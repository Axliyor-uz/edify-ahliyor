// lib/Examblueprint.ts
import type { BlueprintSection, ChapterRef, TestType } from '@/types/Exam';
import type { TopicKey } from './RASCHtopics';
import type { DifficultyId } from '@/types/Math';

export const EXAM_DURATION_MINUTES = 150;
export const EXAM_TOTAL_QUESTIONS = 45;

/**
 * ── How the DTM blueprint maps onto the question bank ────────────────────────
 *
 * The Milliy sertifikat protocol groups its 45 questions into named sections
 * (Y-1: #1–32, Y-2: #33–40, O: #41–45). Those section names exist nowhere in
 * questions1 — the bank only knows two topics, Algebra (topicId "1") and
 * Geometriya ("2"), each split into chapters, plus a difficultyId of 1|2|3.
 *
 * So every blueprint row below declares the *chapters it draws from* (`pools`),
 * and the test type is approximated by a difficulty band (DIFFICULTY_BAND).
 * To re-map a section, edit its `pools` — nothing else has to move.
 *
 * Chapter ids are from data/syllabus.json and match the bank exactly:
 *   Algebra "1"                          Geometriya "2"
 *   01 Natural va butun sonlar           01 Burchak. Masofa. To'g'ri chiziqlar
 *   02 Butun va ratsional sonlar         02 Uchburchaklar
 *   03 Algebraik ifodalar                03 To'rtburchaklar
 *   04 Haqiqiy sonlar                    04 Aylana va doira
 *   05 Tenglama                          05 Aylana va ko'pburchak
 *   06 Tenglamalar sistemasi             06 Koordinatalar sistemasi
 *   07 Tengsizliklar                     07 Vektorlar
 *   08 Irratsional tenglama va tengsiz.  08 Fazoda to'g'ri chiziq va tekisliklar
 *   09 Progressiya                       09 Ko'p yoqlar
 *   10 Matnli masalalar                  10 Aylanish jismlari
 *   11 Funksiyalar                       11 Jismlar kombinatsiyasi
 *   12 Ko'rsatkichli va logarifmik funksiyalar
 *   13 Trigonometriya
 *   14 Modul
 *   15 Hosila
 *   16 Boshlang'ich funksiya va integral
 *   17 Nostandart masalalar   ← unmapped on purpose: a mixed-bag chapter with
 *                               no DTM section of its own.
 *   18 Kombinatorika. Ehtimollar nazariyasi. To'plam
 */

const A = (chapterId: string): ChapterRef => ({ topicId: '1', chapterId });
const G = (chapterId: string): ChapterRef => ({ topicId: '2', chapterId });

/** The whole Geometriya topic — planimetry + stereometry. */
const GEOMETRY_ALL: ChapterRef[] = [
  G('01'), G('02'), G('03'), G('04'), G('05'), G('06'),
  G('07'), G('08'), G('09'), G('10'), G('11'),
];

/**
 * "Moslashtirishni talab qiladigan" (adaptation-requiring) geometry — the
 * multi-step chapters. Chapter 01 (Burchak. Masofa) is left out: it is the
 * single-step warm-up chapter and holds only ~100 questions.
 */
const GEOMETRY_MULTISTEP: ChapterRef[] = [
  G('02'), G('03'), G('04'), G('05'), G('06'),
  G('07'), G('08'), G('09'), G('10'), G('11'),
];

/**
 * Difficulty band per test type. questions1 grades every question 1 (easy),
 * 2 (medium) or 3 (hard), so the test type picks the grade:
 *
 *   Y-1 → medium   Y-2 → hard   O → hard, and answered open-ended (no options
 *                                  are shown; the student types the answer and
 *                                  lib/Examanswers.ts grades it).
 *
 * Easy (1) is never drawn — it only appears if a band runs dry and the
 * relaxation ladder in Examquestions.ts has to widen.
 */
export const DIFFICULTY_BAND: Record<TestType, DifficultyId[]> = {
  'Y-1': [2],
  'Y-2': [3],
  O: [3],
};

export const EXAM_BLUEPRINT: BlueprintSection[] = [
  // ── Y-1 — questions 1–32 ────────────────────────────────────────────────
  {
    id: 'numbers-y1',
    topic: 'numbers',
    label: { uz: 'Sonlar va amallar', ru: 'Числа и действия', en: 'Numbers and operations' },
    testType: 'Y-1',
    count: 2,
    pools: [A('01'), A('02'), A('04')],
  },
  {
    id: 'algebraic-y1',
    topic: 'algebraic',
    label: {
      uz: 'Algebraik shakl almashtirishlar',
      ru: 'Алгебраические преобразования',
      en: 'Algebraic transformations',
    },
    testType: 'Y-1',
    count: 11,
    pools: [A('03'), A('12'), A('13'), A('14')],
  },
  {
    id: 'equations-y1',
    topic: 'equations',
    label: {
      uz: 'Tenglama va tengsizliklar',
      ru: 'Уравнения и неравенства',
      en: 'Equations and inequalities',
    },
    testType: 'Y-1',
    count: 6,
    pools: [A('05'), A('06'), A('07'), A('08'), A('10')],
  },
  {
    id: 'functions-y1',
    topic: 'functions',
    label: { uz: 'Funksiyalar', ru: 'Функции', en: 'Functions' },
    testType: 'Y-1',
    count: 2,
    pools: [A('11'), A('12')],
  },
  {
    id: 'geometry-y1',
    topic: 'geometry',
    label: { uz: 'Geometriya', ru: 'Геометрия', en: 'Geometry' },
    testType: 'Y-1',
    count: 7,
    pools: GEOMETRY_ALL,
  },
  {
    id: 'analysis-y1',
    topic: 'analysis',
    label: {
      uz: 'Matematik analiz asoslari',
      ru: 'Основы математического анализа',
      en: 'Foundations of calculus',
    },
    testType: 'Y-1',
    count: 2,
    pools: [A('09'), A('15'), A('16')],
  },
  {
    id: 'probability-y1',
    topic: 'probability',
    label: {
      uz: "To'plam, mulohazalar, ma'lumotlar tahlili, kombinatorika, ehtimollar nazariyasi va modellashtirish",
      ru: 'Множества, логика, анализ данных, комбинаторика, теория вероятностей и моделирование',
      en: 'Sets, logic, data analysis, combinatorics, probability and modelling',
    },
    testType: 'Y-1',
    count: 2,
    pools: [A('18')],
  },

  // ── Y-2 + O — questions 33–45, drawn from teacher_questions ─────────────
  // These slots come from the teacher bank (images + blocks), matched to each
  // section's chapters via the question_topics taxonomy. The layout follows the
  // DTM protocol sheet: Y-2 is geometry 33–35, everything from 36 on is O.
  {
    id: 'geometry-y2',
    topic: 'geometry',
    label: {
      uz: 'Geometriya (moslashtirishni talab qiladigan testlar)',
      ru: 'Геометрия (задачи, требующие адаптации)',
      en: 'Geometry (adaptation-requiring items)',
    },
    testType: 'Y-2',
    count: 3,
    pools: GEOMETRY_MULTISTEP,
    source: 'teacher',
  },
  {
    id: 'equations-o',
    topic: 'equations',
    label: {
      uz: 'Tenglama va tengsizliklar',
      ru: 'Уравнения и неравенства',
      en: 'Equations and inequalities',
    },
    testType: 'O',
    count: 2,
    pools: [A('05'), A('06'), A('07'), A('08')],
    source: 'teacher',
  },
  {
    id: 'functions-o',
    topic: 'functions',
    label: { uz: 'Funksiyalar', ru: 'Функции', en: 'Functions' },
    testType: 'O',
    count: 1,
    pools: [A('11'), A('12')],
    source: 'teacher',
  },
  {
    id: 'analysis-o',
    topic: 'analysis',
    label: {
      uz: 'Matematik analiz asoslari',
      ru: 'Основы математического анализа',
      en: 'Foundations of calculus',
    },
    testType: 'O',
    count: 2,
    pools: [A('09'), A('15'), A('16')],
    source: 'teacher',
  },
  {
    id: 'geometry-o',
    topic: 'geometry',
    label: { uz: 'Geometriya', ru: 'Геометрия', en: 'Geometry' },
    testType: 'O',
    count: 4,
    pools: GEOMETRY_MULTISTEP,
    source: 'teacher',
  },
  {
    id: 'probability-o',
    topic: 'probability',
    label: {
      uz: "To'plam, mulohazalar, ma'lumotlar tahlili, kombinatorika, ehtimollar nazariyasi va modellashtirish",
      ru: 'Множества, логика, анализ данных, комбинаторика, теория вероятностей и моделирование',
      en: 'Sets, logic, data analysis, combinatorics, probability and modelling',
    },
    testType: 'O',
    count: 1,
    pools: [A('18')],
    source: 'teacher',
  },
];

/** Groups a section's questions under the topic the student is levelled on. */
export function topicOf(section: BlueprintSection): TopicKey {
  return section.topic;
}

/**
 * Which levelling topic a chapter belongs to, derived from the blueprint pools
 * so there is exactly one source of truth. Targeted practice draws by chapter,
 * not by section, so it has to recover the topic this way.
 *
 * A chapter in two sections (Ko'rsatkichli va logarifmik funksiyalar feeds both
 * "Algebraik shakl almashtirishlar" and "Funksiyalar") resolves to the first —
 * and chapter 17, which no section maps, falls back to 'algebraic'.
 */
export function topicForChapter(topicId: string, chapterId: string): TopicKey {
  const section = EXAM_BLUEPRINT.find((s) =>
    s.pools.some((p) => p.topicId === topicId && p.chapterId === chapterId),
  );
  return section?.topic ?? 'algebraic';
}

/** The difficulty ids a section may draw from. */
export function bandFor(section: BlueprintSection): DifficultyId[] {
  return section.difficulties ?? DIFFICULTY_BAND[section.testType];
}

// EXAM_BLUEPRINT.reduce((s, b) => s + b.count, 0) === EXAM_TOTAL_QUESTIONS (45)
