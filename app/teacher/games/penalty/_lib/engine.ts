import { isCorrectPick, type GameQuestion } from '../../_lib/questionDeck';

/**
 * Penalti seriyasi (penalty shootout) rules as a pure reducer (docs/GAMES.md).
 * Time is passed in (`now` = performance.now()), never read here, and the
 * keeper's dive is chosen by the caller (random) and passed to `answer`.
 *
 * Two teams kick in turn. Each kick starts with a question; the answer is
 * shown for a beat ('answered'), then `proceed`:
 *   correct          → the team aims at one of 5 zones; the keeper dives to
 *                      his zone: same zone = saved, otherwise GOAL;
 *   wrong / time-out → no aim, the ball goes over the bar (miss).
 * Every kick is played; tied after `kicksPerTeam` each → sudden death
 * (one kick each until one scores and the other doesn't). Out of
 * questions → the game ends where it stands (a draw if level).
 */

/** Goal zones, left to right: top-left, bottom-left, center, bottom-right, top-right. */
export const ZONE_COUNT = 5;

export type Shot = 'goal' | 'saved' | 'miss';

export type Outcome = 'correct' | 'wrong' | 'timeout';

export type Phase = 'question' | 'answered' | 'aim' | 'kick' | 'result' | 'finished';

export interface PenaltyState {
  phase: Phase;
  /** Questions not used yet, in play order. */
  deck: GameQuestion[];
  kicksPerTeam: number;
  /** Team (0 | 1) that takes the first kick. */
  starter: number;
  /** Finished kicks in order; kick i belongs to team `kickerOf(starter, i)`. */
  kicks: Shot[];
  question: GameQuestion | null;
  picked: string | null;
  outcome: Outcome | null;
  /** Zone the keeper dives to; drawn when the answer is given, hidden until the kick. */
  keeperZone: number | null;
  aimZone: number | null;
  /** Result of the kick being animated (phase 'kick') or just shown ('result'). */
  shot: Shot | null;
  timeLimitMs: number | null;
  endsAt: number | null;
  remainingMs: number | null;
  pausedAt: number | null;
}

export type PenaltyAction =
  | { type: 'init'; deck: GameQuestion[]; kicksPerTeam: number; starter: number; timeLimitMs: number | null; now: number }
  | { type: 'answer'; optionId: string; keeperZone: number; now: number }
  | { type: 'tick'; now: number }
  | { type: 'proceed' }
  | { type: 'aim'; zone: number }
  | { type: 'kicked' }
  | { type: 'next'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number };

export function initialState(): PenaltyState {
  return {
    phase: 'question', deck: [], kicksPerTeam: 5, starter: 0, kicks: [],
    question: null, picked: null, outcome: null, keeperZone: null, aimZone: null, shot: null,
    timeLimitMs: null, endsAt: null, remainingMs: null, pausedAt: null,
  };
}

/** Questions the regular kicks need (sudden death uses what is left). */
export const questionsNeeded = (kicksPerTeam: number) => 2 * kicksPerTeam;

export const kickerOf = (starter: number, kick: number) => (starter + kick) % 2;

/** Team taking the current kick. */
export const kicker = (s: PenaltyState) => kickerOf(s.starter, s.kicks.length);

/** Goals per team: [team 0, team 1]. */
export function goals(s: PenaltyState): [number, number] {
  const g: [number, number] = [0, 0];
  s.kicks.forEach((shot, i) => { if (shot === 'goal') g[kickerOf(s.starter, i)]++; });
  return g;
}

/** true once the regular kicks are used up and the teams were level. */
export const isSuddenDeath = (s: PenaltyState) => s.kicks.length >= questionsNeeded(s.kicksPerTeam);

/** true when the finished kicks decide the game (or no question is left). */
export function isOver(s: PenaltyState): boolean {
  if (s.deck.length === 0) return true;
  const n = s.kicks.length;
  if (n < questionsNeeded(s.kicksPerTeam) || n % 2 === 1) return false;
  const [a, b] = goals(s);
  return a !== b;
}

/** Opens the next question with a fresh timer. */
function openQuestion(state: PenaltyState, now: number): PenaltyState {
  const [question, ...deck] = state.deck;
  if (!question) return { ...state, phase: 'finished' };
  const limit = state.timeLimitMs;
  return {
    ...state, phase: 'question', deck, question,
    picked: null, outcome: null, keeperZone: null, aimZone: null, shot: null,
    endsAt: limit === null ? null : now + limit, remainingMs: limit, pausedAt: null,
  };
}

/** Closes the question; the card shows the outcome until `proceed`. */
const answered = (state: PenaltyState, outcome: Outcome, picked: string | null, keeperZone: number | null = null): PenaltyState =>
  ({ ...state, phase: 'answered', outcome, picked, keeperZone, endsAt: null, pausedAt: null });

export function reducer(state: PenaltyState, action: PenaltyAction): PenaltyState {
  switch (action.type) {
    case 'init':
      return openQuestion({
        ...initialState(),
        deck: action.deck,
        kicksPerTeam: Math.max(1, action.kicksPerTeam),
        starter: action.starter === 1 ? 1 : 0,
        timeLimitMs: action.timeLimitMs,
      }, action.now);

    case 'answer': {
      if (state.phase !== 'question' || !state.question || state.pausedAt !== null) return state;
      if (state.endsAt !== null && action.now >= state.endsAt) return answered(state, 'timeout', null);
      const q = state.question;
      if (!q.options.some((o) => o.id === action.optionId)) return state;
      if (!isCorrectPick(q, action.optionId)) return answered(state, 'wrong', action.optionId);
      const keeperZone = Math.min(ZONE_COUNT - 1, Math.max(0, Math.floor(action.keeperZone)));
      return answered(state, 'correct', action.optionId, keeperZone);
    }

    case 'tick': {
      if (state.phase !== 'question' || state.endsAt === null || state.pausedAt !== null) return state;
      const remainingMs = Math.max(0, state.endsAt - action.now);
      if (remainingMs === 0) return answered({ ...state, remainingMs: 0 }, 'timeout', null);
      return remainingMs === state.remainingMs ? state : { ...state, remainingMs };
    }

    case 'proceed':
      // Correct → aim; wrong / time-out → straight to a missed kick.
      if (state.phase !== 'answered') return state;
      return state.outcome === 'correct' ? { ...state, phase: 'aim' } : { ...state, phase: 'kick', shot: 'miss' };

    case 'aim': {
      if (state.phase !== 'aim' || !Number.isInteger(action.zone) || action.zone < 0 || action.zone >= ZONE_COUNT) return state;
      return { ...state, phase: 'kick', aimZone: action.zone, shot: action.zone === state.keeperZone ? 'saved' : 'goal' };
    }

    case 'kicked':
      return state.phase === 'kick' && state.shot
        ? { ...state, phase: 'result', kicks: [...state.kicks, state.shot] }
        : state;

    case 'next':
      if (state.phase !== 'result') return state;
      return isOver(state) ? { ...state, phase: 'finished', question: null } : openQuestion(state, action.now);

    case 'pause':
      return state.phase === 'question' && state.endsAt !== null && state.pausedAt === null ? { ...state, pausedAt: action.now } : state;

    case 'resume': {
      if (state.pausedAt === null) return state;
      const shift = action.now - state.pausedAt;
      return { ...state, pausedAt: null, endsAt: state.endsAt === null ? null : state.endsAt + shift };
    }
  }
}
