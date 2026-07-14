// app/(student)/RASCHmodel/topic/[topic]/page.tsx
'use client';

import { use, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, CheckCircle2, ChevronDown, Home, Rocket, XCircle,
} from 'lucide-react';

import LatexRenderer from '@/components/LatexRenderer';
import { useStudentLanguage } from '../../../layout';
import {
  getServerSolvedArchive,
  getSolvedArchive,
  subscribeSolved,
  type SolvedQuestion,
} from '@/lib/RASCHsolved';
import { RASCH_TOPICS, TOPIC_KEYS, type TopicKey } from '@/lib/RASCHtopics';
import type { Lang } from '@/types/Math';

function MathText({ text, className }: { text: string; className?: string }) {
  return <LatexRenderer latex={text} className={className} />;
}

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    back: 'Darajam',
    home: 'Bosh sahifa',
    newTest: 'Yangi test',
    solved: 'ta savol yechilgan',
    correct: "to'g'ri",
    empty: "Bu mavzuda hali savol yechmagansiz. Test topshiring — yechgan savollaringiz shu yerda saqlanadi.",
    startExam: 'Testni boshlash',
    yourAnswer: 'Sizning javobingiz',
    correctAnswer: "To'g'ri javob",
    explanation: 'Izoh',
    localOnly: "Yechilgan savollar shu qurilmada saqlanadi (oxirgi 20 tasi).",
    open: 'Ochiq savol',
  },
  ru: {
    back: 'Мой уровень',
    home: 'Главная',
    newTest: 'Новый тест',
    solved: 'вопросов решено',
    correct: 'верно',
    empty: 'Вы ещё не решали вопросы по этой теме. Пройдите тест — решённые вопросы появятся здесь.',
    startExam: 'Начать тест',
    yourAnswer: 'Ваш ответ',
    correctAnswer: 'Правильный ответ',
    explanation: 'Объяснение',
    localOnly: 'Решённые вопросы хранятся на этом устройстве (последние 20).',
    open: 'Открытый вопрос',
  },
  en: {
    back: 'My level',
    home: 'Home',
    newTest: 'New test',
    solved: 'questions solved',
    correct: 'correct',
    empty: "You haven't solved any questions in this topic yet. Take a test — the questions you solve are kept here.",
    startExam: 'Start a test',
    yourAnswer: 'Your answer',
    correctAnswer: 'Correct answer',
    explanation: 'Explanation',
    localOnly: 'Solved questions are kept on this device (the last 20).',
    open: 'Open question',
  },
};

function formatDate(at: number, lang: Lang): string {
  return new Date(at).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

// ─── One solved question ──────────────────────────────────────────────────
function SolvedCard({ item, lang, t, index }: { item: SolvedQuestion; lang: Lang; t: Record<string, string>; index: number }) {
  const [showExplanation, setShowExplanation] = useState(false);
  const expected = item.expected ?? item.answer;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, 10) * 0.03 }}
      className={`bg-white rounded-2xl border-2 border-b-[6px] p-4 ${item.correct ? 'border-emerald-200' : 'border-rose-200'}`}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="px-2 py-0.5 rounded-lg bg-zinc-100 border border-zinc-200 text-[10px] font-black text-zinc-500 shrink-0">
          {item.testType}
        </span>
        <span className="text-[11px] font-bold text-zinc-400 truncate min-w-0">{item.chapter}</span>
        <span className="text-[11px] font-bold text-zinc-300 shrink-0 ml-auto">{formatDate(item.examAt, lang)}</span>
        {item.correct
          ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          : <XCircle size={18} className="text-rose-400 shrink-0" />}
      </div>

      <MathText text={item.question[item.lang] ?? item.question[lang]} className="text-[14px] font-bold text-zinc-900 leading-snug block mb-3" />

      <div className="text-[12px] font-bold text-zinc-500 flex flex-wrap items-center gap-x-1.5">
        <span>{t.yourAnswer}:</span>
        {item.given ? <MathText text={item.given} /> : <span>—</span>}
        {!item.correct && (
          <span className="text-emerald-600 flex items-center gap-1">
            · {t.correctAnswer}: <MathText text={expected} />
          </span>
        )}
      </div>

      {item.explanation?.[item.lang] && (
        <div className="mt-2">
          <button
            onClick={() => setShowExplanation((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[11px] font-black transition-all ${
              showExplanation
                ? 'bg-violet-50 border-violet-200 text-violet-700'
                : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:border-violet-200 hover:text-violet-600'
            }`}
          >
            <BookOpen size={12} strokeWidth={3} />
            {t.explanation}
            <ChevronDown size={12} strokeWidth={3} className={`transition-transform ${showExplanation ? 'rotate-180' : ''}`} />
          </button>
          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-2 pt-2 border-t border-zinc-100 text-[12px] font-medium text-zinc-500"
            >
              <MathText text={item.explanation[item.lang]} />
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = use(params);
  const { lang } = useStudentLanguage();
  const t = UI[lang];

  // The archive is a localStorage store, read the same way the exam snapshot is:
  // null on the server, real data in the browser. Zero Firestore reads.
  const archive = useSyncExternalStore(subscribeSolved, getSolvedArchive, getServerSolvedArchive);

  const key = TOPIC_KEYS.includes(topic as TopicKey) ? (topic as TopicKey) : null;
  const meta = RASCH_TOPICS.find((tp) => tp.key === key);

  const items = useMemo(
    () => (key ? [...(archive.byTopic[key] ?? [])].reverse() : []),
    [archive, key],
  );
  const correct = items.filter((i) => i.correct).length;

  if (!key || !meta) notFound();

  return (
    <div className="min-h-screen bg-zinc-100 font-sans pb-28 md:pb-12">
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 md:px-8 pt-8 flex flex-col gap-5">

        {/* Nav */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/RASCHmodel/progress"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-zinc-200 border-b-4 rounded-2xl text-[12px] font-black text-zinc-600 active:border-b-2 active:translate-y-[2px] transition-all"
          >
            <ArrowLeft size={14} strokeWidth={3} /> {t.back}
          </Link>
          <Link
            href="/RASCHmodel"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-zinc-200 border-b-4 rounded-2xl text-[12px] font-black text-zinc-600 active:border-b-2 active:translate-y-[2px] transition-all"
          >
            <Home size={14} strokeWidth={3} /> {t.home}
          </Link>
          <Link
            href="/RASCHmodel/exam"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-500 text-white border-b-4 border-violet-700 rounded-2xl text-[12px] font-black active:border-b-0 active:translate-y-1 transition-all ml-auto"
          >
            <Rocket size={14} strokeWidth={3} /> {t.newTest}
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <span className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: meta.hex }} />
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight leading-tight">
                {meta.label[lang]}
              </h1>
              <p className="text-[12px] font-bold text-zinc-400 mt-1">
                {items.length} {t.solved}
                {items.length > 0 && <> · {correct} {t.correct}</>}
              </p>
            </div>
          </div>
        </div>

        {/* Solved questions */}
        {items.length === 0 ? (
          <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-8 flex flex-col items-center gap-4 text-center">
            <p className="text-[13px] font-bold text-zinc-400 max-w-sm">{t.empty}</p>
            <Link
              href="/RASCHmodel/exam"
              className="flex items-center gap-2 px-5 py-3 bg-violet-500 text-white font-black text-[13px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider"
            >
              <Rocket size={16} strokeWidth={3} /> {t.startExam}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {items.map((item, i) => (
                <SolvedCard key={`${item.id}-${item.examAt}`} item={item} lang={lang} t={t} index={i} />
              ))}
            </div>
            <p className="text-[11px] font-bold text-zinc-400 px-1">{t.localOnly}</p>
          </>
        )}

      </div>
    </div>
  );
}
