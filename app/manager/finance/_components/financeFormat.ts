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

export const WEEKDAYS_UZ = [
  "Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba",
];

/** Feed section header: "Bugun" / "Kecha" / "Dushanba, 15-iyul" (+ year when not current). */
export function dayLabelOf(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "Bugun";
  const date = new Date(`${dateKey}T00:00:00`);
  const today = new Date(`${todayKey}T00:00:00`);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 1) return "Kecha";
  const label = `${WEEKDAYS_UZ[date.getDay()]}, ${shortDateLabel(dateKey)}`;
  return dateKey.slice(0, 4) === todayKey.slice(0, 4) ? label : `${label} ${dateKey.slice(0, 4)}`;
}

/** "Aziz Abdullayev" → "AA" for avatar circles. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] || "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return (first + second).toUpperCase();
}

/** Charge period label: calendar charges show the month, rolling ones the cycle range. */
export function periodLabelOf(charge: Pick<Charge, "periodKey" | "periodStart" | "periodEnd">): string {
  if (charge.periodKey.length === 7) return monthLabelOf(charge.periodKey);
  return `${shortDateLabel(charge.periodStart)} – ${shortDateLabel(charge.periodEnd)}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  return addMonthsClamped(`${monthKey}-01`, delta).slice(0, 7);
}
