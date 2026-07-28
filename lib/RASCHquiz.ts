// lib/RASCHquiz.ts
//
// The pure layer of the teacher-built Rasch paper (docs/RASCH_QUIZ.md): turning a
// picked question into a stored quiz item, turning a stored quiz back into the
// exam items the runner renders, and the arithmetic the builder shows.
//
// No Firestore here — the service (services/teacherRaschQuizService.ts) owns
// every read and write, this file owns every rule. That split is what lets the
// builder recompute the blueprint picture on each keystroke for free.

import { EXAM_BLUEPRINT, sectionForChapter } from './Examblueprint';
import { examSlotCount, toExamItem, type ExamSlotMeta } from './ExamTeacher';
import { TOPIC_KEYS, type TopicKey } from './RASCHtopics';
import { isTextType } from '@/types/question';
import type { NormalizedQuestion } from '@/types/question';
import type { ExamQuestion, TestType } from '@/types/Exam';
import type { DifficultyId, Lang, QuestionDoc } from '@/types/Math';
import type { QuizTopicCounts, RaschQuizItem } from '@/types/TeacherRaschQuiz';

/**
 * A teacher paper is exactly 45 slots — the length of the Milliy sertifikat
 * paper, and the reason its result can go on the same chart and move the same
 * levels as a mock exam. A shorter paper measures a narrower slice of the seven
 * dimensions, so the builder refuses to PUBLISH below this (a draft may be any
 * length while it is being assembled).
 */
export const RASCH_QUIZ_TOTAL = 45;

/** Default clock. The teacher may change it; 0 is not offered. */
export const RASCH_QUIZ_DEFAULT_MINUTES = 150;

// ─── the access code ─────────────────────────────────────────────────────────

export const ACCESS_CODE_LENGTH = 6;

/** Six digits. Never starts a run of leading zeros being trimmed — it is a
 *  STRING everywhere, never parsed to a number. */
export function newAccessCode(): string {
  let code = '';
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) code += Math.floor(Math.random() * 10);
  return code;
}

/** Digits only, exactly six. Used by both the builder and the student's input. */
export function isValidAccessCode(code: string): boolean {
  return new RegExp(`^\\d{${ACCESS_CODE_LENGTH}}$`).test(code);
}

/** Keeps only digits and clamps the length — for an onChange handler. */
export function sanitizeAccessCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, ACCESS_CODE_LENGTH);
}

// ─── picking a question → a stored quiz item ─────────────────────────────────

/**
 * The test type a hand-picked question is filed under.
 *
 * On the mock exam the test type comes from the blueprint ROW being filled. A
 * teacher picks questions one at a time, so it is derived from the question:
 *
 *   • a typed teacher item (open / numeric) → `O`  — it is answered by typing;
 *   • anything hard (difficultyId 3+)        → `Y-2`;
 *   • everything else                        → `Y-1`.
 *
 * ⚠️ A `questions1` item is NEVER filed as `O`. `examMode()` reads the test type
 * for a bank item (a teacher item goes by its own `qType`), so an `O` would hide
 * the A–D options the teacher picked the question FOR and demand a typed answer
 * graded against `solutions[].final_answer` the teacher never saw.
 */
function testTypeFor(params: { source: 'bank' | 'teacher'; difficultyId: number; typed: boolean }): TestType {
  if (params.source === 'teacher' && params.typed) return 'O';
  return params.difficultyId >= 3 ? 'Y-2' : 'Y-1';
}

/** The section a question belongs to, from the chapter it already carries. */
function slotMeta(topicId: string, chapterId: string, testType: TestType): ExamSlotMeta {
  const section = sectionForChapter(topicId, chapterId);
  return { sectionId: section.id, sectionLabel: section.label, testType };
}

/**
 * A `questions1` document → a quiz item.
 *
 * The bank doc IS the legacy shape every ExamQuestion extends, so this is the
 * blueprint fields plus `source: 'bank'` — no normalization, no bridging.
 */
export function bankQuizItem(q: QuestionDoc): RaschQuizItem {
  const testType = testTypeFor({ source: 'bank', difficultyId: q.difficultyId, typed: false });
  const { sectionId } = slotMeta(q.topicId, q.chapterId, testType);
  return { ...q, sectionId, testType, source: 'bank' };
}

/**
 * A `teacher_questions` document → a quiz item.
 *
 * Runs through the SAME `toExamItem` the mock exam's teacher slots use, so
 * images, `shared_options` / `multi_part` blocks and the question_topics →
 * questions1 taxonomy bridge all behave identically on a hand-built paper.
 */
export function teacherQuizItem(n: NormalizedQuestion): RaschQuizItem {
  const typed = !n.isBlock && isTextType(n.type);
  // The bridge lives inside toExamItem, so the section can only be resolved from
  // the ids it produces — build the item first with a placeholder, then re-file
  // it. Cheap: it is a pure object build, not a read.
  const probe = toExamItem(n, { sectionId: '', sectionLabel: { uz: '', ru: '', en: '' }, testType: 'Y-1' });
  const testType = testTypeFor({ source: 'teacher', difficultyId: probe.difficultyId, typed });
  const { sectionId } = slotMeta(probe.topicId, probe.chapterId, testType);

  return stripPosition({ ...probe, sectionId, testType });
}

/** Drops the two POSITION fields — both are recomputed by `hydrateQuiz`. */
function stripPosition(q: ExamQuestion): RaschQuizItem {
  const item = { ...q } as Partial<ExamQuestion>;
  delete item.slotNumber;
  delete item.sectionLabel;
  return item as RaschQuizItem;
}

/**
 * Strips what nothing renders, before the item is written into the quiz doc.
 *
 * A Firestore document is capped at 1 MiB and this one holds 45 questions.
 * `solutions[].steps` is by far the biggest field on a bank doc and the runner
 * only ever reads `final_answer` (which grades an open item), so the steps go —
 * exactly what the localStorage snapshot already does for the same reason.
 */
export function slimQuizItem(q: RaschQuizItem): RaschQuizItem {
  const finalAnswer = q.solutions?.[0]?.final_answer;
  return {
    ...q,
    solutions: finalAnswer ? [{ final_answer: finalAnswer, method: '', steps: [] }] : [],
    tags: [],
    language: [],
  };
}

/**
 * Rough serialized size of a paper, in bytes.
 *
 * The builder shows it and the service refuses to write past the ceiling. A
 * 1 MiB write that fails at question 45 after an hour of picking is the single
 * worst failure this feature can have, so it is surfaced while there is still
 * something the teacher can do about it.
 */
export function quizByteSize(items: RaschQuizItem[]): number {
  return new Blob([JSON.stringify(items)]).size;
}

/** Firestore's hard document limit is 1 MiB; leave room for the rest of the doc. */
export const QUIZ_MAX_BYTES = 900_000;

// ─── a stored quiz → the paper the runner renders ────────────────────────────

/**
 * Stamps slot numbers and rehydrates the trilingual section labels.
 *
 * Slot numbers are NOT stored: a `shared_options` block occupies one slot per
 * sub-question, so inserting or reordering a single question renumbers every
 * question after it. Deriving them on load means the stored array is the only
 * thing that has to be right.
 */
export function hydrateQuiz(items: RaschQuizItem[]): ExamQuestion[] {
  const labels = new Map(EXAM_BLUEPRINT.map((s) => [s.id, s.label]));
  const fallback = EXAM_BLUEPRINT[0].label;

  let nextSlot = 1;
  return items.map((item) => {
    const q: ExamQuestion = {
      ...item,
      slotNumber: nextSlot,
      sectionLabel: labels.get(item.sectionId) ?? fallback,
    };
    nextSlot += examSlotCount(q);
    return q;
  });
}

/** Exam SLOTS on a paper — a `shared_options` block counts once per part. */
export function quizSlotCount(items: RaschQuizItem[]): number {
  return hydrateQuiz(items).reduce((sum, q) => sum + examSlotCount(q), 0);
}

/** `sectionId` → levelling dimension. Built once; the blueprint is a constant. */
const SECTION_TOPIC: Map<string, TopicKey> = new Map(EXAM_BLUEPRINT.map((s) => [s.id, s.topic]));

/** Slots per dimension, for the builder's coverage panel. */
export function quizTopicCounts(items: RaschQuizItem[]): QuizTopicCounts {
  const counts: QuizTopicCounts = {};
  for (const q of hydrateQuiz(items)) {
    const topic = SECTION_TOPIC.get(q.sectionId);
    if (!topic) continue;
    counts[topic] = (counts[topic] ?? 0) + examSlotCount(q);
  }
  return counts;
}

/** The dimension one stored item is filed under. `null` = an unknown `sectionId`. */
export function quizItemTopic(item: RaschQuizItem): TopicKey | null {
  return SECTION_TOPIC.get(item.sectionId) ?? null;
}

/**
 * The dimension a `questions1` chapter would count against — what the bank
 * picker's chapter dropdown shows the quota for, BEFORE anything is read.
 *
 * Goes through `sectionForChapter`, the same resolver `bankQuizItem` uses, so
 * the number on the dropdown is the number the pick will actually move.
 */
export function topicForQuizChapter(topicId: string, chapterId: string): TopicKey | null {
  return SECTION_TOPIC.get(sectionForChapter(topicId, chapterId).id) ?? null;
}

/**
 * Slots ONE item costs. A stored item carries no position (both fields are
 * derived by `hydrateQuiz`), so they are stubbed in just for the count.
 */
export function quizItemSlots(item: RaschQuizItem): number {
  return examSlotCount({ ...item, slotNumber: 0, sectionLabel: { uz: '', ru: '', en: '' } });
}

/** Slots per difficulty grade (1 easy / 2 medium / 3 hard), for the same panel. */
export function quizDifficultyCounts(items: RaschQuizItem[]): Record<DifficultyId, number> {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<DifficultyId, number>;
  for (const q of hydrateQuiz(items)) {
    counts[q.difficultyId] = (counts[q.difficultyId] ?? 0) + examSlotCount(q);
  }
  return counts;
}

/**
 * How the mock exam's 45 slots are shared out — and, since a teacher paper is
 * scored into the SAME seven dimensions on the SAME 0–5 scale, the quota each
 * dimension must hit exactly. It is not advisory: a geometry-only paper would
 * report six dimensions it never measured and one measured to death, and the
 * levels it writes are the student's real ones.
 *
 * ⚠️ These sum to `RASCH_QUIZ_TOTAL`, which is what makes "45 slots" and "every
 * quota exactly met" the same statement. Changing the blueprint changes both.
 */
export const BLUEPRINT_TOPIC_TARGET: Record<TopicKey, number> = (() => {
  const target = {} as Record<TopicKey, number>;
  for (const key of TOPIC_KEYS) target[key] = 0;
  for (const section of EXAM_BLUEPRINT) target[section.topic] += section.count;
  return target;
})();

/** Why an add was refused — the builder turns each into its own message. */
export type QuizAddCheck =
  | { ok: true; slots: number }
  | { ok: false; reason: 'duplicate' }
  | { ok: false; reason: 'full'; slots: number }
  | { ok: false; reason: 'topicFull'; slots: number; topic: TopicKey; have: number; want: number };

/**
 * May this item join the paper?
 *
 * ⚠️ **A block is added whole or not at all.** A `shared_options` block occupies
 * one slot per sub-question, so a block that would overshoot its dimension's
 * quota is refused entirely — truncating it would break the shared pool it is
 * printed with.
 *
 * An item whose `sectionId` is not in the blueprint has no quota to check
 * against and is judged on the 45-slot total alone; `sectionForChapter` makes
 * that unreachable from either picker, and `toItemResponses` would file it under
 * the wrong dimension anyway (see docs/RASCH_QUIZ.md).
 */
export function checkQuizAdd(items: RaschQuizItem[], item: RaschQuizItem): QuizAddCheck {
  if (items.some((q) => q.id === item.id)) return { ok: false, reason: 'duplicate' };

  const slots = quizItemSlots(item);
  if (quizSlotCount(items) + slots > RASCH_QUIZ_TOTAL) return { ok: false, reason: 'full', slots };

  const topic = quizItemTopic(item);
  if (topic) {
    const have = quizTopicCounts(items)[topic] ?? 0;
    const want = BLUEPRINT_TOPIC_TARGET[topic];
    if (have + slots > want) return { ok: false, reason: 'topicFull', slots, topic, have, want };
  }

  return { ok: true, slots };
}

/** Dimensions that are not exactly at quota — empty means the paper is publishable. */
export function quizQuotaGaps(items: RaschQuizItem[]): { topic: TopicKey; have: number; want: number }[] {
  const counts = quizTopicCounts(items);
  return TOPIC_KEYS
    .map((topic) => ({ topic, have: counts[topic] ?? 0, want: BLUEPRINT_TOPIC_TARGET[topic] }))
    .filter((row) => row.have !== row.want);
}

/** Preview text for a builder row — the paper is trilingual, the list is not. */
export function itemPreview(q: RaschQuizItem, lang: Lang, max = 110): string {
  const raw = q.question?.[lang] || q.question?.uz || q.question?.ru || q.question?.en || '';
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** Fisher–Yates over CARDS — a block is never split apart by shuffling. */
export function shuffleItems(items: RaschQuizItem[]): RaschQuizItem[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
