'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, ChevronDown, Copy, Loader2, Plus, Save, X } from 'lucide-react';
import {
  checkQuestion1, emptyQuestion1, Q1_DIFFICULTIES, Q1_LANG_LABEL, Q1_LANGS, Q1_OPTION_KEYS, Q1_TREE,
  type Q1Draft, type Q1Issue, type Q1Lang,
} from '@/lib/questions1Schema';
import { addQuestions1, updateQuestion1 } from '@/services/questions1AdminService';
import type { OptionKey } from '@/types/Math';
import IssueList from './IssueList';
import QuestionPreview from './QuestionPreview';

const TITLES = { create: 'New question', edit: 'Edit question', apply: 'Fix imported question' };

const inputBase = 'w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200';
const inputTone = (bad: boolean) => (bad ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200');
const labelCls = 'block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5';

/**
 * One question, all three languages. `create` and `edit` save through
 * /api/admin/questions1; `apply` (from the JSON import) only hands the fixed
 * draft back. Validation is lib/questions1Schema.ts — the same rules the
 * server enforces.
 */
export default function QuestionForm({ initial, mode, docId, notes = [], onClose, onDone }: {
  initial: Q1Draft;
  mode: 'create' | 'edit' | 'apply';
  docId?: string;
  /** Automatic fixes applied while loading the question. */
  notes?: Q1Issue[];
  onClose: () => void;
  /** Called after a successful save (create / edit) or with the fixed draft (apply). */
  onDone: (draft: Q1Draft) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [lang, setLang] = useState<Q1Lang>('uz');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stepsText, setStepsText] = useState(initial.solution.steps.join('\n'));
  const [showSolution, setShowSolution] = useState(
    !!(initial.solution.final_answer || initial.solution.method || initial.solution.steps.length),
  );

  const { errors, warnings } = checkQuestion1(draft);
  const topic = Q1_TREE.find((t) => t.topicId === draft.topicId);
  const chapter = topic?.chapters.find((c) => c.chapterId === draft.chapterId);
  const bad = (path: string) => attempted && errors.some((e) => e.path === path);

  const setText = (field: 'question' | 'explanation', value: string) =>
    setDraft((d) => ({ ...d, [field]: { ...d[field], [lang]: value } }));
  const setOption = (key: OptionKey, value: string) =>
    setDraft((d) => ({ ...d, options: { ...d.options, [key]: { ...d.options[key], [lang]: value } } }));
  // A number or formula is the same in every language — one click instead of three.
  const copyOptionToAll = (key: OptionKey) =>
    setDraft((d) => {
      const value = d.options[key][lang];
      return { ...d, options: { ...d.options, [key]: { uz: value, ru: value, en: value } } };
    });
  const setSolution = (patch: Partial<Q1Draft['solution']>) =>
    setDraft((d) => ({ ...d, solution: { ...d.solution, ...patch } }));

  const save = async (another: boolean) => {
    setAttempted(true);
    if (errors.length) {
      const first = errors.find((e) => e.lang);
      if (first?.lang) setLang(first.lang);
      toast.error(`${errors.length} field${errors.length === 1 ? '' : 's'} to fix`);
      return;
    }
    if (mode === 'apply') { onDone(draft); onClose(); return; }

    setSaving(true);
    try {
      if (mode === 'edit') {
        await updateQuestion1(docId!, draft);
        toast.success('Question updated');
        onDone(draft);
        onClose();
        return;
      }
      let res = await addQuestions1([draft]);
      if (res.duplicates.length) {
        if (!confirm('This subtopic already has a question with the same UZ text. Save it anyway?')) return;
        res = await addQuestions1([draft], { allowDuplicates: true });
      }
      if (!res.added.length) return;
      toast.success('Question added');
      onDone(draft);
      if (!another) { onClose(); return; }
      // Same place, same difficulty — the next question of the series.
      setDraft(emptyQuestion1({
        topicId: draft.topicId, chapterId: draft.chapterId, subtopicId: draft.subtopicId, difficultyId: draft.difficultyId,
      }));
      setStepsText('');
      setAttempted(false);
      setLang('uz');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-start md:items-center justify-center p-2 md:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[96vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
          <div className="min-w-0">
            <h2 className="font-black text-slate-900">{TITLES[mode]}</h2>
            <p className="text-xs text-slate-500 truncate">
              questions1 · every text in UZ, RU and EN · formulas in <code className="font-mono bg-slate-100 px-1 rounded">$ … $</code>
            </p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto grid lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* form */}
          <div className="p-5 space-y-5 min-w-0">
            <IssueList issues={notes} tone="fix" title="Fixed automatically when loaded" />

            {/* location + difficulty */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Section</label>
                <div className="flex gap-1">
                  {Q1_TREE.map((t) => (
                    <button key={t.topicId} type="button"
                      onClick={() => setDraft((d) => (d.topicId === t.topicId ? d : { ...d, topicId: t.topicId, chapterId: '', subtopicId: '' }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                        draft.topicId === t.topicId ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Difficulty</label>
                <div className="flex gap-1">
                  {Q1_DIFFICULTIES.map((d) => (
                    <button key={d.id} type="button" onClick={() => setDraft((x) => ({ ...x, difficultyId: d.id }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                        draft.difficultyId === d.id ? 'bg-indigo-600 text-white'
                          : `bg-white border text-slate-600 hover:bg-slate-100 ${bad('difficultyId') ? 'border-rose-300' : 'border-slate-200'}`}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Chapter</label>
                <select value={draft.chapterId} disabled={!topic}
                  onChange={(e) => setDraft((d) => ({ ...d, chapterId: e.target.value, subtopicId: '' }))}
                  className={`${inputBase} ${inputTone(bad('location') && !draft.chapterId)}`}>
                  <option value="">— choose a chapter —</option>
                  {topic?.chapters.map((c) => <option key={c.chapterId} value={c.chapterId}>{c.chapterId} · {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Subtopic</label>
                <select value={draft.subtopicId} disabled={!chapter}
                  onChange={(e) => setDraft((d) => ({ ...d, subtopicId: e.target.value }))}
                  className={`${inputBase} ${inputTone(bad('location') && !draft.subtopicId)}`}>
                  <option value="">— choose a subtopic —</option>
                  {chapter?.subtopics.map((s) => <option key={s.subtopicId} value={s.subtopicId}>{s.subtopicId} · {s.name}</option>)}
                </select>
              </div>
            </div>

            {/* language tabs */}
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
              {Q1_LANGS.map((l) => {
                const count = errors.filter((e) => e.lang === l).length;
                return (
                  <button key={l} type="button" onClick={() => setLang(l)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-black transition-colors ${
                      lang === l ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    {Q1_LANG_LABEL[l]}
                    {count ? (
                      <span className={`min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] flex items-center justify-center ${
                        attempted ? 'bg-rose-500 text-white' : lang === l ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {count}
                      </span>
                    ) : (
                      <CheckCircle2 size={14} className={lang === l ? 'text-white' : 'text-emerald-500'} />
                    )}
                  </button>
                );
              })}
              <span className="ml-auto text-[11px] text-slate-400 hidden sm:inline">The number = empty fields in that language</span>
            </div>

            {/* question */}
            <div>
              <label className={labelCls}>Question · {Q1_LANG_LABEL[lang]}</label>
              <textarea value={draft.question[lang]} onChange={(e) => setText('question', e.target.value)} rows={4}
                placeholder={lang === 'uz' ? 'Savol matni… $x^2 + 1$' : lang === 'ru' ? 'Текст вопроса…' : 'Question text…'}
                className={`${inputBase} ${inputTone(bad(`question.${lang}`))} font-mono text-[13px]`} />
            </div>

            {/* options */}
            <div>
              <label className={labelCls}>Options · {Q1_LANG_LABEL[lang]} — click a letter to mark the correct one</label>
              <div className="space-y-2">
                {Q1_OPTION_KEYS.map((key) => {
                  const correct = draft.answer === key;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <button type="button" onClick={() => setDraft((d) => ({ ...d, answer: key }))} title="Mark as correct"
                        className={`shrink-0 w-9 h-9 rounded-lg text-sm font-black border transition-colors ${
                          correct ? 'bg-emerald-600 border-emerald-600 text-white'
                            : `bg-white text-slate-500 hover:bg-emerald-50 ${bad('answer') ? 'border-rose-300' : 'border-slate-200'}`}`}>
                        {key}
                      </button>
                      <input value={draft.options[key][lang]} onChange={(e) => setOption(key, e.target.value)}
                        className={`${inputBase} ${inputTone(bad(`options.${key}.${lang}`))} font-mono text-[13px]`} />
                      <button type="button" onClick={() => copyOptionToAll(key)} disabled={!draft.options[key][lang]}
                        title="Same text in UZ, RU and EN (numbers, formulas)"
                        className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent">
                        <Copy size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* explanation */}
            <div>
              <label className={labelCls}>Explanation · {Q1_LANG_LABEL[lang]}</label>
              <textarea value={draft.explanation[lang]} onChange={(e) => setText('explanation', e.target.value)} rows={3}
                placeholder="Why the answer is correct — shown in results and My Mistakes"
                className={`${inputBase} ${inputTone(bad(`explanation.${lang}`))} font-mono text-[13px]`} />
            </div>

            {/* solution (language-neutral) */}
            <div className="rounded-xl border border-slate-200">
              <button type="button" onClick={() => setShowSolution((s) => !s)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                <span className="text-sm font-bold text-slate-800">Solution</span>
                <span className="text-[11px] text-slate-400">optional · stored once, not per language</span>
                <ChevronDown size={16} className={`ml-auto text-slate-400 transition-transform ${showSolution ? 'rotate-180' : ''}`} />
              </button>
              {showSolution && (
                <div className="px-3 pb-3 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Final answer</label>
                      <input value={draft.solution.final_answer} onChange={(e) => setSolution({ final_answer: e.target.value })}
                        placeholder="e.g. 15 — grades typed answers"
                        className={`${inputBase} ${inputTone(bad('solution.final_answer'))} font-mono text-[13px]`} />
                    </div>
                    <div>
                      <label className={labelCls}>Method</label>
                      <input value={draft.solution.method} onChange={(e) => setSolution({ method: e.target.value })}
                        className={`${inputBase} ${inputTone(false)}`} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Steps — one per line</label>
                    <textarea value={stepsText} rows={4}
                      onChange={(e) => { setStepsText(e.target.value); setSolution({ steps: e.target.value.split('\n') }); }}
                      className={`${inputBase} ${inputTone(false)} font-mono text-[13px]`} />
                  </div>
                </div>
              )}
            </div>

            {attempted && <IssueList issues={errors} tone="error" title="Fix before saving" onPickLang={setLang} />}
            {attempted && <IssueList issues={warnings} tone="warn" title="Check (does not block saving)" onPickLang={setLang} />}
          </div>

          {/* live preview */}
          <aside className="bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-100 p-5 space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Student preview</span>
              <span className="text-[11px] font-black text-indigo-600">{Q1_LANG_LABEL[lang]}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <QuestionPreview question={draft.question} options={draft.options} answer={draft.answer}
                explanation={draft.explanation} lang={lang} />
            </div>
            {chapter && (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {topic?.name} › {chapter.chapterId} {chapter.name}
                {draft.subtopicId && <> › {draft.subtopicId} {chapter.subtopics.find((s) => s.subtopicId === draft.subtopicId)?.name}</>}
              </p>
            )}
          </aside>
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className={`text-xs font-bold ${errors.length ? (attempted ? 'text-rose-600' : 'text-slate-400') : 'text-emerald-600'}`}>
            {errors.length ? `${errors.length} field${errors.length === 1 ? '' : 's'} left` : 'Ready to save'}
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">
              Cancel
            </button>
            {mode === 'create' && (
              <button onClick={() => save(true)} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
                <Plus size={15} /> Save &amp; add another
              </button>
            )}
            <button onClick={() => save(false)} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {mode === 'apply' ? 'Apply fix' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
