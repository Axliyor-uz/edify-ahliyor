/**
 * The AI is told to wrap math in `$…$`, but it sometimes skips it — mostly on
 * short options ("\frac{4}{8}"). LatexRenderer only renders math inside
 * delimiters, so such text shows raw. `fixMath` adds the missing `$…$`
 * (docs/AI.md). Text that already has delimiters, or no LaTeX command, is
 * returned unchanged. Pure — used by the AI routes and the game deck.
 */

const COMMAND = /\\[a-zA-Z]+/;
/** `{…}` with one level of nesting: \frac{\sqrt{2}}{3}. */
const GROUP = String.raw`\{(?:[^{}]|\{[^{}]*\})*\}`;
/** A run of math: commands with their groups, digits, single-letter variables, operators, spaces. */
const MATH_RUN = new RegExp(
  String.raw`(?:\\[a-zA-Z]+(?:${GROUP})*|${GROUP}|\d|(?<![A-Za-z])[A-Za-z](?![A-Za-z])|[+\-*/=<>^_()[\].,:·\s])+`,
  'g',
);

export function fixMath(text: string): string {
  if (!text || /\$|\\\(|\\\[/.test(text) || !COMMAND.test(text)) return text;
  // "\\frac" (an over-escaped backslash) → "\frac".
  const s = text.replace(/\\\\(?=[a-zA-Z])/g, '\\');

  // Only math (no word outside commands and braces): wrap it all.
  const outside = s.replace(new RegExp(GROUP, 'g'), '').replace(/\\[a-zA-Z]+/g, '');
  if (!/\p{L}{2,}/u.test(outside)) return `$${s.trim()}$`;

  // Text with math inside ("Hisoblang: \frac{3}{8} + \frac{1}{4}"): wrap each math run.
  return s.replace(MATH_RUN, (run) => {
    if (!COMMAND.test(run)) return run;
    const lead = run.match(/^[\s:,.]*/)?.[0] ?? '';
    const trail = run.slice(lead.length).match(/[\s:,.]*$/)?.[0] ?? '';
    return `${lead}$${run.slice(lead.length, run.length - trail.length)}$${trail}`;
  });
}
