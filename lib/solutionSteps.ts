/**
 * Splits a stored explanation into display parts (docs/AI.md → "Worked solutions").
 * AI solutions are saved as ONE line — "1) … 2) … Javob: 6" — so screens can show
 * them as steps without any data change; older/hand-written explanations without
 * the markers return null and are shown as before.
 *
 * Markers count only OUTSIDE math ($…$ / $$…$$), at a word start, and steps must
 * run 1, 2, 3… in order — so "f(2)" or "x = 2)" inside a sentence never splits.
 */

export interface SolutionParts {
  /** Text before step 1 (rare). */
  lead: string;
  steps: string[];
  /** The final "Javob: …" / "Ответ: …" / "Answer: …", label kept as written. */
  answer: { label: string; value: string } | null;
}

const STEP = /^(\d{1,2})\)\s/;
const ANSWER = /^(Javob|JAVOB|javob|Ответ|ОТВЕТ|ответ|Answer|ANSWER|answer)\s*[:：]\s*/;

/** Drops the sentence punctuation a step ends with ("x > -5$." → "x > -5$"). */
const tidy = (s: string) => s.trim().replace(/[\s.,;]+$/, '');

export function splitSolution(text: string | null | undefined): SolutionParts | null {
  const src = String(text ?? '').trim();
  if (!src) return null;

  const steps: { at: number; len: number }[] = [];
  let answer: { at: number; len: number; label: string } | null = null;
  let math: '' | '$' | '$$' = '';

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') { i++; continue; } // \$ is a literal dollar
    if (src.startsWith('$$', i)) {
      if (math !== '$') math = math === '$$' ? '' : '$$';
      i++;
      continue;
    }
    if (ch === '$') {
      if (math !== '$$') math = math === '$' ? '' : '$';
      continue;
    }
    if (math || (i > 0 && !/\s/.test(src[i - 1]))) continue;

    const rest = src.slice(i, i + 16);
    const step = STEP.exec(rest);
    if (step && Number(step[1]) === steps.length + 1) {
      steps.push({ at: i, len: step[0].length });
      continue;
    }
    const mark = ANSWER.exec(rest);
    if (mark) answer = { at: i, len: mark[0].length, label: mark[1] };
  }

  // An answer mark before the last step is part of a step, not the final answer.
  if (answer && steps.length && answer.at < steps[steps.length - 1].at) answer = null;
  if (steps.length < 2 && !answer) return null;

  const end = answer ? answer.at : src.length;
  const numbered = steps.length >= 2 ? steps : [];
  const lead = tidy(src.slice(0, numbered.length ? numbered[0].at : end));
  return {
    lead,
    steps: numbered.map((s, n) => tidy(src.slice(s.at + s.len, n + 1 < numbered.length ? numbered[n + 1].at : end))),
    answer: answer ? { label: answer.label, value: tidy(src.slice(answer.at + answer.len)) } : null,
  };
}
