// lib/Examsession.ts
import type { ExamQuestion, ExamSnapshot } from '@/types/Exam';

/**
 * The exam, kept in the browser.
 *
 * Building an exam costs 45 Firestore reads; resuming one costs zero. The whole
 * paper — questions, answers, flags, deadline — is written to localStorage, so
 * a refresh, a closed tab, or a return trip restores the exact same 45
 * questions without touching the network. Firestore is queried once per exam,
 * and only when the student explicitly starts a new one.
 *
 * Exposed as an external store (subscribe / getExamSnapshot) so the page can
 * read it through useSyncExternalStore: that hands the server a null snapshot
 * and the browser the real one, restoring state without a setState-in-effect
 * and without a hydration mismatch.
 */

const KEY = 'RASCHmodel:exam:v1';
const VERSION = 1;

/** Outlives the 150-minute exam with room to spare, without hoarding forever. */
const TTL_MS = 6 * 60 * 60 * 1000;

const listeners = new Set<() => void>();

// getExamSnapshot() runs on every render, and useSyncExternalStore requires a
// stable reference, so the parse is memoised against the raw string.
let cachedRaw: string | null = null;
let cachedValue: ExamSnapshot | null = null;

function emit() {
  for (const listener of listeners) listener();
}

/**
 * `solutions[].steps` is by far the biggest field on a question doc, and
 * nothing in the exam UI renders it — only `final_answer`, which grades the
 * open (O) answers. Dropping the rest keeps a 45-question paper comfortably
 * inside the localStorage quota.
 */
function slim(q: ExamQuestion): ExamQuestion {
  const finalAnswer = q.solutions?.[0]?.final_answer;
  return {
    ...q,
    solutions: finalAnswer ? [{ final_answer: finalAnswer, method: '', steps: [] }] : [],
    tags: [],
    language: [],
  };
}

function parse(raw: string | null): ExamSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ExamSnapshot;
    if (parsed.version !== VERSION || !parsed.questions?.length) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function subscribeExamSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The stored exam, or null if there is none / it is stale or unusable. */
export function getExamSnapshot(): ExamSnapshot | null {
  if (typeof window === 'undefined') return null;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null; // private mode — behave as if nothing was stored
  }

  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = parse(raw);
  return cachedValue;
}

/** Server render has no localStorage — always start from "no exam stored". */
export function getServerExamSnapshot(): ExamSnapshot | null {
  return null;
}

export function saveExamSnapshot(snapshot: Omit<ExamSnapshot, 'version' | 'savedAt'>): void {
  if (typeof window === 'undefined') return;

  const payload: ExamSnapshot = {
    ...snapshot,
    questions: snapshot.questions.map(slim),
    version: VERSION,
    savedAt: Date.now(),
  };

  try {
    const raw = JSON.stringify(payload);
    window.localStorage.setItem(KEY, raw);
    cachedRaw = raw;
    cachedValue = payload;
    emit();
  } catch {
    // Private mode or quota exceeded — the exam still works in memory, it just
    // won't survive a reload. Never break the paper over a storage failure.
  }
}

export function clearExamSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  cachedRaw = null;
  cachedValue = null;
  emit();
}
