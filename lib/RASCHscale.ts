// lib/RASCHscale.ts
import { DIFFICULTY_LOGIT, GUESS_MC, probCorrect } from './RASCHtheta';
import type { DifficultyId } from '@/types/Math';

/**
 * THE 0–3 MATHEMATICS LEVEL.
 *
 * Ability (θ) and item difficulty (b) live on one scale in Rasch, so a level is
 * not an invented score: it says which difficulty of problem you can actually do.
 *
 *     level 3  →  you RELIABLY solve difficulty-3 problems   (olympiad / master)
 *     level 2  →  you reliably solve medium problems
 *     level 1  →  you reliably solve easy problems
 *     level 0  →  below the easiest problems in the bank
 *
 * "RELIABLY" is doing real work here, and getting it wrong was a bug worth
 * spelling out. The first version defined a level as the difficulty you are
 * FIFTY-FIFTY on — the textbook Rasch reading. But a coin-flip is not mastery,
 * and it made the scale absurdly lenient: "master" (3.0) came out to just 69% of
 * the paper, so a student scoring 28/45 was rated 2.69 — practically a master,
 * on a paper they failed nearly half of.
 *
 * A level therefore means you solve that tier at MASTERY_P (80%), not 50%:
 *
 *     θ(level L) = b_L + logit(0.8) = b_L + 1.386
 *
 * Now level 3 means ~92% of a standard paper, level 2 ~80%, level 1 ~63% — a
 * scale where the top actually has to be earned. Note the 80% is on the KNOWLEDGE
 * component σ(θ − b); the guessing floor then lifts the observed rate above it,
 * which is what a student really experiences (see chanceAt).
 */

export const MASTER_LEVEL = 3;
export const MIN_LEVEL = 0;

/**
 * How reliably you must solve a tier to OWN it. 0.8, not 0.5: being a coin-flip
 * on olympiad problems is not what anyone means by "master of mathematics".
 */
export const MASTERY_P = 0.8;

/** The ability premium that reliability costs, in logits: logit(0.8) ≈ 1.386. */
const RELIABLY = Math.log(MASTERY_P / (1 - MASTERY_P));

/**
 * The floor of the scale: the ability at which a student's answers are barely
 * above pure guessing (~30% of a paper, against a 25% chance floor).
 *
 * It is pinned LOW on purpose. Anchoring level 0 one "difficulty step" below easy
 * put the floor at θ ≈ −0.8 — which sounds tidy until you notice that a student
 * there still scores 44% of the paper, so EVERY genuinely weak student clamps to
 * exactly 0.00: 7/45, 10/45 and 17/45 all rendered as "0.00", which is where most
 * beginners live. The bottom of the scale needs resolution, not a cliff.
 */
const FLOOR_THETA = -2.5;

/** (level, θ) anchor points. Ordered, ascending. */
export const LEVEL_ANCHORS: Array<{ level: number; theta: number }> = [
  { level: 0, theta: FLOOR_THETA }, // answering at little better than chance
  { level: 1, theta: DIFFICULTY_LOGIT[1] + RELIABLY }, // reliably solves easy
  { level: 2, theta: DIFFICULTY_LOGIT[2] + RELIABLY }, // reliably solves medium
  { level: 3, theta: DIFFICULTY_LOGIT[3] + RELIABLY }, // reliably solves hard = master
];

/** Ability in logits → level on the 0–3 scale. */
export function thetaToLevel(theta: number): number {
  const first = LEVEL_ANCHORS[0];
  const last = LEVEL_ANCHORS[LEVEL_ANCHORS.length - 1];

  if (theta <= first.theta) return MIN_LEVEL;
  if (theta >= last.theta) return MASTER_LEVEL;

  for (let i = 1; i < LEVEL_ANCHORS.length; i++) {
    const lo = LEVEL_ANCHORS[i - 1];
    const hi = LEVEL_ANCHORS[i];
    if (theta <= hi.theta) {
      const t = (theta - lo.theta) / (hi.theta - lo.theta);
      const level = lo.level + t * (hi.level - lo.level);
      return Math.round(level * 100) / 100;
    }
  }
  return MASTER_LEVEL;
}

/** Level on the 0–3 scale → ability in logits. The inverse of thetaToLevel. */
export function levelToTheta(level: number): number {
  const clamped = Math.max(MIN_LEVEL, Math.min(MASTER_LEVEL, level));

  for (let i = 1; i < LEVEL_ANCHORS.length; i++) {
    const lo = LEVEL_ANCHORS[i - 1];
    const hi = LEVEL_ANCHORS[i];
    if (clamped <= hi.level) {
      const t = (clamped - lo.level) / (hi.level - lo.level);
      return lo.theta + t * (hi.theta - lo.theta);
    }
  }
  return LEVEL_ANCHORS[LEVEL_ANCHORS.length - 1].theta;
}

/**
 * The chance this student solves a problem of the given difficulty grade.
 * This is what a level MEANS, made concrete — and it is the sentence worth
 * putting on the screen: "at level 1.2 you solve about 55% of easy problems and
 * 22% of medium ones."
 */
export function chanceAt(level: number, difficultyId: DifficultyId): number {
  // Includes the guessing floor: this is the chance the student's ANSWER is
  // right, which is what they actually experience — not the chance they knew it.
  return Math.round(
    probCorrect(levelToTheta(level), DIFFICULTY_LOGIT[difficultyId], GUESS_MC) * 100,
  );
}

export type LevelBand = 'beginner' | 'basic' | 'confident' | 'advanced' | 'master';

/** A name for where the student stands. `master` is reserved for the very top. */
export function levelBand(level: number): LevelBand {
  if (level >= 2.85) return 'master';
  if (level >= 2.25) return 'advanced';
  if (level >= 1.5) return 'confident';
  if (level >= 0.75) return 'basic';
  return 'beginner';
}

export const BAND_COLOR: Record<LevelBand, { text: string; bg: string; hex: string }> = {
  beginner: { text: 'text-zinc-600', bg: 'bg-zinc-50 border-zinc-200', hex: '#71717a' },
  basic: { text: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', hex: '#0284c7' },
  confident: { text: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', hex: '#7c3aed' },
  advanced: { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', hex: '#059669' },
  master: { text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', hex: '#d97706' },
};

/** "1.24" — always two decimals, so the number doesn't jitter in width. */
export function formatLevel(level: number): string {
  return level.toFixed(2);
}
