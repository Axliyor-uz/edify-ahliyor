/**
 * Fixed colors of the Penalti seriyasi stadium — the same DELIBERATE
 * exception to the teacher kit's "tokens only" rule as games/_lib/stage.ts
 * (docs/GAMES.md): grass is green and the goal is white under every palette.
 * Defined once here — never inline these hex values elsewhere.
 */

export const PITCH = {
  /** Stands: dark at the top (under the roof), lighter near the pitch. */
  standsTop: '#0b1220',
  stands: '#1e293b',
  tierLine: '#0f172a',
  /** LED advertising board behind the goal. */
  board: '#0b1220',
  boardText: 'rgba(255,255,255,0.55)',
  grass: '#22a04b',
  grassDark: '#1b8a3f',
  line: '#ffffff',
  post: '#ffffff',
  postShade: '#94a3b8',
  net: 'rgba(255,255,255,0.5)',
  netBack: 'rgba(8,15,30,0.62)',
  netSide: 'rgba(8,15,30,0.45)',
  skin: '#f1c27d',
  hair: '#3f2a1d',
  shorts: '#111827',
  boot: '#0b0f19',
  glove: '#facc15',
  gloveEdge: '#ca8a04',
  ball: '#ffffff',
  ballPatch: '#111827',
  shadow: 'rgba(0,0,0,0.28)',
  vignette: 'rgba(2,6,23,0.45)',
} as const;

/** Crowd dot colors besides the two teams'. */
export const CROWD_NEUTRALS = ['#cbd5e1', '#64748b', '#f59e0b', '#e2b07a', '#94a3b8'];
