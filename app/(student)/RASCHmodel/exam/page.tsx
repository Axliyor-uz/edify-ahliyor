// app/(student)/RASCHmodel/exam/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, Flag, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  AlertTriangle, Play, RotateCcw, Send, Circle, Languages, Database,
  BookOpen, ChevronDown, TrendingUp, Home,
} from 'lucide-react';

import Link from 'next/link';
import LatexRenderer from '@/components/LatexRenderer';
import QuestionCreator from '@/components/QuestionCreator';
import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '../../layout';
import { saveExamResult, toItemResponses } from '@/services/RASCHProgressService';
import { RASCH_TOPICS } from '@/lib/RASCHtopics';
import { archiveExam, setSolvedUser } from '@/lib/RASCHsolved';
import type { RASCHLevels } from '@/types/RASCH';
import { buildExam } from '@/lib/Examquestions';
import {
  examMode, examOptionKeys, examExpectedText, examPartExpected, examScore, examSlotCount,
  hasExamAnswer, isExamItemCorrect, isExamPartCorrect, partKey,
} from '@/lib/ExamTeacher';
import {
  clearExamSnapshot,
  getExamSnapshot,
  getServerExamSnapshot,
  saveExamSnapshot,
  subscribeExamSnapshot,
} from '@/lib/Examsession';
import { EXAM_BLUEPRINT, EXAM_DURATION_MINUTES, EXAM_TOTAL_QUESTIONS } from '@/lib/Examblueprint';
import type { ExamQuestion, Shortfall } from '@/types/Exam';
import type { Lang, LocalizedText } from '@/types/Math';

// Question content carries $...$ LaTeX — LatexRenderer wraps the bundled katex
// build the rest of the app already renders questions with.
function MathText({ text, className }: { text: string; className?: string }) {
  return <LatexRenderer latex={text} className={className} />;
}

// ─── i18n ────────────────────────────────────────────────────────────────
const UI: Record<Lang, Record<string, string>> = {
  uz: {
    examTitle: 'Milliy sertifikat — Matematika',
    duration: 'daqiqa', totalQ: 'ta savol', start: 'Testni boshlash',
    question: 'Savol', of: '/', flag: 'Belgilash', next: 'Keyingi', prev: 'Oldingi',
    submit: 'Testni yakunlash', submitConfirm: "Testni yakunlashni tasdiqlaysizmi? Javoblarni o'zgartirib bo'lmaydi.",
    yes: 'Ha, yakunlash', cancel: 'Bekor qilish', timeUp: 'Vaqt tugadi — test avtomatik yakunlandi.',
    results: 'Natija', byTopic: "Bo'limlar bo'yicha", retake: 'Yangi test',
    yourAnswer: 'Sizning javobingiz', correctAnswer: "To'g'ri javob", explanation: 'Izoh',
    loadingExam: 'Test tayyorlanmoqda…', shortfallWarning: "Ba'zi bo'limlar uchun yetarli savol topilmadi:",
    loadFailed: "Testni yuklab bo'lmadi. Qayta urinib ko'ring.",
    discarded: "Oldingi testning vaqti tugagan, lekin unda birorta ham savolga javob berilmagan — u natija sifatida saqlanmadi.",
    emptyBank: "Savollar bazasidan savol topilmadi. Administrator `npm run backfill:rand` ni ishga tushirishi kerak.",
    openLabel: 'Javobingizni yozing',
    openPlaceholder: 'Masalan: 16  yoki  4pi*sqrt(3)',
    openHint: "Variantlar berilmaydi. Javobni matn ko'rinishida kiriting — bo'sh joylar va qavslar hisobga olinmaydi.",
    sharedPool: 'Umumiy variantlar',
    langTitle: 'Savollar tili',
    langHint: "Testni boshlagandan so'ng savollar tili o'zgarmaydi — interfeys tilidan mustaqil.",
    resumed: 'Boshlangan test tiklandi — savollar qayta yuklanmadi.',
    reads: 'ta savol bazadan o‘qildi',
    levelTitle: 'Darajangiz o‘zgarishi',
    savingResult: 'Natija saqlanmoqda…',
    saveFailed: 'Natijani saqlab bo‘lmadi.',
    signInToSave: 'Natijani saqlash uchun tizimga kiring.',
    viewProgress: 'Darajam va grafik',
    setBaseline: 'Boshlang‘ich darajani belgilang — shundan keyin o‘sish ko‘rinadi.',
    home: 'Bosh sahifa',
  },
  ru: {
    examTitle: 'Национальный сертификат — Математика',
    duration: 'минут', totalQ: 'вопросов', start: 'Начать тест',
    question: 'Вопрос', of: '/', flag: 'Отметить', next: 'Далее', prev: 'Назад',
    submit: 'Завершить тест', submitConfirm: 'Вы уверены, что хотите завершить тест? Ответы изменить будет нельзя.',
    yes: 'Да, завершить', cancel: 'Отмена', timeUp: 'Время вышло — тест завершён автоматически.',
    results: 'Результат', byTopic: 'По разделам', retake: 'Новый тест',
    yourAnswer: 'Ваш ответ', correctAnswer: 'Правильный ответ', explanation: 'Объяснение',
    loadingExam: 'Подготовка теста…', shortfallWarning: 'Недостаточно вопросов для некоторых разделов:',
    loadFailed: 'Не удалось загрузить тест. Попробуйте ещё раз.',
    discarded: 'Время прошлого теста истекло, но в нём не было отвечено ни одного вопроса — он не сохранён как результат.',
    emptyBank: 'В банке вопросов ничего не найдено. Администратору нужно выполнить `npm run backfill:rand`.',
    openLabel: 'Введите ваш ответ',
    openPlaceholder: 'Например: 16  или  4pi*sqrt(3)',
    openHint: 'Варианты не даются. Введите ответ текстом — пробелы и скобки не учитываются.',
    sharedPool: 'Общие варианты',
    langTitle: 'Язык вопросов',
    langHint: 'После начала теста язык вопросов не меняется — он не зависит от языка интерфейса.',
    resumed: 'Начатый тест восстановлен — вопросы не загружались заново.',
    reads: 'вопросов прочитано из базы',
    levelTitle: 'Изменение вашего уровня',
    savingResult: 'Сохранение результата…',
    saveFailed: 'Не удалось сохранить результат.',
    signInToSave: 'Войдите, чтобы сохранить результат.',
    viewProgress: 'Мой уровень и график',
    setBaseline: 'Задайте начальный уровень — тогда будет виден рост.',
    home: 'Главная',
  },
  en: {
    examTitle: 'National Certificate — Mathematics',
    duration: 'minutes', totalQ: 'questions', start: 'Start test',
    question: 'Question', of: 'of', flag: 'Flag', next: 'Next', prev: 'Previous',
    submit: 'Submit test', submitConfirm: "Are you sure you want to submit? You won't be able to change your answers.",
    yes: 'Yes, submit', cancel: 'Cancel', timeUp: 'Time is up — the test was submitted automatically.',
    results: 'Results', byTopic: 'By section', retake: 'New test',
    yourAnswer: 'Your answer', correctAnswer: 'Correct answer', explanation: 'Explanation',
    loadingExam: 'Preparing the test…', shortfallWarning: 'Not enough questions found for some sections:',
    loadFailed: 'Could not load the test. Please try again.',
    discarded: 'Your previous paper ran out of time with nothing answered on it, so it was not recorded as a result.',
    emptyBank: 'No questions found in the bank. An admin needs to run `npm run backfill:rand`.',
    openLabel: 'Type your answer',
    openPlaceholder: 'e.g. 16  or  4pi*sqrt(3)',
    openHint: 'No options are given. Type the answer — spaces and brackets are ignored.',
    sharedPool: 'Shared options',
    langTitle: 'Question language',
    langHint: "Once the test starts the question language is fixed — it is independent of the interface language.",
    resumed: 'Resumed your test — no questions were re-fetched.',
    reads: 'questions read from the database',
    levelTitle: 'How your level moved',
    savingResult: 'Saving your result…',
    saveFailed: 'Could not save your result.',
    signInToSave: 'Sign in to save your result.',
    viewProgress: 'My level & chart',
    setBaseline: 'Set your starting level to see growth.',
    home: 'Home',
  },
};

const QUESTION_LANGS: Array<{ code: Lang; label: string; flag: string }> = [
  { code: 'uz', label: "O'zbek", flag: '🇺🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

type Stage = 'intro' | 'loading' | 'in-progress' | 'submitted';

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Everything about one exam in flight. Mirrors the persisted snapshot. */
interface Session {
  examLang: Lang;
  questions: ExamQuestion[];
  shortfalls: Shortfall[];
  /** Closed questions (Y-1 / Y-2) hold an option key; open ones (O) hold the
   *  text the student typed. isCorrect() branches on the question's testType. */
  answers: Record<string, string>;
  flagged: string[];
  current: number;
  /** Epoch ms. A deadline, not a countdown — a reload can't hand back minutes. */
  endsAt: number;
  submitted: boolean;
  docsRead: number;
  /** True when the paper came out of localStorage rather than Firestore. */
  resumed: boolean;
  /** Set once the result has been written to the student's account, so a
   *  reload of a finished exam never writes it a second time. */
  saved: boolean;
  /** Seconds spent per question id. Feeds the guess/gap/fragile diagnosis —
   *  without it, a wrong answer is just wrong, with no idea whether the student
   *  rushed it or laboured over it. Persisted, so a reload keeps the record. */
  seconds: Record<string, number>;
}

export default function ExamPage() {
  // Two independent languages:
  //   appLang  — the navbar switcher; drives buttons, labels, chrome.
  //   examLang — chosen on this screen before the test starts; drives the
  //              question text. Fixed for the life of the paper, so flipping
  //              the navbar mid-exam never re-languages the questions.
  const { lang: appLang } = useStudentLanguage();
  const [pendingLang, setPendingLang] = useState<Lang>('uz');

  // Saving the result to the student's account. `user` is already settled here —
  // AuthProvider renders children only after auth resolves — so it can gate the
  // restore below without a loading race.
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  // The stored exam, read through an external store: the server gets null, the
  // browser gets the real snapshot after hydration. No restore effect, so no
  // setState-in-effect and no hydration mismatch.
  const stored = useSyncExternalStore(subscribeExamSnapshot, getExamSnapshot, getServerExamSnapshot);
  const restored = useMemo<Session | null>(
    () =>
      // localStorage is shared by every account on one browser — only resume a
      // paper that belongs to the student currently signed in, so student B never
      // sees student A's exam or results.
      stored && (stored.uid ?? '') === uid
        ? {
          examLang: stored.examLang,
          questions: stored.questions,
          shortfalls: stored.shortfalls,
          answers: stored.answers,
          flagged: stored.flagged,
          current: stored.current,
          endsAt: stored.endsAt,
          submitted: stored.submitted,
          docsRead: stored.docsRead,
          resumed: true,
          saved: stored.saved ?? false,
          seconds: stored.seconds ?? {},
        }
        : null,
    [stored, uid],
  );

  // `null` means "untouched — fall back to whatever is stored"; { session: null }
  // means the student explicitly cleared it and wants the intro screen.
  const [local, setLocal] = useState<{ session: Session | null } | null>(null);
  const session = local ? local.session : restored;

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Which explanations the student has opened on the results screen. Purely a
  // view concern — the text itself already came down with the question, so this
  // is never persisted and never re-fetched.
  const [openExplanations, setOpenExplanations] = useState<Set<string>>(new Set());

  const [levels, setLevels] = useState<RASCHLevels | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const t = UI[appLang];

  // ── Timer ────────────────────────────────────────────────────────────
  // Nothing is pushed on expiry: `submitted` below is derived from the
  // deadline, so a paper whose time ran out while the tab was shut comes back
  // already submitted.
  //
  // …unless the student never answered anything on it. Drawing a paper and
  // walking away used to produce a *result*: the deadline passed, the next mount
  // saw `expired`, and a 0% exam went onto the account and the progress chart
  // for an exam nobody sat. An untouched expired paper is abandoned, not
  // submitted — it is discarded below and never reaches the account.
  const expired = !!session && now >= session.endsAt;
  const answeredCount = session
    ? session.questions.filter((q) => hasExamAnswer(q, session.answers)).length
    : 0;
  const abandoned = !!session && !session.submitted && expired && answeredCount === 0;

  const submitted = !!session && !abandoned && (session.submitted || expired);
  const autoSubmitted = !!session && !session.submitted && expired && !abandoned;

  const stage: Stage = loading
    ? 'loading'
    : !session || abandoned
      ? 'intro'
      : submitted
        ? 'submitted'
        : 'in-progress';

  // Throw the abandoned paper away, so the intro screen isn't shadowed by a dead
  // snapshot that re-evaluates as "expired" on every mount.
  const [discarded, setDiscarded] = useState(false);
  useEffect(() => {
    if (!abandoned) return;
    clearExamSnapshot();
    setLocal({ session: null });
    setDiscarded(true);
  }, [abandoned]);

  useEffect(() => {
    if (stage !== 'in-progress') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [stage]);

  const secondsLeft = session
    ? Math.max(0, Math.ceil((session.endsAt - now) / 1000))
    : EXAM_DURATION_MINUTES * 60;

  // ── Persist ──────────────────────────────────────────────────────────
  // Debounced, so typing an open answer doesn't serialise the paper per keypress.
  useEffect(() => {
    if (!session) return;
    const id = setTimeout(() => {
      saveExamSnapshot({
        uid,
        examLang: session.examLang,
        questions: session.questions,
        shortfalls: session.shortfalls,
        answers: session.answers,
        flagged: session.flagged,
        current: session.current,
        endsAt: session.endsAt,
        submitted,
        autoSubmitted,
        docsRead: session.docsRead,
        saved: session.saved,
        seconds: session.seconds,
      });
    }, 400);
    return () => clearTimeout(id);
  }, [session, submitted, autoSubmitted, uid]);

  // ── Per-question stopwatch ───────────────────────────────────────────
  // A ref, not state: it ticks on every render otherwise. `flushTime` banks the
  // seconds spent on the question being left, and is called from the navigation
  // handlers and at submit — every route out of a question goes through one of
  // them, so no time is lost.
  const timerRef = useRef<{ id: string; since: number } | null>(null);

  const bankSeconds = (s: Session): Record<string, number> => {
    const mark = timerRef.current;
    if (!mark) return s.seconds;
    const elapsed = Math.max(0, Math.round((Date.now() - mark.since) / 1000));
    if (elapsed === 0) return s.seconds;
    return { ...s.seconds, [mark.id]: (s.seconds[mark.id] ?? 0) + elapsed };
  };

  /** Applies a change to the live session (no-op before an exam exists). */
  const update = (patch: (s: Session) => Session) => {
    if (!session) return;
    setLocal({ session: patch(session) });
  };

  async function startExam() {
    setLoading(true);
    setLoadError(null);
    try {
      const { questions, shortfalls, docsRead } = await buildExam();
      if (questions.length === 0) {
        // Every section came back empty — the sampler filters on `rand`, so
        // this is what an un-backfilled bank looks like (npm run backfill:rand).
        setLoadError(t.emptyBank);
        return;
      }
      const fresh: Session = {
        examLang: pendingLang,
        questions,
        shortfalls,
        answers: {},
        flagged: [],
        current: 0,
        endsAt: Date.now() + EXAM_DURATION_MINUTES * 60 * 1000,
        submitted: false,
        docsRead,
        resumed: false,
        saved: false,
        seconds: {},
      };
      setNow(Date.now());
      setLocal({ session: fresh });
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  function newExam() {
    clearExamSnapshot();
    setLocal({ session: null });
    setLoadError(null);
  }

  function setAnswer(questionId: string, value: string) {
    update((s) => ({ ...s, answers: { ...s.answers, [questionId]: value } }));
  }

  function toggleFlag(questionId: string) {
    update((s) => ({
      ...s,
      flagged: s.flagged.includes(questionId)
        ? s.flagged.filter((id) => id !== questionId)
        : [...s.flagged, questionId],
    }));
  }

  function toggleExplanation(questionId: string) {
    setOpenExplanations((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  const goTo = (index: number) =>
    update((s) => {
      const seconds = bankSeconds(s);
      timerRef.current = { id: s.questions[index]?.id ?? '', since: Date.now() };
      return { ...s, current: index, seconds };
    });

  const finish = () =>
    update((s) => {
      const seconds = bankSeconds(s);
      timerRef.current = null;
      return { ...s, submitted: true, seconds };
    });

  const questions = useMemo(() => session?.questions ?? [], [session]);
  const shortfalls = session?.shortfalls ?? [];
  const answers = useMemo(() => session?.answers ?? {}, [session]);
  const flaggedIds = useMemo(() => new Set(session?.flagged ?? []), [session]);
  const examLang = session?.examLang ?? pendingLang;
  const current = session?.current ?? 0;

  // Teacher questions are authored uz-only (`tri(uz)` leaves ru/en empty), so a
  // student who picked Russian or English at the intro would otherwise see blank
  // stems/questions. Fall back to whatever language the doc actually has, so the
  // content always shows — the same fallback the option/part text already uses.
  const pickLang = useCallback(
    (tx?: { uz?: string; ru?: string; en?: string } | null) =>
      (tx?.[examLang] || tx?.uz || tx?.ru || tx?.en || '') as string,
    [examLang],
  );

  /** Blank / whitespace-only counts as unanswered — block-aware (any part). */
  const answered = useCallback(
    (q: ExamQuestion) => hasExamAnswer(q, answers),
    [answers],
  );

  // The one grading entry point: closed / typed / block, bank or teacher.
  const isCorrect = useCallback(
    (q: ExamQuestion) => isExamItemCorrect(q, answers),
    [answers],
  );

  // A shared_options card is several questions, so both the score and the
  // denominator count SLOTS (examSlotCount / examScore), not cards.
  const score = useMemo(
    () => questions.reduce((total, q) => total + examScore(q, answers), 0),
    [questions, answers],
  );
  const totalQuestions = useMemo(
    () => questions.reduce((total, q) => total + examSlotCount(q), 0),
    [questions],
  );

  const bySection = useMemo(() => {
    const map = new Map<string, { label: string; testType: string; correct: number; total: number }>();
    for (const q of questions) {
      const entry = map.get(q.sectionId) ?? {
        label: q.sectionLabel[appLang],
        testType: q.testType,
        correct: 0,
        total: 0,
      };
      entry.total += examSlotCount(q);
      entry.correct += examScore(q, answers);
      map.set(q.sectionId, entry);
    }
    return Array.from(map.entries());
  }, [questions, answers, appLang]);

  // Arm the stopwatch for whichever question is on screen. Only touches a ref,
  // so this is not a setState-in-effect.
  const currentId = session && !submitted ? session.questions[session.current]?.id : undefined;
  useEffect(() => {
    if (!currentId) {
      timerRef.current = null;
      return;
    }
    if (timerRef.current?.id !== currentId) {
      timerRef.current = { id: currentId, since: Date.now() };
    }
  }, [currentId]);

  // Point the local solved-questions archive at the signed-in student, so the
  // review it feeds is never mixed with another account on the same browser.
  useEffect(() => { setSolvedUser(uid); }, [uid]);

  // ── Archive the solved questions locally ─────────────────────────────
  // Feeds the per-topic review page. Purely localStorage — no reads, no writes,
  // and it works for a signed-out student too, unlike the account save below.
  const archivedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!submitted || !session || archivedRef.current === session.endsAt) return;
    archivedRef.current = session.endsAt;

    archiveExam({
      questions: session.questions,
      answers: session.answers,
      isCorrect,
      expectedFor: (q) =>
        examMode(q) === 'open' ? examExpectedText(q, session.examLang) : undefined,
      lang: session.examLang,
      at: Date.now(),
    });
  }, [submitted, session, isCorrect]);

  // ── Save the result to the student's account ─────────────────────────
  // Exactly once per exam: one transaction (1 read + 2 writes), guarded by the
  // persisted `saved` flag, so reloading the results screen never writes again.
  // Every setState here happens after an await — never synchronously in the
  // effect body, which the React Compiler rejects.
  //
  // `saved` is set only AFTER the write returns, so anything that re-fires this
  // effect while the transaction is still open (a language switch — `t.saveFailed`
  // is a dependency — or any re-render that hands us a new `session` object) used
  // to start a SECOND save of the same paper. `cancelled` does not help: it stops
  // the setState, not the transaction, which commits regardless and puts the exam
  // on the chart twice. `savingRef` closes that window on the client;
  // `saveExamResult`'s id check closes it on the server, for the tabs and reloads
  // no ref can see.
  const savingRef = useRef<number | null>(null);
  useEffect(() => {
    if (!submitted || !session || session.saved || !user) return;
    if (savingRef.current === session.endsAt) return;
    savingRef.current = session.endsAt;

    let cancelled = false;

    (async () => {
      try {
        const startedAt = session.endsAt - EXAM_DURATION_MINUTES * 60 * 1000;
        const endedAt = Math.min(Date.now(), session.endsAt);
        // Item-level detail — the raw material for ability, subtopic diagnosis
        // and item analysis. Aggregates can never be un-aggregated, so this is
        // recorded once, at the only moment it exists.
        const items = toItemResponses({
          questions: session.questions,
          answers: session.answers,
          isCorrect,
          seconds: session.seconds,
          kind: 'exam',
        });
        const next = await saveExamResult({
          uid: user.uid,
          examLang: session.examLang,
          durationSec: Math.max(0, Math.round((endedAt - startedAt) / 1000)),
          items,
          // The paper's deadline is fixed when it is drawn, so it identifies this
          // paper and no other — the account can refuse a duplicate on sight.
          examId: session.endsAt,
        });
        if (cancelled) return;
        setLevels(next);
        setLocal({ session: { ...session, submitted: true, saved: true } });
      } catch (err) {
        console.error(err);
        // Let a genuine failure be retried.
        savingRef.current = null;
        if (!cancelled) setSaveError(err instanceof Error ? err.message : t.saveFailed);
      }
    })();

    return () => { cancelled = true; };
  }, [submitted, session, user, isCorrect, t.saveFailed]);

  // ── INTRO ────────────────────────────────────────────────────────────
  if (stage === 'intro' || stage === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-100 font-sans py-10 px-4">
        <div className="max-w-[700px] mx-auto flex flex-col gap-5">
          <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight mb-2">{t.examTitle}</h1>
            <div className="flex items-center gap-4 text-[13px] font-bold text-zinc-500 mb-6">
              <span className="flex items-center gap-1.5"><Clock size={14} strokeWidth={3} />{EXAM_DURATION_MINUTES} {t.duration}</span>
              <span>·</span>
              <span>{EXAM_TOTAL_QUESTIONS} {t.totalQ}</span>
            </div>

            {/* Question language — asked BEFORE the exam, and fixed once it starts. */}
            <div className="mb-6">
              <p className="flex items-center gap-1.5 text-[12px] font-black text-zinc-500 uppercase tracking-wider mb-2">
                <Languages size={14} strokeWidth={3} /> {t.langTitle}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {QUESTION_LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setPendingLang(l.code)}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl border-2 text-[13px] font-black transition-all ${pendingLang === l.code
                        ? 'bg-violet-50 border-violet-300 text-violet-700 border-b-4'
                        : 'bg-white border-zinc-200 text-zinc-400 hover:border-violet-200'
                      }`}
                  >
                    <span className="text-[16px] leading-none">{l.flag}</span>
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="text-[12px] font-bold text-zinc-400 mt-2">{t.langHint}</p>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              {EXAM_BLUEPRINT.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[13px] font-bold text-zinc-700">{b.label[appLang]}</span>
                  <span className="text-[12px] font-black text-zinc-400 shrink-0">{b.testType} · {b.count}</span>
                </div>
              ))}
            </div>

            {/* A paper was drawn, its time ran out, and not one question was
                answered. It is thrown away rather than recorded as a 0% exam —
                say so, so the student isn't left wondering where it went. */}
            {discarded && (
              <div className="flex items-start gap-2 mb-4 bg-amber-50 border-2 border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-[13px] font-bold">
                <AlertTriangle size={16} strokeWidth={3} className="shrink-0 mt-0.5" />
                <span>{t.discarded}</span>
              </div>
            )}

            {loadError && (
              <div className="flex items-start gap-2 mb-4 bg-rose-50 border-2 border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-[13px] font-bold">
                <AlertTriangle size={16} strokeWidth={3} className="shrink-0 mt-0.5" />
                <span>{loadError}</span>
              </div>
            )}

            <button
              onClick={startExam}
              disabled={stage === 'loading'}
              className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-violet-500 text-white font-black text-[15px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider disabled:opacity-60"
            >
              {stage === 'loading' ? t.loadingExam : (<><Play size={18} strokeWidth={3} />{t.start}</>)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ──────────────────────────────────────────────────────────
  if (stage === 'submitted') {
    return (
      <div className="min-h-screen bg-zinc-100 font-sans py-10 px-4">
        <div className="max-w-[700px] mx-auto flex flex-col gap-5">
          {autoSubmitted && (
            <div className="flex items-center gap-2 bg-amber-50 border-2 border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-[13px] font-bold">
              <AlertTriangle size={16} strokeWidth={3} /> {t.timeUp}
            </div>
          )}

          <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-6 md:p-8 text-center">
            <p className="text-[13px] font-black text-zinc-400 uppercase tracking-wider mb-1">{t.results}</p>
            <p className="text-5xl font-black text-violet-600 tracking-tight">{score}<span className="text-zinc-300 text-3xl">/{totalQuestions}</span></p>
          </div>

          {shortfalls.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-[12px] font-bold text-amber-700">
              {t.shortfallWarning}
              <ul className="mt-1 list-disc list-inside">
                {shortfalls.map((s) => (
                  <li key={s.sectionId}>{s.label[appLang]} ({s.testType}): {s.received}/{s.requested}</li>
                ))}
              </ul>
            </div>
          )}

          {/* How this exam moved each topic level. The levels document comes
              back from the same transaction that saved the result, so drawing
              this costs no extra read. */}
          <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-[14px] font-black text-zinc-800">{t.levelTitle}</p>
              <Link
                href="/RASCHmodel/progress"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-zinc-200 text-[11px] font-black text-zinc-500 hover:border-violet-200 hover:text-violet-600 transition-all shrink-0"
              >
                {t.viewProgress}
              </Link>
            </div>

            {!user ? (
              <p className="text-[12px] font-bold text-zinc-400">{t.signInToSave}</p>
            ) : saveError ? (
              <p className="text-[12px] font-bold text-rose-600">{saveError}</p>
            ) : !levels ? (
              <p className="text-[12px] font-bold text-zinc-400">{t.savingResult}</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {RASCH_TOPICS.map((topic) => {
                    const stat = levels.topics[topic.key];
                    if (!stat) return null;
                    const up = stat.delta > 0;
                    const flat = stat.delta === 0;
                    return (
                      <div key={topic.key} className="flex items-center justify-between gap-3 text-[13px] font-bold">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: topic.hex }} />
                          <span className="text-zinc-600 truncate">{topic.label[appLang]}</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className={`text-[11px] font-black ${flat ? 'text-zinc-400' : up ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {flat ? '±0' : `${up ? '▲ +' : '▼ '}${stat.delta}`}
                          </span>
                          <span className="text-[15px] font-black text-zinc-900 w-11 text-right">{stat.level}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                {!levels.baseline && (
                  <p className="mt-3 pt-3 border-t border-zinc-100 text-[12px] font-bold text-amber-600">
                    {t.setBaseline}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5">
            <p className="text-[14px] font-black text-zinc-800 mb-3">{t.byTopic}</p>
            <div className="flex flex-col gap-2">
              {bySection.map(([sectionId, s]) => (
                <div key={sectionId} className="flex items-center justify-between text-[13px] font-bold gap-3">
                  <span className="text-zinc-600 truncate">{s.label}</span>
                  <span className="text-zinc-400 shrink-0">{s.testType} · {s.correct}/{s.total}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {questions.map((q) => {
              const isAnswered = answered(q);
              const correct = isCorrect(q);
              const mode = examMode(q);
              const given = answers[q.id];
              // A closed item points at the chosen option key; an open one shows
              // the plain-text answer the typed input was graded against.
              const expected = mode === 'open' ? examExpectedText(q, examLang) : q.answer;
              return (
                <div key={q.id} className={`bg-white rounded-2xl border-2 p-4 ${correct ? 'border-emerald-200' : isAnswered ? 'border-rose-200' : 'border-zinc-200'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="w-6 h-6 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[11px] font-black text-zinc-500 shrink-0">{q.slotNumber}</span>
                    <span className="min-w-0">
                      {pickLang(q.stem) && (
                        <MathText text={pickLang(q.stem)} className="text-[12px] font-semibold text-zinc-500 block mb-1" />
                      )}
                      <MathText text={pickLang(q.question)} className="text-[13px] font-bold text-zinc-800" />
                    </span>
                    {correct ? <CheckCircle2 size={18} className="text-emerald-500 ml-auto shrink-0" /> : <XCircle size={18} className="text-rose-400 ml-auto shrink-0" />}
                  </div>
                  {q.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.imageUrl} alt="" className="ml-8 mb-2 max-h-48 w-auto rounded-xl border-2 border-zinc-200 bg-white object-contain" />
                  )}
                  <QuestionCreator creatorName={q.creatorName} correctedBy={q.correctedBy} className="ml-8 mb-2 text-zinc-400" iconSize={9} />
                  {mode === 'block' ? (
                    <div className="pl-8 flex flex-col gap-1.5">
                      {(q.parts ?? []).map((p) => {
                        const pg = answers[partKey(q.id, p.id)];
                        const pCorrect = isExamPartCorrect(p, pg);
                        return (
                          <div key={p.id} className="text-[12px] font-bold text-zinc-500 flex flex-wrap items-center gap-x-1">
                            {pCorrect
                              ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                              : <XCircle size={13} className="text-rose-400 shrink-0" />}
                            <MathText text={pickLang(p.prompt)} className="text-zinc-700" />
                            <span className="text-zinc-400">—</span>
                            {pg ? <MathText text={pg} /> : <span>—</span>}
                            {!pCorrect && (
                              <span className="text-emerald-600 flex items-center gap-1">
                                · <MathText text={examPartExpected(p, examLang)} />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                  <div className="text-[12px] font-bold text-zinc-500 pl-8 flex flex-wrap items-center gap-x-1">
                    <span>{t.yourAnswer}:</span>
                    {isAnswered ? <MathText text={given!} /> : <span>—</span>}
                    {!correct && (
                      <span className="text-emerald-600 flex items-center gap-1">
                        · {t.correctAnswer}: <MathText text={expected} />
                      </span>
                    )}
                  </div>
                  )}
                  {/* The explanation ships with the question — it is a field on
                      the doc we already read — so this button costs nothing.
                      Collapsed by default: 45 open explanations is a wall of text. */}
                  {pickLang(q.explanation) && (
                    <div className="pl-8 mt-2">
                      <button
                        onClick={() => toggleExplanation(q.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[11px] font-black transition-all ${openExplanations.has(q.id)
                            ? 'bg-violet-50 border-violet-200 text-violet-700'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:border-violet-200 hover:text-violet-600'
                          }`}
                      >
                        <BookOpen size={12} strokeWidth={3} />
                        {t.explanation}
                        <ChevronDown
                          size={12}
                          strokeWidth={3}
                          className={`transition-transform ${openExplanations.has(q.id) ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {openExplanations.has(q.id) && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          className="mt-2 text-[12px] font-medium text-zinc-500 border-t border-zinc-100 pt-2"
                        >
                          <MathText text={pickLang(q.explanation)} />
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Where to next: another paper, the level chart, or out */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={newExam}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-violet-500 text-white font-black text-[14px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider"
            >
              <RotateCcw size={16} strokeWidth={3} /> {t.retake}
            </button>
            <Link
              href="/RASCHmodel/progress"
              className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-zinc-800 text-white font-black text-[14px] rounded-2xl border-b-4 border-zinc-950 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider"
            >
              <TrendingUp size={16} strokeWidth={3} /> {t.viewProgress}
            </Link>
            <Link
              href="/RASCHmodel"
              className="flex items-center justify-center gap-2 px-5 py-4 bg-white text-zinc-600 font-black text-[14px] rounded-2xl border-2 border-zinc-200 border-b-4 active:border-b-2 active:translate-y-[2px] transition-all uppercase tracking-wider"
            >
              <Home size={16} strokeWidth={3} /> {t.home}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── IN PROGRESS ──────────────────────────────────────────────────────
  const q = questions[current];
  if (!session || !q) return null;
  const isFlagged = flaggedIds.has(q.id);
  const lowTime = secondsLeft <= 5 * 60;
  // A teacher item renders by its real type (block / typed / options); a
  // questions1 item by its section (O = typed, otherwise A–D options).
  const mode = examMode(q);
  const optionKeys = examOptionKeys(q);
  const qOptions = q.options as Record<string, LocalizedText>;

  return (
    <div className="min-h-screen bg-zinc-100 font-sans pb-10">
      {/* Sticky header: timer + progress */}
      <div className="sticky top-0 z-10 bg-white border-b-2 border-zinc-200 px-4 py-3">
        <div className="max-w-[900px] mx-auto flex items-center justify-between gap-4">
          <span className="text-[13px] font-black text-zinc-700">
            {t.question} {q.slotNumber}{examSlotCount(q) > 1 ? `–${q.slotNumber + examSlotCount(q) - 1}` : ''}{t.of}{totalQuestions}
          </span>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 font-black text-[13px] ${lowTime ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-violet-50 border-violet-200 text-violet-600'}`}>
            <Clock size={14} strokeWidth={3} />
            {formatTime(secondsLeft)}
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-4 pt-5 flex flex-col gap-5">
        {/* Where the paper came from: a fresh build reports its exact read
            count; a resumed one cost nothing at all. */}
        <div className="flex items-center gap-2 text-[12px] font-bold text-zinc-400">
          <Database size={12} strokeWidth={3} />
          {session.resumed ? t.resumed : `${session.docsRead} ${t.reads}`}
        </div>

        {/* Question navigator */}
        <div className="bg-white rounded-2xl border-2 border-zinc-200 p-4">
          <div className="grid grid-cols-9 sm:grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5">
            {questions.map((qq, i) => {
              const isDone = answered(qq);
              const isCurrent = i === current;
              const isFlag = flaggedIds.has(qq.id);
              return (
                <button
                  key={qq.id}
                  onClick={() => goTo(i)}
                  className={`aspect-square rounded-lg text-[11px] font-black flex items-center justify-center border-2 transition-all relative ${isCurrent
                      ? 'bg-violet-500 border-violet-600 text-white'
                      : isDone
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-400'
                    }`}
                >
                  {qq.slotNumber}
                  {isFlag && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question card */}
        <motion.div
          key={q.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-6"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <span className="px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-200 text-[11px] font-black text-zinc-500 min-w-0 truncate">
              {q.chapter} · {q.testType}
            </span>
            <button
              onClick={() => toggleFlag(q.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-[12px] font-black transition-all shrink-0 ${isFlagged ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400'
                }`}
            >
              <Flag size={13} strokeWidth={3} /> {t.flag}
            </button>
          </div>

          {/* Block stem — the statement several sub-questions share (a split-out
              shared_options item carries it so it is never dropped). */}
          {pickLang(q.stem) && (
            <MathText text={pickLang(q.stem)} className="text-[15px] font-semibold text-zinc-600 leading-snug block mb-3" />
          )}

          <MathText text={pickLang(q.question)} className="text-[16px] font-bold text-zinc-900 leading-snug block mb-4" />

          {/* Prompt image (teacher questions — e.g. a geometry diagram). */}
          {q.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.imageUrl} alt="" className="mb-5 max-h-72 w-auto rounded-2xl border-2 border-zinc-200 bg-white object-contain" />
          )}

          <QuestionCreator creatorName={q.creatorName} correctedBy={q.correctedBy} className="mb-4 text-zinc-400" />

          {mode === 'open' ? (
            // Typed answer: a questions1 O item (options hidden, graded by
            // Examanswers) or a teacher open/numeric item (graded on its text).
            <div className="flex flex-col gap-2">
              <label htmlFor="open-answer" className="text-[12px] font-black text-zinc-500 uppercase tracking-wider">
                {t.openLabel}
              </label>
              <input
                id="open-answer"
                type="text"
                inputMode="text"
                autoComplete="off"
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder={t.openPlaceholder}
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-zinc-200 bg-zinc-50 text-[16px] font-bold text-zinc-900 placeholder:text-zinc-300 placeholder:font-medium focus:outline-none focus:border-violet-400 focus:bg-white transition-all"
              />
              <p className="text-[12px] font-bold text-zinc-400">{t.openHint}</p>
            </div>
          ) : mode === 'block' ? (
            // A block: one card, several sub-questions.
            //   • shared_options — the A–F pool is printed ONCE below, then each
            //     sub-question is a compact row of letter buttons, and every
            //     sub-question counts as its own exam question (slots 33-35…).
            //   • multi_part     — each part carries its own options/typed answer,
            //     and the whole block counts as one question.
            <div className="flex flex-col gap-4">
              {q.qType === 'shared_options' && optionKeys.length > 0 && (
                <div className="rounded-2xl border-2 border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-3">{t.sharedPool}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {optionKeys.map((opt) => (
                      <div key={opt} className="flex items-start gap-2">
                        <span className="w-7 h-7 shrink-0 rounded-lg bg-white border-2 border-zinc-200 text-zinc-600 font-black text-[12px] flex items-center justify-center">{opt}</span>
                        <span className="pt-1 min-w-0 text-zinc-700 font-bold text-[13px]">
                          <MathText text={pickLang(qOptions[opt])} />
                          {q.optionImages?.[opt] && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={q.optionImages[opt]!} alt={opt} className="mt-1 max-h-24 w-auto rounded-lg border border-zinc-200 bg-white object-contain" />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(q.parts ?? []).map((p, pi) => {
                const key = partKey(q.id, p.id);
                const isTyped = p.optionKeys.length === 0;
                const pooled = q.qType === 'shared_options';
                // A shared_options sub-question is numbered by its exam slot
                // (33, 34, 35); a multi_part part keeps its letter (a, b, c).
                const badge = pooled ? String(q.slotNumber + pi) : (p.id || String(pi + 1));
                return (
                  <div key={p.id} className="rounded-2xl border-2 border-zinc-100 p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <span className="min-w-6 h-6 px-1.5 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-[11px] font-black text-violet-600 shrink-0">{badge}</span>
                      <MathText text={pickLang(p.prompt)} className="text-[14px] font-bold text-zinc-800" />
                    </div>
                    {isTyped ? (
                      <input
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        value={answers[key] ?? ''}
                        onChange={(e) => setAnswer(key, e.target.value)}
                        placeholder={t.openPlaceholder}
                        className="w-full px-4 py-3 rounded-2xl border-2 border-zinc-200 bg-zinc-50 text-[15px] font-bold text-zinc-900 placeholder:text-zinc-300 placeholder:font-medium focus:outline-none focus:border-violet-400 focus:bg-white transition-all"
                      />
                    ) : pooled ? (
                      // Shared pool already printed above — just the letters here.
                      <div className="flex flex-wrap gap-2">
                        {p.optionKeys.map((opt) => {
                          const selected = answers[key] === opt;
                          return (
                            <button
                              key={opt}
                              onClick={() => setAnswer(key, opt)}
                              className={`w-11 h-11 rounded-xl border-2 font-black text-[14px] transition-all ${selected ? 'bg-violet-500 border-violet-600 text-white' : 'bg-white border-zinc-200 text-zinc-500 hover:border-violet-300 hover:bg-violet-50/40'}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {p.optionKeys.map((opt) => {
                          const selected = answers[key] === opt;
                          const img = p.optionImages?.[opt];
                          return (
                            <button
                              key={opt}
                              onClick={() => setAnswer(key, opt)}
                              className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${selected ? 'bg-violet-50 border-violet-300' : 'border-zinc-100 hover:border-violet-200 hover:bg-violet-50/40'}`}
                            >
                              <span className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center text-[12px] font-black shrink-0 ${selected ? 'bg-violet-500 border-violet-600 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-500'}`}>{opt}</span>
                              <span className="min-w-0">
                                <MathText text={pickLang(p.options[opt])} className="text-[14px] font-bold text-zinc-800" />
                                {img && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={img} alt={opt} className="mt-1 max-h-28 w-auto rounded-lg border border-zinc-200 bg-white object-contain" />
                                )}
                              </span>
                              {selected ? <Circle className="ml-auto shrink-0 text-violet-500 fill-violet-500" size={15} /> : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Closed: option buttons over the item's own keys (A–D for a
            // questions1 item, up to A–F for a teacher shared pool).
            <div className="flex flex-col gap-2.5">
              {optionKeys.map((opt) => {
                const selected = answers[q.id] === opt;
                const img = q.optionImages?.[opt];
                return (
                  <button
                    key={opt}
                    onClick={() => setAnswer(q.id, opt)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${selected ? 'bg-violet-50 border-violet-300' : 'border-zinc-100 hover:border-violet-200 hover:bg-violet-50/40'
                      }`}
                  >
                    <span className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center text-[13px] font-black shrink-0 ${selected ? 'bg-violet-500 border-violet-600 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                      }`}>
                      {opt}
                    </span>
                    <span className="min-w-0">
                      <MathText text={pickLang(qOptions[opt])} className="text-[14px] font-bold text-zinc-800" />
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={opt} className="mt-1 max-h-32 w-auto rounded-lg border border-zinc-200 bg-white object-contain" />
                      )}
                    </span>
                    {selected ? <Circle className="ml-auto shrink-0 text-violet-500 fill-violet-500" size={16} /> : null}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Prev / Next / Submit */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => goTo(Math.max(0, current - 1))}
            disabled={current === 0}
            className="flex items-center gap-1.5 px-4 py-3 bg-white border-2 border-zinc-200 rounded-2xl font-black text-[13px] text-zinc-600 disabled:opacity-40"
          >
            <ChevronLeft size={16} strokeWidth={3} /> {t.prev}
          </button>

          {current < questions.length - 1 ? (
            <button
              onClick={() => goTo(Math.min(questions.length - 1, current + 1))}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-zinc-800 text-white rounded-2xl font-black text-[13px] border-b-4 border-zinc-950 active:border-b-0 active:translate-y-1 transition-all"
            >
              {t.next} <ChevronRight size={16} strokeWidth={3} />
            </button>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-violet-500 text-white rounded-2xl font-black text-[13px] border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all"
            >
              <Send size={15} strokeWidth={3} /> {t.submit}
            </button>
          )}
        </div>
      </div>

      {/* Confirm submit modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-2xl border-2 border-zinc-200 p-6 max-w-sm w-full">
            <p className="text-[14px] font-bold text-zinc-700 mb-5">{t.submitConfirm}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-3 rounded-xl border-2 border-zinc-200 font-black text-[13px] text-zinc-600">
                {t.cancel}
              </button>
              <button
                onClick={() => { setShowConfirm(false); finish(); }}
                className="flex-1 px-4 py-3 rounded-xl bg-violet-500 text-white font-black text-[13px]"
              >
                {t.yes}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
