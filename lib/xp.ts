// ─── The single XP write path ────────────────────────────────────────────────
// Both live XP writers (the assignment runner and checkers) run their own
// `runTransaction` but MUST route the user-doc mutation and the leaderboard
// mirrors through these helpers, inside that same transaction. That is what
// keeps `users.totalXP` and the leaderboard `xp` counters atomic — the old
// split "transaction then separate batch" left them permanently desynced when
// the batch failed.
//
// Conventions enforced here (docs/STUDENT.md § Gamification):
//   • dailyHistory keys are UTC (lib/xpDays.ts) and trimmed to 30 entries.
//   • The stored streak advances ONLY on a day that actually earned XP —
//     zero-XP submissions must not keep a streak alive that the displayed
//     streak (recomputed from dailyHistory) would show as broken.
//   • Streak bonuses: day 7 → +30, day 30 → +200.
//   • Daily goal (users.dailyGoal, default 200): first time a day's XP crosses
//     it → +25, once per UTC day (users.dailyGoalRewardedOn).
//   • Level is derived floor(totalXP/1000)+1; crossing a level → +50, and the
//     caller gets `leveledUp` back to notify.

import type { Transaction, DocumentReference, DocumentSnapshot } from 'firebase/firestore';
import { doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getPeriodIds } from '@/lib/xpDays';
import { computeUserXp, LEVEL_UP_BONUS } from '@/lib/xpCore';
import { sendNotification } from '@/services/notificationService';

// The numbers and the math live in lib/xpCore.ts (shared with the server writer).
export {
  STREAK_BONUS_7, STREAK_BONUS_30, DAILY_GOAL_BONUS, LEVEL_UP_BONUS, GAMES_DAILY_XP_CAP, levelFromXP,
} from '@/lib/xpCore';

export interface ApplyUserXpOptions {
  /** Base XP the caller computed (may be 0 — the doc is still touched for activity). */
  xp: number;
  /** Breakdown labels in "Label: +N" form; bonus lines are appended here. */
  breakdown: string[];
  /** Entry prepended to users.recentActivity. */
  activityEntry: Record<string, unknown>;
  /** How many recentActivity entries to keep (5 for tests, 10 for games). */
  activityLimit: number;
  /** Extra fields merged into the same user-doc write (e.g. gamesDaily). */
  extraUserFields?: Record<string, unknown>;
}

export interface ApplyUserXpResult {
  finalXp: number;
  breakdown: string[];
  currentStreak: number;
  leveledUp: boolean;
  newLevel: number;
  goalReached: boolean;
  latestName: string;
  latestAvatar: string | null;
}

/**
 * Apply an XP award to `users/{uid}` inside the caller's transaction.
 * `userSnap` must come from `transaction.get(userRef)` in that same transaction.
 */
export function applyUserXp(
  transaction: Transaction,
  userRef: DocumentReference,
  userSnap: DocumentSnapshot,
  opts: ApplyUserXpOptions,
): ApplyUserXpResult {
  const userData: Record<string, any> = userSnap.exists() ? userSnap.data()! : {};
  const {
    finalXp: xpToAward, breakdown, currentStreak, leveledUp, newLevel, goalReached, todayStr, dailyHistory,
  } = computeUserXp(userData, opts.xp, opts.breakdown);

  const existingActivity = Array.isArray(userData.recentActivity) ? userData.recentActivity : [];
  const recentActivity = [opts.activityEntry, ...existingActivity].slice(0, opts.activityLimit);

  // ⚠️ Never write `email` (or any contact field) here — users/{uid} is
  // world-readable; contact lives in users/{uid}/private/contact (docs/AUTH.md).
  const update: Record<string, unknown> = {
    totalXP: increment(xpToAward),
    recentActivity,
    lastActiveTimestamp: serverTimestamp(),
    ...(xpToAward > 0
      ? {
          currentStreak,
          dailyHistory,
          lastActiveDate: todayStr,
          ...(goalReached ? { dailyGoalRewardedOn: todayStr } : {}),
        }
      : {}),
    ...(opts.extraUserFields || {}),
  };
  transaction.set(userRef, update, { merge: true });

  return {
    finalXp: xpToAward,
    breakdown,
    currentStreak,
    leveledUp,
    newLevel,
    goalReached,
    latestName: userData.displayName || 'Student',
    latestAvatar: userData.photoURL || null,
  };
}

/**
 * Mirror an XP award onto the 4 global leaderboard period docs and each
 * per-class leaderboard, INSIDE the same transaction as the user-doc write.
 * No-op when xp is 0 (zero-XP events never touch leaderboards — documented).
 */
export function mirrorLeaderboards(
  transaction: Transaction,
  uid: string,
  xp: number,
  identity: { displayName: string | null; avatar: string | null; classId?: string | null },
  classIds: string[],
) {
  if (xp <= 0) return;
  const { dayId, weekId, monthId, globalId } = getPeriodIds();
  const lbData = {
    uid,
    displayName: identity.displayName || 'Student',
    avatar: identity.avatar || null,
    ...(identity.classId ? { classId: identity.classId } : {}),
    xp: increment(xp),
    lastActive: serverTimestamp(),
  };
  [dayId, weekId, monthId, globalId].forEach((pid) =>
    transaction.set(doc(db, 'leaderboards', pid, 'users', uid), lbData, { merge: true }),
  );
  classIds.forEach((cid) =>
    transaction.set(doc(db, 'classes', cid, 'leaderboard', uid), lbData, { merge: true }),
  );
}

/** Fire-and-forget level-up notification (call AFTER the transaction commits). */
export function notifyLevelUp(uid: string, newLevel: number) {
  sendNotification(
    uid,
    'levelup',
    `Level ${newLevel}!`,
    `You reached level ${newLevel} — +${LEVEL_UP_BONUS} XP bonus. Keep it up!`,
    '/profile',
  ).catch(() => {});
}
