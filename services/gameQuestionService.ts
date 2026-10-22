import type { DocumentSnapshot } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { fetchQuestions } from '@/services/quizService';
import { dtmBankIds, type AiSource } from '@/app/teacher/games/_lib/aiSource';

/**
 * New questions for the classroom games (docs/GAMES.md): AI sources via
 * `/api/teacher/games/questions` (verifies the ID token, spends monthly AI
 * credits), the DTM bank straight from `questions1` (free). Nothing is saved.
 */

export type GameDifficulty = 'easy' | 'medium' | 'hard';
export type GameQuestionLanguage = 'uz' | 'ru' | 'en';

export interface GameQuestionRequest {
  source: Exclude<AiSource, { kind: 'dtm-bank' }>;
  difficulty: GameDifficulty;
  count: number;
  language: GameQuestionLanguage;
}

/** Error codes the route returns; anything else is reported as 'FAILED'. */
export type GameQuestionError = 'LIMIT_REACHED' | 'BAD_TOPIC' | 'BAD_INPUT' | 'EMPTY_BANK' | 'FAILED';
const KNOWN: GameQuestionError[] = ['LIMIT_REACHED', 'BAD_TOPIC', 'BAD_INPUT'];

export class GameQuestionFailure extends Error {
  constructor(public code: GameQuestionError) {
    super(code);
  }
}

/** Raw questions (legacy shape) — run them through `analyzeTest` like a test's. */
export async function generateGameQuestions(req: GameQuestionRequest): Promise<Record<string, unknown>[]> {
  const user = auth.currentUser;
  if (!user) throw new GameQuestionFailure('FAILED');

  let res: Response;
  try {
    res = await fetch('/api/teacher/games/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(req),
    });
  } catch {
    throw new GameQuestionFailure('FAILED');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.questions)) {
    throw new GameQuestionFailure(KNOWN.includes(data.error) ? data.error : 'FAILED');
  }
  return data.questions;
}

const BANK_DIFFICULTY = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;
const BANK_PAGE = 10;

/**
 * Ready questions from the DTM bank (`questions1`) for one topic — read the
 * same way as /teacher/create/database (`fetchQuestions`, 10 per page), up to
 * `count`. Free: no route, no credits. Throws EMPTY_BANK when there are none.
 */
export async function fetchDtmBankQuestions(
  source: Extract<AiSource, { kind: 'dtm-bank' }>,
  difficulty: GameDifficulty,
  count: number,
): Promise<Record<string, unknown>[]> {
  const ids = dtmBankIds(source.section, source.chapter, source.topic);
  if (!ids) throw new GameQuestionFailure('BAD_INPUT');

  const found: Record<string, unknown>[] = [];
  let cursor: DocumentSnapshot | null = null;
  while (found.length < count) {
    const page = await fetchQuestions(ids, BANK_DIFFICULTY[difficulty], cursor);
    found.push(...(page.questions as unknown as Record<string, unknown>[]));
    if (page.questions.length < BANK_PAGE || !page.lastDoc) break;
    cursor = page.lastDoc;
  }
  if (!found.length) throw new GameQuestionFailure('EMPTY_BANK');
  // Bank docs carry their own `id` field, which overrides the doc id in fetchQuestions — re-key so ✕ removes one.
  return found.slice(0, count).map((q, i) => ({ ...q, id: `dtm_${i}_${String(q.id ?? '')}` }));
}
