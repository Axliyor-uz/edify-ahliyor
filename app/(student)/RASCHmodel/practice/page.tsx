// app/(student)/RASCHmodel/practice/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Home, Play, Rocket, Target, XCircle,
} from 'lucide-react';

import LatexRenderer from '@/components/LatexRenderer';
import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '../../layout';
import { diagnosticsFor, getRASCHLevels, savePracticeResult } from '@/services/RASCHProgressService';
import { weakestSpots } from '@/lib/RASCHdiagnosis';
import { buildPractice } from '@/lib/Examquestions';
import { topicForChapter } from '@/lib/Examblueprint';
import type { ChapterRef } from '@/types/Exam';
import type { DifficultyId, Lang, OptionKey, QuestionDoc } from '@/types/Math';
import type { ItemResponse, RASCHLevels } from '@/types/RASCH';

const PRACTICE_SIZE = 10;

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    title: 'Maqsadli mashq',
    subtitle: 'Eng zaif mavzularingizdan, darajangizga mos qiyinlikda',
    back: 'Tahlil', home: 'Bosh sahifa',
    start: 'Mashqni boshlash', loading: 'Savollar tanlanmoqda…',
    focus: 'Diqqat markazida', difficulty: 'Qiyinlik',
    easy: 'Oson', medium: "O'rta", hard: 'Qiyin',
    needData: 'Avval test topshiring — mashq zaif mavzularingizdan tuziladi.',
    startExam: 'Testni boshlash',
    question: 'Savol', next: 'Keyingi', finish: 'Yakunlash',
    result: 'Natija', correct: "to'g'ri",
    again: 'Yana mashq', diagnosis: 'Tahlilga qaytish',
    saving: 'Saqlanmoqda…', saved: 'Tahlilingiz yangilandi',
    signIn: 'Mashq qilish uchun tizimga kiring',
    error: "Savollarni yuklab bo'lmadi",
    correctAnswer: "To'g'ri javob",
    reads: 'ta savol o‘qildi',
  },
  ru: {
    title: 'Целевая тренировка',
    subtitle: 'По самым слабым темам, на подходящей вам сложности',
    back: 'Анализ', home: 'Главная',
    start: 'Начать тренировку', loading: 'Подбор вопросов…',
    focus: 'В фокусе', difficulty: 'Сложность',
    easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный',
    needData: 'Сначала пройдите тест — тренировка строится по слабым темам.',
    startExam: 'Начать тест',
    question: 'Вопрос', next: 'Далее', finish: 'Завершить',
    result: 'Результат', correct: 'верно',
    again: 'Ещё тренировка', diagnosis: 'Вернуться к анализу',
    saving: 'Сохранение…', saved: 'Анализ обновлён',
    signIn: 'Войдите, чтобы тренироваться',
    error: 'Не удалось загрузить вопросы',
    correctAnswer: 'Правильный ответ',
    reads: 'вопросов прочитано',
  },
  en: {
    title: 'Targeted practice',
    subtitle: 'Your weakest subtopics, at a difficulty matched to your ability',
    back: 'Analysis', home: 'Home',
    start: 'Start practice', loading: 'Picking questions…',
    focus: 'Focus', difficulty: 'Difficulty',
    easy: 'Easy', medium: 'Medium', hard: 'Hard',
    needData: 'Sit an exam first — practice is built from your weak spots.',
    startExam: 'Start an exam',
    question: 'Question', next: 'Next', finish: 'Finish',
    result: 'Result', correct: 'correct',
    again: 'Practise again', diagnosis: 'Back to analysis',
    saving: 'Saving…', saved: 'Your analysis is updated',
    signIn: 'Sign in to practise',
    error: 'Could not load questions',
    correctAnswer: 'Correct answer',
    reads: 'questions read',
  },
};

/**
 * Ability → the difficulty worth practising.
 *
 * Not the hardest available: a student is stretched, not buried. Items near
 * their own ability are the ones that actually teach — far above and every
 * attempt is a guess, far below and nothing is learned.
 */
function difficultyForAbility(theta: number | undefined): DifficultyId {
  if (theta === undefined) return 2;
  if (theta < -0.5) return 1;
  if (theta > 0.6) return 3;
  return 2;
}

type Stage = 'intro' | 'loading' | 'running' | 'done';

export default function PracticePage() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useStudentLanguage();
  const t = UI[lang];

  const [levels, setLevels] = useState<RASCHLevels | null>(null);
  const [stage, setStage] = useState<Stage>('intro');
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionDoc[]>([]);
  const [docsRead, setDocsRead] = useState(0);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [seconds, setSeconds] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const clock = useRef<{ id: string; since: number } | null>(null);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    getRASCHLevels(user.uid)
      .then((next) => !cancelled && setLevels(next))
      .catch((err: unknown) => {
        console.error('[RASCH] practice: levels load failed', err);
        if (!cancelled) setError(t.error);
      });
    return () => { cancelled = true; };
  }, [user, authLoading, t.error]);

  // What to practise comes from the EXAM record, not from practice itself —
  // otherwise drilling a topic would make it look weak forever and the practice
  // set would keep serving it back. The exam is the honest signal.
  const weakChapters = useMemo(
    () => weakestSpots(diagnosticsFor(levels, 'exam'), { level: 'chapter', minSeen: 1, limit: 3 }),
    [levels],
  );
  // Difficulty is matched to exam ability for the same reason: practice is
  // untimed, so its ability estimate runs flattering.
  const difficultyId = difficultyForAbility(levels?.abilityExam?.theta ?? levels?.ability?.theta);
  const difficultyLabel = difficultyId === 1 ? t.easy : difficultyId === 2 ? t.medium : t.hard;

  const bank = (id: string) => {
    const mark = clock.current;
    if (!mark || mark.id !== id) return;
    const elapsed = Math.max(0, Math.round((Date.now() - mark.since) / 1000));
    setSeconds((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + elapsed }));
  };

  async function start() {
    if (weakChapters.length === 0) return;
    setStage('loading');
    setError(null);
    try {
      const chapters: ChapterRef[] = weakChapters.map((s) => ({
        topicId: s.topicId,
        chapterId: s.chapterId,
      }));
      const { questions: qs, docsRead: reads } = await buildPractice({
        chapters,
        difficultyId,
        count: PRACTICE_SIZE,
      });
      if (qs.length === 0) {
        setError(t.error);
        setStage('intro');
        return;
      }
      setQuestions(qs);
      setDocsRead(reads);
      setAnswers({});
      setSeconds({});
      setCurrent(0);
      setSavedOk(false);
      startedAt.current = Date.now();
      clock.current = { id: qs[0].id, since: Date.now() };
      setStage('running');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t.error);
      setStage('intro');
    }
  }

  const answer = (id: string, option: OptionKey) => {
    setAnswers((prev) => ({ ...prev, [id]: option }));
  };

  const advance = () => {
    const q = questions[current];
    if (q) bank(q.id);

    if (current < questions.length - 1) {
      const next = current + 1;
      clock.current = { id: questions[next].id, since: Date.now() };
      setCurrent(next);
    } else {
      clock.current = null;
      setStage('done');
    }
  };

  // Save once the set is finished. Practice sharpens the diagnosis and the
  // ability estimate but deliberately does not move the exam level.
  const savedRef = useRef(false);
  useEffect(() => {
    if (stage !== 'done' || !user || savedRef.current || questions.length === 0) return;
    savedRef.current = true;
    let cancelled = false;

    (async () => {
      setSaving(true);
      try {
        const items: ItemResponse[] = questions.map((q) => ({
          kind: 'practice',
          id: q.id,
          topic: 'numbers', // overwritten below from the chapter's real topic
          topicId: q.topicId,
          chapterId: q.chapterId,
          subtopicId: q.subtopicId,
          difficultyId: q.difficultyId,
          testType: 'practice',
          chosen: answers[q.id] ?? '',
          answer: q.answer,
          correct: answers[q.id] === q.answer,
          sec: Math.round(seconds[q.id] ?? 0),
          // Calibrated difficulty rides along with the question — free.
          ...(typeof q.b === 'number' ? { b: q.b } : {}),
        }));
        // Practice draws by chapter, so the levelling topic is recovered from
        // the blueprint — the single source of truth for that mapping.
        const withTopic = items.map((item) => ({
          ...item,
          topic: topicForChapter(item.topicId, item.chapterId),
        }));

        const next = await savePracticeResult({
          uid: user.uid,
          examLang: lang,
          durationSec: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)),
          items: withTopic,
        });
        if (cancelled) return;
        setLevels(next);
        setSavedOk(true);
      } catch (err) {
        console.error('[RASCH] practice save failed', err);
        if (!cancelled) setError(err instanceof Error ? err.message : t.error);
      } finally {
        if (!cancelled) setSaving(false);
      }
    })();

    return () => { cancelled = true; };
  }, [stage, user, questions, answers, seconds, lang, t.error]);

  const reset = useCallback(() => {
    savedRef.current = false;
    setStage('intro');
    setQuestions([]);
  }, []);

  const score = questions.filter((q) => answers[q.id] === q.answer).length;

  if (authLoading) return <div className="p-10 text-center text-[14px] font-black text-zinc-400">{t.loading}</div>;
  if (!user) return <div className="p-10 text-center text-[14px] font-black text-zinc-400">{t.signIn}</div>;

  return (
    <div className="min-h-screen bg-zinc-100 font-sans pb-28 md:pb-12">
      <div className="max-w-[760px] mx-auto px-4 sm:px-6 md:px-8 pt-8 flex flex-col gap-5">

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/RASCHmodel/diagnosis" className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-zinc-200 border-b-4 rounded-2xl text-[12px] font-black text-zinc-600 active:border-b-2 active:translate-y-[2px] transition-all">
            <ArrowLeft size={14} strokeWidth={3} /> {t.back}
          </Link>
          <Link href="/RASCHmodel" className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-zinc-200 border-b-4 rounded-2xl text-[12px] font-black text-zinc-600 active:border-b-2 active:translate-y-[2px] transition-all">
            <Home size={14} strokeWidth={3} /> {t.home}
          </Link>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border-2 border-rose-200 text-rose-700 rounded-2xl px-4 py-3 text-[13px] font-bold">
            <AlertCircle size={16} strokeWidth={3} /> {error}
          </div>
        )}

        {/* ── INTRO ─────────────────────────────────────────────────── */}
        {(stage === 'intro' || stage === 'loading') && (
          <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">{t.title}</h1>
            <p className="text-[14px] font-bold text-zinc-500 mt-1 mb-6">{t.subtitle}</p>

            {weakChapters.length === 0 ? (
              <div className="flex flex-col items-center gap-4 text-center py-6">
                <p className="text-[13px] font-bold text-zinc-400 max-w-sm">{t.needData}</p>
                <Link href="/RASCHmodel/exam" className="flex items-center gap-2 px-5 py-3 bg-violet-500 text-white font-black text-[13px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider">
                  <Rocket size={16} strokeWidth={3} /> {t.startExam}
                </Link>
              </div>
            ) : (
              <>
                <p className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-2">{t.focus}</p>
                <div className="flex flex-col gap-2 mb-5">
                  {weakChapters.map((spot) => (
                    <div key={spot.key} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                      <span className="text-[13px] font-bold text-zinc-700 truncate">{spot.chapterName}</span>
                      <span className="text-[12px] font-black text-zinc-400 shrink-0">{spot.correct}/{spot.seen}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 mb-6 px-4 py-2.5 rounded-xl bg-violet-50 border-2 border-violet-200">
                  <span className="text-[12px] font-black text-violet-700 uppercase tracking-wider">{t.difficulty}</span>
                  <span className="text-[13px] font-black text-violet-800">{difficultyLabel}</span>
                </div>

                <button
                  onClick={start}
                  disabled={stage === 'loading'}
                  className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-violet-500 text-white font-black text-[15px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider disabled:opacity-60"
                >
                  {stage === 'loading' ? t.loading : (<><Play size={18} strokeWidth={3} /> {t.start} · {PRACTICE_SIZE}</>)}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── RUNNING ───────────────────────────────────────────────── */}
        {stage === 'running' && questions[current] && (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-black text-zinc-600">
                {t.question} {current + 1}/{questions.length}
              </span>
              <span className="text-[11px] font-bold text-zinc-400">{docsRead} {t.reads}</span>
            </div>

            <motion.div
              key={questions[current].id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-6"
            >
              <span className="inline-block px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-200 text-[11px] font-black text-zinc-500 mb-4 truncate max-w-full">
                {questions[current].chapter}
              </span>

              <LatexRenderer
                latex={questions[current].question[lang]}
                className="text-[16px] font-bold text-zinc-900 leading-snug block mb-5"
              />

              <div className="flex flex-col gap-2.5">
                {(['A', 'B', 'C', 'D'] as OptionKey[]).map((opt) => {
                  const q = questions[current];
                  const selected = answers[q.id] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => answer(q.id, opt)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${
                        selected ? 'bg-violet-50 border-violet-300' : 'border-zinc-100 hover:border-violet-200 hover:bg-violet-50/40'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center text-[13px] font-black shrink-0 ${
                        selected ? 'bg-violet-500 border-violet-600 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                      }`}>
                        {opt}
                      </span>
                      <LatexRenderer latex={q.options[opt][lang]} className="text-[14px] font-bold text-zinc-800" />
                    </button>
                  );
                })}
              </div>
            </motion.div>

            <button
              onClick={advance}
              className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-zinc-800 text-white font-black text-[14px] rounded-2xl border-b-4 border-zinc-950 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider"
            >
              {current < questions.length - 1 ? (<>{t.next} <ChevronRight size={16} strokeWidth={3} /></>) : (<><Target size={16} strokeWidth={3} /> {t.finish}</>)}
            </button>
          </>
        )}

        {/* ── DONE ──────────────────────────────────────────────────── */}
        {stage === 'done' && (
          <>
            <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-6 md:p-8 text-center">
              <p className="text-[13px] font-black text-zinc-400 uppercase tracking-wider mb-1">{t.result}</p>
              <p className="text-5xl font-black text-violet-600 tracking-tight">
                {score}<span className="text-zinc-300 text-3xl">/{questions.length}</span>
              </p>
              <p className="text-[12px] font-bold text-zinc-400 mt-2">
                {saving ? t.saving : savedOk ? t.saved : ''}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {questions.map((q, i) => {
                const given = answers[q.id];
                const ok = given === q.answer;
                return (
                  <div key={q.id} className={`bg-white rounded-2xl border-2 p-4 ${ok ? 'border-emerald-200' : given ? 'border-rose-200' : 'border-zinc-200'}`}>
                    <div className="flex items-start gap-2 mb-1">
                      <span className="w-6 h-6 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[11px] font-black text-zinc-500 shrink-0">{i + 1}</span>
                      <LatexRenderer latex={q.question[lang]} className="text-[13px] font-bold text-zinc-800" />
                      {ok
                        ? <CheckCircle2 size={18} className="text-emerald-500 ml-auto shrink-0" />
                        : <XCircle size={18} className="text-rose-400 ml-auto shrink-0" />}
                    </div>
                    {!ok && (
                      <p className="text-[12px] font-bold text-emerald-600 pl-8">
                        {t.correctAnswer}: {q.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-violet-500 text-white font-black text-[14px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider"
              >
                <Rocket size={16} strokeWidth={3} /> {t.again}
              </button>
              <Link
                href="/RASCHmodel/diagnosis"
                className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-zinc-800 text-white font-black text-[14px] rounded-2xl border-b-4 border-zinc-950 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider"
              >
                <Target size={16} strokeWidth={3} /> {t.diagnosis}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
