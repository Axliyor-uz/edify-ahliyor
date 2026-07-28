// IELTS data layer. Client SDK for teacher/admin authoring and reads; the graded student
// submission path goes through /api/ielts/* (server holds the answer key).
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs,
  orderBy, query, runTransaction, serverTimestamp, setDoc,
  updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { applyUserXp, mirrorLeaderboards, notifyLevelUp } from '@/lib/xp';
import { extractAnswerKey, renumberTest, stripAnswers } from '@/lib/ielts/testSchema';
import type {
  IeltsAssignment, IeltsListeningTest, IeltsReadingTest, IeltsSkill,
  IeltsSpeakingTest, IeltsWritingTest,
} from '@/lib/ielts/types';

const TEST_COLLECTIONS: Record<IeltsSkill, string> = {
  reading: 'ielts_reading_tests',
  listening: 'ielts_listening_tests',
  writing: 'ielts_writing_tests',
  speaking: 'ielts_speaking_tests',
};

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be logged in.');
  return uid;
}

async function idToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be logged in.');
  return user.getIdToken();
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await idToken();
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

// ---------- authoring (reading / listening) ----------

/**
 * Save a reading or listening test with the answer-key split: the public doc gets
 * `answers_split: true` and no correct_answer anywhere; the key goes to ielts_answer_keys.
 * `asPlatform` (admin dataset) writes teacherId: null + source: 'platform'.
 */
export async function saveIeltsTest(
  testData: IeltsReadingTest | IeltsListeningTest,
  opts?: { asPlatform?: boolean },
) {
  const uid = requireUid();
  renumberTest(testData);
  const keys = extractAnswerKey(testData);
  const publicDoc = stripAnswers(testData);
  const skill = testData.module;
  const owner = opts?.asPlatform ? null : uid;

  const testRef = doc(db, TEST_COLLECTIONS[skill], testData.test_id);
  const keyRef = doc(db, 'ielts_answer_keys', testData.test_id);
  const existing = await getDoc(testRef);

  const batch = writeBatch(db);
  batch.set(testRef, {
    ...publicDoc,
    teacherId: owner,
    source: opts?.asPlatform ? 'platform' : 'teacher',
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'published',
  });
  batch.set(keyRef, { testId: testData.test_id, teacherId: owner, skill, keys });
  await batch.commit();
  return { success: true, testId: testData.test_id };
}

/** Legacy alias kept for the existing reading builder import. */
export const saveIeltsReadingTest = (testData: IeltsReadingTest) => saveIeltsTest(testData);

/** Load a test WITH its inline answers for editing (owner/admin only — key doc is teacher-read). */
export async function loadTestForEdit(skill: IeltsSkill, testId: string) {
  const [testSnap, keySnap] = await Promise.all([
    getDoc(doc(db, TEST_COLLECTIONS[skill], testId)),
    getDoc(doc(db, 'ielts_answer_keys', testId)),
  ]);
  if (!testSnap.exists()) throw new Error('Test not found');
  const test = testSnap.data() as IeltsReadingTest | IeltsListeningTest;
  if (keySnap.exists()) {
    const keys = keySnap.data().keys || {};
    const containers = test.module === 'listening'
      ? (test.parts || []).map((p) => p.questions)
      : (test.passages || []).map((p) => p.questions);
    for (const blocks of containers) {
      for (const qb of blocks || []) {
        for (const row of qb.questions || []) {
          const k = keys[String(row.question_number)];
          if (k) row.correct_answer = k.a;
        }
      }
    }
  }
  return test;
}

export async function deleteIeltsTest(skill: IeltsSkill, testId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, TEST_COLLECTIONS[skill], testId));
  batch.delete(doc(db, 'ielts_answer_keys', testId));
  await batch.commit();
}

// ---------- writing / speaking authoring ----------

export async function saveWritingTest(t: Partial<IeltsWritingTest> & { test_id: string }, opts?: { asPlatform?: boolean }) {
  const uid = requireUid();
  const ref = doc(db, 'ielts_writing_tests', t.test_id);
  const existing = await getDoc(ref);
  await setDoc(ref, {
    ...t,
    module: 'writing',
    teacherId: opts?.asPlatform ? null : uid,
    source: opts?.asPlatform ? 'platform' : 'teacher',
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'published',
  });
}

export async function saveSpeakingTest(t: Partial<IeltsSpeakingTest> & { test_id: string }, opts?: { asPlatform?: boolean }) {
  const uid = requireUid();
  const ref = doc(db, 'ielts_speaking_tests', t.test_id);
  const existing = await getDoc(ref);
  await setDoc(ref, {
    ...t,
    module: 'speaking',
    teacherId: opts?.asPlatform ? null : uid,
    source: opts?.asPlatform ? 'platform' : 'teacher',
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'published',
  });
}

// ---------- libraries ----------

export async function fetchTeacherTests(skill: IeltsSkill, teacherId: string) {
  const snap = await getDocs(query(collection(db, TEST_COLLECTIONS[skill]), where('teacherId', '==', teacherId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ({ id: string } & Record<string, unknown>)[];
}

export async function fetchPlatformTests(skill: IeltsSkill) {
  const snap = await getDocs(query(collection(db, TEST_COLLECTIONS[skill]), where('source', '==', 'platform')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ({ id: string } & Record<string, unknown>)[];
}

/** Admin: copy a teacher's test into the platform dataset (test + key). */
export async function promoteTestToPlatform(skill: 'reading' | 'listening' | 'writing' | 'speaking', testId: string) {
  const testSnap = await getDoc(doc(db, TEST_COLLECTIONS[skill], testId));
  if (!testSnap.exists()) throw new Error('Test not found');
  const batch = writeBatch(db);
  batch.set(doc(db, TEST_COLLECTIONS[skill], testId),
    { ...testSnap.data(), teacherId: null, source: 'platform', updatedAt: serverTimestamp() });
  const keySnap = await getDoc(doc(db, 'ielts_answer_keys', testId));
  if (keySnap.exists()) {
    batch.set(doc(db, 'ielts_answer_keys', testId), { ...keySnap.data(), teacherId: null });
  }
  await batch.commit();
}

// ---------- groups: join / requests ----------

export function generateJoinCode(): string {
  return 'I-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

/**
 * 6-char join code (2.2B combinations — collisions practically impossible, and
 * /api/ielts/join returns 409 on the freak duplicate). Deliberately NO uniqueness
 * query: group reads are member/teacher-only now, so a joinCode == query from the
 * creating teacher would be denied by rules.
 */
export async function generateUniqueJoinCode(): Promise<string> {
  return 'I-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function joinGroupByCode(code: string) {
  return api<{ status: 'member' | 'pending' | 'requested'; groupTitle: string }>(
    '/api/ielts/join', { method: 'POST', body: JSON.stringify({ code }) },
  );
}

/** Approve a join request atomically (arrayUnion + request delete in one batch). */
export async function approveJoinRequest(groupId: string, requestId: string, studentId: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'ielts_groups', groupId), { studentIds: arrayUnion(studentId) });
  batch.delete(doc(db, 'ielts_groups', groupId, 'requests', requestId));
  await batch.commit();
}

export async function removeStudentFromGroup(groupId: string, studentId: string) {
  await updateDoc(doc(db, 'ielts_groups', groupId), { studentIds: arrayRemove(studentId) });
}

// ---------- assignments ----------

export async function createAssignment(groupId: string, a: Omit<IeltsAssignment, 'createdAt' | 'status' | 'completedBy'>) {
  const payload: Record<string, unknown> = {
    ...a,
    openAt: a.openAt ?? null,
    dueAt: a.dueAt ?? null,
    createdAt: serverTimestamp(),
    status: 'active',
    completedBy: [],
  };
  const ref = await addDoc(collection(db, 'ielts_groups', groupId, 'assignments'), payload);
  return ref.id;
}

export async function deleteAssignment(groupId: string, assignmentId: string) {
  await deleteDoc(doc(db, 'ielts_groups', groupId, 'assignments', assignmentId));
}

export async function fetchAssignments(groupId: string) {
  const snap = await getDocs(query(
    collection(db, 'ielts_groups', groupId, 'assignments'), orderBy('createdAt', 'desc'),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as IeltsAssignment) }));
}

// ---------- attempts ----------

export interface SubmitPayload {
  kind: 'assignment' | 'practice';
  groupId?: string;
  assignmentId?: string;
  testId: string;
  skill: IeltsSkill;
  mode?: 'simulation' | 'practice';
  answers?: Record<string, string | string[]>;
  writing?: { task1Text: string; task2Text: string };
  speaking?: { part1AudioUrl?: string; part2AudioUrl?: string; part3AudioUrl?: string };
  tabSwitches: number;
  timeSpentSeconds: number;
  startedAt: number;
}

export interface SubmitResult {
  attemptId: string;
  rawScore?: number;
  totalQuestions?: number;
  bandScore?: number;
  typeStats?: Record<string, { correct: number; total: number }>;
  perQuestion?: Record<string, { correct: boolean; type: string }>;
  resultsVisible?: boolean;
  pendingReview?: boolean;
  xpSuggested: number;
}

/** Submit via the server grading boundary, then apply XP client-side (regular-runner pattern). */
export async function submitIeltsAttempt(payload: SubmitPayload): Promise<SubmitResult> {
  const result = await api<SubmitResult>('/api/ielts/submit', {
    method: 'POST', body: JSON.stringify(payload),
  });
  if (result.xpSuggested > 0) {
    try {
      const uid = requireUid();
      const userRef = doc(db, 'users', uid);
      const xpRes = await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef);
        const r = applyUserXp(tx, userRef, userSnap, {
          xp: result.xpSuggested,
          breakdown: [`IELTS ${payload.skill}: +${result.xpSuggested}`],
          activityEntry: {
            type: 'ielts', skill: payload.skill, testId: payload.testId,
            ...(result.bandScore != null ? { band: result.bandScore } : {}),
            date: new Date().toISOString(),
          },
          activityLimit: 5,
        });
        mirrorLeaderboards(tx, uid, r.finalXp, { displayName: r.latestName, avatar: r.latestAvatar }, []);
        return r;
      });
      if (xpRes.leveledUp) notifyLevelUp(uid, xpRes.newLevel);
    } catch (e) {
      console.error('IELTS XP apply failed (attempt already saved):', e);
    }
  }
  return result;
}

export async function fetchReview(attemptId: string) {
  return api<{ attempt: Record<string, unknown>; correctAnswers?: Record<string, string | string[]> }>(
    `/api/ielts/review?attemptId=${encodeURIComponent(attemptId)}`,
  );
}

export async function fetchMyAttempts(userId: string, opts?: { testId?: string; groupId?: string }) {
  const clauses = [where('userId', '==', userId)] as Parameters<typeof query>[1][];
  if (opts?.testId) clauses.push(where('testId', '==', opts.testId));
  if (opts?.groupId) clauses.push(where('groupId', '==', opts.groupId));
  const snap = await getDocs(query(collection(db, 'ielts_attempts'), ...clauses as never[]));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      ((b.submittedAt as { toMillis?: () => number })?.toMillis?.() || 0)
      - ((a.submittedAt as { toMillis?: () => number })?.toMillis?.() || 0));
}

export async function fetchGroupAttempts(groupId: string) {
  const snap = await getDocs(query(collection(db, 'ielts_attempts'), where('groupId', '==', groupId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Teacher grades a writing/speaking attempt. */
export async function gradeWSAttempt(attemptId: string, band: number, comments: string) {
  await updateDoc(doc(db, 'ielts_attempts', attemptId), {
    reviewStatus: 'graded',
    teacherGrade: { band, comments, gradedAt: serverTimestamp() },
  });
}
