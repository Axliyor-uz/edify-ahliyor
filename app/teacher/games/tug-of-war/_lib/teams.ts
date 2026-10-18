/**
 * Team identity colors — a DELIBERATE exception to the teacher kit's
 * "no hard-coded colors" rule (docs/GAMES.md, docs/UI_KIT.md): the two teams
 * must read as blue vs red under every palette (emerald, wine, graphite…),
 * so they never come from the M3 tokens. Tints mix with `--m3-surface` so
 * they follow light/dark mode. Defined once here — never inline elsewhere.
 */

export type Team = 'blue' | 'red';
export const TEAMS: Team[] = ['blue', 'red'];

export interface TeamTheme {
  /** Solid fill (characters, score, buttons). */
  solid: string;
  /** Darker shade for text on tints. */
  deep: string;
  /** Soft panel tint that follows light/dark. */
  tint: string;
  /** Slightly stronger tint (answer buttons, chips). */
  tintStrong: string;
  /** Skin-free body shade for the second puller. */
  shade: string;
}

export const TEAM_THEME: Record<Team, TeamTheme> = {
  blue: {
    solid: '#2563eb',
    deep: '#1d4ed8',
    tint: 'color-mix(in oklab, #2563eb 9%, var(--m3-surface-container-lowest))',
    tintStrong: 'color-mix(in oklab, #2563eb 16%, var(--m3-surface-container-lowest))',
    shade: '#1e40af',
  },
  red: {
    solid: '#dc2626',
    deep: '#b91c1c',
    tint: 'color-mix(in oklab, #dc2626 9%, var(--m3-surface-container-lowest))',
    tintStrong: 'color-mix(in oklab, #dc2626 16%, var(--m3-surface-container-lowest))',
    shade: '#991b1b',
  },
};

export const CORRECT_COLOR = '#16a34a';
export const WRONG_COLOR = '#dc2626';

/**
 * "Maydon" (sports field) look of the play screen — chosen 2026-10-17.
 * Fixed game colors like the team colors above; tints mix with the M3
 * surface so dark mode still works.
 */
export const FIELD = {
  /** Screen background: faint blue half | faint red half. */
  page: 'linear-gradient(90deg, color-mix(in oklab, #2563eb 10%, var(--m3-surface)) 0 50%, color-mix(in oklab, #dc2626 10%, var(--m3-surface)) 50% 100%)',
  /** Arena: sky at the top fading into the surface. */
  sky: 'linear-gradient(180deg, color-mix(in oklab, #38bdf8 32%, var(--m3-surface-container-lowest)) 0%, color-mix(in oklab, #38bdf8 10%, var(--m3-surface-container-lowest)) 55%, var(--m3-surface-container-lowest) 100%)',
  grass: '#86cf72',
  grassRing: '#5fae4e',
  grassDot: '#3f7f35',
  timerBg: '#ffcc33',
  timerFg: '#4a3500',
  timerUrgentBg: '#ef4444',
  timerUrgentFg: '#ffffff',
} as const;
