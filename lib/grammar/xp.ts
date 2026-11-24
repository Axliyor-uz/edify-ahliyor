// ─── Grammar XP table — the server's copy ───────────────────────────────────
// 1:1 port of the Android app's core/grammar/GrammarXp.kt (EdifyStudent,
// docs/GRAMMAR.md § XP). tests/xp/grammarXp.test.ts pins the same cases as the
// app's GrammarXpTest — change both together. Pure: no Firebase.
// Scale: ~10 XP per minute of real learning; one sub-lesson ≈ 100; no daily cap.

export type XpSession = 'LESSON' | 'ROUND' | 'REVIEW' | 'TEST';
export type XpKind = 'ANSWERS' | 'PASS' | 'PERFECT' | 'CROWNS' | 'SUBLEVEL' | 'LEVEL' | 'LEVEL_BOOST';

export interface XpFacts {
  session: XpSession;
  /** CEFR level of the lesson ("A1" … "C1"). */
  cefr: string;
  /** First-try, hint-free right answers per point. */
  correctByPoint: Record<string, number>;
  /** Sessions on that point already finished this UTC day, before this one. */
  roundsTodayByPoint?: Record<string, number>;
  firstPass?: boolean;
  firstPerfect?: boolean;
  crowns?: number;
  sublevelsDone?: number;
  levelsDone?: number;
}

export interface XpLine { kind: XpKind; xp: number }
export interface XpAward { lines: XpLine[]; total: number }

export const GRAMMAR_XP = {
  ANSWER: 5,
  PRACTICE_ANSWER: 4,
  PASS: 25,
  PERFECT: 10,
  TEST_PASS: 60,
  TEST_PERFECT: 30,
  CROWN: 20,
  SUBLEVEL: 200,
  LEVEL: 500,
  SPEED_ANSWER: 1,
  HUNT_TEXT: 10,
  HUNT_TEXT_MESSY: 5,
} as const;

export function levelBoost(cefr: string): number {
  switch (cefr.toUpperCase()) {
    case 'A2': return 1.1;
    case 'B1': return 1.2;
    case 'B2': return 1.3;
    case 'C1': case 'C2': return 1.4;
    default: return 1.0;
  }
}

/** Same point again the same UTC day: 100 % → 50 % → 20 %. */
export function repeatFactor(roundsBefore: number): number {
  if (roundsBefore <= 0) return 1.0;
  if (roundsBefore === 1) return 0.5;
  return 0.2;
}

/** Kotlin's roundToInt (half up, also for negatives toward +∞). */
const roundToInt = (x: number) => Math.floor(x + 0.5);

export function grammarAward(f: XpFacts): XpAward {
  const X = GRAMMAR_XP;
  const isTest = f.session === 'TEST';
  const fresh = f.session === 'LESSON' || isTest;
  const rate = fresh ? X.ANSWER : X.PRACTICE_ANSWER;
  const rounds = f.roundsTodayByPoint || {};
  const answers = Object.entries(f.correctByPoint)
    .reduce((sum, [point, correct]) => sum + roundToInt(correct * rate * repeatFactor(rounds[point] || 0)), 0);
  const lines: XpLine[] = [];
  if (answers > 0) lines.push({ kind: 'ANSWERS', xp: answers });
  if (f.firstPass && fresh) lines.push({ kind: 'PASS', xp: isTest ? X.TEST_PASS : X.PASS });
  if (f.firstPerfect && fresh) lines.push({ kind: 'PERFECT', xp: isTest ? X.TEST_PERFECT : X.PERFECT });
  // A sub-lesson's first crown comes with its pass — PASS already pays for it.
  const crowns = (f.crowns || 0) - (f.session === 'LESSON' && f.firstPass ? 1 : 0);
  if (crowns > 0) lines.push({ kind: 'CROWNS', xp: crowns * X.CROWN });
  if ((f.sublevelsDone || 0) > 0) lines.push({ kind: 'SUBLEVEL', xp: f.sublevelsDone! * X.SUBLEVEL });
  if ((f.levelsDone || 0) > 0) lines.push({ kind: 'LEVEL', xp: f.levelsDone! * X.LEVEL });

  const base = Math.max(0, lines.reduce((s, l) => s + l.xp, 0));
  const boosted = roundToInt(base * levelBoost(f.cefr));
  if (boosted > base) lines.push({ kind: 'LEVEL_BOOST', xp: boosted - base });
  return { lines, total: boosted };
}
