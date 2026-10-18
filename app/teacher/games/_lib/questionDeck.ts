import { normalizeQuestions, getText, isAnswerCorrect, OPTION_LETTERS } from '@/lib/questionSchema';
import type { NormalizedQuestion } from '@/types/question';
import type { Lang } from '@/types/Math';

/**
 * Turns a test's frozen question snapshots into a game deck (docs/GAMES.md).
 *
 * Only single-answer closed questions (mcq, true_false) can be played by
 * tapping one button; everything else is skipped and counted by reason so
 * the teacher sees exactly why a test is short.
 */

/** Fewer usable questions than this → the game cannot start. */
export const MIN_GAME_QUESTIONS = 6;
/** Rough pace of one answer per team, used for the "lasts ~N min" estimate. */
export const SECONDS_PER_ANSWER = 8;

export type SkipReason = 'open' | 'multi' | 'block' | 'broken';

export interface GameOption {
  /** Original option id — what `isAnswerCorrect` grades against. */
  id: string;
  /** Display letter by POSITION after shuffling (A, B, C…). */
  letter: string;
  text: string;
  imageUrl: string | null;
}

export interface GameQuestion {
  key: string;
  text: string;
  imageUrl: string | null;
  options: GameOption[];
  source: NormalizedQuestion;
}

export interface TestAnalysis {
  total: number;
  usable: NormalizedQuestion[];
  skipped: Record<SkipReason, number>;
}

function skipReason(q: NormalizedQuestion): SkipReason | null {
  if (q.isBlock) return 'block';
  if (q.answerMode === 'text') return 'open';
  if (q.answerMode === 'multi') return 'multi';
  if (q.optionList.length < 2 || q.optionList.length > OPTION_LETTERS.length) return 'broken';
  if (!q.answer || !q.optionList.some((o) => o.id === q.answer)) return 'broken';
  return null;
}

export const isGameEligible = (q: NormalizedQuestion) => skipReason(q) === null;

export function analyzeTest(rawQuestions: unknown[], lang: Lang): TestAnalysis {
  const all = normalizeQuestions(rawQuestions as Record<string, unknown>[], lang);
  const skipped: Record<SkipReason, number> = { open: 0, multi: 0, block: 0, broken: 0 };
  const usable: NormalizedQuestion[] = [];
  for (const q of all) {
    const r = skipReason(q);
    if (r) skipped[r] += 1;
    else usable.push(q);
  }
  return { total: all.length, usable, skipped };
}

/** How many minutes a pile of `n` questions lasts with both teams answering. */
export const estimateMinutes = (n: number) => (n * SECONDS_PER_ANSWER) / 2 / 60;

/** Questions needed for a timed game of `minutes` (both teams answering). */
export const neededForMinutes = (minutes: number) => Math.ceil((minutes * 60 * 2) / SECONDS_PER_ANSWER);

export function shuffle<T>(list: readonly T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A fresh, shuffled pile. MCQ option order is shuffled too and re-lettered
 * by position, so remembering "it was C" never helps. True/false keeps its
 * natural order (shuffling it only confuses).
 */
export function buildDeck(usable: NormalizedQuestion[], lang: Lang): GameQuestion[] {
  return shuffle(usable).map((q, i) => {
    const ordered = q.type === 'true_false' ? q.optionList : shuffle(q.optionList);
    return {
      key: `${q.id || 'q'}-${i}`,
      text: getText(q.question, lang),
      imageUrl: q.imageUrl,
      source: q,
      options: ordered.map((o, idx) => ({
        id: o.id,
        letter: OPTION_LETTERS[idx],
        text: getText(o.text, lang),
        imageUrl: o.imageUrl,
      })),
    };
  });
}

export const isCorrectPick = (q: GameQuestion, optionId: string) => isAnswerCorrect(q.source, optionId);
