// ─── Grammar grading — the server's copy ────────────────────────────────────
// 1:1 port of the Android app's GrammarGrading.kt + the grading-relevant part
// of GrammarParser.kt / GrammarMarkup.tapTokens. Items are the dataset's
// questions.json entries (enggrammar_questions/{topicId}.questionsJson).
//
// Answer wire format (one key per type — what the app sends per item):
//   mcq · fill · listen · dialogue  { c: optionIndex }
//   true_false                      { v: saysCorrect }
//   tap_error                       { t: tokenIndex }
//   order · transform · translate   { w: [chip, …] }
//   match                           { m: misses }   (pairs are confirmed live, a finished board is correct)
//   sort                            { s: [bucket per entry] }

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface GrammarItem {
  id: string;
  pointId: string;
  type: string;
  testOnly: boolean;
  raw: Record<string, any>;
}

export type GrammarAnswer =
  | { c: number } | { v: boolean } | { t: number } | { w: string[] } | { m: number } | { s: number[] };

const CHOICE = new Set(['mcq', 'fill', 'listen', 'dialogue']);
const BUILD = new Set(['order', 'transform', 'translate']);
export const ITEM_TYPES = new Set([...CHOICE, ...BUILD, 'true_false', 'tap_error', 'match', 'sort']);

/** questions.json → items by id (unknown types skipped, like the app's tolerant parser). */
export function parseItems(questionsJson: string): Map<string, GrammarItem> {
  const out = new Map<string, GrammarItem>();
  let arr: unknown;
  try { arr = JSON.parse(questionsJson); } catch { return out; }
  if (!Array.isArray(arr)) return out;
  for (const o of arr) {
    if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !ITEM_TYPES.has(o.type)) continue;
    out.set(o.id, { id: o.id, pointId: String(o.point_id || ''), type: o.type, testOnly: o.pool === 'test', raw: o });
  }
  return out;
}

/** "My parents [is|are] at work." → is-wrong flag per token (GrammarMarkup.tapTokens). */
export function tapWrongFlags(sentence: string): boolean[] {
  const words: string[] = [];
  let open: string | null = null;
  for (const word of sentence.split(' ')) {
    if (!word) continue;
    if (open !== null) {
      open += ' ' + word;
      if (word.includes(']')) { words.push(open); open = null; }
    } else if (word.includes('[') && !word.slice(word.indexOf('[')).includes(']')) {
      open = word;
    } else {
      words.push(word);
    }
  }
  if (open !== null) words.push(open);
  return words.map((w) => {
    const o = w.indexOf('[');
    const bar = o >= 0 ? w.indexOf('|', o) : -1;
    const close = bar >= 0 ? w.indexOf(']', bar) : -1;
    return o >= 0 && bar >= 0 && close >= 0;
  });
}

const sameList = <T>(a: T[], b: T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Is [answer] right for [item]? A malformed answer is simply wrong. */
export function gradeItem(item: GrammarItem, answer: any): boolean {
  const o = item.raw;
  if (!answer || typeof answer !== 'object') return false;
  if (CHOICE.has(item.type)) return Number.isInteger(answer.c) && answer.c === o.answer;
  if (item.type === 'true_false') return typeof answer.v === 'boolean' && answer.v === o.correct;
  if (item.type === 'tap_error') {
    return Number.isInteger(answer.t) && tapWrongFlags(String(o.sentence || ''))[answer.t] === true;
  }
  if (BUILD.has(item.type)) {
    if (!Array.isArray(answer.w) || !Array.isArray(o.words)) return false;
    return sameList(answer.w.map((x: unknown) => String(x).trim()), o.words.map((x: unknown) => String(x).trim()));
  }
  if (item.type === 'match') return Number.isInteger(answer.m) && answer.m >= 0;
  if (item.type === 'sort') {
    if (!Array.isArray(answer.s) || !Array.isArray(o.items)) return false;
    return sameList(answer.s, o.items.map((e: any) => e?.bucket));
  }
  return false;
}
