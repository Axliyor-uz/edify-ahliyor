'use client';

// Admin editor for the abiturient Algebra + Geometriya bank (`questions1`):
//  • browse by syllabus: section → chapter → subtopic → difficulty (data/syllabus.json, 0 reads);
//  • add one question (QuestionForm) or many (BulkImportDialog) — both validated by
//    lib/questions1Schema.ts and written by /api/admin/questions1 (Admin SDK), which stamps
//    rand / uploadedAt / number so the exam sampler and the teacher bank see the question;
//  • edit, and bench / restore (no `rand` = never drawn into a Milliy exam).
// Contract + traps: docs/ADMIN.md "Question bank".

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  AlertTriangle, Ban, BookOpenCheck, ChevronDown, FileJson, Loader2, Pencil, Plus, RotateCcw, ShieldCheck,
} from 'lucide-react';
import { getChapterQuestions } from '@/lib/Mathquestion';
import {
  coerceQuestion1, emptyQuestion1, locateQuestion1, Q1_DIFFICULTIES, Q1_LANG_LABEL, Q1_LANGS, Q1_TREE,
  type Q1DifficultyId, type Q1Draft, type Q1Issue, type Q1Lang,
} from '@/lib/questions1Schema';
import { countQuestions1, setQuestion1Benched } from '@/services/questions1AdminService';
import type { QuestionDoc } from '@/types/Math';
import BulkImportDialog from './_components/BulkImportDialog';
import QuestionForm from './_components/QuestionForm';
import QuestionPreview from './_components/QuestionPreview';

const PAGE_SIZE = 20;

type BankQuestion = QuestionDoc & { source?: string };
type Selection = { topicId: string; chapterId: string; subtopicId: string };
type FormState = { mode: 'create' | 'edit'; draft: Q1Draft; id?: string; notes?: Q1Issue[] };

export default function AdminQuestionBankPage() {
  const [topicId, setTopicId] = useState('1');
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [difficulty, setDifficulty] = useState<Q1DifficultyId>(1);
  const [lang, setLang] = useState<Q1Lang>('uz');
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<Q1DifficultyId, number> | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Only the latest request may write the list — fast clicking must not show a stale subtopic.
  const requestId = useRef(0);

  const topic = Q1_TREE.find((t) => t.topicId === topicId)!;
  const loc = sel ? locateQuestion1(sel) : null;

  const load = async (s: Selection, diff: Q1DifficultyId, after: QueryDocumentSnapshot<DocumentData> | null) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const page = await getChapterQuestions({ ...s, difficultyId: diff, pageSize: PAGE_SIZE, cursor: after });
      if (id !== requestId.current) return;
      setQuestions((prev) => (after ? [...prev, ...page.questions] : page.questions));
      setCursor(page.lastDoc);
      setHasMore(page.hasMore);
    } catch (e) {
      if (id === requestId.current) toast.error(e instanceof Error ? e.message : 'Failed to load questions');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  const refreshCounts = async (s: Selection) => {
    setCounts(null);
    try {
      setCounts(await countQuestions1(s.topicId, s.chapterId, s.subtopicId));
    } catch { /* the counts are a hint — the list still works */ }
  };

  const selectSubtopic = (chapterId: string, subtopicId: string) => {
    const s = { topicId, chapterId, subtopicId };
    setSel(s);
    setQuestions([]);
    load(s, difficulty, null);
    refreshCounts(s);
  };

  const selectDifficulty = (d: Q1DifficultyId) => {
    setDifficulty(d);
    if (sel) { setQuestions([]); load(sel, d, null); }
  };

  const reload = () => {
    if (!sel) return;
    load(sel, difficulty, null);
    refreshCounts(sel);
  };

  const openCreate = () =>
    setForm({ mode: 'create', draft: emptyQuestion1(sel ? { ...sel, difficultyId: difficulty } : { topicId }) });

  const openEdit = (q: BankQuestion) => {
    const { draft, fixes } = coerceQuestion1(q);
    setForm({ mode: 'edit', id: q.id, draft, notes: fixes });
  };

  const toggleBench = async (q: BankQuestion) => {
    const bench = typeof q.rand === 'number';
    if (bench && !confirm('Bench this question? It stays in the teacher bank but is never drawn into a Milliy exam.')) return;
    setBusyId(q.id);
    try {
      await setQuestion1Benched(q.id, bench);
      setQuestions((prev) => prev.map((x) => (x.id === q.id
        ? { ...x, rand: bench ? undefined : Math.random(), suspect: bench ? x.suspect : undefined }
        : x)));
      toast.success(bench ? 'Benched — no longer drawn into exams' : 'Restored to exams');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Abiturient question bank</h1>
          <p className="text-sm text-slate-500">
            Algebra &amp; Geometriya (<code className="font-mono text-xs bg-slate-100 px-1 rounded">questions1</code>) — used by the
            teacher bank, Milliy sertifikat exams and games. Every question needs UZ, RU and EN.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">
            <FileJson size={16} /> Bulk import
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-700">
            <Plus size={16} /> New question
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
        {/* syllabus tree */}
        <aside className="bg-white border border-slate-200 rounded-2xl overflow-hidden lg:sticky lg:top-20 flex flex-col lg:max-h-[calc(100vh-6rem)]">
          <div className="p-3 border-b border-slate-100 flex gap-1">
            {Q1_TREE.map((t) => (
              <button key={t.topicId}
                onClick={() => { if (t.topicId !== topicId) { setTopicId(t.topicId); setOpenChapter(null); } }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                  topicId === t.topicId ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                {t.name}
              </button>
            ))}
          </div>
          <div className="overflow-y-auto max-h-[60vh] lg:max-h-none">
            {topic.chapters.map((ch) => {
              const open = openChapter === ch.chapterId;
              const holdsSelection = sel?.topicId === topicId && sel.chapterId === ch.chapterId;
              return (
                <div key={ch.chapterId} className="border-b border-slate-100 last:border-0">
                  <button onClick={() => setOpenChapter(open ? null : ch.chapterId)}
                    className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-50">
                    <span className={`w-6 shrink-0 pt-0.5 text-[11px] font-black tabular-nums ${holdsSelection ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {ch.chapterId}
                    </span>
                    <span className="flex-1 text-sm font-bold text-slate-800 leading-snug">{ch.name}</span>
                    <ChevronDown size={15} className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <ul className="pb-2">
                      {ch.subtopics.map((s) => {
                        const active = holdsSelection && sel?.subtopicId === s.subtopicId;
                        return (
                          <li key={s.subtopicId}>
                            <button onClick={() => selectSubtopic(ch.chapterId, s.subtopicId)}
                              className={`w-full flex gap-2 pl-9 pr-3 py-1.5 text-left text-[13px] leading-snug transition-colors ${
                                active ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                              <span className={`shrink-0 pt-px text-[11px] tabular-nums ${active ? 'text-indigo-500' : 'text-slate-400'}`}>{s.subtopicId}</span>
                              <span>{s.name}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* subtopic */}
        {!loc ? (
          <section className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <BookOpenCheck size={24} />
            </div>
            <h2 className="font-black text-slate-900">Pick a chapter and a subtopic</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              You will see its questions by difficulty and can add new ones there. A bulk import can also carry its own
              chapter and subtopic numbers — they are the numbers shown in the tree.
            </p>
          </section>
        ) : (
          <section className="space-y-4 min-w-0">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-400">
                    {loc.topic.name} › {loc.chapter.chapterId} {loc.chapter.name}
                  </p>
                  <h2 className="text-lg font-black text-slate-900 leading-snug">{loc.subtopic.name}</h2>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    topicId {loc.topic.topicId} · chapterId {loc.chapter.chapterId} · subtopicId {loc.subtopic.subtopicId}
                  </p>
                </div>
                <button onClick={openCreate}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500">
                  <Plus size={15} /> Add here
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {Q1_DIFFICULTIES.map((d) => (
                  <button key={d.id} onClick={() => selectDifficulty(d.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                      difficulty === d.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    {d.label}
                    <span className={`text-[11px] tabular-nums px-1.5 rounded ${difficulty === d.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                      {counts ? counts[d.id] : '…'}
                    </span>
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1">
                  {Q1_LANGS.map((l) => (
                    <button key={l} onClick={() => setLang(l)}
                      className={`px-2.5 py-1 rounded-md text-xs font-black ${
                        lang === l ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                      {Q1_LANG_LABEL[l]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading && questions.length === 0 ? (
              <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
            ) : questions.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">
                No {Q1_DIFFICULTIES.find((d) => d.id === difficulty)?.label.toLowerCase()} questions here yet.
              </div>
            ) : (
              <ul className="space-y-3">
                {questions.map((q, i) => {
                  const benched = typeof q.rand !== 'number';
                  return (
                    <li key={q.id} className={`bg-white border rounded-2xl p-4 space-y-3 ${benched ? 'border-slate-200 opacity-70' : 'border-slate-200'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-black text-slate-400 tabular-nums">#{i + 1}</span>
                        {q.source === 'admin' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                            <ShieldCheck size={11} /> admin
                          </span>
                        )}
                        {benched && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                            <Ban size={11} /> benched — not in exams
                          </span>
                        )}
                        {q.suspect && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                            title="scripts/analyzeItems.ts: strong students miss it — check the answer key">
                            <AlertTriangle size={11} /> suspect key
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          <button onClick={() => openEdit(q)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => toggleBench(q)} disabled={busyId === q.id}
                            title={benched ? 'Restore to exams' : 'Bench — keep out of exams'}
                            className={`p-2 rounded-lg ${benched ? 'text-emerald-600 hover:bg-emerald-50' : 'text-rose-500 hover:bg-rose-50'}`}>
                            {busyId === q.id ? <Loader2 size={15} className="animate-spin" /> : benched ? <RotateCcw size={15} /> : <Ban size={15} />}
                          </button>
                        </div>
                      </div>
                      <QuestionPreview question={q.question} options={q.options} answer={q.answer}
                        explanation={q.explanation} lang={lang} />
                    </li>
                  );
                })}
              </ul>
            )}

            {hasMore && (
              <div className="flex justify-center">
                <button onClick={() => sel && load(sel, difficulty, cursor)} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                  {loading && <Loader2 size={15} className="animate-spin" />} Load {PAGE_SIZE} more
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {form && (
        <QuestionForm key={form.id ?? 'new'} mode={form.mode} docId={form.id} initial={form.draft} notes={form.notes}
          onClose={() => setForm(null)} onDone={reload} />
      )}

      {importOpen && (
        <BulkImportDialog
          defaults={sel ? { ...sel, difficultyId: difficulty } : undefined}
          defaultsLabel={loc ? `${loc.topic.name} › ${loc.chapter.chapterId}.${loc.subtopic.subtopicId} ${loc.subtopic.name} (${Q1_DIFFICULTIES.find((d) => d.id === difficulty)?.label} if not given)` : undefined}
          onClose={() => setImportOpen(false)} onImported={reload} />
      )}
    </div>
  );
}
