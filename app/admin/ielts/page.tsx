'use client';

// Admin IELTS platform dataset manager: platform tests per skill, JSON import
// (schema-validated), promotion of teacher tests, and reused W/S authoring forms.
// Admin writes bypass rules via the super_admin god-mode wildcard.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import {
  BookOpen, Headphones, PenLine, Mic, Plus, FileJson, Upload, Trash2,
  Pencil, ArrowUpToLine, Search, AlertTriangle, CheckCircle2, X, Loader2,
} from 'lucide-react';
import {
  deleteIeltsTest, fetchPlatformTests, promoteTestToPlatform, saveIeltsTest,
} from '@/services/ieltsService';
import { validateTestJson, typeBreakdown } from '@/lib/ielts/testSchema';
import type { IeltsSkill } from '@/lib/ielts/types';
import AdminLangProvider from './_components/AdminLangProvider';
import WritingForm from '@/app/teacher/ielts/writing/_components/WritingForm';
import SpeakingForm from '@/app/teacher/ielts/speaking/_components/SpeakingForm';

const SKILLS: { key: IeltsSkill; label: string; icon: typeof BookOpen }[] = [
  { key: 'reading', label: 'Reading', icon: BookOpen },
  { key: 'listening', label: 'Listening', icon: Headphones },
  { key: 'writing', label: 'Writing', icon: PenLine },
  { key: 'speaking', label: 'Speaking', icon: Mic },
];

const COLLECTIONS: Record<IeltsSkill, string> = {
  reading: 'ielts_reading_tests',
  listening: 'ielts_listening_tests',
  writing: 'ielts_writing_tests',
  speaking: 'ielts_speaking_tests',
};

type TestRow = { id: string } & Record<string, any>;

const JSON_SAMPLE = `{
  "module": "reading",
  "test_title": "Cambridge Style Test 1",
  "test_category": "academic",
  "total_time_minutes": 60,
  "passages": [
    {
      "title": "Passage title",
      "blocks": [{ "label": "A", "content": "Paragraph text..." }],
      "questions": [
        {
          "type": "true_false_not_given",
          "instructions": "Do the statements agree...",
          "questions": [
            { "statement": "Statement 1", "correct_answer": "TRUE", "passage_reference": "evidence sentence" }
          ]
        }
      ]
    }
  ]
}
// listening: "module": "listening" + "parts": [{ "audio_url": "https://...", "transcript": "...", "questions": [...] }]`;

export default function AdminIeltsPage() {
  const [skill, setSkill] = useState<IeltsSkill>('reading');
  const [platformTests, setPlatformTests] = useState<TestRow[]>([]);
  const [teacherTests, setTeacherTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [wsForm, setWsForm] = useState<{ open: boolean; initial: TestRow | null }>({ open: false, initial: null });
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async (s: IeltsSkill) => {
    setLoading(true);
    try {
      const [platform, all] = await Promise.all([
        fetchPlatformTests(s),
        getDocs(collection(db, COLLECTIONS[s])),
      ]);
      setPlatformTests(platform as TestRow[]);
      setTeacherTests(all.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((t: TestRow) => t.source !== 'platform' && t.teacherId));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load tests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(skill); }, [skill, reload]);

  const filteredTeacher = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teacherTests;
    return teacherTests.filter((t) =>
      String(t.test_title || '').toLowerCase().includes(q) || String(t.teacherId || '').includes(q));
  }, [teacherTests, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this platform test permanently?')) return;
    setBusyId(id);
    try {
      await deleteIeltsTest(skill, id);
      setPlatformTests((p) => p.filter((t) => t.id !== id));
      toast.success('Deleted');
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const handlePromote = async (id: string) => {
    setBusyId(id);
    try {
      await promoteTestToPlatform(skill as never, id);
      toast.success('Promoted to platform dataset');
      reload(skill);
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const editHref = (id: string) =>
    skill === 'reading' ? `/admin/ielts/reading/${id}`
      : skill === 'listening' ? `/admin/ielts/listening/${id}` : null;

  const meta = (t: TestRow) => {
    if (skill === 'reading') return `${t.passages?.length || 0} passages · ${t.total_questions || 0} Q · ${t.total_time_minutes || 60} min`;
    if (skill === 'listening') return `${t.parts?.length || 0} parts · ${t.total_questions || 0} Q · ${t.total_time_minutes || 32} min`;
    if (skill === 'writing') return 'Task 1 + Task 2';
    return `${(t.part1Questions?.length || 0) + (t.part3Questions?.length || 0) + 1} prompts`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">IELTS Platform Dataset</h1>
          <p className="text-sm text-slate-500">Ready-made practice tests available to every teacher and student.</p>
        </div>
        <div className="flex gap-2">
          {(skill === 'reading' || skill === 'listening') && (
            <>
              <button onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">
                <FileJson size={16} /> Import JSON
              </button>
              <Link href={`/admin/ielts/${skill}/new`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-700">
                <Plus size={16} /> New test
              </Link>
            </>
          )}
          {(skill === 'writing' || skill === 'speaking') && (
            <button onClick={() => setWsForm({ open: true, initial: null })}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-700">
              <Plus size={16} /> New {skill} set
            </button>
          )}
        </div>
      </div>

      {/* skill tabs */}
      <div className="flex gap-1 overflow-x-auto hide-scrollbar">
        {SKILLS.map((s) => (
          <button key={s.key} onClick={() => { setSkill(s.key); setWsForm({ open: false, initial: null }); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
              skill === s.key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
            <s.icon size={16} /> {s.label}
          </button>
        ))}
      </div>

      {/* inline W/S form */}
      {wsForm.open && (skill === 'writing' || skill === 'speaking') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <AdminLangProvider>
            {skill === 'writing' ? (
              <WritingForm asPlatform initial={wsForm.initial}
                onSaved={() => { setWsForm({ open: false, initial: null }); reload(skill); }}
                onCancel={() => setWsForm({ open: false, initial: null })} />
            ) : (
              <SpeakingForm asPlatform initial={wsForm.initial}
                onSaved={() => { setWsForm({ open: false, initial: null }); reload(skill); }}
                onCancel={() => setWsForm({ open: false, initial: null })} />
            )}
          </AdminLangProvider>
        </div>
      )}

      {/* platform tests */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-bold text-slate-900 text-sm">
          Platform tests ({platformTests.length})
        </div>
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
        ) : platformTests.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No platform {skill} tests yet — create, import, or promote one below.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {platformTests.map((t) => (
              <li key={t.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    {t.test_title || t.id}
                    {(skill === 'reading' || skill === 'listening') && !t.answers_split && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        <AlertTriangle size={11} /> legacy (answers inline)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{meta(t)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {editHref(t.id) ? (
                    <Link href={editHref(t.id)!} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit">
                      <Pencil size={15} />
                    </Link>
                  ) : (
                    <button onClick={() => setWsForm({ open: true, initial: t })}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit"><Pencil size={15} /></button>
                  )}
                  <button onClick={() => handleDelete(t.id)} disabled={busyId === t.id}
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-50" title="Delete">
                    {busyId === t.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* promote teacher tests */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-900 text-sm">Teacher tests — promote to dataset</span>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title / teacher uid"
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
        </div>
        {filteredTeacher.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No teacher-authored {skill} tests found.</div>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {filteredTeacher.map((t) => (
              <li key={t.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-bold text-slate-900 text-sm">{t.test_title || t.id}</div>
                  <div className="text-xs text-slate-500">{meta(t)} · teacher {String(t.teacherId).slice(0, 8)}…</div>
                </div>
                <button onClick={() => handlePromote(t.id)} disabled={busyId === t.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100">
                  {busyId === t.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpToLine size={13} />} Promote
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {importOpen && (
        <ImportJsonDialog skill={skill as 'reading' | 'listening'}
          onClose={() => setImportOpen(false)}
          onImported={() => { setImportOpen(false); reload(skill); }} />
      )}
    </div>
  );
}

function ImportJsonDialog({ skill, onClose, onImported }: {
  skill: 'reading' | 'listening'; onClose: () => void; onImported: () => void;
}) {
  const [raw, setRaw] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [valid, setValid] = useState<ReturnType<typeof validateTestJson> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSample, setShowSample] = useState(false);

  const validate = () => {
    setValid(null);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch (e: any) {
      setErrors([`Invalid JSON: ${e.message}`]); return;
    }
    const res = validateTestJson(parsed);
    setErrors(res.errors);
    if (res.ok) setValid(res);
  };

  const doImport = async () => {
    if (!valid?.test) return;
    setSaving(true);
    try {
      await saveIeltsTest(valid.test as never, { asPlatform: true });
      toast.success(`Imported "${valid.test.test_title}"`);
      onImported();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const summary = valid?.test ? {
    title: valid.test.test_title,
    module: valid.test.module,
    sections: valid.test.module === 'reading' ? valid.test.passages.length : valid.test.parts.length,
    questions: valid.test.total_questions,
    types: Object.entries(typeBreakdown(valid.test)).map(([k, v]) => `${v} × ${k}`).join(', '),
  } : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-black text-slate-900">Import {skill} test from JSON</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <button onClick={() => setShowSample((s) => !s)} className="text-xs font-bold text-indigo-600 hover:underline">
          {showSample ? 'Hide' : 'Show'} expected structure
        </button>
        {showSample && (
          <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre">{JSON_SAMPLE}</pre>
        )}
        <textarea value={raw} onChange={(e) => { setRaw(e.target.value); setValid(null); setErrors([]); }}
          placeholder="Paste the test JSON here…" spellCheck={false}
          className="w-full h-56 font-mono text-xs border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        {errors.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
            {errors.map((e, i) => (
              <div key={i} className="text-xs text-rose-700 flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{e}</div>
            ))}
          </div>
        )}
        {summary && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-0.5">
            <div className="flex items-center gap-1.5 font-bold"><CheckCircle2 size={13} /> Valid — ready to import</div>
            <div>{summary.title} · {summary.module} · {summary.sections} section(s) · {summary.questions} questions</div>
            <div className="text-emerald-700">{summary.types}</div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={validate} disabled={!raw.trim()}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40">
            Validate
          </button>
          <button onClick={doImport} disabled={!valid || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Import to dataset
          </button>
        </div>
      </div>
    </div>
  );
}
