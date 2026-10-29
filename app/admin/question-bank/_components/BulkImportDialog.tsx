'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Copy, Download, FileJson, Loader2, Pencil, Trash2, Upload, Wand2, X,
} from 'lucide-react';
import LatexRenderer from '@/components/LatexRenderer';
import {
  checkQuestion1, locateQuestion1, parseQuestions1Json, questions1ToJson, Q1_DIFFICULTIES, Q1_LANG_LABEL, Q1_LANGS,
  type Q1Check, type Q1Draft, type Q1Issue, type Q1Lang,
} from '@/lib/questions1Schema';
import { addQuestions1 } from '@/services/questions1AdminService';
import IssueList from './IssueList';
import QuestionForm from './QuestionForm';
import QuestionPreview from './QuestionPreview';

interface Row extends Q1Check {
  key: number;
  /** The same UZ text is already in that subtopic (server dry run). */
  duplicate?: boolean;
}

type Filter = 'all' | 'errors' | 'ready' | 'duplicates';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function locationLabel(d: Q1Draft) {
  const loc = locateQuestion1(d);
  const diff = Q1_DIFFICULTIES.find((x) => x.id === d.difficultyId)?.label;
  if (!loc) return 'No location';
  return `${loc.topic.name} · ${loc.chapter.chapterId}.${loc.subtopic.subtopicId}${diff ? ` · ${diff}` : ''}`;
}

/**
 * JSON bulk import for questions1. Nothing is written until "Import": the file
 * is parsed and repaired (lib/questions1Schema.ts — deterministic, no AI),
 * every question is checked, the server dry-runs the duplicate check, and only
 * the ready questions are sent. What cannot be fixed automatically is listed
 * per field and per language, fixable in the form or in the downloaded file.
 */
export default function BulkImportDialog({ defaults, defaultsLabel, onClose, onImported }: {
  /** The subtopic open on the page — used for items with no location of their own. */
  defaults?: Partial<Q1Draft>;
  defaultsLabel?: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [raw, setRaw] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileFixes, setFileFixes] = useState<Q1Issue[]>([]);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [lang, setLang] = useState<Q1Lang>('uz');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [fixing, setFixing] = useState<Row | null>(null);
  const [showFormat, setShowFormat] = useState(false);

  const resetResult = () => { setRows(null); setParseError(null); setFileFixes([]); };

  const markDuplicates = async (list: Row[]): Promise<Row[]> => {
    const ready = list.filter((r) => !r.errors.length);
    if (!ready.length) return list;
    const res = await addQuestions1(ready.map((r) => r.draft), { dryRun: true });
    const dup = new Set(res.duplicates.map((i) => ready[i].key));
    return list.map((r) => ({ ...r, duplicate: dup.has(r.key) }));
  };

  const check = async () => {
    const res = parseQuestions1Json(raw, defaults);
    setParseError(res.parseError ?? null);
    setFileFixes(res.fileFixes);
    setFilter('all');
    setExpanded(null);
    if (res.parseError) { setRows(null); return; }

    const list: Row[] = res.items.map((c, key) => ({ ...c, key }));
    setRows(list);
    setChecking(true);
    try {
      setRows(await markDuplicates(list));
    } catch (e) {
      toast.error(`Duplicate check failed: ${message(e)}`);
    } finally {
      setChecking(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setRaw(await file.text());
    resetResult();
  };

  const applyFix = async (target: Row, draft: Q1Draft) => {
    const { errors, warnings } = checkQuestion1(draft);
    const updated: Row = { ...target, draft, errors, warnings, duplicate: false };
    if (!errors.length) {
      try {
        updated.duplicate = (await addQuestions1([draft], { dryRun: true })).duplicates.length > 0;
      } catch { /* the import re-checks duplicates anyway */ }
    }
    setRows((prev) => prev?.map((r) => (r.key === updated.key ? updated : r)) ?? prev);
  };

  const all = rows ?? [];
  const ready = all.filter((r) => !r.errors.length && !r.duplicate);
  const broken = all.filter((r) => r.errors.length);
  const dups = all.filter((r) => r.duplicate && !r.errors.length);
  const fixCount = all.reduce((n, r) => n + r.fixes.length, 0) + fileFixes.length;
  const errorsByLang = Q1_LANGS.map((l) => ({ lang: l, n: broken.reduce((n, r) => n + r.errors.filter((e) => e.lang === l).length, 0) }));
  const shown = filter === 'errors' ? broken : filter === 'ready' ? ready : filter === 'duplicates' ? dups : all;

  const doImport = async () => {
    if (!ready.length) return;
    setImporting(true);
    try {
      const res = await addQuestions1(ready.map((r) => r.draft));
      const addedKeys = new Set(res.added.map((a) => ready[a.index].key));
      const dupKeys = new Set(res.duplicates.map((i) => ready[i].key));
      toast.success(`Added ${res.added.length} question${res.added.length === 1 ? '' : 's'}`);
      if (dupKeys.size) toast(`${dupKeys.size} already in the bank — skipped`);
      onImported();
      const left = all.filter((r) => !addedKeys.has(r.key)).map((r) => (dupKeys.has(r.key) ? { ...r, duplicate: true } : r));
      if (!left.length) onClose();
      else setRows(left);
    } catch (e) {
      toast.error(message(e));
    } finally {
      setImporting(false);
    }
  };

  const downloadFixed = () => {
    const base = fileName ? fileName.replace(/\.json$/i, '') : 'questions1';
    downloadJson({ questions: all.map((r) => questions1ToJson(r.draft)) }, `${base}.fixed.json`);
  };

  const loc = defaults?.topicId ? locateQuestion1({ topicId: defaults.topicId, chapterId: defaults.chapterId ?? '', subtopicId: defaults.subtopicId ?? '' }) : null;
  const template = {
    topic: loc?.topic.name ?? 'Algebra',
    chapterId: loc ? Number(loc.chapter.chapterId) : 1,
    subtopicId: loc ? Number(loc.subtopic.subtopicId) : 1,
    questions: [
      {
        difficulty: 'easy',
        question: {
          uz: '$2^3 + 7$ ning qiymatini toping.',
          ru: 'Найдите значение $2^3 + 7$.',
          en: 'Find the value of $2^3 + 7$.',
        },
        options: { A: '$13$', B: '$15$', C: '$17$', D: '$21$' },
        answer: 'B',
        explanation: {
          uz: '$2^3 = 8$, $8 + 7 = 15$.',
          ru: '$2^3 = 8$, $8 + 7 = 15$.',
          en: '$2^3 = 8$, $8 + 7 = 15$.',
        },
        solution: { final_answer: '15', method: '', steps: ['$2^3 = 8$', '$8 + 7 = 15$'] },
      },
    ],
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start md:items-center justify-center p-2 md:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center"><FileJson size={18} /></div>
          <div className="min-w-0">
            <h2 className="font-black text-slate-900">Bulk import — JSON</h2>
            <p className="text-xs text-slate-500 truncate">Checked and repaired before anything is written. Only valid questions are imported.</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* source */}
          {!rows && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer">
                  <Upload size={15} /> Choose .json file
                  <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
                {fileName && <span className="text-xs font-mono text-slate-500 truncate">{fileName}</span>}
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setShowFormat((s) => !s)} className="text-xs font-bold text-indigo-600 hover:underline">
                    {showFormat ? 'Hide' : 'Show'} format
                  </button>
                  <button onClick={() => downloadJson(template, 'questions1-template.json')}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
                    <Download size={12} /> Template
                  </button>
                </div>
              </div>

              {showFormat && (
                <div className="grid md:grid-cols-2 gap-3">
                  <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto max-h-80">{JSON.stringify(template, null, 2)}</pre>
                  <ul className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
                    <li><b>Location</b> — <code className="font-mono bg-slate-100 px-1 rounded">topic</code> (Algebra / Geometriya or 1 / 2), <code className="font-mono bg-slate-100 px-1 rounded">chapterId</code>, <code className="font-mono bg-slate-100 px-1 rounded">subtopicId</code> — the numbers in the tree on the left. Put them once at the top, or on each question.</li>
                    <li><b>Every text</b> needs <code className="font-mono bg-slate-100 px-1 rounded">uz</code>, <code className="font-mono bg-slate-100 px-1 rounded">ru</code>, <code className="font-mono bg-slate-100 px-1 rounded">en</code>. A number or formula may be written once (<code className="font-mono bg-slate-100 px-1 rounded">&quot;$15$&quot;</code>) — it is copied to all three.</li>
                    <li><b>answer</b> — a letter A–D. <b>difficulty</b> — easy / medium / hard.</li>
                    <li><b>Fixed automatically:</b> lone LaTeX backslashes (<code className="font-mono">\sqrt</code>, <code className="font-mono">\frac</code>), trailing commas, line breaks in text, <code className="font-mono">A)</code> prefixes, question numbers, bare LaTeX without <code className="font-mono">$</code>, difficulty words (oson / o&apos;rta / qiyin), chapter/subtopic names.</li>
                    <li><b>Never invented:</b> a missing translation — you will be told which field in which language.</li>
                  </ul>
                </div>
              )}

              <textarea value={raw} onChange={(e) => { setRaw(e.target.value); resetResult(); }} spellCheck={false}
                placeholder="…or paste the JSON here"
                className="w-full h-64 font-mono text-xs border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-200" />

              <p className="text-xs text-slate-500">
                Questions without a location go to: <b className="text-slate-700">{defaultsLabel || 'nowhere — they must carry their own'}</b>
              </p>
            </>
          )}

          {parseError && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 flex gap-1.5 whitespace-pre-wrap font-mono">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />{parseError}
            </div>
          )}

          {/* results */}
          {rows && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  ['all', 'Total', all.length, 'text-slate-900'],
                  ['ready', 'Ready', ready.length, 'text-emerald-600'],
                  ['errors', 'To fix', broken.length, 'text-rose-600'],
                  ['duplicates', 'Already in bank', dups.length, 'text-amber-600'],
                ] as const).map(([key, label, n, tone]) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${filter === key ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <div className={`text-xl font-black tabular-nums ${tone}`}>{n}</div>
                    <div className="text-[11px] font-bold text-slate-500">{label}</div>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {fixCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                    <Wand2 size={12} /> {fixCount} automatic fix{fixCount === 1 ? '' : 'es'}
                  </span>
                )}
                {broken.length > 0 && errorsByLang.filter((x) => x.n).map((x) => (
                  <span key={x.lang} className="font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                    {Q1_LANG_LABEL[x.lang]}: {x.n} empty/invalid
                  </span>
                ))}
                {checking && <span className="inline-flex items-center gap-1 text-slate-500"><Loader2 size={12} className="animate-spin" /> checking duplicates…</span>}
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-slate-400 mr-1">Preview</span>
                  {Q1_LANGS.map((l) => (
                    <button key={l} onClick={() => setLang(l)}
                      className={`px-2 py-1 rounded-md font-black ${lang === l ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                      {Q1_LANG_LABEL[l]}
                    </button>
                  ))}
                </div>
              </div>

              <IssueList issues={fileFixes} tone="fix" title="File repaired" />

              {shown.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">Nothing in this group.</div>
              ) : (
                <ul className="space-y-2">
                  {shown.map((r) => {
                    const open = expanded === r.key || r.errors.length > 0;
                    const status = r.errors.length ? 'error' : r.duplicate ? 'dup' : 'ok';
                    return (
                      <li key={r.key} className={`rounded-xl border bg-white ${
                        status === 'error' ? 'border-rose-200' : status === 'dup' ? 'border-amber-200' : 'border-slate-200'}`}>
                        <button onClick={() => setExpanded(expanded === r.key ? null : r.key)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
                          {status === 'error' ? <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                            : status === 'dup' ? <Copy size={16} className="text-amber-500 shrink-0" />
                            : <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                          <span className="text-[11px] font-black text-slate-400 tabular-nums">#{r.key + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                            {r.draft.question.uz ? <LatexRenderer latex={r.draft.question.uz} /> : <i className="text-slate-400">no UZ text</i>}
                          </span>
                          <span className="hidden sm:inline text-[11px] font-bold text-slate-500 whitespace-nowrap">{locationLabel(r.draft)}</span>
                          {r.errors.length > 0 && <span className="text-[11px] font-black text-white bg-rose-500 rounded-full px-2 py-0.5">{r.errors.length}</span>}
                          {r.fixes.length > 0 && <Wand2 size={13} className="text-emerald-500 shrink-0" />}
                          <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>

                        {open && (
                          <div className="px-3 pb-3 space-y-2.5">
                            <IssueList issues={r.errors} tone="error" title="Fix these fields" onPickLang={setLang} />
                            {r.duplicate && (
                              <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                                This subtopic already has a question with the same UZ text — it will be skipped.
                              </div>
                            )}
                            <IssueList issues={r.warnings} tone="warn" title="Check" onPickLang={setLang} />
                            <IssueList issues={r.fixes} tone="fix" title="Fixed automatically" onPickLang={setLang} />
                            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                              <QuestionPreview question={r.draft.question} options={r.draft.options} answer={r.draft.answer}
                                explanation={r.draft.explanation} lang={lang} />
                            </div>
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => setRows((prev) => prev?.filter((x) => x.key !== r.key) ?? prev)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50">
                                <Trash2 size={13} /> Remove
                              </button>
                              <button onClick={() => setFixing(r)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100">
                                <Pencil size={13} /> {r.errors.length ? 'Fix in form' : 'Edit'}
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          {rows ? (
            <>
              <button onClick={resetResult} className="px-3 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">
                ← Edit JSON
              </button>
              <button onClick={downloadFixed}
                title="All remaining questions with the automatic fixes applied — fix the rest and import again"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">
                <Download size={15} /> Download fixed JSON
              </button>
              <button onClick={doImport} disabled={!ready.length || importing || checking}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40">
                {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                Import {ready.length} ready
              </button>
            </>
          ) : (
            <button onClick={check} disabled={!raw.trim()}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
              <CheckCircle2 size={15} /> Check
            </button>
          )}
        </div>
      </div>

      {fixing && (
        <div onClick={(e) => e.stopPropagation()}>
          <QuestionForm mode="apply" initial={fixing.draft} notes={fixing.fixes}
            onClose={() => setFixing(null)} onDone={(draft) => applyFix(fixing, draft)} />
        </div>
      )}
    </div>
  );
}
