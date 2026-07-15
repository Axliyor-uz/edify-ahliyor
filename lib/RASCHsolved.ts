// lib/RASCHsolved.ts
import { EXAM_BLUEPRINT } from './Examblueprint';
import { TOPIC_KEYS, type TopicKey } from './RASCHtopics';
import { examChosen } from './ExamTeacher';
import type { ExamQuestion } from '@/types/Exam';
import type { Lang, LocalizedText, OptionKey } from '@/types/Math';

/**
 * The questions the student has actually solved, archived per topic in the
 * browser.
 *
 * Firestore is deliberately NOT involved. RASCH_attempts only records per-topic
 * totals — it has no per-question detail — so rebuilding "the problems I solved
 * in Geometriya" from the server would mean re-reading the question documents
 * (~45 per exam) every time the page is opened. Archiving them locally at
 * submission costs zero reads and zero writes.
 *
 * The trade-off, stated plainly: this history is per-device. Sign in on another
 * phone and the levels follow you (they live in RASCH_levels), but this list
 * starts empty. Making it follow the account means writing the questions into
 * the attempt document — a much bigger write, per exam — which is the opposite
 * of what we were asked for.
 */

const KEY = 'RASCHmodel:solved:v1';
const VERSION = 1;

/** Per topic. Twenty questions is a few exams' worth — enough to review, small
 *  enough that seven topics never threaten the localStorage quota. */
const CAP_PER_TOPIC = 20;

export interface SolvedQuestion {
  id: string;
  /** Epoch ms of the exam this came from. */
  examAt: number;
  chapter: string;
  subtopic: string;
  testType: string;
  question: LocalizedText;
  /** Shared block statement, shown above the question (shared_options items). */
  stem?: LocalizedText | null;
  options: Record<OptionKey, LocalizedText>;
  answer: OptionKey;
  /** Prompt image (teacher_questions items only). */
  imageUrl?: string | null;
  explanation: LocalizedText;
  /** Plain-text answer for open (O) questions; undefined for closed ones. */
  expected?: string;
  /** What the student put down — an option key, or typed text for O. */
  given: string;
  correct: boolean;
  /** Question language at the time it was sat. */
  lang: Lang;
  /** Author of the question (teacher_questions items) — shown in review too. */
  creatorName?: string;
  /** Corrector's display name, if it was ever edited. */
  correctedBy?: string;
}

interface Archive {
  version: number;
  byTopic: Record<string, SolvedQuestion[]>;
}

const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedValue: Archive | null = null;

const EMPTY: Archive = { version: VERSION, byTopic: {} };

// localStorage is shared by every account on one browser, so the archive is
// namespaced per account — otherwise the "questions I solved" review shows
// student A's history to student B. The active account is set by each consuming
// page (setSolvedUser); '' is the signed-out bucket.
let activeUid = '';
const keyFor = (uid: string) => `${KEY}:${uid || 'anon'}`;

function emit() {
  for (const listener of listeners) listener();
}

/** Point the archive at the signed-in student. Call before reading or writing.
 *  Switching accounts drops the cache and notifies subscribers to re-read. */
export function setSolvedUser(uid: string | null | undefined): void {
  const u = uid || '';
  if (u === activeUid) return;
  activeUid = u;
  cachedRaw = null;
  cachedValue = null;
  emit();
}

export function subscribeSolved(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable reference across renders — useSyncExternalStore requires it. */
export function getSolvedArchive(): Archive {
  if (typeof window === 'undefined') return EMPTY;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(keyFor(activeUid));
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw && cachedValue) return cachedValue;

  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Archive) : EMPTY;
    cachedValue = parsed.version === VERSION && parsed.byTopic ? parsed : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

export function getServerSolvedArchive(): Archive {
  return EMPTY;
}

/** Newest first — the most recent attempt at a topic is what you want to review. */
export function solvedForTopic(topic: TopicKey): SolvedQuestion[] {
  return [...(getSolvedArchive().byTopic[topic] ?? [])].reverse();
}

export function solvedCounts(): Record<TopicKey, { solved: number; correct: number }> {
  const archive = getSolvedArchive();
  const out = {} as Record<TopicKey, { solved: number; correct: number }>;
  for (const key of TOPIC_KEYS) {
    const list = archive.byTopic[key] ?? [];
    out[key] = {
      solved: list.length,
      correct: list.filter((q) => q.correct).length,
    };
  }
  return out;
}

/**
 * Files one finished exam's questions under the topics they belong to.
 *
 * Called once per exam, alongside the Firestore save. Purely local, so it also
 * works for a signed-out student.
 */
export function archiveExam(params: {
  questions: ExamQuestion[];
  answers: Record<string, string>;
  isCorrect: (q: ExamQuestion) => boolean;
  expectedFor: (q: ExamQuestion) => string | undefined;
  lang: Lang;
  at: number;
}): void {
  if (typeof window === 'undefined') return;

  const sectionTopic = new Map(EXAM_BLUEPRINT.map((s) => [s.id, s.topic]));
  const archive = getSolvedArchive();
  const byTopic: Record<string, SolvedQuestion[]> = { ...archive.byTopic };

  for (const q of params.questions) {
    const topic = sectionTopic.get(q.sectionId);
    if (!topic) continue;

    const entry: SolvedQuestion = {
      id: q.id,
      examAt: params.at,
      chapter: q.chapter,
      subtopic: q.subtopic,
      testType: q.testType,
      question: q.question,
      ...(q.stem ? { stem: q.stem } : {}),
      options: q.options,
      answer: q.answer,
      ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}),
      explanation: q.explanation,
      expected: params.expectedFor(q),
      // A block's answer lives under per-part keys — examChosen collapses them.
      given: examChosen(q, params.answers),
      correct: params.isCorrect(q),
      lang: params.lang,
      ...(q.creatorName ? { creatorName: q.creatorName } : {}),
      ...(q.correctedBy ? { correctedBy: q.correctedBy } : {}),
    };

    // Re-solving the same question replaces the old record rather than
    // duplicating it — the list is "how I did on this question", latest wins.
    const existing = (byTopic[topic] ?? []).filter((e) => e.id !== entry.id);
    byTopic[topic] = [...existing, entry].slice(-CAP_PER_TOPIC);
  }

  const next: Archive = { version: VERSION, byTopic };
  try {
    const raw = JSON.stringify(next);
    window.localStorage.setItem(keyFor(activeUid), raw);
    cachedRaw = raw;
    cachedValue = next;
    emit();
  } catch {
    // Quota exceeded — the exam and the levels are unaffected; only this
    // review archive is lost. Never break a submission over it.
  }
}

export function clearSolvedArchive(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyFor(activeUid));
  } catch {
    // ignore
  }
  cachedRaw = null;
  cachedValue = null;
  emit();
}
