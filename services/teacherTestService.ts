import {
  collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where,
  type QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Read-only access to a teacher's own `custom_tests` (docs/TEACHER.md) for
 * consumers that only PLAY a test — currently the classroom games
 * (docs/GAMES.md). Same query shape as /teacher/library/tests, so it rides
 * the existing `teacherId + status + createdAt` index.
 *
 * Questions come back RAW (frozen snapshots, legacy or v1); callers run them
 * through `normalizeQuestions` themselves.
 */

export interface TeacherTestSummary {
  id: string;
  title: string;
  rawQuestions: unknown[];
  questionCount: number;
  createdAt: unknown;
}

const toSummary = (id: string, data: DocumentData): TeacherTestSummary => {
  const rawQuestions: unknown[] = Array.isArray(data.questions) ? data.questions : [];
  return {
    id,
    title: typeof data.title === 'string' && data.title.trim() ? data.title : '—',
    rawQuestions,
    questionCount: typeof data.questionCount === 'number' ? data.questionCount : rawQuestions.length,
    createdAt: data.createdAt ?? null,
  };
};

export async function fetchActiveTeacherTests(
  uid: string,
  pageSize: number,
  cursor?: QueryDocumentSnapshot | null,
): Promise<{ tests: TeacherTestSummary[]; cursor: QueryDocumentSnapshot | null; hasMore: boolean }> {
  let q = query(
    collection(db, 'custom_tests'),
    where('teacherId', '==', uid),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );
  if (cursor) q = query(q, startAfter(cursor));
  const snap = await getDocs(q);
  return {
    tests: snap.docs.map((d) => toSummary(d.id, d.data())),
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

/** One test by id — only returned when it belongs to `uid`. */
export async function fetchTeacherTest(id: string, uid: string): Promise<TeacherTestSummary | null> {
  const snap = await getDoc(doc(db, 'custom_tests', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.teacherId !== uid) return null;
  return toSummary(snap.id, data);
}
