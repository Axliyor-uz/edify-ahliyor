import { isCorrectPick, type GameQuestion } from '../../_lib/questionDeck';

/**
 * Omad g'ildiragi (lucky wheel) rules as a pure reducer (docs/GAMES.md).
 * Time is passed in (`now` = performance.now()), never read here, and the
 * landing segment is chosen by the caller (random) and passed to `spin`.
 *
 * Team spins → wheel lands:
 *   points   → question + answers open, worth value × multiplier;
 *   ×2       → same team spins again, the multiplier doubles (max ×4);
 *   bankrot  → nothing this turn (score kept), no question used.
 * Correct → points to the team; wrong / time-out → nothing. Next team.
 * One round = one turn per team; the game ends after `rounds` rounds.
 */

export type Segment =
  | { kind: 'points'; value: number }
  | { kind: 'double' }
  | { kind: 'bankrupt' };

const p = (value: number): Segment => ({ kind: 'points', value });

/** Clockwise from the top. ×2 and Bankrot sit opposite each other. */
export const SEGMENTS: Segment[] = [
  p(20), p(50), p(10), { kind: 'double' }, p(30), p(40),
  p(20), p(10), p(50), { kind: 'bankrupt' }, p(30), p(40),
];

export const MAX_MULTIPLIER = 4;

export type Outcome = 'correct' | 'wrong' | 'timeout' | 'bankrupt';

export type Phase = 'spin' | 'spinning' | 'landed' | 'answers' | 'result' | 'finished';

export interface WheelState {
  phase: Phase;
  /** Questions not used yet, in play order. */
  deck: GameQuestion[];
  teamCount: number;
  rounds: number;
  /** 1-based. */
  round: number;
  turn: number;
  scores: number[];
  correct: number[];
  wrong: number[];
  /** ×2 landings this turn: 1, 2 or 4. */
  multiplier: number;
  /** Segment the current spin lands / landed on. */
  target: number | null;
  /** Bumps on every spin so the wheel animates even to the same segment. */
  spinId: number;
  question: GameQuestion | null;
  /** Points at stake for the open question (value × multiplier). */
  stake: number | null;
  picked: string | null;
  outcome: Outcome | null;
  gained: number | null;
  timeLimitMs: number | null;
  endsAt: number | null;
  remainingMs: number | null;
  pausedAt: number | null;
}

export type WheelAction =
  | { type: 'init'; deck: GameQuestion[]; teamCount: number; rounds: number; timeLimitMs: number | null }
  | { type: 'spin'; target: number }
  | { type: 'land' }
  | { type: 'reveal'; now: number }
  | { type: 'answer'; optionId: string; now: number }
  | { type: 'tick'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'next' }
  | { type: 'finish' };

export function initialState(): WheelState {
  return {
    phase: 'spin', deck: [], teamCount: 2, rounds: 1, round: 1, turn: 0,
    scores: [0, 0], correct: [0, 0], wrong: [0, 0], multiplier: 1, target: null, spinId: 0,
    question: null, stake: null, picked: null, outcome: null, gained: null,
    timeLimitMs: null, endsAt: null, remainingMs: null, pausedAt: null,
  };
}

/** Questions a game needs: one per turn (bankrot turns use none). */
export const questionsNeeded = (teamCount: number, rounds: number) => teamCount * rounds;

/** true when the turn being played is the game's last (`next` will finish). */
export const isLastTurn = (s: WheelState) =>
  (s.round === s.rounds && s.turn === s.teamCount - 1) || s.deck.length === 0;

const bump = (a: number[], i: number, by = 1) => a.map((v, k) => (k === i ? v + by : v));

function close(state: WheelState, outcome: Exclude<Outcome, 'bankrupt'>, picked: string | null): WheelState {
  const team = state.turn;
  const base = { ...state, phase: 'result' as const, outcome, picked, endsAt: null, pausedAt: null };
  if (outcome !== 'correct') return { ...base, gained: null, wrong: bump(state.wrong, team) };
  const points = state.stake ?? 0;
  return { ...base, gained: points, scores: bump(state.scores, team, points), correct: bump(state.correct, team) };
}

export function reducer(state: WheelState, action: WheelAction): WheelState {
  switch (action.type) {
    case 'init': {
      const zeros = Array.from({ length: action.teamCount }, () => 0);
      return {
        ...initialState(),
        deck: action.deck,
        teamCount: action.teamCount,
        rounds: Math.max(1, action.rounds),
        scores: zeros, correct: zeros, wrong: zeros,
        timeLimitMs: action.timeLimitMs,
      };
    }

    case 'spin': {
      if (state.phase !== 'spin') return state;
      if (!Number.isInteger(action.target) || action.target < 0 || action.target >= SEGMENTS.length) return state;
      return { ...state, phase: 'spinning', target: action.target, spinId: state.spinId + 1 };
    }

    case 'land': {
      if (state.phase !== 'spinning' || state.target === null) return state;
      if (SEGMENTS[state.target].kind === 'bankrupt') {
        return { ...state, phase: 'result', outcome: 'bankrupt', gained: null, multiplier: 1, stake: null };
      }
      return { ...state, phase: 'landed' };
    }

    case 'reveal': {
      if (state.phase !== 'landed' || state.target === null) return state;
      const seg = SEGMENTS[state.target];
      if (seg.kind === 'double') {
        return { ...state, phase: 'spin', multiplier: Math.min(MAX_MULTIPLIER, state.multiplier * 2) };
      }
      if (seg.kind !== 'points') return state;
      const [question, ...deck] = state.deck;
      if (!question) return { ...state, phase: 'finished' };
      const limit = state.timeLimitMs;
      return {
        ...state, phase: 'answers', deck, question, stake: seg.value * state.multiplier,
        picked: null, outcome: null, gained: null,
        endsAt: limit === null ? null : action.now + limit, remainingMs: limit, pausedAt: null,
      };
    }

    case 'answer': {
      if (state.phase !== 'answers' || !state.question || state.pausedAt !== null) return state;
      if (state.endsAt !== null && action.now >= state.endsAt) return close(state, 'timeout', null);
      const q = state.question;
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
      return state.phase === 'answers' && state.endsAt !== null && state.pausedAt === null ? { ...state, pausedAt: action.now } : state;

    case 'resume': {
      if (state.pausedAt === null) return state;
      const shift = action.now - state.pausedAt;
      return { ...state, pausedAt: null, endsAt: state.endsAt === null ? null : state.endsAt + shift };
    }

    case 'next': {
      if (state.phase !== 'result') return state;
      const wraps = state.turn === state.teamCount - 1;
      const round = wraps ? state.round + 1 : state.round;
      const over = round > state.rounds || state.deck.length === 0;
      return {
        ...state,
        phase: over ? 'finished' : 'spin',
        turn: over ? state.turn : (state.turn + 1) % state.teamCount,
        round: over ? state.round : round,
        multiplier: 1, target: null, question: null, stake: null, picked: null, outcome: null, gained: null,
        endsAt: null, remainingMs: null, pausedAt: null,
      };
    }

    case 'finish':
      return state.phase === 'spin' || state.phase === 'result'
        ? { ...state, phase: 'finished', question: null, outcome: null, gained: null }
        : state;
  }
}

export { ranking } from '../../_lib/ranking';
