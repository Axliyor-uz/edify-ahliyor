// ─── Grammar XP: evaluate one submitted session (pure) ──────────────────────
// The server's authority for grammar XP. It keeps its OWN progress record per
// student (enggrammar_xp/{uid}) — the client's enggrammar_progress is never
// trusted for pay decisions — and re-grades every answer from the published
// content. Ports of the Android app's GrammarProgressOps.finishLesson /
// finishLessonTest / finishPractice + GrammarPath.completed (EdifyStudent
// docs/GRAMMAR.md § XP). No Firebase here — app/api/xp/grammar/route.ts loads
// the docs, calls evaluate(), and writes the result in one transaction.
//
// Anti-cheat, in order:
//   1. Every answer must name a real item of the right topic / point; the
//      server grades it (a client can't claim "13 correct").
//   2. One-time rewards (first pass, first 100 %, crowns, sub-level / level)
//      come from the server record, so they pay exactly once.
//   3. The same point again the same UTC day pays 100 % → 50 % → 20 %.
//   4. Time budget: each answer costs MS_PER_ANSWER of wall time (a game round
//      its length); at most BACKLOG_MS may be "banked" (offline play queued),
//      so nothing — bot or human — earns faster than a fast human can play.
//   5. Submissions are idempotent by their client id (the route stores it).

import { gradeItem, type GrammarItem } from './grade';
import { grammarAward, repeatFactor, GRAMMAR_XP, type XpAward, type XpFacts, type XpSession } from './xp';

export const MS_PER_ANSWER = 4_000;
export const SPEED_ROUND_MS = 60_000;
export const HUNT_TEXT_MS = 15_000;
export const BACKLOG_MS = 60 * 60_000;
export const SPEED_MAX_RIGHT = 40;

/** Session sizes (GrammarSessions.kt). */
export const SIZES = { LESSON_PRACTICE: 8, LESSON_CHECK: 5, ROUND: 10, REVIEW: 10, TEST: 12 } as const;

const MAX_CROWNS = 3;
const PASS_PERCENT = 80;
const REVIEW_DAYS = [1, 2, 4, 7, 15, 30];
const DAY_MS = 86_400_000;
/** finishLessonTest's "never due" (Kotlin Long.MAX_VALUE) — Firestore-safe. */
export const NEVER = Number.MAX_SAFE_INTEGER;

export interface PointState {
  passed?: boolean;
  best?: number;
  crowns?: number;
  step?: number;
  due?: number;
  roundDay?: string;
  roundsToday?: number;
}

export interface GrammarXpState {
  schema: 1;
  /** Grammar XP paid so far (also inside users.totalXP). */
  xp: number;
  points: Record<string, PointState>;
  /** One-time completions already paid: "sub:A1.1", "lvl:A1". */
  done: string[];
  /** Time-budget clock (ms). */
  clockAt: number;
}

export const emptyState = (): GrammarXpState => ({ schema: 1, xp: 0, points: {}, done: [], clockAt: 0 });

export interface SubAnswer {
  /** Topic of the item (Review spans topics; defaults to the submission's). */
  t?: string;
  /** Item id. */
  i: string;
  /** Lesson stage: "p" practice, "c" mini-test (check). */
  s?: 'p' | 'c';
  /** The answer (lib/grammar/grade.ts wire format). */
  a: unknown;
  /** A wrong answer coming back at the end — never paid. */
  r?: boolean;
  /** Answered with the 💡 hint — never paid. */
  h?: boolean;
}

export type SubKind = 'lesson' | 'round' | 'review' | 'test' | 'speed' | 'hunt';

export interface Submission {
  id: string;
  kind: SubKind;
  topicId: string;
  pointId?: string;
  answers?: SubAnswer[];
  /** speed: right calls. */
  right?: number;
  /** hunt: the text's id inside its topic, and the misses. */
  textId?: string;
  misses?: number;
}

export interface TopicView {
  id: string;
  level: string;
  sublevel: string;
  /** Published with content (status ready + a topic doc). */
  ready: boolean;
}

/** What evaluate() needs from the published content (preloaded by the route). */
export interface ContentView {
  /** Syllabus topics in order. */
  topics: TopicView[];
  items(topicId: string): Map<string, GrammarItem> | undefined;
  /** The topic's grammar point ids (content), in order. */
  points(topicId: string): string[] | undefined;
  passScore(topicId: string): number;
  pointTitle(topicId: string, pointId: string): string;
  topicTitle(topicId: string): string;
  huntTextExists(topicId: string, textId: string): boolean;
}

export class GrammarXpError extends Error {
  constructor(message: string, public status: number, public code: string, public retryAfterMs?: number) {
    super(message);
  }
}

export interface Evaluation {
  state: GrammarXpState;
  award: XpAward;
  /** First-try answers / their correct ones / score (session result). */
  total: number;
  correct: number;
  percent: number;
  passed: boolean | null;
  /** For users.recentActivity. */
  title: string;
}

export const testKey = (topicId: string) => `${topicId}#test`;
const bad = (msg: string, code = 'BAD_REQUEST') => new GrammarXpError(msg, 400, code);
const pct = (c: number, t: number) => (t === 0 ? 0 : Math.floor((c * 100) / t));

// ── progress ops (GrammarProgressOps) ───────────────────────────────────────

function finishLesson(p: PointState, percent: number, passPercent: number, now: number): PointState {
  if (percent >= passPercent && !p.passed) {
    return { ...p, passed: true, crowns: Math.max(p.crowns || 0, 1), best: Math.max(p.best || 0, percent), step: 0, due: now + REVIEW_DAYS[0] * DAY_MS };
  }
  return { ...p, best: Math.max(p.best || 0, percent) };
}

function finishLessonTest(p: PointState, percent: number, passPercent: number): PointState {
  return { ...p, passed: !!p.passed || percent >= passPercent, best: Math.max(p.best || 0, percent), due: NEVER };
}

function finishPractice(p: PointState, percent: number, now: number): PointState {
  if (!p.passed) return p;
  if (percent < PASS_PERCENT) return { ...p, step: 0, due: now + REVIEW_DAYS[0] * DAY_MS };
  if (now >= (p.due || 0)) {
    const step = Math.min((p.step || 0) + 1, REVIEW_DAYS.length - 1);
    return { ...p, crowns: Math.min((p.crowns || 0) + 1, MAX_CROWNS), step, due: now + REVIEW_DAYS[step] * DAY_MS, best: Math.max(p.best || 0, percent) };
  }
  return { ...p, best: Math.max(p.best || 0, percent) };
}

const roundsToday = (p: PointState | undefined, day: string) => (p && p.roundDay === day ? p.roundsToday || 0 : 0);

/** Sub-levels / levels whose every lesson (all points + the test) is passed. */
export function completed(content: ContentView, points: Record<string, PointState>): Set<string> {
  const topicDone = (t: TopicView) => {
    if (!t.ready) return false;
    const ps = content.points(t.id);
    if (!ps || ps.length === 0) return false;
    return ps.every((id) => points[id]?.passed) && !!points[testKey(t.id)]?.passed;
  };
  const out = new Set<string>();
  const group = (key: (t: TopicView) => string, prefix: string) => {
    const by = new Map<string, TopicView[]>();
    content.topics.forEach((t) => by.set(key(t), [...(by.get(key(t)) || []), t]));
    by.forEach((ts, k) => { if (ts.length > 0 && ts.every(topicDone)) out.add(prefix + k); });
  };
  group((t) => t.sublevel, 'sub:');
  group((t) => t.level, 'lvl:');
  return out;
}

/** Spend the time budget, or refuse with how long to wait. */
function spendClock(state: GrammarXpState, costMs: number, now: number): number {
  const clock = Math.max(state.clockAt || 0, now - BACKLOG_MS) + costMs;
  if (clock > now) {
    throw new GrammarXpError('Juda tez — birozdan keyin qayta urinib ko‘ring.', 429, 'TOO_FAST', clock - now);
  }
  return clock;
}

// ── evaluate ────────────────────────────────────────────────────────────────

export function evaluate(
  prev: GrammarXpState,
  sub: Submission,
  content: ContentView,
  now: number,
  day: string,
): Evaluation {
  const state: GrammarXpState = { ...prev, points: { ...prev.points }, done: [...prev.done] };
  const topic = content.topics.find((t) => t.id === sub.topicId);
  if (!topic) throw bad('Noma’lum mavzu.', 'UNKNOWN_TOPIC');

  if (sub.kind === 'speed' || sub.kind === 'hunt') return evaluateGame(state, sub, content, now, day);

  // ── grade the answers ──
  const answers = Array.isArray(sub.answers) ? sub.answers : [];
  const firstTries = answers.filter((a) => a && !a.r);
  const seen = new Set<string>();
  type Graded = { item: GrammarItem; topicId: string; clean: boolean; stage?: 'p' | 'c' };
  const graded: Graded[] = firstTries.map((a) => {
    if (typeof a.i !== 'string') throw bad('Savol id yo‘q.');
    const topicId = typeof a.t === 'string' && sub.kind === 'review' ? a.t : sub.topicId;
    const key = `${topicId}/${a.i}`;
    if (seen.has(key)) throw bad('Bir savol ikki marta.', 'DUPLICATE_ITEM');
    seen.add(key);
    const item = content.items(topicId)?.get(a.i);
    if (!item) throw bad('Savol topilmadi.', 'UNKNOWN_ITEM');
    return { item, topicId, clean: gradeItem(item, a.a) && !a.h, stage: a.s };
  });
  const limit = { lesson: SIZES.LESSON_PRACTICE + SIZES.LESSON_CHECK, round: SIZES.ROUND, review: SIZES.REVIEW, test: SIZES.TEST }[sub.kind];
  if (limit === undefined) throw bad('kind noto‘g‘ri.');
  if (graded.length === 0) throw bad('Javoblar yo‘q.');
  if (graded.length > limit) throw bad('Javoblar juda ko‘p.', 'TOO_MANY');

  state.clockAt = spendClock(state, firstTries.length * MS_PER_ANSWER, now);
  const before = prev.points;
  const passPercent = Math.trunc(content.passScore(sub.topicId) * 100);
  let session: XpSession;
  let percent: number;
  let correct: number;
  let passed: boolean | null = null;
  let firstPass = false;
  let firstPerfect = false;
  let payPoints: string[];
  const correctByPoint: Record<string, number> = {};
  let title: string;

  if (sub.kind === 'lesson' || sub.kind === 'round') {
    const pointId = sub.pointId || '';
    if (!content.points(sub.topicId)?.includes(pointId)) throw bad('Mavzu qismi topilmadi.', 'UNKNOWN_POINT');
    if (graded.some((g) => g.item.pointId !== pointId || g.item.testOnly)) throw bad('Savol boshqa mavzudan.', 'WRONG_ITEM');
    const cur = before[pointId] || {};
    payPoints = [pointId];
    correctByPoint[pointId] = graded.filter((g) => g.clean).length;
    title = content.pointTitle(sub.topicId, pointId);
    if (sub.kind === 'lesson') {
      const check = graded.filter((g) => g.stage === 'c');
      const practiceIds = new Set(graded.filter((g) => g.stage !== 'c').map((g) => g.item.id));
      const eligible = [...(content.items(sub.topicId)?.values() || [])]
        .filter((it) => it.pointId === pointId && !it.testOnly && !practiceIds.has(it.id)).length;
      if (check.length < Math.max(1, Math.min(SIZES.LESSON_CHECK, eligible))) throw bad('Mini-test to‘liq emas.', 'CHECK_INCOMPLETE');
      if (check.length > SIZES.LESSON_CHECK) throw bad('Mini-test juda uzun.', 'TOO_MANY');
      correct = check.filter((g) => g.clean).length;
      percent = pct(correct, check.length);
      passed = percent >= passPercent;
      const wasPassed = !!cur.passed;
      session = wasPassed ? 'ROUND' : 'LESSON';
      firstPass = passed && !wasPassed;
      firstPerfect = passed && percent === 100 && (cur.best || 0) < 100;
      state.points[pointId] = finishLesson(cur, percent, passPercent, now);
    } else {
      if (!cur.passed) throw new GrammarXpError('Bu qism hali o‘tilmagan.', 409, 'NOT_PASSED');
      correct = correctByPoint[pointId];
      percent = pct(correct, graded.length);
      session = 'ROUND';
      state.points[pointId] = finishPractice(cur, percent, now);
    }
  } else if (sub.kind === 'test') {
    const key = testKey(sub.topicId);
    if (sub.pointId && sub.pointId !== key) throw bad('Test kaliti noto‘g‘ri.');
    const pts = content.points(sub.topicId) || [];
    if (pts.length === 0 || !pts.every((id) => before[id]?.passed)) {
      throw new GrammarXpError('Dars testi hali ochilmagan.', 409, 'NOT_UNLOCKED');
    }
    const pool = content.items(sub.topicId)?.size || 0;
    if (graded.length < Math.min(SIZES.TEST, pool)) throw bad('Test to‘liq emas.', 'TEST_INCOMPLETE');
    const cur = before[key] || {};
    correct = graded.filter((g) => g.clean).length;
    percent = pct(correct, graded.length);
    passed = percent >= passPercent;
    session = cur.passed ? 'ROUND' : 'TEST';
    firstPass = passed && !cur.passed;
    firstPerfect = passed && percent === 100 && (cur.best || 0) < 100;
    state.points[key] = finishLessonTest(cur, percent, passPercent);
    payPoints = [key];
    correctByPoint[key] = correct;
    title = `${content.topicTitle(sub.topicId)} · Lesson test`;
  } else {
    // review: each point scored on its own answers
    const byPoint = new Map<string, Graded[]>();
    for (const g of graded) {
      if (g.item.testOnly) throw bad('Savol boshqa mavzudan.', 'WRONG_ITEM');
      if (!before[g.item.pointId]?.passed) throw new GrammarXpError('Bu qism hali o‘tilmagan.', 409, 'NOT_PASSED');
      byPoint.set(g.item.pointId, [...(byPoint.get(g.item.pointId) || []), g]);
    }
    byPoint.forEach((gs, point) => {
      const c = gs.filter((g) => g.clean).length;
      correctByPoint[point] = c;
      state.points[point] = finishPractice(state.points[point] || {}, pct(c, gs.length), now);
    });
    payPoints = [...byPoint.keys()];
    correct = graded.filter((g) => g.clean).length;
    percent = pct(correct, graded.length);
    session = 'REVIEW';
    title = 'Review';
  }

  const crownsOf = (pts: Record<string, PointState>) => Object.values(pts).reduce((s, p) => s + (p.crowns || 0), 0);
  const crowns = Math.max(0, crownsOf(state.points) - crownsOf(before));

  // One-time sub-level / level completions (only a lesson test can complete one).
  const newlyDone = [...completed(content, state.points)].filter((k) => !state.done.includes(k));
  state.done.push(...newlyDone);

  // CEFR boost: the easiest level among the paid points' lessons.
  const topicOfPoint = (point: string) => content.topics.find((t) =>
    point === testKey(t.id) || content.points(t.id)?.includes(point));
  const cefr = payPoints.map((p) => topicOfPoint(p)?.level || topic.level).sort()[0] || topic.level;

  const roundsTodayByPoint = Object.fromEntries(payPoints.map((p) => [p, roundsToday(before[p], day)]));
  const facts: XpFacts = {
    session, cefr, correctByPoint, roundsTodayByPoint, firstPass, firstPerfect, crowns,
    sublevelsDone: newlyDone.filter((k) => k.startsWith('sub:')).length,
    levelsDone: newlyDone.filter((k) => k.startsWith('lvl:')).length,
  };
  const award = grammarAward(facts);
  for (const p of payPoints) {
    const cur = state.points[p] || {};
    state.points[p] = { ...cur, roundDay: day, roundsToday: roundsToday(cur, day) + 1 };
  }
  state.xp = (state.xp || 0) + award.total;
  return { state, award, total: graded.length, correct, percent, passed, title };
}

function evaluateGame(state: GrammarXpState, sub: Submission, content: ContentView, now: number, day: string): Evaluation {
  if (sub.kind === 'speed') {
    const right = Number.isInteger(sub.right) && sub.right! >= 0 ? Math.min(sub.right!, SPEED_MAX_RIGHT) : -1;
    if (right < 0) throw bad('right noto‘g‘ri.');
    state.clockAt = spendClock(state, SPEED_ROUND_MS, now);
    const xp = right * GRAMMAR_XP.SPEED_ANSWER;
    state.xp = (state.xp || 0) + xp;
    return { state, award: { lines: xp > 0 ? [{ kind: 'ANSWERS', xp }] : [], total: xp }, total: 0, correct: right, percent: 0, passed: null, title: 'Speed round' };
  }
  const textId = String(sub.textId || '');
  if (!content.huntTextExists(sub.topicId, textId)) throw bad('Matn topilmadi.', 'UNKNOWN_TEXT');
  const misses = Number.isInteger(sub.misses) && sub.misses! >= 0 ? sub.misses! : -1;
  if (misses < 0) throw bad('misses noto‘g‘ri.');
  state.clockAt = spendClock(state, HUNT_TEXT_MS, now);
  const key = `hunt:${sub.topicId}/${textId}`;
  const cur = state.points[key] || {};
  const base = misses <= 1 ? GRAMMAR_XP.HUNT_TEXT : GRAMMAR_XP.HUNT_TEXT_MESSY;
  const xp = Math.floor(base * repeatFactor(roundsToday(cur, day)) + 0.5);
  state.points[key] = { ...cur, roundDay: day, roundsToday: roundsToday(cur, day) + 1 };
  state.xp = (state.xp || 0) + xp;
  return { state, award: { lines: xp > 0 ? [{ kind: 'ANSWERS', xp }] : [], total: xp }, total: 0, correct: 0, percent: 0, passed: null, title: 'Error hunter' };
}

/**
 * First server contact: start from what the student already passed in the app
 * (enggrammar_progress points). Seeding can never pay more than playing —
 * already-passed points simply don't get their first-pass bonus again.
 */
export function seedState(clientPoints: unknown, content: ContentView, now: number): GrammarXpState {
  const state = emptyState();
  if (clientPoints && typeof clientPoints === 'object') {
    for (const [key, v] of Object.entries(clientPoints as Record<string, Record<string, unknown>>)) {
      if (!v || typeof v !== 'object' || v.passed !== true || key.length > 200) continue;
      const isTest = key.endsWith('#test');
      state.points[key] = {
        passed: true,
        best: Math.min(100, Math.max(0, Number(v.best) || 0)),
        crowns: isTest ? 0 : Math.min(MAX_CROWNS, Math.max(1, Number(v.crowns) || 1)),
        step: Math.min(REVIEW_DAYS.length - 1, Math.max(0, Number(v.step) || 0)),
        due: isTest ? NEVER : Math.min(now + 30 * DAY_MS, Math.max(now, Number(v.due) || now)),
      };
    }
  }
  state.done = [...completed(content, state.points)];
  return state;
}
