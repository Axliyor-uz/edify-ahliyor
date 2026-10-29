'use client';

import LatexRenderer from '@/components/LatexRenderer';
import { Q1_LANG_LABEL, Q1_OPTION_KEYS, type Q1Lang } from '@/lib/questions1Schema';

/** One language of a localized field; tolerates the odd legacy doc that stored plain text. */
export function textIn(value: unknown, lang: Q1Lang): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const text = (value as Record<string, unknown>)[lang];
    return typeof text === 'string' ? text : '';
  }
  return '';
}

/** A question as the student sees it, in one language — empty fields are flagged, not hidden. */
export default function QuestionPreview({ question, options, answer, explanation, lang }: {
  question: unknown;
  options: unknown;
  answer: string;
  explanation?: unknown;
  lang: Q1Lang;
}) {
  const stem = textIn(question, lang);
  const optionMap = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
  const why = textIn(explanation, lang);

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-900 leading-relaxed break-words">
        {stem ? <LatexRenderer latex={stem} /> : <span className="italic text-rose-500">Question is empty in {Q1_LANG_LABEL[lang]}</span>}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {Q1_OPTION_KEYS.map((key) => {
          const text = textIn(optionMap[key], lang);
          const correct = answer === key;
          return (
            <div key={key}
              className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                correct ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'}`}>
              <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-black ${
                correct ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{key}</span>
              <span className="min-w-0 break-words pt-0.5">
                {text ? <LatexRenderer latex={text} /> : <span className="italic text-rose-500">empty</span>}
              </span>
            </div>
          );
        })}
      </div>
      {why && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 leading-relaxed break-words">
          <span className="font-bold text-slate-700">Explanation: </span><LatexRenderer latex={why} />
        </div>
      )}
    </div>
  );
}
