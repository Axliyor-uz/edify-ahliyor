// The shared XP math (lib/xpCore.ts) used by every XP writer — browser and server.
// Run: npm run test:xp
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeUserXp, levelFromXP, DAILY_GOAL_BONUS, LEVEL_UP_BONUS, STREAK_BONUS_7, STREAK_BONUS_30,
} from '../../lib/xpCore';

const NOW = new Date(Date.UTC(2026, 10, 24, 3)); // 08:00 in Tashkent, still Nov 24 UTC
const TODAY = '2026-11-24';
const YESTERDAY = '2026-11-23';

test('a first XP day starts the streak and writes the UTC day key', () => {
  const c = computeUserXp({}, 40, ['Grammar: +40'], NOW);
  assert.equal(c.finalXp, 40);
  assert.equal(c.currentStreak, 1);
  assert.deepEqual(c.dailyHistory, { [TODAY]: 40 });
  assert.equal(c.todayStr, TODAY);
});

test('zero XP never moves the streak', () => {
  const c = computeUserXp({ currentStreak: 4, lastActiveDate: '2026-11-20' }, 0, [], NOW);
  assert.equal(c.currentStreak, 4);
  assert.equal(c.finalXp, 0);
});

test('streak day 7 and day 30 pay their bonuses', () => {
  const d7 = computeUserXp({ currentStreak: 6, lastActiveDate: YESTERDAY }, 10, [], NOW);
  assert.equal(d7.currentStreak, 7);
  assert.equal(d7.finalXp, 10 + STREAK_BONUS_7);
  const d30 = computeUserXp({ currentStreak: 29, lastActiveDate: YESTERDAY, dailyGoal: 1000 }, 10, [], NOW);
  assert.equal(d30.finalXp, 10 + STREAK_BONUS_30);
  // A gap resets to 1, no bonus.
  assert.equal(computeUserXp({ currentStreak: 6, lastActiveDate: '2026-11-20' }, 10, [], NOW).currentStreak, 1);
});

test('the daily goal pays once, on the crossing write', () => {
  const c = computeUserXp({ dailyHistory: { [TODAY]: 180 }, lastActiveDate: TODAY, currentStreak: 1 }, 30, [], NOW);
  assert.equal(c.goalReached, true);
  assert.equal(c.finalXp, 30 + DAILY_GOAL_BONUS);
  const again = computeUserXp({ dailyHistory: { [TODAY]: 235 }, dailyGoalRewardedOn: TODAY, lastActiveDate: TODAY, currentStreak: 1 }, 30, [], NOW);
  assert.equal(again.goalReached, false);
});

test('crossing a level pays the level-up bonus', () => {
  const c = computeUserXp({ totalXP: 990, lastActiveDate: TODAY, currentStreak: 1 }, 20, [], NOW);
  assert.equal(c.leveledUp, true);
  assert.equal(c.finalXp, 20 + LEVEL_UP_BONUS);
  assert.equal(c.newLevel, 2);
  assert.equal(levelFromXP(999), 1);
  assert.equal(levelFromXP(1000), 2);
});

test('dailyHistory keeps the last 30 days', () => {
  const hist: Record<string, number> = {};
  for (let d = 1; d <= 31; d++) hist[`2026-10-${String(d).padStart(2, '0')}`] = 1;
  const c = computeUserXp({ dailyHistory: hist }, 5, [], NOW);
  const keys = Object.keys(c.dailyHistory).sort();
  assert.equal(keys.length, 30);
  assert.equal(keys.at(-1), TODAY);
  assert.equal(keys[0], '2026-10-03');
});
