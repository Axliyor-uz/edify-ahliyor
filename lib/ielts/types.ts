// IELTS platform types — the real, wired model (replaces the dead types in types/ielts.ts).
// Shapes mirror what the reading builder already writes; additive-only for Android sync.

export type IeltsSkill = 'reading' | 'listening' | 'writing' | 'speaking';
export type IeltsTestCategory = 'academic' | 'general';
export type IeltsMode = 'simulation' | 'practice';
export type IeltsResultsVisibility = 'always' | 'after_due' | 'never';

export const IELTS_QUESTION_TYPES = [
  'matching_headings',
  'true_false_not_given',
  'multiple_choice',
  'summary_completion',
  'matching_paragraph_information',
  'list_selection',
  'matching_features',
  'sentence_completion',
  'matching_sentence_endings',
  'short_answer',
  'table_completion',
  'flowchart_completion',
  'diagram_completion',
] as const;
export type IeltsQuestionType = (typeof IELTS_QUESTION_TYPES)[number];

export interface IeltsTextBlock {
  type: 'text';
  label: string;
  content: string;
}

// Rows vary by type — the builder's shapes, kept loose where the builder is loose.
export interface IeltsQuestionRow {
  question_number: number;
  correct_answer?: string | string[]; // stripped from public docs (answers_split)
  statement?: string;
  question_text?: string;
  sentence?: string;
  sentence_start?: string;
  target_paragraph?: string;
  passage_reference?: string;
  explanation?: string;
  options?: { id: string; text: string }[];
}

export interface IeltsQuestionBlock {
  type: IeltsQuestionType;
  instructions: string;
  start_question: number;
  end_question: number;
  questions: IeltsQuestionRow[];
  options?: { id: string; text: string }[] | string[] | { label: string; description: string }[] | null;
  word_limit?: number;
  summary_title?: string;
  summary_text?: string;
  table_title?: string;
  headers?: string[];
  rows?: { cells: string[] }[];
  flowchart_title?: string;
  steps?: string[];
  diagram_title?: string;
  diagram_url?: string;
  diagram_alt_text?: string;
}

export interface IeltsPassage {
  id: string;
  module: 'reading';
  passage_number: number;
  title: string;
  subtitle: string;
  instruction: string;
  word_count: number;
  difficulty: 'easy' | 'medium' | 'hard';
  blocks: IeltsTextBlock[];
  questions: IeltsQuestionBlock[];
}

export interface IeltsListeningPart {
  part_number: number; // 1..4
  audio_url: string;
  audio_duration_seconds?: number;
  transcript?: string;
  questions: IeltsQuestionBlock[];
}

interface IeltsTestBase {
  test_id: string;
  test_title: string;
  total_time_minutes: number;
  total_questions: number;
  teacherId: string | null; // null for platform tests
  source?: 'teacher' | 'platform';
  test_category?: IeltsTestCategory; // reading band table selection (default 'academic')
  answers_split?: boolean; // true => doc holds no correct_answer; key in ielts_answer_keys
  status: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface IeltsReadingTest extends IeltsTestBase {
  module: 'reading';
  passages: IeltsPassage[];
}

export interface IeltsListeningTest extends IeltsTestBase {
  module: 'listening';
  parts: IeltsListeningPart[];
}

export interface IeltsWritingTest extends IeltsTestBase {
  module: 'writing';
  task1: { prompt: string; imageUrl?: string; modelAnswer?: string };
  task2: { prompt: string; modelAnswer?: string };
}

export interface IeltsSpeakingTest extends IeltsTestBase {
  module: 'speaking';
  part1Questions: string[];
  part2CueCard: { topic: string; bullets: string[] };
  part3Questions: string[];
}

export type IeltsTest = IeltsReadingTest | IeltsListeningTest | IeltsWritingTest | IeltsSpeakingTest;

// ielts_answer_keys/{testId}
export interface IeltsKeyEntry {
  t: IeltsQuestionType;
  a: string | string[]; // letter(s) or accepted text alternates ("taxi/cab", "(the) library")
  wl?: number; // word limit
  span?: number; // list_selection: how many question numbers this entry covers
}
export interface IeltsAnswerKeyDoc {
  testId: string;
  teacherId: string | null;
  skill: 'reading' | 'listening';
  keys: Record<string, IeltsKeyEntry>;
}

// ielts_groups/{groupId}/assignments/{assignmentId}
export interface IeltsAssignment {
  testId: string;
  skill: IeltsSkill;
  testTitle: string;
  questionCount: number;
  totalTimeMinutes: number;
  mode: IeltsMode;
  openAt: unknown | null;
  dueAt: unknown | null;
  allowedAttempts: number;
  resultsVisibility: IeltsResultsVisibility;
  assignedTo: 'all' | string[];
  teacherId: string;
  createdAt: unknown;
  status: 'active';
  completedBy: string[];
}

export interface IeltsPerQuestionResult {
  correct: boolean;
  type: string;
}

// ielts_attempts — server-written only.
// Assignment attempts: deterministic id `${uid}_${groupId}_${assignmentId}`.
// Practice attempts: auto id, kind 'practice', unlimited history.
export interface IeltsAttempt {
  userId: string;
  userName: string;
  kind: 'assignment' | 'practice';
  groupId?: string;
  assignmentId?: string;
  testId: string;
  skill: IeltsSkill;
  mode: IeltsMode;
  answers: Record<string, string | string[]>;
  rawScore?: number;
  totalQuestions?: number;
  bandScore?: number;
  perQuestion?: Record<string, IeltsPerQuestionResult>;
  typeStats?: Record<string, { correct: number; total: number }>;
  // writing/speaking
  writing?: { task1Text: string; task2Text: string; task1Words: number; task2Words: number };
  speaking?: { part1AudioUrl?: string; part2AudioUrl?: string; part3AudioUrl?: string };
  reviewStatus?: 'pending_review' | 'graded';
  teacherGrade?: { band: number; comments: string; gradedAt: unknown };
  tabSwitches: number;
  timeSpentSeconds: number;
  attemptsTaken?: number;
  xpEarned?: number;
  startedAt: unknown;
  submittedAt: unknown;
}
