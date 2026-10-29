'use client';

import { AlertTriangle, Info, Wand2 } from 'lucide-react';
import { Q1_LANG_LABEL, type Q1Issue, type Q1Lang } from '@/lib/questions1Schema';

/** "Question is empty" in RU and EN → one line with two language chips. */
function groupIssues(issues: Q1Issue[]) {
  const groups = new Map<string, { message: string; langs: Q1Lang[] }>();
  for (const issue of issues) {
    const base = issue.lang ? issue.path.replace(/\.(uz|ru|en)$/, '') : issue.path;
    const key = `${base}|${issue.message}`;
    const group = groups.get(key) ?? { message: issue.message, langs: [] };
    if (issue.lang && !group.langs.includes(issue.lang)) group.langs.push(issue.lang);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const TONES = {
  error: { box: 'bg-rose-50 border-rose-200 text-rose-800', chip: 'bg-rose-600 text-white hover:bg-rose-500', Icon: AlertTriangle },
  warn: { box: 'bg-amber-50 border-amber-200 text-amber-800', chip: 'bg-amber-500 text-white hover:bg-amber-400', Icon: Info },
  fix: { box: 'bg-emerald-50 border-emerald-200 text-emerald-800', chip: 'bg-emerald-600 text-white hover:bg-emerald-500', Icon: Wand2 },
};

export default function IssueList({ issues, tone, title, onPickLang }: {
  issues: Q1Issue[];
  tone: keyof typeof TONES;
  title?: string;
  /** Clicking a language chip jumps to that language tab. */
  onPickLang?: (lang: Q1Lang) => void;
}) {
  if (!issues.length) return null;
  const { box, chip, Icon } = TONES[tone];
  return (
    <div className={`rounded-lg border p-2.5 text-xs ${box}`}>
      {title && <div className="font-black mb-1.5">{title}</div>}
      <ul className="space-y-1">
        {groupIssues(issues).map((g, i) => (
          <li key={i} className="flex flex-wrap items-center gap-1.5 leading-relaxed">
            <Icon size={12} className="shrink-0" />
            <span>{g.message}</span>
            {g.langs.map((lang) => (
              <button key={lang} type="button" onClick={() => onPickLang?.(lang)} disabled={!onPickLang}
                className={`px-1.5 py-0.5 rounded font-black text-[10px] tracking-wide disabled:cursor-default ${chip}`}>
                {Q1_LANG_LABEL[lang]}
              </button>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
