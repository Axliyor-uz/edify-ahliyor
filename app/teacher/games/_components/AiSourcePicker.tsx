'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Check, GraduationCap, Library, PenLine, School, Search, Sparkles, Target } from 'lucide-react';
import { Skeleton, cn } from '@/components/ui';
import {
  DTM_BANK_SUBJECT, DTM_SECTIONS, EXAM_SUBJECTS, MAX_TOPIC, SOURCE_KINDS, TRACKS, gradesOf, normalizeSyllabus, subjectLabel, subjectsOf,
  type AiSource, type SourceKind, type SyllabusChapter, type SyllabusKind,
} from '../_lib/aiSource';
import type { AiText } from '../_lib/aiText';

/**
 * "What to build the questions from": 4 source cards, then only the fields
 * that source needs — a topic box; grade → subject → syllabus topic (the same
 * data as /teacher/create/maktab and ixtisoslashtirilgan_maktab); or an exam
 * subject + topic (as /teacher/create/ai for abiturients) — for Matematika
 * also "DTM bazasidan": section → topic, ready questions (/teacher/create/database).
 */

export interface SourceForm {
  kind: SourceKind;
  text: string;
  grade: string;
  subject: string;
  chapter: number | null;
  topic: number | null;
  /** Names of the picked syllabus topic, for the summary and the set's title. */
  topicName: string;
  chapterName: string;
  examSubject: string;
  examTopic: string;
  /** Abiturient + Matematika only: AI-written, or ready questions from the DTM bank. */
  examMode: 'ai' | 'bank';
  bankSection: number | null;
  bankChapter: number | null;
  bankTopic: number | null;
  bankChapterName: string;
  bankTopicName: string;
}

export const emptyForm = (): SourceForm => ({
  kind: 'topic', text: '', grade: '', subject: '', chapter: null, topic: null, topicName: '', chapterName: '', examSubject: '', examTopic: '',
  examMode: 'ai', bankSection: null, bankChapter: null, bankTopic: null, bankChapterName: '', bankTopicName: '',
});

/** True when the form asks for ready DTM-bank questions (free, no AI). */
export const isBankForm = (f: SourceForm) => f.kind === 'abiturient' && f.examSubject === DTM_BANK_SUBJECT && f.examMode === 'bank';

/** The form a saved set was made from (so "Yangi savollar" starts where the teacher left off). */
export function formFromSet(source: AiSource, title: string): SourceForm {
  const form = emptyForm();
  if (source.kind === 'topic') return { ...form, text: source.topic };
  if (source.kind === 'abiturient') return { ...form, kind: 'abiturient', examSubject: source.subject, examTopic: source.topic };
  if (source.kind === 'dtm-bank') {
    return {
      ...form, kind: 'abiturient', examSubject: DTM_BANK_SUBJECT, examMode: 'bank',
      bankSection: source.section, bankChapter: source.chapter, bankTopic: source.topic, bankTopicName: title.split(' · ').pop() ?? '',
    };
  }
  return {
    ...form, kind: source.kind, grade: source.grade, subject: source.subject, chapter: source.chapter, topic: source.topic,
    topicName: title.split(' · ').pop() ?? '',
  };
}

/** The request source, or null while something is missing. */
export function toSource(f: SourceForm): AiSource | null {
  if (f.kind === 'topic') return f.text.trim().length >= 2 ? { kind: 'topic', topic: f.text.trim() } : null;
  if (isBankForm(f)) {
    return f.bankSection !== null && f.bankChapter !== null && f.bankTopic !== null
      ? { kind: 'dtm-bank', section: f.bankSection, chapter: f.bankChapter, topic: f.bankTopic }
      : null;
  }
  if (f.kind === 'abiturient') {
    return f.examSubject && f.examTopic.trim().length >= 2 ? { kind: 'abiturient', subject: f.examSubject, topic: f.examTopic.trim() } : null;
  }
  return f.grade && f.subject && f.chapter !== null && f.topic !== null
    ? { kind: f.kind, grade: f.grade, subject: f.subject, chapter: f.chapter, topic: f.topic }
    : null;
}

/** The set's name in the game: the topic, prefixed with where it comes from. */
export function sourceTitle(f: SourceForm, t: AiText): string {
  if (f.kind === 'topic') return f.text.trim();
  if (isBankForm(f)) return `DTM · ${DTM_SECTIONS[f.bankSection ?? 0]?.name} · ${f.bankTopicName}`;
  if (f.kind === 'abiturient') return `DTM · ${t.examSubjects[f.examSubject] ?? f.examSubject} · ${f.examTopic.trim()}`;
  return `${t.gradeLabel(f.grade)} · ${subjectLabel(f.subject)} · ${f.topicName}`;
}

const SOURCE_ICONS: Record<SourceKind, React.ReactNode> = {
  topic: <PenLine size={19} />,
  maktab: <School size={19} />,
  ixtisos: <GraduationCap size={19} />,
  abiturient: <Target size={19} />,
};

export default function AiSourcePicker({ form, onChange, onSubmit, t }: {
  form: SourceForm;
  onChange: (form: SourceForm) => void;
  /** Ctrl/Cmd+Enter in a text box. */
  onSubmit: () => void;
  t: AiText;
}) {
  const set = (patch: Partial<SourceForm>) => onChange({ ...form, ...patch });
  const pickKind = (kind: SourceKind) => {
    if (kind === form.kind) return;
    // Grades and subjects differ between the two school tracks: start that part over.
    const keepSyllabus = kind === 'topic' || kind === 'abiturient' || form.kind === 'topic' || form.kind === 'abiturient';
    set(keepSyllabus ? { kind } : { kind, grade: '', subject: '', chapter: null, topic: null, topicName: '', chapterName: '' });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[13px] font-bold text-on-surface">{t.sourceTitle}</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {SOURCE_KINDS.map((kind) => {
            const on = kind === form.kind;
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickKind(kind)}
                className={cn(
                  'flex items-center gap-2.5 rounded-m3-md border-2 p-2.5 text-left transition-colors',
                  on ? 'border-primary bg-t-primary-soft' : 'border-outline-variant bg-surface-container-lowest hover:border-primary',
                )}
              >
                <span className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-m3-sm',
                  on ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant',
                )}>
                  {SOURCE_ICONS[kind]}
                </span>
                <span className="min-w-0">
                  <b className="block text-[13px] font-bold leading-tight text-on-surface">{t.sources[kind].title}</b>
                  <small className="block text-[11.5px] font-medium leading-tight text-on-surface-variant">{t.sources[kind].desc}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {form.kind === 'topic' && (
        <Field label={t.topic}>
          <TopicBox id="ai-topic" value={form.text} placeholder={t.topicHint} onChange={(text) => set({ text })} onSubmit={onSubmit} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold text-on-surface-variant">{t.examplesLabel}</span>
            {t.examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => set({ text: ex })}
                className="rounded-full bg-surface-container-high px-2.5 py-1 text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-t-primary-soft hover:text-primary"
              >
                {ex}
              </button>
            ))}
          </div>
        </Field>
      )}

      {(form.kind === 'maktab' || form.kind === 'ixtisos') && (
        <>
          <Field label={t.grade}>
            <Pills
              items={gradesOf(form.kind).map((g) => ({ id: g, label: t.gradeLabel(g) }))}
              value={form.grade}
              onPick={(grade) => set({
                grade,
                // Keep the subject when the new grade has it too; the topic always starts over.
                subject: subjectsOf(form.kind as SyllabusKind, grade).includes(form.subject) ? form.subject : '',
                chapter: null, topic: null, topicName: '', chapterName: '',
              })}
            />
          </Field>
          {form.grade && (
            <Field label={t.subject}>
              <Pills
                items={subjectsOf(form.kind, form.grade).map((s) => ({ id: s, label: subjectLabel(s) }))}
                value={form.subject}
                onPick={(subject) => set({ subject, chapter: null, topic: null, topicName: '', chapterName: '' })}
              />
            </Field>
          )}
          {form.grade && form.subject && (
            <Field label={t.syllabusTopic}>
              <SyllabusTopics form={form} onPick={(chapter, topic, chapterName, topicName) => set({ chapter, topic, chapterName, topicName })} t={t} />
            </Field>
          )}
        </>
      )}

      {form.kind === 'abiturient' && (
        <>
          <Field label={t.subject}>
            <Pills
              items={EXAM_SUBJECTS.map((s) => ({ id: s, label: t.examSubjects[s] ?? s }))}
              value={form.examSubject}
              onPick={(examSubject) => set({ examSubject })}
            />
          </Field>
          {form.examSubject === DTM_BANK_SUBJECT && (
            <Field label={t.examMode}>
              <Pills
                items={[
                  { id: 'ai', label: t.examModes.ai, icon: <Sparkles size={15} /> },
                  { id: 'bank', label: t.examModes.bank, icon: <Library size={15} /> },
                ]}
                value={form.examMode}
                onPick={(examMode) => set({ examMode: examMode as SourceForm['examMode'] })}
              />
            </Field>
          )}
          {isBankForm(form) ? (
            <>
              <Field label={t.section}>
                <Pills
                  items={DTM_SECTIONS.map((sec, i) => ({ id: String(i), label: sec.name }))}
                  value={form.bankSection === null ? '' : String(form.bankSection)}
                  onPick={(id) => set({ bankSection: Number(id), bankChapter: null, bankTopic: null, bankChapterName: '', bankTopicName: '' })}
                />
              </Field>
              {form.bankSection !== null && (
                <Field label={t.syllabusTopic}>
                  <TopicList
                    key={form.bankSection}
                    chapters={DTM_SECTIONS[form.bankSection].chapters}
                    picked={{ chapter: form.bankChapter, topic: form.bankTopic, chapterName: form.bankChapterName, topicName: form.bankTopicName }}
                    onPick={(bankChapter, bankTopic, bankChapterName, bankTopicName) => set({ bankChapter, bankTopic, bankChapterName, bankTopicName })}
                    t={t}
                  />
                  <p className="mt-1.5 text-[12px] font-medium text-on-surface-variant">{t.bankNote}</p>
                </Field>
              )}
            </>
          ) : (
            <Field label={t.topic}>
              <TopicBox id="ai-exam-topic" value={form.examTopic} placeholder={t.examTopicHint} onChange={(examTopic) => set({ examTopic })} onSubmit={onSubmit} rows={2} />
              <p className="mt-1.5 text-[12px] font-medium text-on-surface-variant">{t.examNote}</p>
            </Field>
          )}
        </>
      )}
    </div>
  );
}

/** The syllabus topics of one grade + subject, loaded from /api/syllabus (as the create pages do). */
function SyllabusTopics({ form, onPick, t }: {
  form: SourceForm;
  onPick: (chapter: number, topic: number, chapterName: string, topicName: string) => void;
  t: AiText;
}) {
  const kind = form.kind as SyllabusKind;
  const key = `${kind}|${form.grade}|${form.subject}`;
  /** chapters = null → the list failed to load. */
  const [loaded, setLoaded] = useState<{ key: string; chapters: SyllabusChapter[] | null } | null>(null);

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ track: TRACKS[kind].folder, class: form.grade, subject: form.subject });
    fetch(`/api/syllabus?${q}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((raw) => alive && setLoaded({ key, chapters: normalizeSyllabus(raw, subjectLabel(form.subject)) }))
      .catch(() => alive && setLoaded({ key, chapters: null }));
    return () => { alive = false; };
  }, [key, kind, form.grade, form.subject]);

  const picked = { chapter: form.chapter, topic: form.topic, chapterName: form.chapterName, topicName: form.topicName };
  // A picked topic shows at once; the list is only needed to change it.
  if (picked.chapter === null && (!loaded || loaded.key !== key)) {
    return <div className="grid gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-m3-sm" />)}</div>;
  }
  if (picked.chapter === null && !loaded?.chapters?.length) {
    return <p className="rounded-m3-md bg-error-container px-3 py-2.5 text-[13px] font-semibold text-on-error-container">{t.syllabusFailed}</p>;
  }
  return <TopicList key={key} chapters={loaded?.key === key ? loaded.chapters ?? [] : []} picked={picked} onPick={onPick} t={t} />;
}

/** Topics grouped by chapter, with search — or, once one is picked, just that one + "O'zgartirish". */
function TopicList({ chapters, picked, onPick, t }: {
  chapters: SyllabusChapter[];
  picked: { chapter: number | null; topic: number | null; chapterName: string; topicName: string };
  onPick: (chapter: number, topic: number, chapterName: string, topicName: string) => void;
  t: AiText;
}) {
  const [search, setSearch] = useState('');
  const [browsing, setBrowsing] = useState(false);

  if (picked.chapter !== null && picked.topic !== null && !browsing) {
    return (
      <div className="flex items-center gap-3 rounded-m3-md border-2 border-primary bg-t-primary-soft p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-m3-sm bg-primary text-on-primary"><BookOpen size={18} /></span>
        <span className="min-w-0 flex-1">
          <b className="block text-[14px] font-bold leading-snug text-on-surface">{picked.topicName}</b>
          {picked.chapterName && <small className="block truncate text-[12px] font-medium text-on-surface-variant">{picked.chapterName}</small>}
        </span>
        <button type="button" onClick={() => setBrowsing(true)} className="shrink-0 text-[13px] font-bold text-primary hover:underline">{t.change}</button>
      </div>
    );
  }

  const needle = search.trim().toLowerCase();
  const groups = chapters
    .map((ch, ci) => ({ ch, ci, topics: ch.topics.map((tp, ti) => ({ tp, ti })).filter(({ tp }) => !needle || tp.name.toLowerCase().includes(needle)) }))
    .filter((g) => g.topics.length);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 rounded-m3-md border border-outline-variant bg-surface-container-lowest px-3 focus-within:border-primary">
        <Search size={16} className="shrink-0 text-on-surface-variant" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchTopic}
          className="h-10 w-full bg-transparent text-[14px] font-medium text-on-surface outline-none placeholder:text-on-surface-variant"
        />
      </label>
      <div className="max-h-[300px] overflow-y-auto rounded-m3-md border border-outline-variant bg-surface-container-lowest custom-scrollbar">
        {!groups.length && <p className="px-3 py-6 text-center text-[13px] font-medium text-on-surface-variant">{t.noTopicMatch}</p>}
        {groups.map(({ ch, ci, topics }) => (
          <div key={ci}>
            <p className="sticky top-0 z-[1] bg-surface-container-high px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-on-surface-variant">{ch.name}</p>
            {topics.map(({ tp, ti }) => {
              const on = picked.chapter === ci && picked.topic === ti;
              return (
                <button
                  key={ti}
                  type="button"
                  onClick={() => { onPick(ci, ti, ch.name, tp.name); setBrowsing(false); setSearch(''); }}
                  className={cn(
                    'flex w-full items-center gap-2 border-b border-outline-variant px-3 py-2.5 text-left text-[13.5px] font-semibold last:border-b-0 transition-colors',
                    on ? 'bg-t-primary-soft text-primary' : 'text-on-surface hover:bg-state-hover',
                  )}
                >
                  <span className="min-w-0 flex-1">{tp.name}</span>
                  {on && <Check size={16} className="shrink-0" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicBox({ id, value, placeholder, onChange, onSubmit, rows = 3 }: {
  id: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      maxLength={MAX_TOPIC}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit(); }}
      className="w-full resize-none rounded-m3-md border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 text-[15px] font-medium text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary"
    />
  );
}

/** Wrapping single-choice pills (grades, subjects). */
function Pills({ items, value, onPick }: { items: { id: string; label: string; icon?: React.ReactNode }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(it.id)}
            className={cn(
              'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-colors',
              on ? 'bg-primary text-on-primary shadow-elev-1' : 'bg-surface-container-high text-on-surface-variant hover:bg-state-hover hover:text-on-surface',
            )}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-bold text-on-surface">{label}</p>
      {children}
    </div>
  );
}
