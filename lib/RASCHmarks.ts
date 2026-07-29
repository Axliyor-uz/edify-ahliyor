// lib/RASCHmarks.ts
//
// DYNAMIC MARKS — how a section's ball budget is shared out between its
// questions, from how the cohort actually answered them.
//
// The DTM protocol prints a ball beside every question and they sum to exactly
// 100. Read one row at a time it is really a BUDGET: "Sonlar va amallar" is
// worth 3.5 across its 2 questions, "Algebraik shakl almashtirishlar" 20.6
// across its 11, "Geometriya O" 12.8 across its 4. What the protocol cannot know
// in advance is how that budget should split — which of the 11 algebra questions
// is the hard one. That is a claim about difficulty, and difficulty is
// measurable.
//
// So each section keeps its own total to the decimal, and the questions inside
// it share it in proportion to how hard the cohort found them: the one fewest
// students solved takes the largest slice, the one most of them solved the
// smallest. Sections never trade with each other, and the paper still adds to
// 100.
//
// Until a section has evidence it is marked with the protocol's printed values,
// so an unsat paper is the official table verbatim.
//
// Pure: no Firestore, no React. Contract + traps: docs/RASCH_QUIZ.md.

import { sectionBalls } from './Examblueprint';
import { examSlotKeys } from './ExamTeacher';
import type { ExamQuestion, TestType } from '@/types/Exam';

/** What a blueprint-shaped paper's balls add up to. */
export const PAPER_TOTAL = 100;

/**
 * Responses every slot of a section needs before its budget is redistributed.
 *
 * ⚠️ Under this the section keeps the protocol's PRINTED values, so the first
 * sitting of a paper marks exactly like the official table. One student getting
 * one question wrong is not evidence that it is the hard one.
 *
 * The whole section moves or none of it does — a half-measured section would
 * price measured questions against unmeasured ones, which is not a comparison.
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
 * How far one question's share may travel from an even split, and how fast.
 *
 * `LOGIT_SLOPE` multiplies the item's empirical log-odds of failure, so the
 * scale is the Rasch one the rest of this app speaks; the clamps bound the
 * spread inside a section to ~3.5× between its cheapest and dearest question.
 * ⚠️ Without the clamps one question nobody solved would eat its whole section
 * and the rest would round to zero — a paper where 10 right answers score less
 * than 1 is not a mark scheme.
 */
export const LOGIT_SLOPE = 0.24;
export const MULT_MIN = 0.45;
export const MULT_MAX = 1.6;

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
  /** The ball this question is worth, to one decimal. */
  ball: number;
  /** What the protocol prints in this position, before any redistribution. */
  printedBall: number;
  /** The section's total — fixed, whatever the split inside it. */
  sectionBudget: number;
  /** True while the section is still marked with the printed values. */
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
 * Difficulty → this question's claim on its section's budget.
 *
 * `ln((1−p)/p)` is the item's empirical difficulty in logits (0 at p = 0.5,
 * positive when most students fail it). A linear ramp on that, clamped.
 */
export function itemWeight(stat: ItemStat | undefined): number {
  if (!stat || stat.seen === 0) return 1;
  const p = Math.min(0.999, Math.max(0.001, shrunkP(stat)));
  return Math.min(MULT_MAX, Math.max(MULT_MIN, 1 + LOGIT_SLOPE * Math.log((1 - p) / p)));
}

/**
 * Rounds a section's shares to one decimal so they still add to its budget.
 *
 * ⚠️ Rounding each share on its own does NOT: 11 roundings drift by up to half a
 * point, and a section printed as 20.6 that adds to 20.3 makes the whole table
 * look wrong. Largest-remainder in tenths lands the error on whichever shares
 * were rounded hardest and keeps the total exact — which is what then keeps the
 * paper at 100.
 */
function shareOut(weights: number[], budget: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);

  const tenths = weights.map((w) => (w / sum) * budget * 10);
  const floors = tenths.map(Math.floor);
  let left = Math.round(budget * 10) - floors.reduce((a, b) => a + b, 0);

  const order = tenths
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const out = [...floors];
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out.map((v) => v / 10);
}

/**
 * The whole paper, marked against its cohort — section by section.
 *
 * Nothing here is stored. The marks are derived on every render from the
 * sittings that exist right now, which means **a question's ball moves when a
 * classmate sits the paper**. That is the feature, and the results page says so
 * on screen.
 */
export function paperMarks(slots: PaperSlot[], stats: Map<string, ItemStat>): SlotMark[] {
  const bySection = new Map<string, PaperSlot[]>();
  for (const slot of slots) {
    const list = bySection.get(slot.sectionId) ?? [];
    list.push(slot);
    bySection.set(slot.sectionId, list);
  }

  const marks = new Map<string, SlotMark>();

  for (const [sectionId, sectionSlots] of bySection) {
    const printed = sectionBalls(sectionId, sectionSlots.length);
    // ⚠️ The BUDGET is the protocol's own row total, to the decimal (3.5, 20.6,
    // 12.8…). It is what never changes; everything below only splits it.
    const budget = Math.round(printed.reduce((a, b) => a + b, 0) * 10) / 10;

    const rows = sectionSlots.map((slot, i) => ({
      slot,
      stat: stats.get(slot.key),
      printedBall: printed[i] ?? printed[printed.length - 1] ?? 0,
    }));

    // The section is redistributed only when EVERY slot in it has enough
    // evidence. In practice `seen` is uniform inside a paper (a student sits all
    // of it), so this is really "has the paper been sat MIN_RESPONSES times".
    // A half-measured section would price measured questions against unmeasured
    // ones, which is not a comparison.
    const ready = rows.every((row) => (row.stat?.seen ?? 0) >= MIN_RESPONSES);
    const balls = ready
      ? shareOut(rows.map((row) => itemWeight(row.stat)), budget)
      : rows.map((row) => row.printedBall);

    rows.forEach((row, i) => {
      const seen = row.stat?.seen ?? 0;
      marks.set(row.slot.key, {
        key: row.slot.key,
        number: row.slot.number,
        sectionId,
        testType: row.slot.testType,
        seen,
        correct: row.stat?.correct ?? 0,
        p: seen > 0 ? row.stat!.correct / seen : null,
        ball: balls[i],
        printedBall: row.printedBall,
        sectionBudget: budget,
        provisional: !ready,
      });
    });
  }

  // Back into paper order — the map above is grouped by section.
  return slots.map((slot) => marks.get(slot.key)!).filter(Boolean);
}

/** What this paper is marked out of. 100 for a blueprint-shaped one. */
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
