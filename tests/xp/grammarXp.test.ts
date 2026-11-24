// The grammar XP table — the SAME cases as the Android app's GrammarXpTest.kt.
// Run: npm run test:xp
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grammarAward, type XpFacts } from '../../lib/grammar/xp';

const total = (f: XpFacts) => grammarAward(f).total;

test('a perfect new sub-lesson is about one hundred', () => {
  const a = grammarAward({ session: 'LESSON', cefr: 'A1', correctByPoint: { p: 13 }, firstPass: true, firstPerfect: true, crowns: 1 });
  assert.equal(a.total, 13 * 5 + 25 + 10);
  assert.deepEqual(a.lines.map((l) => l.kind), ['ANSWERS', 'PASS', 'PERFECT']);
});

test('a lesson test is about one hundred fifty', () => {
  assert.equal(total({ session: 'TEST', cefr: 'A1', correctByPoint: { t: 12 }, firstPass: true, firstPerfect: true }), 12 * 5 + 60 + 30);
});

test('review pays practice rate plus crowns', () => {
  assert.equal(total({ session: 'REVIEW', cefr: 'A1', correctByPoint: { a: 6, b: 4 }, crowns: 2 }), 10 * 4 + 2 * 20);
});

test('repeats the same day pay less, milestones never', () => {
  const f: XpFacts = { session: 'ROUND', cefr: 'A1', correctByPoint: { p: 10 } };
  assert.equal(total(f), 40);
  assert.equal(total({ ...f, roundsTodayByPoint: { p: 1 } }), 20);
  assert.equal(total({ ...f, roundsTodayByPoint: { p: 2 } }), 8);
  assert.equal(total({ ...f, roundsTodayByPoint: { p: 9 } }), 8);
  assert.equal(total({ ...f, roundsTodayByPoint: { p: 2 }, crowns: 1 }), 8 + 20);
});

test('pass and perfect only count for lessons and tests', () => {
  assert.equal(total({ session: 'ROUND', cefr: 'A1', correctByPoint: { p: 10 }, firstPass: true, firstPerfect: true }), 40);
});

test('harder levels pay more', () => {
  const a1: XpFacts = { session: 'LESSON', cefr: 'A1', correctByPoint: { p: 13 }, firstPass: true, firstPerfect: true };
  assert.deepEqual(['A1', 'A2', 'B1', 'B2', 'C1'].map((c) => total({ ...a1, cefr: c })), [100, 110, 120, 130, 140]);
  assert.deepEqual(grammarAward({ ...a1, cefr: 'C1' }).lines.at(-1), { kind: 'LEVEL_BOOST', xp: 40 });
});

test('level milestones', () => {
  assert.equal(total({ session: 'TEST', cefr: 'A1', correctByPoint: {}, firstPass: true, firstPerfect: true, sublevelsDone: 1, levelsDone: 1 }), 60 + 30 + 200 + 500);
});

test('nothing right pays nothing', () => {
  assert.deepEqual(grammarAward({ session: 'LESSON', cefr: 'B2', correctByPoint: {} }), { lines: [], total: 0 });
});
