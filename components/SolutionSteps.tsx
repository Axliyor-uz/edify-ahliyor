import type { CSSProperties, ReactNode } from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import LatexRenderer from '@/components/LatexRenderer';
import { splitSolution } from '@/lib/solutionSteps';

/**
 * An explanation shown as numbered steps + an answer pill (lib/solutionSteps.ts).
 * Kit-neutral like LatexRenderer: no tokens, every tint is a mix of the parent's
 * text color, so it fits the teacher, student and manager kits alike.
 * `render` draws one piece of text — pass the screen's own math renderer
 * (FormattedText, MathText…) so math looks the same as before.
 * Renders <div>s: never put it inside a <p>.
 */

const tint = (percent: number): CSSProperties => ({ backgroundColor: `color-mix(in srgb, currentColor ${percent}%, transparent)` });

export default function SolutionSteps({ text, render = (s) => <LatexRenderer latex={s} />, className }: {
  text: string | null | undefined;
  render?: (text: string) => ReactNode;
  className?: string;
}) {
  const parts = splitSolution(text);
  if (!parts) return <div className={className}>{render(text ?? '')}</div>;

  return (
    <div className={clsx('space-y-2', className)}>
      {parts.lead && <div>{render(parts.lead)}</div>}
      {parts.steps.length > 0 && (
        <ol className="space-y-1.5">
          {parts.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-[0.1em] grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold leading-none"
                style={tint(14)}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 break-words">{render(step)}</div>
            </li>
          ))}
        </ol>
      )}
      {parts.answer && (
        <div className="inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 font-semibold" style={tint(12)}>
          <Check size={14} className="shrink-0" />
          <span className="shrink-0">{parts.answer.label}:</span>
          <span className="min-w-0 break-words">{render(parts.answer.value)}</span>
        </div>
      )}
    </div>
  );
}
