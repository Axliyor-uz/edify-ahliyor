import { isCorrectPick, shuffle, type GameQuestion } from '../../_lib/questionDeck';

/**
 * Savol doskasi (question board) rules as a pure reducer (docs/GAMES.md).
 * Time is passed in (`now` = performance.now()), never read here.
 *
 * Board of numbered tiles → the team whose turn it is picks one → question
 * and its answers open together (+ optional timer) → teacher taps the option
 * the team said → correct: the tile's points go to the team; wrong or
 * time-out: nothing, the correct answer is shown → next team's turn.
 */

/** Each tile is worth one of these, spread evenly and shuffled. */
export const POINT_VALUES = [10, 20, 30] as const;

export type Outcome = 'correct' | 'wrong' | 'timeout';

export interface Tile {
  n: number;
  question: GameQuestion;
  points: number;
  used: null | { team: number; outcome: Outcome };
}

export type Phase = 'board' | 'answers' | 'result' | 'finished';

export interface BoardState {
  phase: Phase;
  tiles: Tile[];
  teamCount: number;
  scores: number[];
  correct: number[];
  wrong: number[];
  turn: number;
  /** Index into `tiles` of the open question. */
  active: number | null;
  picked: string | null;
  outcome: Outcome | null;
  /** Points just earned (result of a correct answer), else null. */
  gained: number | null;
  timeLimitMs: number | null;
  endsAt: number | null;
  remainingMs: number | null;
  pausedAt: number | null;
}

export type BoardAction =
  | { type: 'init'; deck: GameQuestion[]; tileCount: number; teamCount: number; timeLimitMs: number | null }
  | { type: 'pick'; index: number; now: number }
  | { type: 'answer'; optionId: string; now: number }
  | { type: 'tick'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'next' }
  | { type: 'finish' };

/** Tile values for a board: 10/20/30 in equal shares, random spots. */
export function buildPoints(count: number): number[] {
  return shuffle(Array.from({ length: count }, (_, i) => POINT_VALUES[i % POINT_VALUES.length]));
}

export function initialState(): BoardState {
  return {
    phase: 'board', tiles: [], teamCount: 2, scores: [0, 0], correct: [0, 0], wrong: [0, 0],
    turn: 0, active: null, picked: null, outcome: null, gained: null,
    timeLimitMs: null, endsAt: null, remainingMs: null, pausedAt: null,
  };
}

const bump = (a: number[], i: number, by = 1) => a.map((v, k) => (k === i ? v + by : v));

function close(state: BoardState, outcome: Outcome, picked: string | null): BoardState {
  const idx = state.active!;
  const team = state.turn;
  const tiles = state.tiles.map((t, i) => (i === idx ? { ...t, used: { team, outcome } } : t));
  const base = { ...state, tiles, phase: 'result' as const, outcome, picked, endsAt: null, pausedAt: null };
  if (outcome !== 'correct') return { ...base, gained: null, wrong: bump(state.wrong, team) };
  const points = state.tiles[idx].points;
  return { ...base, gained: points, scores: bump(state.scores, team, points), correct: bump(state.correct, team) };
}

export function reducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'init': {
      const questions = action.deck.slice(0, action.tileCount);
      const points = buildPoints(questions.length);
      const zeros = Array.from({ length: action.teamCount }, () => 0);
      return {
        ...initialState(),
        teamCount: action.teamCount,
        scores: zeros, correct: zeros, wrong: zeros,
        timeLimitMs: action.timeLimitMs,
        tiles: questions.map((question, i) => ({ n: i + 1, question, points: points[i], used: null })),
      };
    }

    case 'pick': {
      if (state.phase !== 'board') return state;
      const tile = state.tiles[action.index];
      if (!tile || tile.used) return state;
      const limit = state.timeLimitMs;
      return {
        ...state, phase: 'answers', active: action.index, picked: null, outcome: null, gained: null,
        endsAt: limit === null ? null : action.now + limit, remainingMs: limit, pausedAt: null,
      };
    }

    case 'answer': {
      if (state.phase !== 'answers' || state.active === null || state.pausedAt !== null) return state;
      if (state.endsAt !== null && action.now >= state.endsAt) return close(state, 'timeout', null);
      const q = state.tiles[state.active].question;
      if (!q.options.some((o) => o.id === action.optionId)) return state;
      return close(state, isCorrectPick(q, action.optionId) ? 'correct' : 'wrong', action.optionId);
    }

    case 'tick': {
      if (state.phase !== 'answers' || state.endsAt === null || state.pausedAt !== null) return state;
      const remainingMs = Math.max(0, state.endsAt - action.now);
      if (remainingMs === 0) return close({ ...state, remainingMs: 0 }, 'timeout', null);
      return remainingMs === state.remainingMs ? state : { ...state, remainingMs };
    }

    case 'pause':
      return state.endsAt !== null && state.pausedAt === null ? { ...state, pausedAt: action.now } : state;

    case 'resume': {
      if (state.pausedAt === null) return state;
      const shift = action.now - state.pausedAt;
      return { ...state, pausedAt: null, endsAt: state.endsAt === null ? null : state.endsAt + shift };
    }

    case 'next': {
      if (state.phase !== 'result') return state;
      const left = state.tiles.some((t) => !t.used);
      return {
        ...state, phase: left ? 'board' : 'finished', active: null, picked: null, outcome: null, gained: null,
        remainingMs: null, turn: (state.turn + 1) % state.teamCount,
      };
    }

    case 'finish':
      return state.phase === 'board' || state.phase === 'result'
        ? { ...state, phase: 'finished', active: null, picked: null, outcome: null, gained: null }
        : state;
  }
}

/** Places for the podium: equal scores share a place (1, 1, 3…). */
export function ranking(scores: number[]): { team: number; score: number; place: number }[] {
  const sorted = scores.map((score, team) => ({ team, score })).sort((a, b) => b.score - a.score || a.team - b.team);
  return sorted.map((row) => ({ ...row, place: sorted.findIndex((r) => r.score === row.score) + 1 }));
}
