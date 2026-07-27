// types/TeacherRaschQuiz.ts
//
// A teacher-built Rasch paper: 45 questions the teacher picked or wrote, opened
// by a private 6-digit code, sat in the student Rasch runner and scored by the
// same ability model as the mock exam. Contract + traps: docs/RASCH_QUIZ.md.
//
// ⚠️ Questions are stored as EMBEDDED SNAPSHOTS, not as refs.
//
// A ref list would mean 45 document reads per student per sitting, plus a read
// rule wide enough to serve them; the snapshot makes the whole paper ONE read no
// matter how many students sit it, and it freezes the question the way
// `custom_tests.questions[]` already does — editing a source question later can
// never re-key a paper somebody has already answered. The cost is that a fixed
// paper does not pick up a correction; that is the intended trade (see the doc).

import type { Lang } from './Math';
import type { ExamQuestion } from './Exam';
import type { TopicKey } from '@/lib/RASCHtopics';
import type { TopicScore } from './RASCH';

/**
 * One stored question.
 *
 * It is an `ExamQuestion` minus the two fields that are POSITION rather than
 * content: `slotNumber` (recomputed on load, because a `shared_options` block
 * occupies several slots and reordering the paper moves every number after it)
 * and `sectionLabel` (a trilingual label that would be repeated 45 times — it is
 * rehydrated from `sectionId` through EXAM_BLUEPRINT, which is bundled).
 */
export type RaschQuizItem = Omit<ExamQuestion, 'slotNumber' | 'sectionLabel'>;

/** Where a question came from — the builder tab that added it. */
export type QuizItemOrigin = 'bank' | 'teacher';

export type RaschQuizStatus = 'draft' | 'published' | 'closed';

export interface TeacherRaschQuiz {
  id: string;
  title: string;
  description: string;

  teacherId: string;
  teacherName: string;

  /**
   * SIX DIGITS, e.g. `"482913"`. Digits only, so it can be typed on a phone
   * number pad and read aloud without the letter/number ambiguity that makes
   * `custom_tests.accessCode` (an alphanumeric 6) awkward over a classroom.
   * Uniqueness is checked at generation time — see the service — but the check is
   * a query, not a constraint, so a race can still collide. The lookup takes the
   * FIRST published match.
   */
  accessCode: string;

  /** The paper, in the order the student sees it (before optional shuffling). */
  questions: RaschQuizItem[];
  /** Exam SLOTS, not cards — a `shared_options` block is worth one per part. */
  questionCount: number;

  /** 0 is not allowed: a Rasch paper is sat against a clock. */
  durationMinutes: number;
  /** Shuffle the question order per student. Blocks stay intact either way. */
  shuffle: boolean;
  /** Reveal the correct answers + explanations on the results screen. */
  showAnswers: boolean;

  status: RaschQuizStatus;

  /** Firestore serverTimestamp. */
  createdAt: unknown | null;
  updatedAt: unknown | null;
}

/** What the builder holds before it is written (no id, no timestamps). */
export type RaschQuizDraft = Omit<TeacherRaschQuiz, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * One student's sitting — `teacher_rasch_results/{quizId}_{uid}`.
 *
 * The id is deterministic so a retake OVERWRITES rather than accumulating, the
 * same rule `attempts/{uid}_{assignmentId}` follows. `teacherId` is denormalized
 * because the read rule proves ownership off it (a teacher lists their own
 * results with `where('teacherId','==',uid)`).
 */
export interface RaschQuizResult {
  quizId: string;
  quizTitle: string;
  teacherId: string;

  studentId: string;
  studentName: string;

  /** Slots correct / slots on the paper. Not cards — see `questionCount`. */
  correct: number;
  total: number;
  percent: number;
  durationSec: number;
  /** Epoch ms — matches every other RASCH timestamp (see docs/DATA_MODEL.md). */
  submittedAt: number;

  /** The question language the student sat it in. */
  examLang: Lang;
  /** Per-dimension breakdown, so the teacher sees WHERE it went wrong. */
  topics: Record<TopicKey, TopicScore>;
  /** Ability measured from this paper alone, in logits. */
  theta: number | null;
}

/** Blueprint coverage of a paper under construction, per dimension. */
export type QuizTopicCounts = Partial<Record<TopicKey, number>>;
