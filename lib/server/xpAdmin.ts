// ─── Server XP writer (Admin SDK) ───────────────────────────────────────────
// The server twin of lib/xp.ts `applyUserXp` + `mirrorLeaderboards`: the same
// math (lib/xpCore.ts) and the same document shapes, but written with the
// Admin SDK inside the caller's Admin transaction. Server routes that pay XP
// (/api/xp/grammar) go through here so the student's client never computes or
// writes its own XP.

import { FieldValue, type DocumentReference, type DocumentSnapshot, type Transaction } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { computeUserXp, DAILY_GOAL_BONUS, LEVEL_UP_BONUS } from '@/lib/xpCore';
import { getPeriodIds } from '@/lib/xpDays';

export interface AdminXpOptions {
  xp: number;
  breakdown: string[];
  activityEntry: Record<string, unknown>;
  activityLimit: number;
  extraUserFields?: Record<string, unknown>;
}

export interface AdminXpResult {
  finalXp: number;
  breakdown: string[];
  currentStreak: number;
  leveledUp: boolean;
  newLevel: number;
  goalReached: boolean;
  /** totalXP after this write. */
  totalXP: number;
  /** The global bonuses inside finalXp (shown as their own reward lines). */
  bonuses: { streak: number; dailyGoal: number; levelUp: number };
  displayName: string;
  avatar: string | null;
}

/** Apply an XP award to users/{uid}; `userSnap` must be read in the same transaction. */
export function applyUserXpAdmin(
  tx: Transaction,
  userRef: DocumentReference,
  userSnap: DocumentSnapshot,
  opts: AdminXpOptions,
  now: Date = new Date(),
): AdminXpResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userData: Record<string, any> = userSnap.exists ? userSnap.data()! : {};
  const c = computeUserXp(userData, opts.xp, opts.breakdown, now);
  const existingActivity = Array.isArray(userData.recentActivity) ? userData.recentActivity : [];
  const recentActivity = [opts.activityEntry, ...existingActivity].slice(0, opts.activityLimit);

  // ⚠️ Never write `email` (or any contact field) here — users/{uid} is world-readable.
  tx.set(userRef, {
    totalXP: FieldValue.increment(c.finalXp),
    recentActivity,
    lastActiveTimestamp: FieldValue.serverTimestamp(),
    ...(c.finalXp > 0
      ? {
          currentStreak: c.currentStreak,
          dailyHistory: c.dailyHistory,
          lastActiveDate: c.todayStr,
          ...(c.goalReached ? { dailyGoalRewardedOn: c.todayStr } : {}),
        }
      : {}),
    ...(opts.extraUserFields || {}),
  }, { merge: true });

  return {
    finalXp: c.finalXp,
    breakdown: c.breakdown,
    currentStreak: c.currentStreak,
    leveledUp: c.leveledUp,
    newLevel: c.newLevel,
    goalReached: c.goalReached,
    totalXP: (userData.totalXP || 0) + c.finalXp,
    bonuses: (() => {
      const levelUp = c.leveledUp ? LEVEL_UP_BONUS : 0;
      const dailyGoal = c.goalReached ? DAILY_GOAL_BONUS : 0;
      return { streak: Math.max(0, c.finalXp - opts.xp - levelUp - dailyGoal), dailyGoal, levelUp };
    })(),
    displayName: userData.displayName || 'Student',
    avatar: userData.photoURL || null,
  };
}

/** Mirror onto the 4 global period leaderboards + every class leaderboard (same tx). */
export function mirrorLeaderboardsAdmin(
  tx: Transaction,
  uid: string,
  xp: number,
  identity: { displayName: string | null; avatar: string | null },
  classIds: string[],
  now: Date = new Date(),
) {
  if (xp <= 0) return;
  const { dayId, weekId, monthId, globalId } = getPeriodIds(now);
  const lbData = {
    uid,
    displayName: identity.displayName || 'Student',
    avatar: identity.avatar || null,
    xp: FieldValue.increment(xp),
    lastActive: FieldValue.serverTimestamp(),
  };
  [dayId, weekId, monthId, globalId].forEach((pid) =>
    tx.set(adminDb.collection('leaderboards').doc(pid).collection('users').doc(uid), lbData, { merge: true }),
  );
  classIds.forEach((cid) =>
    tx.set(adminDb.collection('classes').doc(cid).collection('leaderboard').doc(uid), lbData, { merge: true }),
  );
}

/** Classes whose leaderboard this student is on (read before the transaction). */
export async function studentClassIds(uid: string): Promise<string[]> {
  const snap = await adminDb.collection('classes').where('studentIds', 'array-contains', uid).get();
  return snap.docs.map((d) => d.id);
}

/** Level-up notification (same doc shape as services/notificationService.ts). */
export async function notifyLevelUpAdmin(uid: string, newLevel: number) {
  await adminDb.collection('notifications').add({
    userId: uid,
    type: 'levelup',
    title: `Level ${newLevel}!`,
    message: `You reached level ${newLevel} — +${LEVEL_UP_BONUS} XP bonus. Keep it up!`,
    link: '/profile',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => {});
}
