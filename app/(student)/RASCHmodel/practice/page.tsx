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
import {
  Banner, Button, Card, Chip, EmptyState, ListGroup, ListRow, LoadingState, Page, cn,
  MOTION_ON, springTransition,
} from '@/components/student-ui';
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

  if (authLoading) {
    return (
      <Page>
        <LoadingState rows={3} label={t.loading} />
      </Page>
    );
  }
  if (!user) {
    return (
      <Page>
        <EmptyState title={t.signIn} />
      </Page>
    );
  }

  return (
    <Page className="flex flex-col gap-s-gap-lg">

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/RASCHmodel/diagnosis">
          <Button variant="outlined" size="sm" icon={<ArrowLeft size={14} strokeWidth={3} />}>
            {t.back}
          </Button>
        </Link>
        <Link href="/RASCHmodel">
          <Button variant="outlined" size="sm" icon={<Home size={14} strokeWidth={3} />}>
            {t.home}
          </Button>
        </Link>
      </div>

      {error && (
        <Banner status="error" title={error} icon={<AlertCircle size={16} strokeWidth={3} />} />
      )}

      {/* ── INTRO ─────────────────────────────────────────────────── */}
      {(stage === 'intro' || stage === 'loading') && (
        <Card>
          <h1 className="s-display text-2xl font-bold tracking-tight md:text-3xl">{t.title}</h1>
          <p className="mb-6 mt-1 text-[14px] font-bold text-on-surface-variant">{t.subtitle}</p>

          {weakChapters.length === 0 ? (
            <EmptyState
              title={t.needData}
              action={
                <Link href="/RASCHmodel/exam">
                  <Button size="lg" icon={<Rocket size={16} strokeWidth={3} />}>
                    {t.startExam}
                  </Button>
                </Link>
              }
            />
          ) : (
            <>
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                {t.focus}
              </p>
              <ListGroup className="mb-5">
                {weakChapters.map((spot) => (
                  <ListRow
                    key={spot.key}
                    title={spot.chapterName}
                    trailing={<span className="s-num shrink-0 text-[12px] font-black text-on-surface-variant">{spot.correct}/{spot.seen}</span>}
                  />
                ))}
              </ListGroup>

              <div className="mb-6 flex items-center justify-between gap-3 rounded-m3-md bg-primary-container px-4 py-2.5 text-on-primary-container">
                <span className="text-[12px] font-black uppercase tracking-wider">{t.difficulty}</span>
                <span className="text-[13px] font-black">{difficultyLabel}</span>
              </div>

              <Button
                onClick={start}
                disabled={stage === 'loading'}
                loading={stage === 'loading'}
                fullWidth
                size="lg"
                icon={stage === 'loading' ? undefined : <Play size={18} strokeWidth={3} />}
              >
                {stage === 'loading' ? t.loading : `${t.start} · ${PRACTICE_SIZE}`}
              </Button>
            </>
          )}
        </Card>
      )}

      {/* ── RUNNING ───────────────────────────────────────────────── */}
      {stage === 'running' && questions[current] && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="s-num text-[13px] font-black text-on-surface">
              {t.question} {current + 1}/{questions.length}
            </span>
            <span className="s-num text-[11px] font-bold text-on-surface-variant">{docsRead} {t.reads}</span>
          </div>

          <motion.div
            key={questions[current].id}
            initial={MOTION_ON ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={springTransition}
          >
            <Card>
              <Chip status="neutral" className="mb-4 max-w-full truncate">
                {questions[current].chapter}
              </Chip>

              <LatexRenderer
                latex={questions[current].question[lang]}
                className="mb-5 block text-[16px] font-bold leading-snug text-on-surface"
              />

              <div className="flex flex-col gap-2.5">
                {(['A', 'B', 'C', 'D'] as OptionKey[]).map((opt) => {
                  const q = questions[current];
                  const selected = answers[q.id] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => answer(q.id, opt)}
                      aria-pressed={selected}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-m3-md border-2 p-3.5 text-left',
                        'transition-colors duration-m3-fast ease-m3-std',
                        selected
                          ? 'border-primary bg-primary-container text-on-primary-container'
                          : 'border-outline-variant hover:bg-state-hover',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-m3-sm border-2 text-[13px] font-black',
                          selected
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-outline-variant bg-surface-container-high text-on-surface-variant',
                        )}
                      >
                        {opt}
                      </span>
                      <LatexRenderer latex={q.options[opt][lang]} className="text-[14px] font-bold" />
                    </button>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          <Button
            onClick={advance}
            tone="secondary"
            fullWidth
            size="lg"
            icon={current < questions.length - 1 ? undefined : <Target size={16} strokeWidth={3} />}
            trailingIcon={current < questions.length - 1 ? <ChevronRight size={16} strokeWidth={3} /> : undefined}
          >
            {current < questions.length - 1 ? t.next : t.finish}
          </Button>
        </>
      )}

      {/* ── DONE ──────────────────────────────────────────────────── */}
      {stage === 'done' && (
        <>
          <Card className="text-center">
            <p className="mb-1 text-[13px] font-black uppercase tracking-wider text-on-surface-variant">{t.result}</p>
            <p className="s-num text-5xl font-black tracking-tight text-primary">
              {score}<span className="text-3xl text-on-surface-variant">/{questions.length}</span>
            </p>
            <p className="mt-2 text-[12px] font-bold text-on-surface-variant">
              {saving ? t.saving : savedOk ? t.saved : ''}
            </p>
          </Card>

          <div className="flex flex-col gap-s-gap">
            {questions.map((q, i) => {
              const given = answers[q.id];
              const ok = given === q.answer;
              return (
                <Card
                  key={q.id}
                  variant="outlined"
                  className={cn('border-2', ok ? 'border-success' : given ? 'border-error' : 'border-outline-variant')}
                >
                  <div className="mb-1 flex items-start gap-2">
                    <span className="s-num grid h-6 w-6 shrink-0 place-items-center rounded-m3-sm bg-surface-container-high text-[11px] font-black text-on-surface-variant">
                      {i + 1}
                    </span>
                    <LatexRenderer latex={q.question[lang]} className="text-[13px] font-bold text-on-surface" />
                    {ok
                      ? <CheckCircle2 size={18} className="ml-auto shrink-0 text-success" />
                      : <XCircle size={18} className="ml-auto shrink-0 text-error" />}
                  </div>
                  {!ok && (
                    <p className="pl-8 text-[12px] font-bold text-success">
                      {t.correctAnswer}: {q.answer}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={reset}
              size="lg"
              fullWidth
              className="flex-1"
              icon={<Rocket size={16} strokeWidth={3} />}
            >
              {t.again}
            </Button>
            <Link href="/RASCHmodel/diagnosis" className="flex-1">
              <Button tone="secondary" size="lg" fullWidth icon={<Target size={16} strokeWidth={3} />}>
                {t.diagnosis}
              </Button>
            </Link>
          </div>
        </>
      )}
    </Page>
  );
}
