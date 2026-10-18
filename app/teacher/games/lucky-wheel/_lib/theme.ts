/**
 * Fixed colors of the Omad g'ildiragi wheel — the same DELIBERATE exception
 * to the teacher kit's "tokens only" rule as games/_lib/stage.ts
 * (docs/GAMES.md): the wheel must look the same under every palette.
 * Defined once here — never inline these hex values elsewhere.
 */

import { SEGMENTS } from './engine';

const POINT_COLORS = ['#6366f1', '#e11d48', '#06b6d4', '#22c55e', '#a855f7', '#f97316', '#14b8a6', '#e11d48', '#0ea5e9', '#f97316'];

export const WHEEL = {
  rimOuter: '#312e81',
  rimInner: '#1e1b4b',
  rimEdge: '#fbbf24',
  bulb: '#fde68a',
  bulbGlow: '#fbbf24',
  pointer: '#ef4444',
  pointerDeep: '#b91c1c',
  double: '#fbbf24',
  doubleDeep: '#d97706',
  doubleInk: '#78350f',
  bankrupt: '#1f2937',
  bankruptDeep: '#030712',
  peg: '#ffffff',
  pegEdge: '#475569',
} as const;

/** Fill of each wedge, in SEGMENTS order (points get the next point color). */
export const WEDGE_FILLS: string[] = (() => {
  let k = 0;
  return SEGMENTS.map((s) =>
    s.kind === 'double' ? 'url(#lw-double)' : s.kind === 'bankrupt' ? 'url(#lw-bankrupt)' : POINT_COLORS[k++ % POINT_COLORS.length],
  );
})();
