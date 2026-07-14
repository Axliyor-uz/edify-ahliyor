// app/(student)/RASCHmodel/diagnosis/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertCircle, ArrowLeft, Brain, Clock, Gauge, Home, Rocket, Target, Zap,
} from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '../../layout';
import { abilityFor, diagnosticsFor, getRASCHLevels, type AnalysisSource } from '@/services/RASCHProgressService';
import { behaviorTotals, weakestSpots, EXPECTED_SEC } from '@/lib/RASCHdiagnosis';
import { expectedRange } from '@/lib/RASCHtheta';
import type { Behavior, RASCHLevels } from '@/types/RASCH';
import type { Lang } from '@/types/Math';

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    title: 'Bilim tahlili',
    subtitle: 'Har bir savol vaqti va natijasi asosida — nimani bilmaysiz, nimani shoshib xato qilasiz',
    back: 'Darajam',
    home: 'Bosh sahifa',
    practice: 'Zaif mavzularni mashq qilish',
    ability: 'Qobiliyat (Rasch)',
    abilityHint: 'Standart variantdagi kutilayotgan natija. Test qiyin yoki oson chiqishiga bog‘liq emas.',
    items: 'ta savol asosida',
    behavior: 'Javob berish uslubi',
    solid: 'Mustahkam',
    fragile: 'Sekin, lekin to‘g‘ri',
    guess: 'Shoshilib xato',
    gap: 'Bilim bo‘shlig‘i',
    skipped: 'Belgilanmagan',
    solidHint: 'To‘g‘ri va tez — bu mavzu sizda mustahkam.',
    fragileHint: 'To‘g‘ri, lekin sekin. Imtihon vaqtida yetkazmasligingiz mumkin.',
    guessHint: 'Xato va juda tez — o‘qimasdan tanlangan. Bu — shoshilish muammosi, bilim emas.',
    gapHint: 'Xato, lekin vaqt sarflangan — haqiqiy bilim bo‘shlig‘i. Aynan shuni o‘rganish kerak.',
    weakest: 'Eng zaif mavzular',
    weakestHint: 'Kamida 2 marta uchragan mavzular. Eng zaifi birinchi.',
    noData: 'Hali yetarli ma‘lumot yo‘q. Test topshiring — har bir savol vaqti bilan tahlil qilinadi.',
    startExam: 'Testni boshlash',
    avgTime: 'o‘rtacha',
    budget: 'me‘yor',
    loading: 'Yuklanmoqda…',
    error: 'Ma‘lumotlarni yuklab bo‘lmadi',
    signIn: 'Tahlilni ko‘rish uchun tizimga kiring',
    pacing: 'Shoshilish muammosi',
    pacingHint: 'Xatolaringizning ko‘pi shoshilishdan. Sekinroq o‘qing — bilimingiz bundan yuqori.',
    knowledge: 'Bilim muammosi',
    knowledgeHint: 'Xatolaringiz o‘ylab ishlanganidan keyin. Bu — o‘rganish kerak bo‘lgan mavzular.',
    srcAll: 'Hammasi', srcExam: 'Testlar', srcPractice: 'Mashqlar',
    srcHint: 'Test — vaqt bosimi ostida. Mashq — erkin. Ular alohida o‘lchanadi.',
    noSource: 'Bu bo‘limda hali ma‘lumot yo‘q.',
    mastery: 'O‘zlashtirish',
    masteryHint: 'Bilim ehtimoli (BKT) — tasodifiy topish va e‘tiborsizlik hisobga olingan holda. Ball emas, bilim.',
  },
  ru: {
    title: 'Анализ знаний',
    subtitle: 'По времени и результату каждого вопроса — что вы не знаете, а где просто спешите',
    back: 'Мой уровень',
    home: 'Главная',
    practice: 'Тренировать слабые темы',
    ability: 'Способность (Rasch)',
    abilityHint: 'Ожидаемый результат на стандартном варианте. Не зависит от того, лёгкий попался тест или трудный.',
    items: 'на основе вопросов',
    behavior: 'Как вы отвечаете',
    solid: 'Уверенно',
    fragile: 'Медленно, но верно',
    guess: 'Поспешная ошибка',
    gap: 'Пробел в знаниях',
    skipped: 'Без ответа',
    solidHint: 'Верно и быстро — тема освоена.',
    fragileHint: 'Верно, но медленно. На экзамене может не хватить времени.',
    guessHint: 'Неверно и очень быстро — выбрано не читая. Это проблема темпа, а не знаний.',
    gapHint: 'Неверно, но время потрачено — настоящий пробел. Именно это и нужно учить.',
    weakest: 'Самые слабые темы',
    weakestHint: 'Темы, встреченные минимум 2 раза. Самая слабая — первая.',
    noData: 'Пока недостаточно данных. Пройдите тест — каждый вопрос анализируется вместе со временем.',
    startExam: 'Начать тест',
    avgTime: 'в среднем',
    budget: 'норма',
    loading: 'Загрузка…',
    error: 'Не удалось загрузить данные',
    signIn: 'Войдите, чтобы увидеть анализ',
    pacing: 'Проблема темпа',
    pacingHint: 'Большинство ошибок — от спешки. Читайте медленнее: вы знаете больше, чем показываете.',
    knowledge: 'Проблема знаний',
    knowledgeHint: 'Ошибки после реальных усилий. Это темы, которые нужно учить.',
    srcAll: 'Всё', srcExam: 'Тесты', srcPractice: 'Тренировки',
    srcHint: 'Тест — под давлением времени. Тренировка — свободно. Измеряются отдельно.',
    noSource: 'В этом разделе пока нет данных.',
    mastery: 'Освоение',
    masteryHint: 'Вероятность знания (BKT) — с поправкой на угадывание и невнимательность. Это не балл, а знание.',
  },
  en: {
    title: 'Knowledge analysis',
    subtitle: "From the time and outcome of every question — what you don't know, versus what you rush",
    back: 'My level',
    home: 'Home',
    practice: 'Practise weak spots',
    ability: 'Ability (Rasch)',
    abilityHint: "Expected score on a standard paper. Unaffected by whether your draw was easy or hard.",
    items: 'based on questions',
    behavior: 'How you answer',
    solid: 'Solid',
    fragile: 'Slow but right',
    guess: 'Rushed error',
    gap: 'Knowledge gap',
    skipped: 'Unanswered',
    solidHint: 'Right and brisk — this is secure.',
    fragileHint: "Right, but slow. Under exam time pressure this is where you'll run out.",
    guessHint: 'Wrong and very fast — answered without reading. A pacing problem, not a knowledge one.',
    gapHint: 'Wrong after real effort — a genuine gap. This is what to study.',
    weakest: 'Weakest subtopics',
    weakestHint: 'Subtopics you have met at least twice. Weakest first.',
    noData: 'Not enough data yet. Sit an exam — every question is analysed together with its timing.',
    startExam: 'Start an exam',
    avgTime: 'avg',
    budget: 'budget',
    loading: 'Loading…',
    error: 'Could not load your analysis',
    signIn: 'Sign in to see your analysis',
    pacing: 'A pacing problem',
    pacingHint: "Most of your errors are rushed. Slow down — you know more than your score shows.",
    knowledge: 'A knowledge problem',
    knowledgeHint: 'Your errors come after real effort. These are the topics to study.',
    srcAll: 'All', srcExam: 'Exams', srcPractice: 'Practice',
    srcHint: 'An exam is timed and pressured; practice is not. They are measured separately.',
    noSource: 'No data in this view yet.',
    mastery: 'Mastery',
    masteryHint: 'P(knows it) from BKT — discounting lucky guesses and careless slips. Not a score: knowledge.',
  },
};

const BEHAVIOR_STYLE: Record<Behavior, { color: string; hex: string; icon: React.ElementType }> = {
  solid: { color: 'bg-emerald-50 border-emerald-200 text-emerald-700', hex: '#059669', icon: Target },
  fragile: { color: 'bg-amber-50 border-amber-200 text-amber-700', hex: '#d97706', icon: Clock },
  guess: { color: 'bg-sky-50 border-sky-200 text-sky-700', hex: '#0284c7', icon: Zap },
  gap: { color: 'bg-rose-50 border-rose-200 text-rose-700', hex: '#e11d48', icon: Brain },
  skipped: { color: 'bg-zinc-50 border-zinc-200 text-zinc-400', hex: '#a1a1aa', icon: AlertCircle },
};

export default function DiagnosisPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useStudentLanguage();
  const t = UI[lang];

  const [levels, setLevels] = useState<RASCHLevels | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // Exam and practice are kept apart in storage and merged only for the "all"
  // view — an exam is timed and high-stakes, practice is not, and pooling them
  // would quietly flatter the exam picture.
  const [source, setSource] = useState<AnalysisSource>('all');

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    getRASCHLevels(user.uid)
      .then((next) => {
        if (cancelled) return;
        setLevels(next);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        console.error('[RASCH] diagnosis load failed', err);
        if (!cancelled) setStatus('error');
      });

    return () => { cancelled = true; };
  }, [user, authLoading]);

  const diagnostics = useMemo(() => diagnosticsFor(levels, source), [levels, source]);
  const weak = useMemo(() => weakestSpots(diagnostics, { minSeen: 2, limit: 8 }), [diagnostics]);
  const totals = useMemo(() => behaviorTotals(diagnostics), [diagnostics]);
  const answered = totals.solid + totals.fragile + totals.guess + totals.gap;
  const ability = abilityFor(levels, source);
  const range = ability ? expectedRange(ability) : null;

  const hasPractice = (levels?.abilityPractice?.items ?? 0) > 0;

  if (authLoading || status === 'loading') {
    return <div className="p-10 text-center text-[14px] font-black text-zinc-400">{t.loading}</div>;
  }
  if (!user) {
    return <div className="p-10 text-center text-[14px] font-black text-zinc-400">{t.signIn}</div>;
  }
  if (status === 'error' || !levels) {
    return (
      <div className="max-w-[900px] mx-auto p-6">
        <div className="flex items-center gap-3 bg-rose-50 border-2 border-rose-200 text-rose-700 rounded-2xl px-4 py-3 text-[13px] font-bold">
          <AlertCircle size={18} strokeWidth={3} /> {t.error}
        </div>
      </div>
    );
  }

  // The single most useful sentence we can say: is this a pacing problem or a
  // knowledge problem? They look identical on a score sheet and need opposite fixes.
  const verdict = totals.guess > totals.gap ? 'pacing' : totals.gap > 0 ? 'knowledge' : null;

  return (
    <div className="min-h-screen bg-zinc-100 font-sans pb-28 md:pb-12">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-8 pt-8 flex flex-col gap-5">

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/RASCHmodel/progress" className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-zinc-200 border-b-4 rounded-2xl text-[12px] font-black text-zinc-600 active:border-b-2 active:translate-y-[2px] transition-all">
            <ArrowLeft size={14} strokeWidth={3} /> {t.back}
          </Link>
          <Link href="/RASCHmodel" className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-zinc-200 border-b-4 rounded-2xl text-[12px] font-black text-zinc-600 active:border-b-2 active:translate-y-[2px] transition-all">
            <Home size={14} strokeWidth={3} /> {t.home}
          </Link>
          <Link href="/RASCHmodel/practice" className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-500 text-white border-b-4 border-violet-700 rounded-2xl text-[12px] font-black active:border-b-0 active:translate-y-1 transition-all ml-auto">
            <Rocket size={14} strokeWidth={3} /> {t.practice}
          </Link>
        </div>

        <div>
          <h1 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight">{t.title}</h1>
          <p className="text-[14px] font-bold text-zinc-500 mt-1 max-w-2xl">{t.subtitle}</p>
        </div>

        {/* Source: exams and practice are different evidence, so they are
            measured separately — and merged only here, on demand. */}
        <div>
          <div className="inline-flex items-center gap-1 bg-white border-2 border-zinc-200 border-b-4 rounded-2xl p-1">
            {([
              ['all', t.srcAll],
              ['exam', t.srcExam],
              ['practice', t.srcPractice],
            ] as [AnalysisSource, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSource(key)}
                disabled={key === 'practice' && !hasPractice}
                className={`px-3.5 py-2 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all disabled:opacity-30 ${
                  source === key ? 'bg-violet-500 text-white' : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] font-bold text-zinc-400 mt-1.5">{t.srcHint}</p>
        </div>

        {answered === 0 ? (
          <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-8 flex flex-col items-center gap-4 text-center">
            <p className="text-[13px] font-bold text-zinc-400 max-w-md">
              {source === 'all' ? t.noData : t.noSource}
            </p>
            <Link href="/RASCHmodel/exam" className="flex items-center gap-2 px-5 py-3 bg-violet-500 text-white font-black text-[13px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider">
              <Rocket size={16} strokeWidth={3} /> {t.startExam}
            </Link>
          </div>
        ) : (
          <>
            {/* Rasch ability — the draw-independent number */}
            {ability && ability.items > 0 && (
              <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5 md:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Gauge size={16} strokeWidth={3} className="text-violet-500" />
                  <h2 className="text-[15px] font-black text-zinc-900">{t.ability}</h2>
                  <span className="ml-auto text-[11px] font-bold text-zinc-400">
                    {ability.items} {t.items}
                  </span>
                </div>
                <div className="flex items-end gap-5 flex-wrap">
                  <div>
                    <p className="text-5xl font-black text-violet-600 tracking-tight leading-none">
                      {ability.expected}%
                    </p>
                    {range && (
                      <p className="text-[12px] font-black text-zinc-400 mt-2">
                        {range.low}% – {range.high}%
                      </p>
                    )}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-[12px] font-bold text-zinc-400 leading-relaxed">{t.abilityHint}</p>
                    <p className="text-[11px] font-black text-zinc-300 mt-1">
                      θ = {ability.theta.toFixed(2)} ± {ability.se.toFixed(2)} logit
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* The verdict: pacing vs knowledge */}
            {verdict && (
              <div className={`rounded-[1.5rem] border-2 border-b-[6px] p-5 ${verdict === 'pacing' ? 'bg-sky-50 border-sky-200' : 'bg-rose-50 border-rose-200'}`}>
                <p className={`text-[15px] font-black ${verdict === 'pacing' ? 'text-sky-800' : 'text-rose-800'}`}>
                  {verdict === 'pacing' ? t.pacing : t.knowledge}
                </p>
                <p className={`text-[13px] font-bold mt-1 ${verdict === 'pacing' ? 'text-sky-700' : 'text-rose-700'}`}>
                  {verdict === 'pacing' ? t.pacingHint : t.knowledgeHint}
                </p>
              </div>
            )}

            {/* Behaviour split */}
            <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5 md:p-6">
              <h2 className="text-[15px] font-black text-zinc-900 mb-4">{t.behavior}</h2>

              {/* One bar, to scale — the shape of the problem at a glance */}
              <div className="flex h-3 rounded-full overflow-hidden bg-zinc-100 mb-4">
                {(['solid', 'fragile', 'guess', 'gap'] as Behavior[]).map((b) =>
                  totals[b] > 0 ? (
                    <div
                      key={b}
                      style={{ width: `${(totals[b] / answered) * 100}%`, backgroundColor: BEHAVIOR_STYLE[b].hex }}
                      title={`${t[b]}: ${totals[b]}`}
                    />
                  ) : null,
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(['gap', 'guess', 'fragile', 'solid'] as Behavior[]).map((b) => {
                  const style = BEHAVIOR_STYLE[b];
                  const Icon = style.icon;
                  return (
                    <div key={b} className={`flex items-start gap-2.5 p-3 rounded-2xl border-2 ${style.color}`}>
                      <Icon size={16} strokeWidth={3} className="shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-black flex items-center gap-2">
                          {t[b]} <span className="text-[15px]">{totals[b]}</span>
                        </p>
                        <p className="text-[11px] font-bold opacity-80 leading-snug mt-0.5">
                          {t[`${b}Hint`]}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weakest subtopics */}
            <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5 md:p-6">
              <div className="flex items-center justify-between gap-3 mb-1">
                <h2 className="text-[15px] font-black text-zinc-900">{t.weakest}</h2>
                <span className="text-[11px] font-bold text-zinc-400">{t.weakestHint}</span>
              </div>

              {weak.length === 0 ? (
                <p className="text-[13px] font-bold text-zinc-400 mt-3">{t.noData}</p>
              ) : (
                <div className="flex flex-col gap-2 mt-3">
                  {weak.map((spot, i) => {
                    const style = BEHAVIOR_STYLE[spot.dominant];
                    const budget = EXPECTED_SEC[2];
                    return (
                      <motion.div
                        key={spot.key}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.04 }}
                        className="flex items-center gap-3 p-3 rounded-2xl border-2 border-zinc-100"
                      >
                        <span className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[11px] font-black text-zinc-400 shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-zinc-800 truncate">
                            {spot.subtopicName || spot.chapterName}
                          </p>
                          <p className="text-[11px] font-bold text-zinc-400 truncate">
                            {spot.chapterName} · {t.avgTime} {spot.avgSec}s ({t.budget} {budget}s)
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black shrink-0 ${style.color}`}>
                          {t[spot.dominant]}
                        </span>

                        {/* BKT mastery — what they KNOW, as opposed to what they scored */}
                        <div className="shrink-0 w-16" title={t.masteryHint}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] font-black text-zinc-300 uppercase">{t.mastery}</span>
                            <span className="text-[11px] font-black text-zinc-600">
                              {Math.round(spot.mastery * 100)}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden mt-0.5">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round(spot.mastery * 100)}%`,
                                backgroundColor: spot.mastery >= 0.7 ? '#059669' : spot.mastery >= 0.4 ? '#d97706' : '#e11d48',
                              }}
                            />
                          </div>
                        </div>

                        <span className="text-[14px] font-black text-zinc-900 shrink-0 w-12 text-right">
                          {spot.correct}/{spot.seen}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
