import { isCorrectPick, type GameQuestion } from '../../_lib/questionDeck';
import type { Team } from './teams';

/**
 * Arqon tortish — the whole rule book as a pure reducer (docs/GAMES.md).
 * Time is always passed IN (`now`), so pause/resume, the wrong-answer freeze
 * and the game clock all shift together and nothing depends on setTimeout.
 *
 * Rope: negative = toward Blue (left), positive = toward Red (right).
 */

/** Steps from the center to a win line. */
export const WIN_STEPS = 5;
/** How long a correct answer shows its green flash before the next question. */
export const CORRECT_FLASH_MS = 650;
/** Wrong-answer freeze — the side is locked, then gets a NEW question. */
export const FREEZE_MS = 2000;

export type Status = 'countdown' | 'playing' | 'paused' | 'finished';
export type FinishReason = 'rope' | 'time' | 'questions';
export type Winner = Team | 'draw';

export interface Feedback {
  kind: 'correct' | 'wrong';
  optionId: string;
  /** When the side moves on to its next question. */
  until: number;
}

export interface SideState {
  current: GameQuestion | null;
  feedback: Feedback | null;
  correct: number;
  wrong: number;
}

export interface GameState {
  status: Status;
  pile: GameQuestion[];
  sides: Record<Team, SideState>;
  rope: number;
  /** null = ∞ (no clock). */
  durationMs: number | null;
  endsAt: number | null;
  remainingMs: number | null;
  pausedAt: number | null;
  finishReason: FinishReason | null;
  winner: Winner | null;
  /** Monotonic counters the arena watches to fire one-shot animations. */
  pulls: Record<Team, number>;
  misses: Record<Team, number>;
  /** Game time of each team's last correct pull (0 = never) — drives the heave pose. */
  lastPullAt: Record<Team, number>;
  /** Last `now` the reducer saw — lets views derive poses without effects. */
  clock: number;
}

export type Action =
  | { type: 'init'; deck: GameQuestion[]; durationMs: number | null }
  | { type: 'begin'; now: number }
  | { type: 'answer'; team: Team; optionId: string; now: number }
  | { type: 'tick'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number };

const emptySide = (): SideState => ({ current: null, feedback: null, correct: 0, wrong: 0 });

export const initialState = (deck: GameQuestion[] = [], durationMs: number | null = null): GameState => ({
  status: 'countdown',
  pile: deck,
  sides: { blue: emptySide(), red: emptySide() },
  rope: 0,
  durationMs,
  endsAt: null,
  remainingMs: durationMs,
  pausedAt: null,
  finishReason: null,
  winner: null,
  pulls: { blue: 0, red: 0 },
  misses: { blue: 0, red: 0 },
  lastPullAt: { blue: 0, red: 0 },
  clock: 0,
});

const winnerByRope = (rope: number): Winner => (rope < 0 ? 'blue' : rope > 0 ? 'red' : 'draw');

const finish = (s: GameState, reason: FinishReason): GameState => ({
  ...s,
  status: 'finished',
  finishReason: reason,
  winner: winnerByRope(s.rope),
  remainingMs: s.endsAt !== null ? Math.max(0, s.remainingMs ?? 0) : null,
});

/** Hands the next question of the SHARED pile to one side. */
function draw(s: GameState, team: Team): GameState {
  const [next, ...rest] = s.pile;
  return {
    ...s,
    pile: rest,
    sides: { ...s.sides, [team]: { ...s.sides[team], current: next ?? null, feedback: null } },
  };
}

/** Both sides empty-handed with nothing left to show → questions ran out. */
const outOfQuestions = (s: GameState) =>
  s.pile.length === 0 &&
  (['blue', 'red'] as Team[]).every((t) => !s.sides[t].current && !s.sides[t].feedback);

/** Moves sides whose feedback window has passed on to their next question. */
function settle(s: GameState, now: number): GameState {
  let next = s;
  for (const team of ['blue', 'red'] as Team[]) {
    const fb = next.sides[team].feedback;
    if (fb && now >= fb.until) next = draw(next, team);
  }
  return outOfQuestions(next) ? finish(next, 'questions') : next;
}

export function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'init':
      return initialState(a.deck, a.durationMs);

    case 'begin': {
      if (s.status !== 'countdown') return s;
      let next: GameState = {
        ...s,
        status: 'playing',
        clock: a.now,
        endsAt: s.durationMs !== null ? a.now + s.durationMs : null,
      };
      next = draw(draw(next, 'blue'), 'red');
      return outOfQuestions(next) ? finish(next, 'questions') : next;
    }

    case 'answer': {
      if (s.status !== 'playing') return s;
      const side = s.sides[a.team];
      // One answer per question; nothing while flashing or frozen.
      if (!side.current || side.feedback) return s;
      if (!side.current.options.some((o) => o.id === a.optionId)) return s;

      if (isCorrectPick(side.current, a.optionId)) {
        const rope = s.rope + (a.team === 'blue' ? -1 : 1);
        const next: GameState = {
          ...s,
          rope,
          clock: a.now,
          pulls: { ...s.pulls, [a.team]: s.pulls[a.team] + 1 },
          lastPullAt: { ...s.lastPullAt, [a.team]: a.now },
          sides: {
            ...s.sides,
            [a.team]: {
              ...side,
              correct: side.correct + 1,
              feedback: { kind: 'correct', optionId: a.optionId, until: a.now + CORRECT_FLASH_MS },
            },
          },
        };
        return Math.abs(rope) >= WIN_STEPS ? finish(next, 'rope') : next;
      }

      return {
        ...s,
        clock: a.now,
        misses: { ...s.misses, [a.team]: s.misses[a.team] + 1 },
        sides: {
          ...s.sides,
          [a.team]: {
            ...side,
            wrong: side.wrong + 1,
            feedback: { kind: 'wrong', optionId: a.optionId, until: a.now + FREEZE_MS },
          },
        },
      };
    }

    case 'tick': {
      if (s.status !== 'playing') return s;
      let next: GameState = { ...s, clock: a.now };
      if (s.endsAt !== null) {
        const remainingMs = Math.max(0, s.endsAt - a.now);
        next = { ...next, remainingMs };
        if (remainingMs === 0) return finish(next, 'time');
      }
      return settle(next, a.now);
    }

    case 'pause':
      if (s.status !== 'playing') return s;
      return { ...s, status: 'paused', pausedAt: a.now };

    case 'resume': {
      if (s.status !== 'paused' || s.pausedAt === null) return s;
      // Shift every deadline by the paused span — nobody loses time to a pause.
      const shift = a.now - s.pausedAt;
      const shiftSide = (side: SideState): SideState =>
        side.feedback ? { ...side, feedback: { ...side.feedback, until: side.feedback.until + shift } } : side;
      return {
        ...s,
        status: 'playing',
        clock: a.now,
        pausedAt: null,
        endsAt: s.endsAt !== null ? s.endsAt + shift : null,
        sides: { blue: shiftSide(s.sides.blue), red: shiftSide(s.sides.red) },
        lastPullAt: { blue: s.lastPullAt.blue + shift, red: s.lastPullAt.red + shift },
      };
    }

    default:
      return s;
  }
}
