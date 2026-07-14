// types/Exam.ts
import type { TopicKey } from '@/lib/RASCHtopics';
import type { DifficultyId, Lang, QuestionDoc } from './Math';

/**
 * Milliy sertifikat question formats.
 *   Y-1 — closed, single correct answer (basic)
 *   Y-2 — closed, single correct answer (harder / multi-step)
 *   O   — open-ended equivalent (hardest)
 *
 * These are a property of the *blueprint slot*, not of a question: no doc in
 * questions1 carries a `testType` field, so we approximate the format with a
 * difficulty band instead (see DIFFICULTY_BAND in lib/Examblueprint.ts).
 */
export type TestType = 'Y-1' | 'Y-2' | 'O';

/** One chapter of the question bank, addressed the way questions1 stores it. */
export interface ChapterRef {
  /** "1" = Algebra, "2" = Geometriya. Unpadded, as stored. */
  topicId: string;
  /** "01".."18", zero-padded to 2 chars, as stored. */
  chapterId: string;
}

/** One row of the exam blueprint = one DTM section at one test type. */
export interface BlueprintSection {
  /** Stable key — groups results and doubles as the React key. */
  id: string;
  /** The topic the student is levelled on. Several sections share one topic —
   *  Geometriya is drawn at Y-1, Y-2 and O — and their scores pool together. */
  topic: TopicKey;
  label: Record<Lang, string>;
  testType: TestType;
  count: number;
  /** The questions1 chapters this section draws from. */
  pools: ChapterRef[];
  /** Overrides DIFFICULTY_BAND[testType] for sections that need their own band. */
  difficulties?: DifficultyId[];
}

/** A question bound to its position in the exam. */
export interface ExamQuestion extends QuestionDoc {
  slotNumber: number;
  sectionId: string;
  sectionLabel: Record<Lang, string>;
  testType: TestType;
}

export interface Shortfall {
  sectionId: string;
  label: Record<Lang, string>;
  testType: TestType;
  requested: number;
  received: number;
}

export interface BuildExamResult {
  questions: ExamQuestion[];
  shortfalls: Shortfall[];
  /** Documents Firestore actually returned — what the build was billed. */
  docsRead: number;
}

/**
 * A whole exam sitting in the browser: the paper itself plus the student's
 * progress. Persisted by lib/Examsession.ts so a reload, a closed tab, or a
 * revisit resumes the same paper without re-reading a single document.
 */
export interface ExamSnapshot {
  version: number;
  /** Chosen on the intro screen — NOT the app UI language. */
  examLang: Lang;
  questions: ExamQuestion[];
  shortfalls: Shortfall[];
  answers: Record<string, string>;
  flagged: string[];
  current: number;
  /** Epoch ms. The clock keeps running while the tab is closed. */
  endsAt: number;
  savedAt: number;
  submitted: boolean;
  autoSubmitted: boolean;
  docsRead: number;
  /** Result already written to the student's account — never write it twice. */
  saved?: boolean;
  /** Seconds spent per question id — persisted, so a reload keeps the timings
   *  the guess/gap/fragile diagnosis is built from. */
  seconds?: Record<string, number>;
}
