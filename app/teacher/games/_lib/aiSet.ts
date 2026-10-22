import type { Lang } from '@/types/Math';
import type { GameDifficulty, GameQuestionLanguage } from '@/services/gameQuestionService';
import type { AiSource } from './aiSource';
import { analyzeTest } from './questionDeck';
import type { PickedTest } from '../_components/TestPicker';

/**
 * The teacher's last AI-made question set ("AI bilan yaratish", docs/GAMES.md).
 * Kept in localStorage per teacher, so one set can be played in every game
 * without spending credits again. Never written to Firestore.
 */

export interface AiSet {
  id: string;
  /** Shown as the "test" name: the typed topic, or "6-sinf · Matematika · Kasrlar". */
  title: string;
  /** What it was made from — reopens the form as it was. */
  source: AiSource;
  difficulty: GameDifficulty;
  language: GameQuestionLanguage;
  /** Raw questions from the route (legacy shape). */
  questions: Record<string, unknown>[];
}

export const COUNT_OPTIONS = [10, 15, 20, 30];

/** Smallest count option that covers what the game needs. */
export const suggestCount = (needed: number) => COUNT_OPTIONS.find((c) => c >= needed) ?? COUNT_OPTIONS[COUNT_OPTIONS.length - 1];

const storageKey = (uid: string) => `edify.games.aiSet.${uid}`;

export function loadAiSet(uid: string): AiSet | null {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    const set = raw ? (JSON.parse(raw) as AiSet) : null;
    return set && typeof set.title === 'string' && set.source && Array.isArray(set.questions) ? set : null;
  } catch {
    return null;
  }
}

export function saveAiSet(uid: string, set: AiSet | null) {
  try {
    if (set) localStorage.setItem(storageKey(uid), JSON.stringify(set));
    else localStorage.removeItem(storageKey(uid));
  } catch {
    // Storage full or blocked: the set still works for this visit.
  }
}

/** The set as a picker selection, so every game's settings and deck work unchanged. */
export const aiSetToPicked = (set: AiSet, lang: Lang): PickedTest => ({
  test: { id: `ai-${set.id}`, title: set.title, rawQuestions: set.questions, questionCount: set.questions.length, createdAt: null },
  analysis: analyzeTest(set.questions, lang),
});
