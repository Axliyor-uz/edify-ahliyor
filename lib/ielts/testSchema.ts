// Structure utilities shared by the builders, the admin JSON import, and the save path:
// global renumbering (same algorithm as the reading builder), answer-key extraction/stripping
// (the security split), JSON validation, and per-type breakdown for library cards.

import {
  IELTS_QUESTION_TYPES,
  type IeltsAnswerKeyDoc,
  type IeltsKeyEntry,
  type IeltsListeningTest,
  type IeltsQuestionBlock,
  type IeltsReadingTest,
} from './types';

type AnyTest = IeltsReadingTest | IeltsListeningTest;

function blockContainers(test: AnyTest): IeltsQuestionBlock[][] {
  if (test.module === 'listening') return (test.parts || []).map((p) => p.questions || []);
  return (test.passages || []).map((p) => p.questions || []);
}

/** Global question numbering — mirrors the reading builder: one number per row, except
 * list_selection which consumes max(1, correct_answer.length) numbers. Mutates in place. */
export function renumberTest(test: AnyTest): number {
  let counter = 1;
  for (const blocks of blockContainers(test)) {
    for (const qb of blocks) {
      qb.start_question = counter;
      for (const row of qb.questions || []) {
        row.question_number = counter;
        if (qb.type === 'list_selection') {
          const n = Array.isArray(row.correct_answer) ? Math.max(1, row.correct_answer.length) : 1;
          counter += n;
        } else {
          counter += 1;
        }
      }
      qb.end_question = counter - 1;
    }
  }
  test.total_questions = counter - 1;
  return test.total_questions;
}

const FREE_TEXT_TYPES = new Set([
  'summary_completion', 'sentence_completion', 'short_answer',
  'table_completion', 'flowchart_completion', 'diagram_completion',
]);

/** Build the ielts_answer_keys payload from a fully-authored test (answers still inline). */
export function extractAnswerKey(test: AnyTest): IeltsAnswerKeyDoc['keys'] {
  const keys: Record<string, IeltsKeyEntry> = {};
  for (const blocks of blockContainers(test)) {
    for (const qb of blocks) {
      for (const row of qb.questions || []) {
        if (row.correct_answer == null) continue;
        const entry: IeltsKeyEntry = { t: qb.type, a: row.correct_answer };
        if (qb.type === 'list_selection' && Array.isArray(row.correct_answer)) {
          entry.span = Math.max(1, row.correct_answer.length);
        }
        if (qb.word_limit && FREE_TEXT_TYPES.has(qb.type) && qb.options == null) {
          entry.wl = qb.word_limit;
        }
        keys[String(row.question_number)] = entry;
      }
    }
  }
  return keys;
}

/** Deep-clone the test with every correct_answer removed and answers_split set. */
export function stripAnswers<T extends AnyTest>(test: T): T {
  const clone: T = JSON.parse(JSON.stringify(test));
  for (const blocks of blockContainers(clone)) {
    for (const qb of blocks) {
      for (const row of qb.questions || []) delete row.correct_answer;
    }
  }
  clone.answers_split = true;
  return clone;
}

/** Question-type mix for library cards, e.g. { true_false_not_given: 7, summary_completion: 6 }. */
export function typeBreakdown(test: AnyTest): Record<string, number> {
  const out: Record<string, number> = {};
  for (const blocks of blockContainers(test)) {
    for (const qb of blocks) {
      const n = Math.max(0, (qb.end_question || 0) - (qb.start_question || 0) + 1);
      out[qb.type] = (out[qb.type] || 0) + (n || (qb.questions || []).length);
    }
  }
  return out;
}

// ---------- JSON import validation (admin dataset) ----------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  test?: AnyTest;
}

function err(errors: string[], path: string, msg: string) {
  errors.push(`${path}: ${msg}`);
}

function validateBlocks(blocks: unknown, path: string, errors: string[]) {
  if (!Array.isArray(blocks) || !blocks.length) return err(errors, path, 'questions must be a non-empty array');
  blocks.forEach((qb: any, i) => {
    const p = `${path}[${i}]`;
    if (!qb || typeof qb !== 'object') return err(errors, p, 'must be an object');
    if (!IELTS_QUESTION_TYPES.includes(qb.type)) return err(errors, p, `unknown type "${qb.type}"`);
    if (typeof qb.instructions !== 'string' || !qb.instructions.trim()) err(errors, p, 'instructions required');
    if (!Array.isArray(qb.questions) || !qb.questions.length) return err(errors, p, 'questions rows required');
    qb.questions.forEach((row: any, j: number) => {
      const rp = `${p}.questions[${j}]`;
      const a = row?.correct_answer;
      const okAnswer = typeof a === 'string' ? a.trim().length > 0
        : Array.isArray(a) ? a.length > 0 && a.every((x: any) => typeof x === 'string' && x.trim())
        : false;
      if (!okAnswer) err(errors, rp, 'correct_answer required (string or non-empty string[])');
    });
    if (qb.type === 'diagram_completion' && qb.diagram_url && typeof qb.diagram_url !== 'string') {
      err(errors, p, 'diagram_url must be a string URL');
    }
  });
}

/** Validate a pasted JSON payload for the admin importer. Accepts reading or listening tests.
 * On success returns the test renumbered and with computed totals — answers still inline
 * (the save path is responsible for splitting the key). */
export function validateTestJson(input: unknown): ValidationResult {
  const errors: string[] = [];
  const t = input as any;
  if (!t || typeof t !== 'object') return { ok: false, errors: ['root: must be a JSON object'] };
  if (t.module !== 'reading' && t.module !== 'listening') {
    return { ok: false, errors: ['root.module: must be "reading" or "listening"'] };
  }
  if (typeof t.test_title !== 'string' || !t.test_title.trim()) err(errors, 'root', 'test_title required');
  if (t.total_time_minutes != null && typeof t.total_time_minutes !== 'number') {
    err(errors, 'root', 'total_time_minutes must be a number');
  }
  if (t.test_category != null && !['academic', 'general'].includes(t.test_category)) {
    err(errors, 'root', 'test_category must be "academic" | "general"');
  }

  if (t.module === 'reading') {
    if (!Array.isArray(t.passages) || !t.passages.length || t.passages.length > 3) {
      err(errors, 'root', 'passages must be an array of 1–3');
    } else {
      t.passages.forEach((p: any, i: number) => {
        const pp = `passages[${i}]`;
        if (typeof p?.title !== 'string' || !p.title.trim()) err(errors, pp, 'title required');
        if (!Array.isArray(p?.blocks) || !p.blocks.length) err(errors, pp, 'blocks (text) required');
        else p.blocks.forEach((b: any, j: number) => {
          if (typeof b?.content !== 'string' || !b.content.trim()) err(errors, `${pp}.blocks[${j}]`, 'content required');
        });
        validateBlocks(p?.questions, `${pp}.questions`, errors);
      });
    }
  } else {
    if (!Array.isArray(t.parts) || !t.parts.length || t.parts.length > 4) {
      err(errors, 'root', 'parts must be an array of 1–4');
    } else {
      t.parts.forEach((p: any, i: number) => {
        const pp = `parts[${i}]`;
        if (typeof p?.audio_url !== 'string' || !p.audio_url.trim()) err(errors, pp, 'audio_url required');
        validateBlocks(p?.questions, `${pp}.questions`, errors);
      });
    }
  }

  if (errors.length) return { ok: false, errors };

  // Normalize: slug id, numbering, totals, passage metadata defaults.
  const slug = String(t.test_title).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const rand = Math.random().toString(36).slice(2, 8);
  const test: AnyTest = {
    ...t,
    test_id: typeof t.test_id === 'string' && t.test_id.trim() ? t.test_id : `${slug}_${rand}`,
    total_time_minutes: t.total_time_minutes ?? (t.module === 'reading' ? 60 : 32),
    status: 'published',
    teacherId: t.teacherId ?? null,
  };
  if (test.module === 'reading') {
    test.passages = test.passages.map((p, i) => ({
      ...p,
      difficulty: p.difficulty || 'medium',
      subtitle: p.subtitle ?? '',
      instruction: p.instruction ?? '',
      module: 'reading' as const,
      passage_number: i + 1,
      id: p.id || `${test.test_id}_p${i + 1}`,
      word_count: (p.blocks || []).reduce((s, b) => s + String(b.content || '').split(/\s+/).filter(Boolean).length, 0),
      blocks: (p.blocks || []).map((b) => ({ type: 'text' as const, label: b.label ?? '', content: b.content })),
    }));
  } else {
    test.parts = test.parts.map((p, i) => ({ ...p, part_number: i + 1 }));
  }
  renumberTest(test);
  return { ok: true, errors: [], test };
}
