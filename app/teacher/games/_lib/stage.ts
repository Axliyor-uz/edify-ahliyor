/**
 * Fixed colors of the team games (Savol doskasi, Omad g'ildiragi) — the same
 * DELIBERATE exception to the teacher kit's "tokens only" rule as
 * tug-of-war/_lib/teams.ts (docs/GAMES.md): team identity and the game-show
 * stage must look the same under every palette. Tints mix with the M3 surface so dark mode still works.
 * Defined once here — never inline these hex values elsewhere.
 */

export interface GameTeam {
  solid: string;
  deep: string;
  tint: string;
}

const team = (solid: string, deep: string): GameTeam => ({
  solid,
  deep,
  tint: `color-mix(in oklab, ${solid} 12%, var(--m3-surface-container-lowest))`,
});

/** Up to 4 teams, in turn order. */
export const GAME_TEAMS: GameTeam[] = [
  team('#2563eb', '#1e40af'),
  team('#dc2626', '#991b1b'),
  team('#16a34a', '#166534'),
  team('#d97706', '#92400e'),
];

export const TEAM_COUNTS = [2, 3, 4] as const;

export const STAGE = {
  /** Page: soft indigo → pink wash over the surface (follows dark mode). */
  page: 'linear-gradient(150deg, color-mix(in oklab, #6366f1 16%, var(--m3-surface)) 0%, color-mix(in oklab, #a855f7 8%, var(--m3-surface)) 50%, color-mix(in oklab, #ec4899 12%, var(--m3-surface)) 100%)',
  /** Two alternating tile faces + their 3D bottom edge. */
  tileA: 'linear-gradient(160deg, #6366f1 0%, #4f46e5 100%)',
  tileB: 'linear-gradient(160deg, #8b5cf6 0%, #7c3aed 100%)',
  tileEdgeA: '#3730a3',
  tileEdgeB: '#5b21b6',
  /** Floating backdrop shapes. */
  shapes: ['#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#a855f7'],
  correct: '#16a34a',
  wrong: '#dc2626',
  gold: '#f59e0b',
  goldDeep: '#d97706',
} as const;

/** Answer letter badges A–F (white cards, colored badges). */
export const OPTION_COLORS = ['#e11d48', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#ea580c'];
