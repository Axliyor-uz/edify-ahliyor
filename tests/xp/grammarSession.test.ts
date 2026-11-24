// Server-side grammar session evaluation: grading, one-time rewards, the
// repeat factor, the time budget and every way a forged submission is refused.
// Run: npm run test:xp
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeItem, parseItems, tapWrongFlags } from '../../lib/grammar/grade';
import {
  completed, emptyState, evaluate, seedState, GrammarXpError, MS_PER_ANSWER, BACKLOG_MS,
  type ContentView, type GrammarXpState, type SubAnswer, type Submission,
} from '../../lib/grammar/session';

const DAY = '2026-11-24';
const NOW = Date.UTC(2026, 10, 24, 12);

// Topic t1 (A1.1): points a, b; 12 practice items each (mcq, answer 1) + 4 test-only items.
// Topic t2 (A1.2): point c.
function q(id: string, point: string, pool?: string) {
  return { id, point_id: point, type: 'mcq', difficulty: 2, options: [{ text: 'x' }, { text: 'y' }], answer: 1, ...(pool ? { pool } : {}) };
}
const t1 = parseItems(JSON.stringify([
  ...Array.from({ length: 12 }, (_, i) => q(`a${i}`, 'a')),
  ...Array.from({ length: 12 }, (_, i) => q(`b${i}`, 'b')),
  ...Array.from({ length: 4 }, (_, i) => q(`ta${i}`, 'a', 'test')),
]));
const t2 = parseItems(JSON.stringify(Array.from({ length: 14 }, (_, i) => q(`c${i}`, 'c'))));
const content: ContentView = {
  topics: [
    { id: 't1', level: 'A1', sublevel: 'A1.1', ready: true },
    { id: 't2', level: 'A1', sublevel: 'A1.2', ready: true },
  ],
  items: (t) => ({ t1, t2 } as Record<string, typeof t1>)[t],
  points: (t) => ({ t1: ['a', 'b'], t2: ['c'] } as Record<string, string[]>)[t],
  passScore: () => 0.8,
  pointTitle: (_t, p) => `Point ${p}`,
  topicTitle: (t) => `Topic ${t}`,
  huntTextExists: (t, id) => t === 't1' && id === 'eh_01',
};

const right = (i: string, s?: 'p' | 'c', extra: Partial<SubAnswer> = {}): SubAnswer => ({ i, s, a: { c: 1 }, ...extra });
const wrong = (i: string, s?: 'p' | 'c'): SubAnswer => ({ i, s, a: { c: 0 } });
const lesson = (point: string, answers: SubAnswer[]): Submission => ({ id: 'x', kind: 'lesson', topicId: point === 'c' ? 't2' : 't1', pointId: point, answers });
function run(state: GrammarXpState, sub: Submission, now = NOW, day = DAY) {
  return evaluate(state, sub, content, now, day);
}
function code(fn: () => unknown): string {
  try { fn(); } catch (e) { if (e instanceof GrammarXpError) return e.code; throw e; }
  return 'OK';
}

// 8 practice (p0..p7) + 4 unseen check items (p8..p11) — only 4 left unseen, so 4 is a full check.
const fullLesson = (p: string, checkRight = 4) => lesson(p, [
  ...Array.from({ length: 8 }, (_, i) => right(`${p}${i}`, 'p')),
  ...Array.from({ length: 4 }, (_, i) => (i < checkRight ? right : wrong)(`${p}${i + 8}`, 'c')),
]);

test('grading: every answer type', () => {
  const items = parseItems(JSON.stringify([
    { id: 'tf', point_id: 'a', type: 'true_false', sentence: 's', correct: false },
    { id: 'te', point_id: 'a', type: 'tap_error', sentence: 'My parents [is|are] at work.' },
    { id: 'or', point_id: 'a', type: 'order', words: ['I', 'am', 'here'] },
    { id: 'ma', point_id: 'a', type: 'match', pairs: [['a', 'b'], ['c', 'd']] },
    { id: 'so', point_id: 'a', type: 'sort', buckets: ['x', 'y'], items: [{ text: 'a', bucket: 1 }, { text: 'b', bucket: 0 }] },
    { id: 'zz', point_id: 'a', type: 'weird' },
  ]));
  assert.equal(items.has('zz'), false);
  assert.equal(gradeItem(items.get('tf')!, { v: false }), true);
  assert.equal(gradeItem(items.get('tf')!, { v: true }), false);
  assert.equal(gradeItem(items.get('te')!, { t: 2 }), true);
  assert.equal(gradeItem(items.get('te')!, { t: 1 }), false);
  assert.equal(gradeItem(items.get('or')!, { w: ['I', 'am', ' here'] }), true);
  assert.equal(gradeItem(items.get('or')!, { w: ['am', 'I', 'here'] }), false);
  assert.equal(gradeItem(items.get('ma')!, { m: 2 }), true);
  assert.equal(gradeItem(items.get('so')!, { s: [1, 0] }), true);
  assert.equal(gradeItem(items.get('so')!, { s: [0, 1] }), false);
  assert.equal(gradeItem(items.get('or')!, null), false);
  assert.deepEqual(tapWrongFlags('I [has been|have been] here, [is|are].'), [false, true, false, true]);
});

test('a perfect new sub-lesson pays 100 once; replaying it pays the round rate', () => {
  const first = run(emptyState(), fullLesson('a'));
  assert.equal(first.passed, true);
  assert.equal(first.award.total, 12 * 5 + 25 + 10);
  assert.equal(first.state.points.a.passed, true);
  assert.equal(first.state.points.a.crowns, 1);
  assert.equal(first.state.xp, first.award.total);
  // Same lesson again, same day, later: round rate (4) × 50 %, no bonuses.
  const again = run(first.state, fullLesson('a'), NOW + 3_600_000);
  assert.equal(again.award.total, Math.round(12 * 4 * 0.5));
});

test('a failed mini-test pays the answers but no pass bonus', () => {
  const r = run(emptyState(), fullLesson('a', 2));
  assert.equal(r.passed, false);
  assert.equal(r.percent, 50);
  assert.equal(r.award.total, 10 * 5);
  assert.equal(r.state.points.a.passed, undefined);
});

test('hinted and retried answers are never paid', () => {
  const sub = lesson('a', [
    right('a0', 'p', { h: true }), right('a1', 'p'), right('a1', 'p', { r: true }),
    ...Array.from({ length: 5 }, (_, i) => right(`a${i + 7}`, 'c')),
  ]);
  const r = run(emptyState(), sub);
  // a1 once + 5 check = 6 paid answers; a0 hinted, the retry of a1 ignored.
  assert.equal(r.award.lines[0].xp, 6 * 5);
});

test('forged submissions are refused', () => {
  const s = emptyState();
  assert.equal(code(() => run(s, lesson('a', [right('nope', 'c')]))), 'UNKNOWN_ITEM');
  assert.equal(code(() => run(s, lesson('a', [right('b0', 'c')]))), 'WRONG_ITEM');
  assert.equal(code(() => run(s, lesson('a', [right('ta0', 'c')]))), 'WRONG_ITEM');
  assert.equal(code(() => run(s, lesson('a', [right('a8', 'c'), right('a8', 'c')]))), 'DUPLICATE_ITEM');
  assert.equal(code(() => run(s, lesson('a', [right('a8', 'c')]))), 'CHECK_INCOMPLETE');
  assert.equal(code(() => run(s, lesson('a', Array.from({ length: 12 }, (_, i) => right(`a${i}`, 'c'))))), 'TOO_MANY');
  assert.equal(code(() => run(s, { id: 'x', kind: 'round', topicId: 't1', pointId: 'a', answers: [right('a0')] })), 'NOT_PASSED');
  assert.equal(code(() => run(s, { id: 'x', kind: 'test', topicId: 't1', answers: [right('a0')] })), 'NOT_UNLOCKED');
  assert.equal(code(() => run(s, { id: 'x', kind: 'lesson', topicId: 'zz', pointId: 'a', answers: [] })), 'UNKNOWN_TOPIC');
  assert.equal(code(() => run(s, { id: 'x', kind: 'hunt', topicId: 't1', textId: 'eh_99', misses: 0 })), 'UNKNOWN_TEXT');
});

test('time budget: bursts beyond the backlog are refused, then allowed later', () => {
  let s = emptyState();
  // A bot fires lessons back to back: each costs 12 × 4 s; the 1 h backlog runs out.
  let paid = 0;
  let refusedAt = -1;
  for (let n = 0; n < 200; n++) {
    const sub = n % 2 === 0 ? fullLesson('a') : fullLesson('b');
    const c = code(() => { s = run(s, sub).state; });
    if (c === 'TOO_FAST') { refusedAt = n; break; }
    paid++;
  }
  assert.equal(refusedAt, Math.floor(BACKLOG_MS / (12 * MS_PER_ANSWER)));
  assert.ok(paid > 0);
  // A minute later there is room again.
  assert.equal(code(() => run(s, fullLesson('a'), NOW + 60_000)), 'OK');
});

test('the lesson test unlocks after every point; passing it completes the sub-level once', () => {
  let s = run(emptyState(), fullLesson('a')).state;
  s = run(s, fullLesson('b')).state;
  const testAnswers = [...Array.from({ length: 4 }, (_, i) => right(`ta${i}`)), ...Array.from({ length: 8 }, (_, i) => right(`b${i}`))];
  const t = run(s, { id: 'x', kind: 'test', topicId: 't1', answers: testAnswers });
  assert.equal(t.passed, true);
  assert.deepEqual(t.award.lines.map((l) => l.kind), ['ANSWERS', 'PASS', 'PERFECT', 'SUBLEVEL']);
  assert.equal(t.award.total, 12 * 5 + 60 + 30 + 200);
  assert.deepEqual(t.state.done, ['sub:A1.1']);
  // Retaking the passed test: no bonus, no second sub-level payment.
  const again = run(t.state, { id: 'y', kind: 'test', topicId: 't1', answers: testAnswers }, NOW + 3_600_000);
  assert.deepEqual(again.award.lines.map((l) => l.kind), ['ANSWERS']);
});

test('review: a due point earns its crown; early practice only trains', () => {
  const s = run(emptyState(), fullLesson('a')).state;
  const review = (now: number) => run(s, {
    id: 'r', kind: 'review', topicId: 't1', answers: Array.from({ length: 10 }, (_, i) => ({ ...right(`a${i}`), t: 't1' })),
  }, now, now === NOW ? DAY : '2026-11-26');
  const early = review(NOW);
  assert.equal(early.state.points.a.crowns, 1);
  const due = review(NOW + 2 * 86_400_000);
  assert.equal(due.state.points.a.crowns, 2);
  assert.equal(due.award.total, 10 * 4 + 20);
});

test('games: speed is capped per round; hunt texts repeat at the reduced rate', () => {
  const sp = run(emptyState(), { id: 's', kind: 'speed', topicId: 't1', right: 500 });
  assert.equal(sp.award.total, 40);
  const h1 = run(emptyState(), { id: 'h', kind: 'hunt', topicId: 't1', textId: 'eh_01', misses: 0 });
  assert.equal(h1.award.total, 10);
  const h2 = run(h1.state, { id: 'h2', kind: 'hunt', topicId: 't1', textId: 'eh_01', misses: 3 }, NOW + 60_000);
  assert.equal(h2.award.total, 3); // 5 × 50 %
});

test('seeding from the app keeps passes, never pays them again, clamps junk', () => {
  const s = seedState({
    a: { passed: true, crowns: 9, best: 100, step: 2, due: 1 },
    b: { passed: false },
    ['x'.repeat(300)]: { passed: true },
  }, content, NOW);
  assert.deepEqual(Object.keys(s.points), ['a']);
  assert.equal(s.points.a.crowns, 3);
  assert.equal(s.points.a.due, NOW);
  const replay = run(s, fullLesson('a'));
  assert.equal(replay.award.lines.some((l) => l.kind === 'PASS'), false);
  assert.deepEqual([...completed(content, s.points)], []);
});
