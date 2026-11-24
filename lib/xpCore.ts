// ─── XP core: the pure math behind every XP write ───────────────────────────
// No Firebase imports — shared by the browser writers (lib/xp.ts, client SDK)
// and the server writers (lib/server/xpAdmin.ts, Admin SDK) so the streak,
// daily-goal and level-up rules can never drift between them.
// Conventions (docs/STUDENT.md § Gamification):
//   • dailyHistory keys are UTC (lib/xpDays.ts) and trimmed to 30 entries.
//   • The stored streak advances ONLY on a day that actually earned XP.
//   • Streak bonuses: day 7 → STREAK_BONUS_7, day 30 → STREAK_BONUS_30.
//   • Daily goal (users.dailyGoal, default 200): first crossing per UTC day → bonus.
//   • Level is derived floor(totalXP/1000)+1; crossing a level → bonus.

import { xpDayKey } from '@/lib/xpDays';

export const STREAK_BONUS_7 = 30;
export const STREAK_BONUS_30 = 200;
export const DAILY_GOAL_BONUS = 25;
export const LEVEL_UP_BONUS = 50;
/** Max XP a student can earn from games per UTC day (anti-farming). */
export const GAMES_DAILY_XP_CAP = 60;

export const levelFromXP = (totalXP: number) => Math.floor((totalXP || 0) / 1000) + 1;

export interface XpComputation {
  /** XP actually added to totalXP (base + bonuses). */
  finalXp: number;
  breakdown: string[];
  currentStreak: number;
  leveledUp: boolean;
  newLevel: number;
  goalReached: boolean;
  todayStr: string;
  /** The trimmed dailyHistory to store (only meaningful when finalXp > 0). */
  dailyHistory: Record<string, number>;
}

/** Everything an XP write changes, computed from the user doc as read. */
export function computeUserXp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: Record<string, any>,
  baseXp: number,
  baseBreakdown: string[],
  now: Date = new Date(),
): XpComputation {
  const todayStr = xpDayKey(now);
  const yesterdayStr = xpDayKey(new Date(now.getTime() - 86_400_000));
  const breakdown = [...baseBreakdown];

  let xpToAward = baseXp;
  let currentStreak = userData.currentStreak || 0;
  const lastActive = userData.lastActiveDate || '';
  let streakAdvanced = false;

  if (xpToAward > 0) {
    if (lastActive === todayStr) {
      if (currentStreak === 0) currentStreak = 1;
    } else if (lastActive === yesterdayStr) {
      currentStreak += 1;
      streakAdvanced = true;
    } else {
      currentStreak = 1;
    }
    if (streakAdvanced && currentStreak === 7) { xpToAward += STREAK_BONUS_7; breakdown.push(`7 Day Streak!: +${STREAK_BONUS_7}`); }
    if (streakAdvanced && currentStreak === 30) { xpToAward += STREAK_BONUS_30; breakdown.push(`30 Day Streak!: +${STREAK_BONUS_30}`); }
  }

  const dailyGoal = userData.dailyGoal || 200;
  const earnedTodayBefore = (userData.dailyHistory || {})[todayStr] || 0;
  let goalReached = false;
  if (
    xpToAward > 0 &&
    earnedTodayBefore < dailyGoal &&
    earnedTodayBefore + xpToAward >= dailyGoal &&
    userData.dailyGoalRewardedOn !== todayStr
  ) {
    goalReached = true;
    xpToAward += DAILY_GOAL_BONUS;
    breakdown.push(`Daily Goal!: +${DAILY_GOAL_BONUS}`);
  }

  const prevTotal = userData.totalXP || 0;
  const levelBefore = levelFromXP(prevTotal);
  let leveledUp = false;
  if (xpToAward > 0 && levelFromXP(prevTotal + xpToAward) > levelBefore) {
    leveledUp = true;
    xpToAward += LEVEL_UP_BONUS;
    breakdown.push(`Level Up!: +${LEVEL_UP_BONUS}`);
  }
  const newLevel = levelFromXP(prevTotal + xpToAward);

  let dailyHistory: Record<string, number> = { ...(userData.dailyHistory || {}) };
  if (xpToAward > 0) {
    dailyHistory[todayStr] = (dailyHistory[todayStr] || 0) + xpToAward;
    const sortedDates = Object.keys(dailyHistory).sort();
    if (sortedDates.length > 30) {
      const trimmed: Record<string, number> = {};
      sortedDates.slice(-30).forEach((d) => (trimmed[d] = dailyHistory[d]));
      dailyHistory = trimmed;
    }
  }

  return { finalXp: xpToAward, breakdown, currentStreak, leveledUp, newLevel, goalReached, todayStr, dailyHistory };
}
