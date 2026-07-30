// Verifies the authored reading JSON against the repo's real contracts:
//   lib/ielts/testSchema.ts  (validateTestJson, renumberTest, extractAnswerKey)
//   runner/shared.ts         (GAP_TOKEN_SPLIT positional gap mapping)
//   lib/ielts/grading.ts     (word limits, letter answers)
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIR = process.argv[2];
const GAP_TOKEN_SPLIT = /(\[\s*\d*\s*\]|\[_\]|\[\])/g;
const isGapToken = (s) => /^\[\s*[\d_]*\s*\]$/.test(s);
const TYPES = ['matching_headings','true_false_not_given','multiple_choice','summary_completion',
  'matching_paragraph_information','list_selection','matching_features','sentence_completion',
  'matching_sentence_endings','short_answer','table_completion','flowchart_completion','diagram_completion'];
const GAP_TEXT_TYPES = new Set(['summary_completion','table_completion','flowchart_completion']);

let failures = 0;
const fail = (f, msg) => { console.log(`  ✗ [${f}] ${msg}`); failures++; };

function countGaps(qb) {
  let n = 0;
  const scan = (s) => String(s || '').split(GAP_TOKEN_SPLIT).forEach((p) => { if (isGapToken(p)) n++; });
  if (qb.type === 'summary_completion') scan(qb.summary_text);
  if (qb.type === 'table_completion') (qb.rows || []).forEach((r) => (r.cells || []).forEach(scan));
  if (qb.type === 'flowchart_completion') (qb.steps || []).forEach(scan);
  return n;
}

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const raw = readFileSync(path.join(DIR, file), 'utf8');
  let t;
  try { t = JSON.parse(raw); } catch (e) { fail(file, `invalid JSON: ${e.message}`); continue; }
  console.log(`\n${file}  —  "${t.test_title}"`);

  if (t.module !== 'reading') fail(file, 'module must be "reading"');
  if (!Array.isArray(t.passages) || t.passages.length < 1 || t.passages.length > 3) fail(file, 'passages must be 1–3');

  // ---- renumber exactly as renumberTest() does, comparing against authored numbers
  let counter = 1;
  const typeCount = {};
  for (const [pi, p] of (t.passages || []).entries()) {
    const passageText = (p.blocks || []).map((b) => b.content).join('\n');
    const labels = new Set((p.blocks || []).map((b) => b.label).filter(Boolean));
    if (!p.title?.trim()) fail(file, `passage ${pi + 1}: title required`);
    if (!Array.isArray(p.blocks) || !p.blocks.length) fail(file, `passage ${pi + 1}: blocks required`);
    for (const b of p.blocks || []) if (!String(b.content || '').trim()) fail(file, `passage ${pi + 1}: empty block content`);

    for (const [qi, qb] of (p.questions || []).entries()) {
      const where = `P${pi + 1}.block${qi + 1}(${qb.type})`;
      if (!TYPES.includes(qb.type)) fail(file, `${where}: unknown type`);
      if (!String(qb.instructions || '').trim()) fail(file, `${where}: instructions required`);
      if (!Array.isArray(qb.questions) || !qb.questions.length) { fail(file, `${where}: no rows`); continue; }

      const start = counter;
      for (const row of qb.questions) {
        const expected = counter;
        if (row.question_number !== expected) fail(file, `${where}: authored question_number ${row.question_number} but renumberTest gives ${expected}`);
        const a = row.correct_answer;
        const ok = typeof a === 'string' ? a.trim().length > 0
          : Array.isArray(a) ? a.length > 0 && a.every((x) => typeof x === 'string' && x.trim()) : false;
        if (!ok) fail(file, `Q${expected} ${where}: correct_answer missing/empty`);

        // per-type answer sanity
        const blockIds = Array.isArray(qb.options)
          ? qb.options.map((o) => (typeof o === 'string' ? o : o.id ?? o.label)).filter(Boolean) : [];
        if (['matching_headings','matching_paragraph_information'].includes(qb.type)) {
          if (typeof a !== 'string') fail(file, `Q${expected} ${where}: expected a string letter`);
          else if (!blockIds.includes(a)) fail(file, `Q${expected} ${where}: answer "${a}" not in block options`);
        }
        if (qb.type === 'matching_headings' && row.target_paragraph && labels.size && !labels.has(row.target_paragraph)) {
          fail(file, `Q${expected} ${where}: target_paragraph "${row.target_paragraph}" has no matching block label`);
        }
        if (['matching_features','matching_sentence_endings'].includes(qb.type)) {
          if (!Array.isArray(a) || a.length !== 1) fail(file, `Q${expected} ${where}: expected a 1-element array`);
          else if (!blockIds.includes(a[0])) fail(file, `Q${expected} ${where}: answer "${a[0]}" not in block options`);
        }
        if (qb.type === 'true_false_not_given') {
          const labelsAllowed = blockIds.length ? blockIds : ['TRUE','FALSE','NOT GIVEN'];
          if (!labelsAllowed.includes(a)) fail(file, `Q${expected} ${where}: "${a}" not one of ${labelsAllowed.join('/')}`);
        }
        if (qb.type === 'multiple_choice') {
          const ids = (row.options || []).map((o) => o.id);
          if (!Array.isArray(a) || a.length !== 1) fail(file, `Q${expected} ${where}: expected a 1-element array`);
          else if (!ids.includes(a[0])) fail(file, `Q${expected} ${where}: answer "${a[0]}" not in row options`);
          if (ids.length < 3) fail(file, `Q${expected} ${where}: fewer than 3 options`);
        }
        if (qb.type === 'list_selection') {
          const ids = (row.options || []).map((o) => o.id);
          if (!Array.isArray(a) || a.length < 2) fail(file, `Q${expected} ${where}: list_selection needs >=2 letters`);
          else for (const x of a) if (!ids.includes(x)) fail(file, `Q${expected} ${where}: answer "${x}" not in row options`);
        }
        if (['summary_completion','table_completion','flowchart_completion','diagram_completion'].includes(qb.type)) {
          const wordBank = Array.isArray(qb.options) && qb.options.length > 0;
          if (wordBank && typeof a !== 'string') fail(file, `Q${expected} ${where}: word-bank block expects a string letter`);
          if (!wordBank && !Array.isArray(a)) fail(file, `Q${expected} ${where}: free-text block expects an array of alternates`);
          if (wordBank && typeof a === 'string' && !blockIds.includes(a)) fail(file, `Q${expected} ${where}: "${a}" not in word bank`);
        }
        if (['sentence_completion','short_answer'].includes(qb.type) && !Array.isArray(a)) {
          fail(file, `Q${expected} ${where}: expected an array of accepted answers`);
        }
        // word limit (official convention: token count, hyphen = 1 word)
        if (qb.word_limit && Array.isArray(a)) {
          for (const alt of a) {
            const n = String(alt).replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean).length;
            if (n > qb.word_limit) fail(file, `Q${expected} ${where}: answer "${alt}" is ${n} words but word_limit is ${qb.word_limit}`);
          }
        }
        // sentence_completion: exactly one gap in the row sentence
        if (qb.type === 'sentence_completion') {
          const g = String(row.sentence || '').split(GAP_TOKEN_SPLIT).filter(isGapToken).length;
          if (g !== 1) fail(file, `Q${expected} ${where}: sentence has ${g} gap tokens (need exactly 1)`);
        }
        // passage_reference must be locatable in the passage text
        if (row.passage_reference && !passageText.includes(row.passage_reference)) {
          fail(file, `Q${expected} ${where}: passage_reference not found verbatim in passage`);
        }

        counter += (qb.type === 'list_selection' && Array.isArray(a)) ? Math.max(1, a.length) : 1;
      }
      const end = counter - 1;
      typeCount[qb.type] = (typeCount[qb.type] || 0) + (end - start + 1);

      // gap-text blocks: token count must equal row count, or numbering silently desyncs
      if (GAP_TEXT_TYPES.has(qb.type)) {
        const gaps = countGaps(qb);
        if (gaps !== qb.questions.length) {
          fail(file, `${where}: ${gaps} gap tokens vs ${qb.questions.length} answer rows (must match)`);
        }
      }
      if (qb.type === 'table_completion') {
        const w = (qb.headers || []).length;
        (qb.rows || []).forEach((r, i) => {
          if ((r.cells || []).length !== w) fail(file, `${where}: row ${i + 1} has ${(r.cells || []).length} cells, headers have ${w}`);
        });
      }
    }
  }

  const total = counter - 1;
  console.log(`  questions: ${total}`);
  console.log(`  types: ${Object.entries(typeCount).map(([k, v]) => `${v}×${k}`).join(', ')}`);
  if (t.test_id?.startsWith('platform_reading_academic') && total !== 40) fail(file, `expected 40 questions, got ${total}`);
}

console.log(failures ? `\n${failures} problem(s)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
