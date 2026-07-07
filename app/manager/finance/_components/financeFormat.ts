// Route-local formatting helpers for the finance UI (uz labels).

import { addMonthsClamped } from "@/lib/finance/billingEngine";
import type { Charge } from "@/types/finance";

export const MONTHS_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

/** "2026-07" → "Iyul 2026". */
export function monthLabelOf(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTHS_UZ[(m || 1) - 1]} ${y}`;
}

/** "2026-07-15" → "15-iyul". */
export function shortDateLabel(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number);
  return `${d}-${MONTHS_UZ[(m || 1) - 1].toLowerCase()}`;
}

/** Charge period label: calendar charges show the month, rolling ones the cycle range. */
export function periodLabelOf(charge: Pick<Charge, "periodKey" | "periodStart" | "periodEnd">): string {
  if (charge.periodKey.length === 7) return monthLabelOf(charge.periodKey);
  return `${shortDateLabel(charge.periodStart)} – ${shortDateLabel(charge.periodEnd)}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  return addMonthsClamped(`${monthKey}-01`, delta).slice(0, 7);
}
