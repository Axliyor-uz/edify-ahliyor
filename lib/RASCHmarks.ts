// lib/RASCHmarks.ts
//
// DYNAMIC MARKS — what each question on a paper is worth, priced from how the
// cohort actually answered it.
//
// A question's ball is an ABSOLUTE function of one number — the share of the
// cohort that solved it — on a continuous 1.3 … 6.0 scale:
//
//     difficulty d = 1 − p̂                    (p̂ = shrunk share correct)
//     ball        = 1.3 + 4.7 · d²
//
// so 100 % solved → 1.30, 50 % → 2.48, 20 % → 4.31, 0 % → 6.00, and every value
// in between is reachable. The square is the point: it is flat where questions
// are easy (90 % and 80 % differ by 0.14) and steep where they are hard (20 %
// and 10 % differ by 0.80), which is where a mark scheme should discriminate.
//
// The student's score is then `Σ(balls earned) / Σ(balls) × 100` — see
// `normalizedScore`. ⚠️ That is what makes ten hard answers beat ten easy ones,
// the thing a flat "x correct out of 45" cannot express.
//
// ── two earlier designs, and why they went ──────────────────────────────────
// Both dated 2026-07-29, both replaced the same day:
//   1. **A per-SECTION budget.** Each blueprint row kept its printed total (3.5
//      across 2 questions, 20.6 across 11) and its questions permuted the balls
//      inside it. That capped a question at its own row's dearest printed value,
//      so the hardest question on the paper could be worth less than an easy one
//      in a richer row.
//   2. **Whole-paper allocation normalised to exactly 100.** Balls were priced
//      against each other and rescaled so the 45 summed to 100. Better, but the
//      ball was still RELATIVE — it depended on what else was on the paper — and
//      the rescaling collapsed onto a handful of values in practice.
// The ball is now absolute: the same solve rate is the same ball on every paper,
// and two papers' marks mean the same thing. The 45 no longer sum to 100 — the
// SCORE is normalised instead, which is the number a student is judged on.
//
// Until the paper has evidence it is marked with the protocol's PRINTED values,
// so an unsat paper is still the official table verbatim.
//
// Pure: no Firestore, no React. Contract + traps: docs/RASCH_QUIZ.md.

import { sectionBalls } from './Examblueprint';
import { examSlotKeys } from './ExamTeacher';
import type { ExamQuestion, TestType } from '@/types/Exam';

/**
 * What a paper is worth at most, and what a score is out of.
 *
 * ⚠️ **A CAP, not a target** (`capBalls`). The curve below prices each question
 * on its own, so an ordinary paper — one the class solves about half of — adds
 * up to more than 100; when it does, every ball is scaled down by the same
 * factor until the total is exactly 100. A paper that comes in UNDER 100 is left
 * alone: scaling an easy paper *up* would inflate a question nobody found hard.
 */
export const PAPER_TOTAL = 100;

/**
 * The band the curve prices into, BEFORE the 100-point cap.
 *
 * `BALL_MIN` is the protocol's own cheapest printed value, so the floor is not
 * an invention; `BALL_MAX` is what a question nobody solved is worth. Both ends
 * are reached: they are the values of the curve at d = 0 and d = 1, not clamps.
 *
 * ⚠️ **A ball on screen can sit BELOW `BALL_MIN`.** `capBalls` scales the whole
 * paper down when it would otherwise pass 100, and the band cannot survive that:
 * 45 questions at the 2.22 average the cap implies is a solve rate of ~56 %, so
 * any harder paper is scaled. The ORDER and the RATIOS are what the cap
 * preserves — the hardest question stays the dearest, and stays the same
 * multiple of the easiest — which is what the mark is actually read for.
 */
export const BALL_MIN = 1.3;
export const BALL_MAX = 6;

/** The band's width — how much a question's ball can travel. */
export const BALL_SPAN = BALL_MAX - BALL_MIN;

/**
 * The exponent on difficulty in `ballFor`.
 *
 * `2` (a square) is deliberately convex, not linear: on a linear ramp a question
 * solved by 90 % and one solved by 80 % differ by 0.47, which is noise dressed
 * as a judgement, while 20 % and 10 % differ by the same 0.47 — the one place
 * the distinction is real. Squaring compresses the easy end (0.14 between 90 %
 * and 80 %) and stretches the hard end (0.80 between 20 % and 10 %).
 *
 * ⚠️ It is a display curve, not the statistics. Ability is estimated by the 3PL
 * EAP model in [lib/RASCHtheta.ts](RASCHtheta.ts) and is untouched by this file
 * — see docs/RASCH_QUIZ.md on why the two must not be conflated.
 */
export const BALL_CURVE = 2;

/**
 * Responses below which a ball is FLAGGED as still settling.
 *
 * ⚠️ **It is a label, not a switch.** A question is priced from the moment one
 * student has answered it — the ball on screen is always the current one, and
 * `provisional` only tells the teacher how much to lean on it.
 *
 * It used to freeze the whole paper on the protocol's printed table until every
 * slot cleared this, which is why a paper sat 4 times showed nothing but 1.3 and
 * 2.2. That gate belonged to the old design, where balls were priced against
 * each other inside a fixed budget and mixing measured with unmeasured items
 * really would have corrupted the comparison. Balls are **absolute** now
 * (`ballFor`), so an item with two responses simply gets the ball two responses
 * justify — and the shrunk `p̂` is what keeps that honest, doing the job the
 * gate was doing, continuously and per question rather than all-or-nothing.
 */
export const MIN_RESPONSES = 5;

/**
 * Shrinkage toward `PRIOR_P`, in "imaginary responses".
 *
 * Two questions at 1/6 and 0/6 are barely distinguishable, and shrinking both
 * toward 0.5 keeps a single lucky answer from taking a section's whole budget.
 */
export const PRIOR_WEIGHT = 3;
export const PRIOR_P = 0.5;

/** Balls carry TWO decimals. One decimal collapses the easy half of the curve
 *  onto a handful of values (1.3, 1.3, 1.4, 1.5…), which is the discreteness
 *  this design exists to remove. */
const round2 = (v: number) => Math.round(v * 100) / 100;

/** How one slot went, across everybody who has sat the paper. */
export interface ItemStat {
  seen: number;
  correct: number;
}

/** One numbered question on the paper, marked. */
export interface SlotMark {
  /** `examSlotKeys` — the id shared by ItemResponse, the stored outcome map and this. */
  key: string;
  /** Its position on the paper (1…45). */
  number: number;
  sectionId: string;
  testType: TestType;
  seen: number;
  correct: number;
  /** Raw proportion correct, or `null` when nobody has answered it yet. */
  p: number | null;
  /** The ball this question is worth, to one decimal. In [BALL_MIN, BALL_MAX]. */
  ball: number;
  /** What the protocol prints in this position, before any repricing. */
  printedBall: number;
  /**
   * What this question's section adds up to under the marks in force.
   *
   * ⚠️ **Reported, not reserved.** Before 2026-07-29 it was a fixed per-section
   * budget the questions inside it split; now the paper is priced as a whole and
   * a section's total MOVES — a row full of questions the class found hard is
   * worth more than the protocol prints it, and that is the point.
   */
  sectionTotal: number;
  /** Fewer than `MIN_RESPONSES` answers — the ball is live but still moving. */
  provisional: boolean;
}

export interface PaperSlot {
  key: string;
  number: number;
  sectionId: string;
  testType: TestType;
}

/** The paper's slots in order, with the position each is printed under. */
export function paperSlots(questions: ExamQuestion[]): PaperSlot[] {
  return questions.flatMap((q) =>
    examSlotKeys(q).map((key, i) => ({
      key,
      number: q.slotNumber + i,
      sectionId: q.sectionId,
      testType: q.testType,
    })),
  );
}

/**
 * Every stored sitting → per-slot counts.
 *
 * ⚠️ A result saved before `items` existed contributes NOTHING, not zeros: it
 * has no per-question record, and counting it as "seen but wrong" would make
 * every question of an old paper look impossible.
 */
export function cohortStats(results: { items?: Record<string, number> }[]): Map<string, ItemStat> {
  const stats = new Map<string, ItemStat>();
  for (const r of results) {
    if (!r.items) continue;
    for (const [key, value] of Object.entries(r.items)) {
      const stat = stats.get(key) ?? { seen: 0, correct: 0 };
      stat.seen += 1;
      stat.correct += value ? 1 : 0;
      stats.set(key, stat);
    }
  }
  return stats;
}

/** Shrunk proportion correct — see `PRIOR_WEIGHT`. */
export function shrunkP(stat: ItemStat): number {
  return (stat.correct + PRIOR_WEIGHT * PRIOR_P) / (stat.seen + PRIOR_WEIGHT);
}

/**
 * Solve rate → what this question is worth.
 *
 *     ball = BALL_MIN + BALL_SPAN · (1 − p̂)^BALL_CURVE
 *
 * ⚠️ **Absolute, not relative.** It depends on this question's own solve rate
 * and on nothing else on the paper, so the same 30 %-solved question is 3.60 on
 * every paper it appears on — which is what makes two papers' marks comparable
 * and what a rescaled-to-100 allocation could never give.
 *
 * ⚠️ **The ends of the band are asymptotes in practice**, because `p̂` is
 * SHRUNK: a question 20 of 20 students solved reads p̂ = 0.93, not 1.00, so it
 * prices at 1.32 rather than 1.30, and 0 of 20 gives 5.41 rather than 6.00. That
 * is deliberate — the alternative is one lucky answer moving a mark by half a
 * point — and the gap closes as the cohort grows (0 of 50 → 5.74).
 *
 *     solved  100%   90%   80%   70%   60%   50%   40%   30%   20%   10%    0%
 *     ball    1.30  1.35  1.49  1.72  2.05  2.48  2.99  3.60  4.31  5.11  6.00
 */
export function ballFor(stat: ItemStat | undefined): number {
  if (!stat || stat.seen === 0) return BALL_MIN + BALL_SPAN * 0.5 ** BALL_CURVE;
  const d = 1 - shrunkP(stat);
  return round2(BALL_MIN + BALL_SPAN * d ** BALL_CURVE);
}

/**
 * Rounds to two decimals so the parts still add to the whole.
 *
 * ⚠️ Rounding each ball on its own does NOT: 45 roundings drift, and a paper
 * marked out of 100 that adds to 99.87 is unreadable. Largest-remainder in
 * hundredths lands the error on whichever balls were rounded hardest and keeps
 * the total exact.
 */
function roundHundredths(values: number[], total: number): number[] {
  const cents = values.map((v) => v * 100);
  const out = cents.map(Math.floor);
  let left = Math.round(total * 100) - out.reduce((a, b) => a + b, 0);

  const order = cents.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k].i] += 1;
  for (let k = order.length - 1; left < 0 && k >= 0; k--, left++) out[order[k].i] -= 1;

  return out.map((v) => v / 100);
}

/**
 * **The 100-point ceiling.** A paper worth more than `PAPER_TOTAL` has every
 * ball scaled down by the same factor until it is worth exactly that.
 *
 * ⚠️ Needed because the curve is ABSOLUTE: it prices each question from its own
 * solve rate and never looks at the paper, so nothing stops 45 hard questions
 * adding to 200. A mark scheme that says "out of 100" has to be out of 100 —
 * the screenshot that started this read `65.56/112.20`, which is not a mark
 * anybody can act on.
 *
 * ⚠️ **One factor for the whole paper, never a clamp per question.** Trimming
 * only the dearest questions would change which question is worth more than
 * which; a single factor leaves every ratio — and therefore the entire ordering
 * — exactly as the cohort earned it. The floor of `BALL_MIN` is what yields, and
 * it is documented as yielding.
 *
 * ⚠️ **Under 100 is left ALONE.** Scaling an easy paper up to 100 would make a
 * question everyone solved worth more than its difficulty says, purely because
 * the rest of the paper was easy too — the exact relativity this design removed.
 */
export function capBalls(raw: number[], cap = PAPER_TOTAL): number[] {
  const total = raw.reduce((a, b) => a + b, 0);
  if (total <= cap || total <= 0) return raw.map(round2);
  return roundHundredths(raw.map((v) => (v / total) * cap), cap);
}

/**
 * The printed value for a paper that has **no printed protocol** — an even split
 * of `PAPER_TOTAL` across its slots.
 *
 * ⚠️ This is what the Milliy sertifikat SUBJECT papers (biology…) use: the DTM
 * maths blueprint is the only place per-position printed balls exist, and
 * inventing per-section values for a subject whose blueprint this repo does not
 * have would be worse than an honest flat split. It only ever shows BEFORE a
 * question has been answered by anybody — from the first sitting on, the cohort
 * curve takes over, which is the entire point of the dynamic marks.
 *
 * See docs/MILLIY_QUIZ.md.
 */
export function evenPrinted(count: number, total = PAPER_TOTAL): number[] {
  if (count <= 0) return [];
  return roundHundredths(new Array(count).fill(total / count), total);
}

/**
 * What each position PRINTS in the DTM maths protocol, in paper order.
 *
 * Per section, because that is the only place the printed values exist — a row's
 * `balls` are its own multiset. It is the provisional mark and the "before" the
 * results page strikes through, nothing more.
 */
function printedBalls(slots: PaperSlot[]): number[] {
  const bySection = new Map<string, number>();
  for (const slot of slots) bySection.set(slot.sectionId, (bySection.get(slot.sectionId) ?? 0) + 1);

  const next = new Map<string, number>();
  return slots.map((slot) => {
    const row = sectionBalls(slot.sectionId, bySection.get(slot.sectionId) ?? 1);
    const i = next.get(slot.sectionId) ?? 0;
    next.set(slot.sectionId, i + 1);
    return row[i] ?? row[row.length - 1] ?? 0;
  });
}

/**
 * The whole paper, marked against its cohort.
 *
 * Nothing here is stored. The marks are derived on every render from the
 * sittings that exist right now, which means **a question's ball moves when a
 * classmate sits the paper**. That is the feature, and the results page says so
 * on screen.
 *
 * ⚠️ **Subject-agnostic since 2026-07-30.** Everything below the `printed`
 * argument is cohort arithmetic — solve rate in, ball out — with no blueprint,
 * no calibrated difficulty and no taxonomy in it, which is exactly why the same
 * marking now serves the Milliy sertifikat subject papers (docs/MILLIY_QUIZ.md).
 * `printed` is the ONLY maths-specific part, so it is injectable: pass
 * `evenPrinted(slots.length)` for a paper with no printed protocol. It defaults
 * to the DTM table so the maths caller is unchanged.
 *
 * ⚠️ Do NOT confuse this with the ability model. θ and the 0–5 levels come from
 * the 3PL EAP fit in [lib/RASCHtheta.ts](RASCHtheta.ts), which IS anchored on
 * calibrated maths item difficulty and is deliberately not generalized.
 */
export function paperMarks(
  slots: PaperSlot[],
  stats: Map<string, ItemStat>,
  printed: number[] = printedBalls(slots),
): SlotMark[] {
  const rows = slots.map((slot, i) => ({ slot, stat: stats.get(slot.key), printedBall: printed[i] ?? 0 }));

  // Every question carries its CURRENT ball, priced per question from whatever
  // evidence that question has. Only a slot nobody has answered at all falls
  // back to the protocol's printed value — there is nothing to compute from.
  // Then the whole paper is capped at 100 (`capBalls`), which is what makes the
  // per-question grid add up to the score in the header.
  const balls = capBalls(
    rows.map((row) => ((row.stat?.seen ?? 0) > 0 ? ballFor(row.stat) : row.printedBall)),
  );

  // Reported per section AFTER the split, never reserved before it.
  const sectionTotals = new Map<string, number>();
  rows.forEach((row, i) => {
    const id = row.slot.sectionId;
    sectionTotals.set(id, (sectionTotals.get(id) ?? 0) + balls[i]);
  });

  return rows.map((row, i) => {
    const seen = row.stat?.seen ?? 0;
    return {
      key: row.slot.key,
      number: row.slot.number,
      sectionId: row.slot.sectionId,
      testType: row.slot.testType,
      seen,
      correct: row.stat?.correct ?? 0,
      p: seen > 0 ? row.stat!.correct / seen : null,
      ball: balls[i],
      printedBall: row.printedBall,
      sectionTotal: round2(sectionTotals.get(row.slot.sectionId) ?? 0),
      // Per QUESTION, not per paper: a slot's ball is as settled as its own
      // response count makes it.
      provisional: seen < MIN_RESPONSES,
    };
  });
}

/**
 * Every ball on the paper added up — what a perfect sitting would earn.
 *
 * **At most `PAPER_TOTAL`** (`capBalls`), and exactly it on any paper the class
 * did not find easy. ⚠️ It can still come in UNDER 100: a paper everybody solves
 * is worth 45 × 1.30 = 58.5, and is deliberately left there rather than inflated
 * to 100. So this is summed, not assumed.
 */
export function paperTotal(marks: SlotMark[]): number {
  return round2(marks.reduce((sum, m) => sum + m.ball, 0));
}

/**
 * Raw balls one student earned — the evidence behind the score, shown beside the
 * per-question grid.
 *
 * `null` for a sitting saved before per-item outcomes were recorded — the raw
 * percentage is what those results have, and inventing a mark from it would be
 * a different number wearing the same label.
 */
export function scoreFor(marks: SlotMark[], items: Record<string, number> | undefined): number | null {
  if (!items) return null;
  return round2(marks.reduce((sum, m) => sum + (items[m.key] ? m.ball : 0), 0));
}

/**
 * **The student's score, out of 100** — `Σ(balls earned) / Σ(balls) × 100`.
 *
 * ⚠️ This is where difficulty is actually rewarded, and it is the whole reason
 * the balls are absolute. Two students who each answered 10 of 45 do NOT score
 * the same: on a paper priced 1.30…6.00, the ten hardest are worth ~50 raw balls
 * and the ten easiest ~14, so the same "10 correct" comes out around 45 vs 13.
 * A flat count of right answers cannot say that, and it is the single most
 * misleading number a maths dashboard can show.
 *
 * Normalising also puts every paper back on one scale, whatever its raw total.
 */
export function normalizedScore(
  marks: SlotMark[],
  items: Record<string, number> | undefined,
): number | null {
  const earned = scoreFor(marks, items);
  if (earned === null) return null;
  const total = paperTotal(marks);
  return total > 0 ? Math.round((earned / total) * PAPER_TOTAL * 10) / 10 : 0;
}
