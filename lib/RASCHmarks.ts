// lib/RASCHmarks.ts
//
// DYNAMIC MARKS — what each question on a paper is worth, priced from how the
// cohort actually answered it.
//
// The DTM protocol prints a ball beside every question and they sum to exactly
// 100. What it cannot know in advance is WHICH question is the hard one, and
// that is a claim about difficulty — which is measurable. So once a paper has
// been sat enough times, every one of its 45 questions is repriced ACROSS THE
// WHOLE PAPER, in proportion to how hard the cohort found it:
//
//   • the fewer students solved it, the dearer it is;
//   • a ball runs from BALL_MIN (1.3) to BALL_MAX (6.0) — the protocol's own
//     cheapest printed value, and a ceiling high enough that one brutal question
//     is worth more than four easy ones without being worth a section;
//   • the 45 balls still add to exactly 100.
//
// ⚠️ **This was per SECTION until 2026-07-29**: each blueprint row kept its own
// printed total (3.5 across 2 questions, 20.6 across 11…) and the questions only
// permuted the balls inside it. That capped a question at its own row's dearest
// printed ball, so the hardest question on the paper could be worth less than an
// easy one in a richer row, and it made the mark say more about which section a
// question sat in than about the question. Pricing on the whole paper is what
// makes the ball comparable between any two questions.
//
// Until the paper has evidence it is marked with the protocol's PRINTED values,
// so an unsat paper is still the official table verbatim.
//
// Pure: no Firestore, no React. Contract + traps: docs/RASCH_QUIZ.md.

import { sectionBalls } from './Examblueprint';
import { examSlotKeys } from './ExamTeacher';
import type { ExamQuestion, TestType } from '@/types/Exam';

/** What a paper's balls add up to. Fixed — this is the one number a mark out
 *  of 100 cannot negotiate. */
export const PAPER_TOTAL = 100;

/**
 * The band one question's ball may take.
 *
 * `BALL_MIN` is the protocol's own cheapest printed value, so the floor is not
 * an invention; `BALL_MAX` is the ceiling a question the whole cohort failed can
 * reach. ⚠️ Both are needed: without the floor a question everybody solved
 * rounds to nothing and a student who answered 40 of 45 could still score badly,
 * and without the ceiling one impossible question would eat a quarter of the
 * paper.
 *
 * ⚠️ They are only satisfiable while `n·BALL_MIN ≤ 100 ≤ n·BALL_MAX`, i.e.
 * **17…76 slots** — a 45-question paper sits comfortably inside that (the mean
 * ball is 100/45 ≈ 2.2). Outside it the clamps yield and the total does not; see
 * `shareOut`.
 */
export const BALL_MIN = 1.3;
export const BALL_MAX = 6;

/**
 * Responses every slot needs before the paper is repriced.
 *
 * ⚠️ Under this the paper keeps the protocol's PRINTED values, so its first
 * sittings mark exactly like the official table. One student getting one
 * question wrong is not evidence that it is the hard one.
 *
 * The whole paper moves or none of it does — half-measured, it would price
 * measured questions against unmeasured ones, which is not a comparison. In
 * practice `seen` is uniform across a paper (a student sits all of it), so this
 * really reads "has the paper been sat MIN_RESPONSES times".
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

/**
 * How steeply the price climbs with difficulty: a question one logit harder than
 * another is worth `e^0.35 ≈ 1.42×` more.
 *
 * The scale is the Rasch one the rest of this app speaks — the item's empirical
 * log-odds of FAILURE — so the ratio between two questions is the same whatever
 * the paper's overall difficulty, and only their relative standing prices them.
 *
 * ⚠️ It is tuned so the band is REACHABLE but not instantly saturated. With the
 * shrinkage below, five sittings put the extremes about 4 logits apart (a ~4×
 * spread, which the 1.3 floor already binds); a class of twenty spreads them
 * ~5.3 logits (~6×), which is where a question nobody solved finally reaches
 * `BALL_MAX`. A steeper slope would hand the ceiling to the first hard question
 * on the thinnest evidence.
 */
export const BALL_SLOPE = 0.35;

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
  /** True while the paper is still marked with the protocol's printed values. */
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
 * Difficulty → this question's claim on the paper's 100.
 *
 * `ln((1−p)/p)` is the item's empirical difficulty in logits (0 at p = 0.5,
 * positive when most students fail it), and the weight is `e^(slope·logit)` —
 * multiplicative, so it is always positive and a fixed difficulty gap is always
 * the same PRICE RATIO. The band is imposed later, on the ball itself
 * (`shareOut`), not here: clamping the weight would cap a question relative to
 * an even split rather than to the 1.3…6 the mark scheme actually promises.
 */
export function itemWeight(stat: ItemStat | undefined): number {
  if (!stat || stat.seen === 0) return 1;
  const p = Math.min(0.999, Math.max(0.001, shrunkP(stat)));
  return Math.exp(BALL_SLOPE * Math.log((1 - p) / p));
}

/**
 * Rounds to one decimal so the parts still add to the whole.
 *
 * ⚠️ Rounding each ball on its own does NOT: 45 roundings drift by up to two
 * points, and a paper marked out of 100 that adds to 98.4 is unreadable.
 * Largest-remainder in tenths lands the error on whichever balls were rounded
 * hardest and keeps the total exact.
 */
function roundTenths(values: number[], total: number): number[] {
  const tenths = values.map((v) => v * 10);
  const out = tenths.map(Math.floor);
  let left = Math.round(total * 10) - out.reduce((a, b) => a + b, 0);

  // Dearest remainder first when handing tenths out, cheapest first when taking
  // them back — either way the ball that moves is the one least entitled to the
  // value it was given.
  const order = tenths.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);

  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k].i] += 1;
  for (let k = order.length - 1; left < 0 && k >= 0; k--, left++) out[order[k].i] -= 1;

  return out.map((v) => v / 10);
}

/**
 * Weights → balls: proportional to the weight, clamped to [min, max], summing to
 * exactly `total`.
 *
 * ⚠️ Clamping AFTER a plain proportional split does not work — every ball the
 * floor lifts or the ceiling trims has to be paid for by the others, which moves
 * them, which can push more of them into a clamp. The fixed point is found by
 * scaling instead: `sum(clamp(k·wᵢ))` is non-decreasing in `k`, so one bisection
 * lands the `k` at which it equals the total, with the clamps already applied.
 * That is the standard water-filling allocation and it converges in ~50 steps
 * for 45 items.
 *
 * ⚠️ **When the band and the total cannot both hold, the TOTAL wins** and the
 * clamps are relaxed to a plain proportional split. A paper marked out of 100
 * that does not add to 100 is the one failure a teacher cannot read past; a ball
 * of 1.1 on a 90-question paper is merely unusual. Only reachable off the
 * blueprint (fewer than 17 or more than 76 slots).
 */
export function shareOut(weights: number[], total: number, min: number, max: number): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const positive = weights.filter((w) => w > 0);
  const proportional = () => {
    const sum = weights.reduce((a, b) => a + b, 0);
    return roundTenths(
      sum > 0 ? weights.map((w) => (w / sum) * total) : weights.map(() => total / n),
      total,
    );
  };

  if (positive.length === 0 || n * min > total || n * max < total) return proportional();

  const clampedSum = (k: number) =>
    weights.reduce((sum, w) => sum + Math.min(max, Math.max(min, k * w)), 0);

  // At k = 0 every ball is at `min` (sum ≤ total); at k = max/min(w) every ball
  // is at `max` (sum ≥ total). The answer is between them.
  let lo = 0;
  let hi = max / Math.min(...positive);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (clampedSum(mid) < total) lo = mid;
    else hi = mid;
  }

  const k = (lo + hi) / 2;
  return roundTenths(
    weights.map((w) => Math.min(max, Math.max(min, k * w))),
    total,
  );
}

/**
 * What each position PRINTS in the protocol, in paper order.
 *
 * Still per section, because that is the only place the printed values exist —
 * a row's `balls` are its own multiset. It is the provisional mark and the
 * "before" the results page strikes through, nothing more.
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
 */
export function paperMarks(slots: PaperSlot[], stats: Map<string, ItemStat>): SlotMark[] {
  const printed = printedBalls(slots);
  const rows = slots.map((slot, i) => ({ slot, stat: stats.get(slot.key), printedBall: printed[i] }));

  // The paper is repriced only when EVERY slot has enough evidence — see
  // MIN_RESPONSES. Until then it is marked with the protocol's printed table.
  const ready = rows.length > 0 && rows.every((row) => (row.stat?.seen ?? 0) >= MIN_RESPONSES);
  const balls = ready
    ? shareOut(rows.map((row) => itemWeight(row.stat)), PAPER_TOTAL, BALL_MIN, BALL_MAX)
    : rows.map((row) => row.printedBall);

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
      sectionTotal: Math.round((sectionTotals.get(row.slot.sectionId) ?? 0) * 10) / 10,
      provisional: !ready,
    };
  });
}

/** What this paper is marked out of — 100, by construction (`shareOut`). It is
 *  still summed rather than asserted so a provisional paper (printed balls) and
 *  a repriced one report the same way. */
export function paperTotal(marks: SlotMark[]): number {
  return Math.round(marks.reduce((sum, m) => sum + m.ball, 0) * 10) / 10;
}

/**
 * What one student scored under the dynamic marks.
 *
 * `null` for a sitting saved before per-item outcomes were recorded — the raw
 * percentage is what those results have, and inventing a mark from it would be
 * a different number wearing the same label.
 */
export function scoreFor(marks: SlotMark[], items: Record<string, number> | undefined): number | null {
  if (!items) return null;
  const earned = marks.reduce((sum, m) => sum + (items[m.key] ? m.ball : 0), 0);
  return Math.round(earned * 10) / 10;
}
