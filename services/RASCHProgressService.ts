// services/RASCHProgressService.ts
import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { applyBaseline, applyExam, emptyLevels, percentOf } from '@/lib/RASCHlevels';
import { estimateAbility, expectedScore } from '@/lib/RASCHtheta';
import { thetaToLevel, levelToTheta } from '@/lib/RASCHscale';
import { getMathTopics } from '@/lib/Mathstructure';
import { filterTheta, learningRate, predictScore } from '@/lib/RASCHdynamic';
import { applyItems, mergeDiagnostics } from '@/lib/RASCHdiagnosis';
import { TOPIC_KEYS, type TopicKey } from '@/lib/RASCHtopics';
import { EXAM_BLUEPRINT } from '@/lib/Examblueprint';
import type { ExamQuestion } from '@/types/Exam';
import type { Lang } from '@/types/Math';
import type { Ability, Diagnostics, ItemResponse, RASCHAttempt, RASCHLevels, SpotStat, TopicScore } from '@/types/RASCH';
import type { ThetaPoint } from '@/lib/RASCHdynamic';

const LEVELS_COLLECTION = 'RASCH_levels';
const ATTEMPTS_COLLECTION = 'RASCH_attempts';

/**
 * How many recent item responses the levels document carries.
 *
 * Ability is re-estimated from this rolling window, so it tracks current form
 * without ever reading the attempt documents back — three exams' worth of
 * evidence for a few KB, and still ONE document read.
 */
const RECENT_ITEMS_CAP = 135;

/**
 * The ability model's version.
 *
 * v2 added the guessing floor (a 4-option question is right 1 time in 4 by luck)
 * and re-anchored the 0–3 level scale to reliable solving rather than a
 * coin-flip. v1 numbers are inflated — a 28/45 paper rated 2.69/3 — so any
 * document still carrying them is recomputed from its stored item responses on
 * the next read. No extra reads: the items are already in the document.
 */
const MODEL_VERSION = 2;

/** Sittings kept in the ability trace — enough to measure a learning rate. */
const TRACE_CAP = 30;

/** Per-dimension traces are shorter: seven of them, and they only need a trend. */
const TOPIC_TRACE_CAP = 12;

/**
 * The progress, diagnosis and practice pages all read exactly ONE document
 * (RASCH_levels/{uid}) — levels, ability, chart history and the whole weak-spot
 * diagnosis live inside it. Mirrored to localStorage, so a revisit costs zero.
 */
const CACHE_KEY = 'RASCHmodel:levels:v2';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

interface Cached {
  levels: RASCHLevels;
  cachedAt: number;
}

function readCache(uid: string): RASCHLevels | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: Cached = JSON.parse(raw);
    if (parsed.levels?.userId !== uid) return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed.levels;
  } catch {
    return null;
  }
}

function writeCache(levels: RASCHLevels) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ levels, cachedAt: Date.now() } as Cached),
    );
  } catch {
    // quota / private mode — the page still works, it just re-reads next time
  }
}

export function clearLevelsCache() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Recomputes every ability the old model got wrong, from the item responses the
 * document already carries. Pure, and free — no reads, no writes. The corrected
 * values are persisted the next time the student sits anything.
 *
 * A spot (chapter/subtopic) whose responses have aged out of the window loses its
 * θ rather than keeping an inflated one: an unknown level is honest, a wrong one
 * is not.
 */
export function migrateModel(levels: RASCHLevels): RASCHLevels {
  if (levels.modelVersion === MODEL_VERSION) return levels;

  const items = levels.recentItems ?? [];
  if (items.length === 0) return { ...levels, modelVersion: MODEL_VERSION };

  const at = levels.updatedAt ?? Date.now();
  const answered = items.filter((i) => i.chosen !== '');

  const topics = { ...levels.topics };
  for (const key of TOPIC_KEYS) {
    const mine = answered.filter((i) => i.topic === key);
    const ability = estimateAbility(items.filter((i) => i.topic === key));
    topics[key] = {
      ...topics[key],
      ability,
      // The old trace holds v1 θ values on a different scale — mixing them with
      // v2 values would corrupt the learning rate. Restart it from what we can
      // actually recompute.
      thetaTrace:
        mine.length > 0
          ? [{ at, theta: ability.theta, se: ability.se, observed: ability.theta, kind: 'exam' as const }]
          : [],
    };
  }

  const rebuildSpots = (d: Diagnostics | undefined): Diagnostics | undefined => {
    if (!d) return d;
    const fix = (spots: Record<string, SpotStat>, keyOf: (i: ItemResponse) => string) => {
      const groups = new Map<string, ItemResponse[]>();
      for (const item of answered) {
        const k = keyOf(item);
        groups.set(k, [...(groups.get(k) ?? []), item]);
      }
      const out: Record<string, SpotStat> = {};
      for (const [k, spot] of Object.entries(spots)) {
        const group = groups.get(k);
        if (!group) {
          // No recent evidence to recompute from — drop the stale v1 θ rather
          // than keep showing an inflated level. Unknown is honest; wrong isn't.
          const rest = { ...spot };
          delete rest.theta;
          delete rest.se;
          out[k] = rest;
          continue;
        }
        const ability = estimateAbility(group);
        out[k] = { ...spot, theta: ability.theta, se: ability.se };
      }
      return out;
    };

    return {
      ...d,
      chapters: fix(d.chapters, (i) => `${i.topicId}:${i.chapterId}`),
      subtopics: fix(d.subtopics, (i) => `${i.topicId}:${i.chapterId}:${i.subtopicId}`),
    };
  };

  const overall = estimateAbility(items);

  return {
    ...levels,
    modelVersion: MODEL_VERSION,
    topics,
    ability: overall,
    abilityExam: estimateAbility(items.filter((i) => i.kind !== 'practice')),
    abilityPractice: estimateAbility(items.filter((i) => i.kind === 'practice')),
    thetaTrace: [
      { at, theta: overall.theta, se: overall.se, observed: overall.theta, kind: 'exam' as const },
    ],
    diagnosticsExam: rebuildSpots(levels.diagnosticsExam ?? levels.diagnostics),
    diagnosticsPractice: rebuildSpots(levels.diagnosticsPractice),
  };
}

/**
 * The student's levels, ability and diagnosis. Served from localStorage when
 * warm (0 reads); otherwise a single document read.
 */
export async function getRASCHLevels(uid: string, force = false): Promise<RASCHLevels> {
  if (!force) {
    const cached = readCache(uid);
    if (cached && cached.modelVersion === MODEL_VERSION) return cached;
  }

  const snap = await getDoc(doc(db, LEVELS_COLLECTION, uid));
  const raw = snap.exists() ? (snap.data() as RASCHLevels) : emptyLevels(uid, null);
  const levels = migrateModel(raw);
  writeCache(levels);
  return levels;
}

// ─── turning a finished sitting into data ────────────────────────────────────

/** Builds the per-question record — the atom every later analysis needs. */
export function toItemResponses(params: {
  questions: ExamQuestion[];
  answers: Record<string, string>;
  isCorrect: (q: ExamQuestion) => boolean;
  seconds: Record<string, number>;
  kind: 'exam' | 'practice';
}): ItemResponse[] {
  const sectionTopic = new Map(EXAM_BLUEPRINT.map((s) => [s.id, s.topic]));

  return params.questions.map((q) => ({
    kind: params.kind,
    id: q.id,
    topic: sectionTopic.get(q.sectionId) ?? 'numbers',
    topicId: q.topicId,
    chapterId: q.chapterId,
    subtopicId: q.subtopicId,
    difficultyId: q.difficultyId,
    testType: q.testType,
    chosen: params.answers[q.id] ?? '',
    answer: q.answer,
    correct: params.isCorrect(q),
    sec: Math.round(params.seconds[q.id] ?? 0),
    // Calibrated difficulty, if this item has one. It came down with the
    // question — no extra read to use it.
    ...(typeof q.b === 'number' ? { b: q.b } : {}),
  }));
}

/** Tallies per-topic scores from the item records. */
export function scoreByTopic(items: ItemResponse[]): Record<TopicKey, TopicScore> {
  const tally = {} as Record<TopicKey, TopicScore>;
  for (const key of TOPIC_KEYS) tally[key] = { correct: 0, total: 0, percent: 0 };

  for (const item of items) {
    const bucket = tally[item.topic];
    if (!bucket) continue;
    bucket.total += 1;
    if (item.correct) bucket.correct += 1;
  }
  for (const key of TOPIC_KEYS) {
    tally[key].percent = percentOf(tally[key].correct, tally[key].total);
  }
  return tally;
}

/**
 * Folds new responses into the rolling window, then re-estimates ability —
 * overall and per topic — from that window.
 */
/**
 * Appends this sitting's measurement to the ability trace, filtered.
 *
 * This is what makes a FUTURE score predictable at all: plain Rasch holds θ
 * fixed, so it can only describe the present. The trace lets ability move, and a
 * learning rate be measured from how it moves.
 */
function withThetaTrace(
  previous: RASCHLevels,
  sitting: Ability,
  at: number,
  kind: 'exam' | 'practice',
): ThetaPoint[] {
  const trace = previous.thetaTrace ?? [];
  const last = trace.length > 0 ? trace[trace.length - 1] : null;
  const point = filterTheta(
    last ? { theta: last.theta, se: last.se, at: last.at } : null,
    sitting,
    at,
    kind,
  );
  return [...trace, point].slice(-TRACE_CAP);
}

function withAbility(
  previous: RASCHLevels,
  items: ItemResponse[],
  at: number,
  kind: 'exam' | 'practice',
): RASCHLevels {
  const recentItems = [...(previous.recentItems ?? []), ...items].slice(-RECENT_ITEMS_CAP);

  // Three estimates from one window — pure maths on data already in hand, so
  // splitting by source costs nothing. Items recorded before the split carry no
  // `kind`; they were all exams, so that is how they are counted.
  const examItems = recentItems.filter((i) => i.kind !== 'practice');
  const practiceItems = recentItems.filter((i) => i.kind === 'practice');

  const topics = { ...previous.topics };
  for (const key of TOPIC_KEYS) {
    const prior = topics[key];

    // What THIS sitting said about THIS dimension. Only answered items count.
    const sittingItems = items.filter((i) => i.topic === key && i.chosen !== '');

    // A sitting that never touched this topic is not evidence about it — leave
    // the dimension exactly where it was rather than drifting it on nothing.
    const trace = prior?.thetaTrace ?? [];
    const nextTrace =
      sittingItems.length > 0
        ? [
            ...trace,
            filterTheta(
              trace.length > 0
                ? { theta: trace[trace.length - 1].theta, se: trace[trace.length - 1].se, at: trace[trace.length - 1].at }
                : null,
              estimateAbility(sittingItems),
              at,
              kind,
            ),
          ].slice(-TOPIC_TRACE_CAP)
        : trace;

    topics[key] = {
      ...prior,
      // A topic with few items gets a wide standard error, and says so.
      ability: estimateAbility(recentItems.filter((i) => i.topic === key)),
      thetaTrace: nextTrace,
    };
  }

  return {
    ...previous,
    recentItems,
    ability: estimateAbility(recentItems),
    abilityExam: estimateAbility(examItems),
    abilityPractice: estimateAbility(practiceItems),
    topics,
  };
}

/**
 * Saves one finished EXAM against the student's account.
 *
 * One transaction: read the levels doc, fold in the exam (levels + ability +
 * diagnosis), write it back, and append an immutable attempt record carrying the
 * per-question detail. Still 1 read and 2 writes per exam — the item array makes
 * the write bigger, not more numerous.
 */
export async function saveExamResult(params: {
  uid: string;
  examLang: Lang;
  durationSec: number;
  items: ItemResponse[];
}): Promise<RASCHLevels> {
  const { uid, examLang, durationSec, items } = params;
  const at = Date.now();

  const topicScores = scoreByTopic(items);
  const correct = items.filter((i) => i.correct).length;
  const total = items.length;
  const overallPercent = percentOf(correct, total);
  const sittingAbility = estimateAbility(items);

  const levelsRef = doc(db, LEVELS_COLLECTION, uid);
  const attemptRef = doc(collection(db, ATTEMPTS_COLLECTION));

  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(levelsRef);
    const previous = snap.exists() ? migrateModel(snap.data() as RASCHLevels) : null;

    let updated = applyExam(previous, { userId: uid, topicScores, overallPercent, at });
    updated.modelVersion = MODEL_VERSION;
    updated = withAbility(updated, items, at, 'exam');
    updated.thetaTrace = withThetaTrace(updated, sittingAbility, at, 'exam');
    // The legacy pooled rollup becomes the exam rollup — it only ever held exam
    // data, since practice did not exist when it was written.
    const priorExam = previous?.diagnosticsExam ?? previous?.diagnostics;
    updated.diagnosticsExam = applyItems(priorExam, items, at);

    // Record the draw-independent score alongside the raw one on the chart.
    const exams = [...updated.exams];
    if (exams.length > 0) {
      exams[exams.length - 1] = {
        ...exams[exams.length - 1],
        expected: updated.ability?.expected,
      };
      updated.exams = exams;
    }

    tx.set(levelsRef, { ...updated, updatedAtServer: serverTimestamp() });

    const attempt: RASCHAttempt = {
      userId: uid,
      submittedAt: at,
      examLang,
      kind: 'exam',
      correct,
      total,
      percent: overallPercent,
      durationSec,
      topics: topicScores,
      items,
      ability: sittingAbility,
    };
    tx.set(attemptRef, attempt);

    return updated;
  });

  writeCache(next);
  return next;
}

/**
 * Saves a targeted PRACTICE set.
 *
 * Practice sharpens the diagnosis and the ability estimate, but deliberately
 * does NOT touch the exam level or the exam chart: a 10-question drill on your
 * weakest subtopic is not a 45-question mock exam, and letting it move the same
 * number would make the level meaningless.
 */
export async function savePracticeResult(params: {
  uid: string;
  examLang: Lang;
  durationSec: number;
  items: ItemResponse[];
}): Promise<RASCHLevels> {
  const { uid, examLang, durationSec, items } = params;
  const at = Date.now();

  const topicScores = scoreByTopic(items);
  const correct = items.filter((i) => i.correct).length;
  const total = items.length;

  const levelsRef = doc(db, LEVELS_COLLECTION, uid);
  const attemptRef = doc(collection(db, ATTEMPTS_COLLECTION));

  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(levelsRef);
    const previous = snap.exists()
      ? migrateModel(snap.data() as RASCHLevels)
      : emptyLevels(uid, null);

    const updated = withAbility(previous, items, at, 'practice');
    updated.modelVersion = MODEL_VERSION;
    updated.diagnosticsPractice = applyItems(previous.diagnosticsPractice, items, at);
    updated.thetaTrace = withThetaTrace(previous, estimateAbility(items), at, 'practice');
    updated.updatedAt = at;

    tx.set(levelsRef, { ...updated, updatedAtServer: serverTimestamp() });

    const attempt: RASCHAttempt = {
      userId: uid,
      submittedAt: at,
      examLang,
      kind: 'practice',
      correct,
      total,
      percent: percentOf(correct, total),
      durationSec,
      topics: topicScores,
      items,
      ability: estimateAbility(items),
    };
    tx.set(attemptRef, attempt);

    return updated;
  });

  writeCache(next);
  return next;
}

/** Sets the student's self-selected starting level for every topic. 1 write. */
export async function saveBaseline(
  uid: string,
  baseline: Record<TopicKey, number>,
): Promise<RASCHLevels> {
  const levelsRef = doc(db, LEVELS_COLLECTION, uid);

  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(levelsRef);
    const previous = snap.exists() ? (snap.data() as RASCHLevels) : null;
    const updated = applyBaseline(previous, uid, baseline);
    tx.set(levelsRef, { ...updated, updatedAtServer: serverTimestamp() });
    return updated;
  });

  writeCache(next);
  return next;
}

/** Which slice of the analysis a page is looking at. */
export type AnalysisSource = 'all' | 'exam' | 'practice';

/**
 * The rollup for one source. 'all' merges the two rather than storing a third
 * copy. Legacy pooled data (written before the split) is read as exam data.
 */
export function diagnosticsFor(levels: RASCHLevels | null, source: AnalysisSource) {
  if (!levels) return undefined;
  const exam = levels.diagnosticsExam ?? levels.diagnostics;
  const practice = levels.diagnosticsPractice;

  if (source === 'exam') return exam;
  if (source === 'practice') return practice;
  return mergeDiagnostics(exam, practice);
}

/** The ability estimate for one source. */
export function abilityFor(levels: RASCHLevels | null, source: AnalysisSource) {
  if (!levels) return undefined;
  if (source === 'exam') return levels.abilityExam ?? levels.ability;
  if (source === 'practice') return levels.abilityPractice;
  return levels.ability;
}

/**
 * The learning picture: where the student is now, how fast they are moving, and
 * what that implies for a future paper.
 *
 * All of it is computed from the levels document already in hand — no reads.
 */
export function learningPicture(levels: RASCHLevels | null, horizonDays = 14) {
  const trace = levels?.thetaTrace ?? [];
  const last = trace.length > 0 ? trace[trace.length - 1] : null;

  // Prefer the filtered trace; fall back to the plain exam ability estimate for
  // students whose data predates the trace.
  const current = last
    ? { theta: last.theta, se: last.se }
    : levels?.abilityExam ?? levels?.ability
      ? { theta: (levels.abilityExam ?? levels.ability)!.theta, se: (levels.abilityExam ?? levels.ability)!.se }
      : null;

  const rate = learningRate(trace);

  return {
    trace,
    current,
    rate,
    now: predictScore(current, rate, 0),
    future: predictScore(current, rate, horizonDays),
  };
}

/** One vertex of the ability heptagon. */
export interface Dimension {
  key: TopicKey;
  /** Rasch ability for this dimension, in logits. */
  theta: number;
  se: number;
  /** The same ability as an expected score on a standard paper, 0–100 — what a
   *  human can actually read off an axis. */
  score: number;
  /** Where this dimension stood at the previous sitting, 0–100. */
  before: number | null;
  /** score − before, in points. Positive = this dimension improved. */
  delta: number;
  /** The 0–3 level at the previous sitting. Null on the first measurement. */
  levelBefore: number | null;
  /** Sittings that have measured this dimension. */
  measured: number;
  /** The same ability on the 0–3 scale, where 3 = olympiad / master. */
  level: number;
}

/**
 * The seven dimensions of mathematics ability, ready to plot.
 *
 * θ per dimension is what the model actually holds; `score` re-expresses it as
 * "expected % on a standard paper" purely so the axes are legible — logits mean
 * nothing to a student, and a radar with a −2…+2 axis is unreadable.
 *
 * `before` is the previous filtered value on that axis, which is what makes the
 * chart show MOVEMENT rather than just a shape: the two polygons together say
 * "geometry grew, trigonometry shrank".
 */
export function dimensions(levels: RASCHLevels | null): Dimension[] {
  return TOPIC_KEYS.map((key) => {
    const topic = levels?.topics?.[key];
    const trace = topic?.thetaTrace ?? [];
    const last = trace.length > 0 ? trace[trace.length - 1] : null;
    const prev = trace.length > 1 ? trace[trace.length - 2] : null;

    // Fall back to the window estimate for students whose data predates the
    // per-dimension traces.
    const theta = last?.theta ?? topic?.ability?.theta ?? 0;
    const se = last?.se ?? topic?.ability?.se ?? 1.2;

    const score = expectedScore(theta);
    const before = prev ? expectedScore(prev.theta) : null;

    return {
      key,
      theta,
      se,
      score,
      before,
      delta: before === null ? 0 : score - before,
      measured: trace.length,
      level: thetaToLevel(theta),
      levelBefore: prev ? thetaToLevel(prev.theta) : null,
    };
  });
}

/** Overall mathematics ability = the mean of the seven dimensions, in logits. */
export function overallTheta(levels: RASCHLevels | null): number {
  const dims = dimensions(levels).filter((d) => d.measured > 0);
  if (dims.length === 0) return levels?.ability?.theta ?? 0;
  return dims.reduce((sum, d) => sum + d.theta, 0) / dims.length;
}

// ─── The level hierarchy: mathematics → 7 dimensions → 29 chapters ───────────

export interface ChapterLevel {
  topicId: string;
  chapterId: string;
  name: string;
  /** 0–3. Null when the student has never met this chapter — unknown is not zero. */
  level: number | null;
  theta: number | null;
  se: number | null;
  seen: number;
  correct: number;
  mastery: number | null;
}

export interface TopicSection {
  /** "1" = Algebra, "2" = Geometriya — the syllabus grouping the chapters live in. */
  topicId: string;
  name: string;
  chapters: ChapterLevel[];
  /** Mean level over the chapters actually measured. Null if none are. */
  level: number | null;
}

/**
 * Every chapter of the syllabus with the student's level in it, grouped the way
 * the syllabus groups them (Algebra 1–18, Geometriya 1–11).
 *
 * A chapter the student has never seen returns `level: null`, NOT 0. Zero means
 * "measured, and they cannot do it"; null means "we have no idea" — and showing
 * an unmet chapter as 0.00 would be a lie that makes the whole page untrustworthy.
 */
export function chapterLevels(levels: RASCHLevels | null, source: AnalysisSource = 'all'): TopicSection[] {
  const diagnostics = diagnosticsFor(levels, source);

  return getMathTopics().map((topic) => {
    const chapters: ChapterLevel[] = topic.chapters.map((chapter) => {
      const spot = diagnostics?.chapters?.[`${topic.topicId}:${chapter.chapterId}`];
      const theta = typeof spot?.theta === 'number' ? spot.theta : null;

      return {
        topicId: topic.topicId,
        chapterId: chapter.chapterId,
        name: chapter.name,
        level: theta === null ? null : thetaToLevel(theta),
        theta,
        se: typeof spot?.se === 'number' ? spot.se : null,
        seen: spot?.seen ?? 0,
        correct: spot?.correct ?? 0,
        mastery: typeof spot?.mastery === 'number' ? spot.mastery : null,
      };
    });

    const measured = chapters.filter((c) => c.level !== null);
    return {
      topicId: topic.topicId,
      name: topic.name,
      chapters,
      level:
        measured.length > 0
          ? Math.round((measured.reduce((s, c) => s + (c.level ?? 0), 0) / measured.length) * 100) / 100
          : null,
    };
  });
}

/**
 * The headline: one mathematics level, 0–3, where 3 is the master / olympiad tier.
 *
 * It is the mean over the seven dimensions that have actually been measured —
 * never over all seven, or a student who has only ever been tested on geometry
 * would be dragged toward the prior by six dimensions nobody has looked at.
 */
export function mathLevel(levels: RASCHLevels | null): {
  level: number;
  theta: number;
  measuredDimensions: number;
} {
  const dims = dimensions(levels).filter((d) => d.measured > 0);

  if (dims.length === 0) {
    const theta = levels?.ability?.theta ?? levelToTheta(0);
    return { level: thetaToLevel(theta), theta, measuredDimensions: 0 };
  }

  const theta = dims.reduce((sum, d) => sum + d.theta, 0) / dims.length;
  return {
    level: thetaToLevel(theta),
    theta: Math.round(theta * 1000) / 1000,
    measuredDimensions: dims.length,
  };
}
