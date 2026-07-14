// app/(student)/RASCHmodel/progress/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Target, Rocket, Sliders, AlertCircle, ChevronRight, ChevronDown, Home, Crosshair, Brain, Hexagon } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '../../layout';
import ChartFrame from '@/components/ChartFrame';
import { getRASCHLevels, saveBaseline } from '@/services/RASCHProgressService';
import { DEFAULT_BASELINE, LEVEL_WINDOW, overallLevel } from '@/lib/RASCHlevels';
import { RASCH_TOPICS, TOPIC_KEYS, type TopicKey } from '@/lib/RASCHtopics';
import { getServerSolvedArchive, getSolvedArchive, subscribeSolved } from '@/lib/RASCHsolved';
import { forecastByTopic, forecastOverall, type Forecast } from '@/lib/RASCHforecast';
import {
  learningPicture, dimensions, overallTheta, chapterLevels, mathLevel,
  type Dimension, type TopicSection,
} from '@/services/RASCHProgressService';
import { BAND_COLOR, chanceAt, formatLevel, levelBand, MASTER_LEVEL } from '@/lib/RASCHscale';
import { daysToTarget, type LearningRate, type ScorePrediction } from '@/lib/RASCHdynamic';
import type { RASCHLevels } from '@/types/RASCH';
import type { Lang } from '@/types/Math';

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    title: 'Mening darajam',
    subtitle: 'Har bir mavzu bo\'yicha darajangiz oxirgi 5 ta test o\'rtachasi asosida hisoblanadi',
    setupTitle: 'Boshlang\'ich darajangizni tanlang',
    setupHint: 'Har bir mavzu uchun hozirgi darajangizni belgilang. Keyin har bir testdan so\'ng daraja o\'zgarib boradi — 5 ta testdan keyin boshlang\'ich daraja hisobga olinmaydi.',
    save: 'Saqlash va boshlash',
    saving: 'Saqlanmoqda…',
    overall: 'Umumiy',
    level: 'Daraja',
    noExams: 'Hali test topshirmadingiz. Birinchi testdan so\'ng grafik paydo bo\'ladi.',
    startExam: 'Testni boshlash',
    examsTaken: 'ta test topshirilgan',
    chartTitle: 'Testdan testga natijalar',
    chartHint: 'Mavzuni qo\'shish uchun bosing',
    exam: 'Test',
    baseline: 'Boshlang\'ich',
    editBaseline: 'Boshlang\'ich darajani o\'zgartirish',
    loading: 'Yuklanmoqda…',
    error: 'Ma\'lumotlarni yuklab bo\'lmadi',
    errorRules: 'Ruxsat yo\'q (permission-denied). Administrator Firestore qoidalarini joylashi kerak: firebase deploy --only firestore:rules',
    signIn: 'Darajangizni ko\'rish uchun tizimga kiring',
    solvedLabel: 'to\'g\'ri yechilgan',
    noneSolved: 'Hali yechilmagan',
    review: 'Ko\'rish',
    home: 'Bosh sahifa',
    newTest: 'Yangi test',
    diagnosis: 'Bilim tahlili',
    forecastTitle: 'Keyingi test bashorati',
    expectedRange: 'Kutilayotgan oraliq',
    nextShort: 'keyingi',
    confLow: 'past ishonch',
    confMedium: "o'rtacha ishonch",
    confHigh: 'yuqori ishonch',
    confNone: "ma'lumot yo'q",
    forecastNoData: 'Bashorat uchun kamida 2 ta test kerak.',
    forecastNote: "Oxirgi testlaringiz tendensiyasi asosida hisoblangan. Bu — taxmin, kafolat emas: oraliq qanchalik keng bo'lsa, noaniqlik shuncha yuqori.",
    predicted: 'Bashorat',
    bandmaster: "Master",
    bandadvanced: "Yuqori",
    bandconfident: "Ishonchli",
    bandbasic: "Asosiy",
    bandbeginner: "Boshlang'ich",
    chaptersHint: "Uchramagan mavzu 0 emas — u o'lchanmagan. Test yoki mashqda uchraganda daraja paydo bo'ladi.",
    notMet: "Uchramagan",
    chaptersTitle: "Mavzular bo'yicha daraja",
    scaleHint: "3 — master darajasi: olimpiada masalalarini ishonchli (80%) yechadi. Daraja — Rasch shkalasi: siz ishonchli yecha oladigan masalaning qiyinligi. Foizlarda tasodifan topish ehtimoli (4 variantdan 1 tasi) ham hisobga olingan.",
    solves: "masalalarni yechadi",
    ofOlympic: "olimpiada",
    ofMedium: "o'rta",
    ofEasy: "oson",
    levelMeans: "Bu nimani anglatadi",
    ofMaster: "master",
    mathLevel: "Matematika darajangiz",
    overallTheta: "Umumiy qobiliyat",
    hepEmpty: "Test topshiring — 7 o'lcham shundan keyin ko'rinadi.",
    hepHint: "Har bir o'lcham — alohida Rasch qobiliyati (θ). Har bir test va mashqdan keyin o'sha o'lcham o'zgaradi. Ko'rsatkich — standart variantdagi kutilayotgan natija.",
    hepBefore: "Oldingi",
    hepNow: "Hozir",
    heptagon: "Matematika qobiliyati — 7 o'lcham",
    raschTitle: 'Keyingi test bashorati (Rasch)',
    raschNow: 'Hozirgi qobiliyat',
    raschIn2w: '2 haftadan keyin',
    raschRate: "O'sish tezligi",
    perWeek: 'logit/hafta',
    raschHow: "Har bir savol uchun P(to'g'ri) = σ(θ − b) hisoblanib, ular qo'shiladi — bu kutilayotgan ball. Qobiliyat (θ) vaqt bilan o'zgaradi, o'sish tezligi testlaringizdan o'lchanadi.",
    toTarget: '75% ga yetish uchun',
    days: 'kun',
    noRate: "O'sish tezligi hali o'lchanmagan — kamida 2 ta test kerak.",
    notImproving: "Hozirgi sur'atda 75% ga yetib bo'lmaydi.",
  },
  ru: {
    title: 'Мой уровень',
    subtitle: 'Уровень по каждой теме — среднее из последних 5 тестов',
    setupTitle: 'Выберите начальный уровень',
    setupHint: 'Укажите текущий уровень по каждой теме. Дальше он будет меняться после каждого теста — через 5 тестов начальный уровень перестаёт учитываться.',
    save: 'Сохранить и начать',
    saving: 'Сохранение…',
    overall: 'Общий',
    level: 'Уровень',
    noExams: 'Вы ещё не проходили тест. График появится после первого теста.',
    startExam: 'Начать тест',
    examsTaken: 'тестов пройдено',
    chartTitle: 'Результаты от теста к тесту',
    chartHint: 'Нажмите, чтобы добавить тему',
    exam: 'Тест',
    baseline: 'Начальный',
    editBaseline: 'Изменить начальный уровень',
    loading: 'Загрузка…',
    error: 'Не удалось загрузить данные',
    errorRules: 'Нет доступа (permission-denied). Администратору нужно развернуть правила Firestore: firebase deploy --only firestore:rules',
    signIn: 'Войдите, чтобы увидеть свой уровень',
    solvedLabel: 'решено верно',
    noneSolved: 'Пока не решалось',
    review: 'Открыть',
    home: 'Главная',
    newTest: 'Новый тест',
    diagnosis: 'Анализ знаний',
    forecastTitle: 'Прогноз следующего теста',
    expectedRange: 'Ожидаемый диапазон',
    nextShort: 'далее',
    confLow: 'низкая уверенность',
    confMedium: 'средняя уверенность',
    confHigh: 'высокая уверенность',
    confNone: 'нет данных',
    forecastNoData: 'Для прогноза нужно минимум 2 теста.',
    forecastNote: 'Рассчитано по тренду последних тестов. Это оценка, а не гарантия: чем шире диапазон, тем больше неопределённость.',
    predicted: 'Прогноз',
    bandmaster: "Мастер",
    bandadvanced: "Продвинутый",
    bandconfident: "Уверенный",
    bandbasic: "Базовый",
    bandbeginner: "Начальный",
    chaptersHint: "Не встреченная глава — это не 0, а «не измерено». Уровень появится, когда она встретится в тесте или тренировке.",
    notMet: "Не встречалось",
    chaptersTitle: "Уровень по главам",
    scaleHint: "3 — уровень мастера: надёжно (80%) решает олимпиадные задачи. Уровень по шкале Rasch — это сложность задач, которые вы решаете уверенно. В процентах учтён и шанс угадать (1 из 4).",
    solves: "задач решает",
    ofOlympic: "олимпиадных",
    ofMedium: "средних",
    ofEasy: "лёгких",
    levelMeans: "Что это значит",
    ofMaster: "мастер",
    mathLevel: "Ваш уровень по математике",
    overallTheta: "Общая способность",
    hepEmpty: "Пройдите тест — тогда появятся 7 измерений.",
    hepHint: "Каждое измерение — отдельная способность по Rasch (θ). После каждого теста и тренировки оно меняется. Значение — ожидаемый результат на стандартном варианте.",
    hepBefore: "Раньше",
    hepNow: "Сейчас",
    heptagon: "Способность по математике — 7 измерений",
    raschTitle: 'Прогноз следующего теста (Rasch)',
    raschNow: 'Способность сейчас',
    raschIn2w: 'Через 2 недели',
    raschRate: 'Скорость роста',
    perWeek: 'логит/неделя',
    raschHow: 'Для каждого вопроса считается P(верно) = σ(θ − b), и они суммируются — это и есть ожидаемый балл. Способность (θ) меняется со временем, скорость роста измеряется по вашим тестам.',
    toTarget: 'До 75%',
    days: 'дней',
    noRate: 'Скорость роста ещё не измерена — нужно минимум 2 теста.',
    notImproving: 'При текущем темпе 75% не достигается.',
  },
  en: {
    title: 'My level',
    subtitle: 'Your level per topic is the mean of your last 5 exams',
    setupTitle: 'Choose your starting level',
    setupHint: 'Set where you are today for each topic. Every exam then moves it — after 5 exams the starting level stops counting entirely.',
    save: 'Save and start',
    saving: 'Saving…',
    overall: 'Overall',
    level: 'Level',
    noExams: 'No exams yet. The chart appears after your first one.',
    startExam: 'Start a test',
    examsTaken: 'exams taken',
    chartTitle: 'Exam by exam',
    chartHint: 'Tap to add a topic',
    exam: 'Exam',
    baseline: 'Baseline',
    editBaseline: 'Change starting level',
    loading: 'Loading…',
    error: 'Could not load your progress',
    errorRules: 'Permission denied. The Firestore rules for RASCH_levels are not deployed yet: firebase deploy --only firestore:rules',
    signIn: 'Sign in to see your level',
    solvedLabel: 'solved correctly',
    noneSolved: 'Nothing solved yet',
    review: 'Review',
    home: 'Home',
    newTest: 'New test',
    diagnosis: 'Knowledge analysis',
    forecastTitle: 'Next exam forecast',
    expectedRange: 'Likely range',
    nextShort: 'next',
    confLow: 'low confidence',
    confMedium: 'medium confidence',
    confHigh: 'high confidence',
    confNone: 'no data',
    forecastNoData: 'A forecast needs at least 2 exams.',
    forecastNote: 'Extrapolated from the trend of your recent exams. It is an estimate, not a promise — the wider the range, the less certain it is.',
    predicted: 'Forecast',
    bandmaster: "Master",
    bandadvanced: "Advanced",
    bandconfident: "Confident",
    bandbasic: "Basic",
    bandbeginner: "Beginner",
    chaptersHint: "A chapter you haven't met is not 0 — it's unmeasured. Its level appears once it shows up in an exam or drill.",
    notMet: "Not met yet",
    chaptersTitle: "Level by chapter",
    scaleHint: "3 is master: reliably (80%) solves olympiad problems. On the Rasch scale your level is the difficulty of problem you can solve dependably. The percentages include the 1-in-4 chance of guessing a four-option question.",
    solves: "problems solved",
    ofOlympic: "olympiad",
    ofMedium: "medium",
    ofEasy: "easy",
    levelMeans: "What this means",
    ofMaster: "master",
    mathLevel: "Your mathematics level",
    overallTheta: "Overall ability",
    hepEmpty: "Sit an exam — the seven dimensions appear after that.",
    hepHint: "Each axis is its own Rasch ability (θ). Every exam and drill moves that axis on its own evidence. The value is the expected score on a standard paper.",
    hepBefore: "Previous",
    hepNow: "Now",
    heptagon: "Mathematics ability — 7 dimensions",
    raschTitle: 'Next exam forecast (Rasch)',
    raschNow: 'Ability now',
    raschIn2w: 'In 2 weeks',
    raschRate: 'Learning rate',
    perWeek: 'logits/week',
    raschHow: 'For every item we compute P(correct) = σ(θ − b) and sum them — that sum IS the expected score. Ability (θ) moves over time; the learning rate is measured from your exams.',
    toTarget: 'To reach 75%',
    days: 'days',
    noRate: 'No learning rate yet — that needs at least 2 exams.',
    notImproving: 'Not on track for 75% at the current rate.',
  },
};

const OVERALL_HEX = '#3f3f46'; // zinc-700 — the reference line, not a topic hue

/** Firebase throws a typed error; the only one that realistically lands here is
 *  permission-denied, which means the RASCH_levels rules are not deployed. */
function describeError(err: unknown, t: Record<string, string>): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return t.errorRules;
  if (err instanceof Error && err.message) return err.message;
  return t.error;
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-black text-zinc-400">
        <Minus size={11} strokeWidth={3} /> 0
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-black ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? <TrendingUp size={11} strokeWidth={3} /> : <TrendingDown size={11} strokeWidth={3} />}
      {up ? '+' : ''}{delta}
    </span>
  );
}

// ─── Next-exam forecast ───────────────────────────────────────────────────
function ForecastCard({ f, t }: { f: Forecast; t: Record<string, string> }) {
  const confLabel =
    f.confidence === 'high' ? t.confHigh
    : f.confidence === 'medium' ? t.confMedium
    : f.confidence === 'low' ? t.confLow
    : t.confNone;

  const tone =
    f.direction === 'up' ? 'text-emerald-600'
    : f.direction === 'down' ? 'text-rose-600'
    : 'text-zinc-500';

  const Icon = f.direction === 'up' ? TrendingUp : f.direction === 'down' ? TrendingDown : Minus;

  return (
    <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Crosshair size={16} strokeWidth={3} className="text-violet-500" />
        <h2 className="text-[15px] font-black text-zinc-900">{t.forecastTitle}</h2>
        <span className="ml-auto text-[11px] font-black text-zinc-400 uppercase tracking-wider">{confLabel}</span>
      </div>

      {f.confidence === 'none' ? (
        <p className="text-[13px] font-bold text-zinc-400">{t.forecastNoData}</p>
      ) : (
        <>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <p className="text-5xl font-black text-violet-600 tracking-tight leading-none">{f.expected}%</p>
              <p className={`flex items-center gap-1 text-[12px] font-black mt-2 ${tone}`}>
                <Icon size={13} strokeWidth={3} />
                {f.slope > 0 ? '+' : ''}{f.slope} / {t.exam.toLowerCase()}
              </p>
            </div>

            <div className="flex-1 min-w-[180px]">
              <p className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-1.5">
                {t.expectedRange}
              </p>
              {/* The band, drawn to scale on a 0–100 track — the width IS the uncertainty */}
              <div className="relative h-2.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="absolute h-full bg-violet-200"
                  style={{ left: `${f.low}%`, width: `${Math.max(1, f.high - f.low)}%` }}
                />
                <div
                  className="absolute h-full w-1 bg-violet-600 rounded-full"
                  style={{ left: `calc(${f.expected}% - 2px)` }}
                />
              </div>
              <p className="text-[13px] font-black text-zinc-700 mt-1.5">{f.low}% – {f.high}%</p>
            </div>
          </div>

          <p className="text-[11px] font-medium text-zinc-400 mt-4 pt-3 border-t border-zinc-100 leading-relaxed">
            {t.forecastNote}
          </p>
        </>
      )}
    </div>
  );
}

// ─── The headline: one mathematics level, 0–3 ─────────────────────────────
// A level is not an invented score. In Rasch, ability and item difficulty share
// one scale, so "your level is 1.20" means: you are 50/50 on a problem of
// difficulty 1.20. Level 3 is where the olympiad problems live — which is
// exactly why 3 is master.
function MathLevelCard({
  level, theta, dimensionsMeasured, t,
}: {
  level: number;
  theta: number;
  dimensionsMeasured: number;
  t: Record<string, string>;
}) {
  const band = levelBand(level);
  const colors = BAND_COLOR[band];
  const pct = (level / MASTER_LEVEL) * 100;

  return (
    <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5 md:p-7">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[12px] font-black text-zinc-400 uppercase tracking-wider">{t.mathLevel}</p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-6xl font-black tracking-tight leading-none" style={{ color: colors.hex }}>
              {formatLevel(level)}
            </span>
            <span className="text-2xl font-black text-zinc-300 leading-none pb-1">/ {MASTER_LEVEL}</span>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-xl border-2 text-[13px] font-black ${colors.bg} ${colors.text}`}>
          {t[`band${band}`]}
        </div>
      </div>

      {/* The 0–3 track, with the difficulty tiers marked where they actually are */}
      <div className="mt-5">
        <div className="relative h-3 rounded-full bg-zinc-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: colors.hex }} />
        </div>
        <div className="relative h-4 mt-1">
          {[0, 1, 2, 3].map((tick) => (
            <span
              key={tick}
              className="absolute text-[10px] font-black text-zinc-300 -translate-x-1/2"
              style={{ left: `${(tick / MASTER_LEVEL) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>
      </div>

      {/* What the number MEANS, in problems rather than logits */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        {([1, 2, 3] as const).map((d) => (
          <div key={d} className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-center">
            <p className="text-[17px] font-black text-zinc-800 leading-none">{chanceAt(level, d)}%</p>
            <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-wider">
              {d === 1 ? t.ofEasy : d === 2 ? t.ofMedium : t.ofOlympic}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11px] font-medium text-zinc-400 mt-3 leading-relaxed">
        {t.scaleHint} <span className="text-zinc-300">θ = {theta.toFixed(2)} · {dimensionsMeasured}/7</span>
      </p>
    </div>
  );
}

// ─── Level in each of the 29 chapters ─────────────────────────────────────
function ChapterLevels({ sections, t }: { sections: TopicSection[]; t: Record<string, string> }) {
  const [open, setOpen] = useState<string | null>(sections[0]?.topicId ?? null);

  return (
    <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5 md:p-6">
      <h2 className="text-[15px] font-black text-zinc-900 mb-1">{t.chaptersTitle}</h2>
      <p className="text-[11px] font-bold text-zinc-400 mb-4">{t.chaptersHint}</p>

      <div className="flex flex-col gap-3">
        {sections.map((section) => {
          const isOpen = open === section.topicId;
          return (
            <div key={section.topicId} className="rounded-2xl border-2 border-zinc-100 overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : section.topicId)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
              >
                <span className="text-[14px] font-black text-zinc-800 flex-1">{section.name}</span>
                {section.level !== null && (
                  <span
                    className="px-2 py-0.5 rounded-lg text-[12px] font-black border-2"
                    style={{
                      color: BAND_COLOR[levelBand(section.level)].hex,
                      borderColor: BAND_COLOR[levelBand(section.level)].hex + '40',
                    }}
                  >
                    {formatLevel(section.level)}
                  </span>
                )}
                <ChevronDown
                  size={16}
                  strokeWidth={3}
                  className={`text-zinc-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="px-3 pb-3 flex flex-col gap-1">
                  {section.chapters.map((chapter, i) => {
                    const measured = chapter.level !== null;
                    const hex = measured ? BAND_COLOR[levelBand(chapter.level!)].hex : '#e4e4e7';
                    return (
                      <div
                        key={chapter.chapterId}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl ${measured ? '' : 'opacity-50'}`}
                      >
                        <span className="w-5 text-[10px] font-black text-zinc-300 shrink-0 text-right">{i + 1}</span>
                        <span className="text-[12px] font-bold text-zinc-700 truncate flex-1">{chapter.name}</span>

                        {measured ? (
                          <>
                            <div className="w-16 h-1.5 rounded-full bg-zinc-100 overflow-hidden shrink-0">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${(chapter.level! / MASTER_LEVEL) * 100}%`, backgroundColor: hex }}
                              />
                            </div>
                            <span className="text-[12px] font-black shrink-0 w-9 text-right" style={{ color: hex }}>
                              {formatLevel(chapter.level!)}
                            </span>
                            <span className="text-[10px] font-black text-zinc-300 shrink-0 w-10 text-right">
                              {chapter.correct}/{chapter.seen}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-300 shrink-0">{t.notMet}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── The ability heptagon ─────────────────────────────────────────────────
// Seven dimensions, one shape. Mathematics ability is not a single number: a
// student can be climbing in geometry while sliding in trigonometry, and one θ
// averages exactly that away. Two polygons are drawn — now, and the previous
// sitting — so the chart shows MOVEMENT per dimension, not just a profile.
function AbilityHeptagon({
  dims, lang, t,
}: {
  dims: Dimension[];
  lang: Lang;
  t: Record<string, string>;
}) {
  // The axes carry the SAME 0–3 level as the headline — one scale everywhere,
  // rather than making the reader translate between a percentage and a level.
  const data = dims.map((d) => ({
    key: d.key,
    // Short label: a full "To'plam, mulohazalar, ma'lumotlar tahlili…" would
    // collide with its neighbours on a 7-axis radar.
    axis: RASCH_TOPICS.find((tp) => tp.key === d.key)!.label[lang].split(/[ ,(]/)[0],
    [t.hepNow]: d.level,
    [t.hepBefore]: d.levelBefore ?? d.level,
    theta: d.theta,
  }));

  const measured = dims.some((d) => d.measured > 0);

  return (
    <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        <Hexagon size={16} strokeWidth={3} className="text-violet-500" />
        <h2 className="text-[15px] font-black text-zinc-900">{t.heptagon}</h2>
      </div>

      {!measured ? (
        <p className="text-[13px] font-bold text-zinc-400 py-8 text-center">{t.hepEmpty}</p>
      ) : (
        <>
          <ChartFrame className="h-[340px] sm:h-[400px] -mx-2">
            {({ width, height }) => (
              <RadarChart width={width} height={height} data={data} outerRadius="72%">
                <PolarGrid stroke="#e4e4e7" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fill: '#71717a', fontSize: 11, fontWeight: 800 }}
                />
                <PolarRadiusAxis
                  domain={[0, MASTER_LEVEL]}
                  tickCount={4}
                  tick={{ fill: '#d4d4d8', fontSize: 9, fontWeight: 700 }}
                  axisLine={false}
                />
                {/* Previous sitting, drawn first so it sits behind */}
                <Radar
                  name={t.hepBefore}
                  dataKey={t.hepBefore}
                  stroke="#a1a1aa"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  fill="#a1a1aa"
                  fillOpacity={0.08}
                />
                <Radar
                  name={t.hepNow}
                  dataKey={t.hepNow}
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="#7c3aed"
                  fillOpacity={0.25}
                  dot={{ r: 3, strokeWidth: 0, fill: '#7c3aed' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, fontWeight: 800, paddingTop: 4 }}
                  iconType="plainline"
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '2px solid #e4e4e7', fontSize: 12, fontWeight: 700 }}
                  formatter={(value, name) => [`${Number(value).toFixed(2)} / ${MASTER_LEVEL}`, String(name)]}
                />
              </RadarChart>
            )}
          </ChartFrame>

          {/* The precise view. A radar reads shape well and exact values badly,
              so the numbers live here — and this doubles as the table view. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
            {dims.map((d) => {
              const topic = RASCH_TOPICS.find((tp) => tp.key === d.key)!;
              const up = d.delta > 0;
              const flat = d.delta === 0;
              return (
                <div key={d.key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: topic.hex }} />
                  <span className="text-[12px] font-bold text-zinc-600 truncate flex-1">
                    {topic.label[lang]}
                  </span>
                  <span className={`text-[10px] font-black shrink-0 ${flat ? 'text-zinc-300' : up ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {flat ? '±0' : `${up ? '▲+' : '▼'}${d.delta}`}
                  </span>
                  <span className="text-[13px] font-black shrink-0 w-10 text-right" style={{ color: BAND_COLOR[levelBand(d.level)].hex }}>
                    {formatLevel(d.level)}
                  </span>
                  <span className="text-[10px] font-black text-zinc-300 shrink-0 w-9 text-right">
                    {d.score}%
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] font-medium text-zinc-400 mt-3 pt-3 border-t border-zinc-100 leading-relaxed">
            {t.hepHint}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Next-exam forecast, the Rasch way ────────────────────────────────────
// score = Σ P(correct) = Σ σ(θ − bᵢ)  — never a line fitted through past
// percentages. Ability is projected forward by the measured learning rate,
// because Rasch on its own holds ability fixed and cannot see learning at all.
function RaschForecastCard({
  now, future, rate, target, t,
}: {
  now: ScorePrediction;
  future: ScorePrediction | null;
  rate: LearningRate;
  target: number | null;
  t: Record<string, string>;
}) {
  const improving = rate.perWeek > 0.02;
  const declining = rate.perWeek < -0.02;
  const Icon = improving ? TrendingUp : declining ? TrendingDown : Minus;
  const tone = improving ? 'text-emerald-600' : declining ? 'text-rose-600' : 'text-zinc-500';

  return (
    <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Crosshair size={16} strokeWidth={3} className="text-violet-500" />
        <h2 className="text-[15px] font-black text-zinc-900">{t.raschTitle}</h2>
        <span className="ml-auto text-[11px] font-black text-zinc-300">
          θ = {now.theta.toFixed(2)} ± {now.se.toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Now */}
        <div className="p-4 rounded-2xl bg-zinc-50 border-2 border-zinc-200">
          <p className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">{t.raschNow}</p>
          <p className="text-4xl font-black text-violet-600 tracking-tight leading-none mt-1">{now.expected}%</p>
          <p className="text-[12px] font-black text-zinc-400 mt-1.5">{now.low}% – {now.high}%</p>
        </div>

        {/* Projected — the bit plain Rasch cannot give you */}
        <div className="p-4 rounded-2xl bg-violet-50 border-2 border-violet-200">
          <p className="text-[11px] font-black text-violet-400 uppercase tracking-wider">{t.raschIn2w}</p>
          {future ? (
            <>
              <p className="text-4xl font-black text-violet-700 tracking-tight leading-none mt-1">
                {future.expected}%
              </p>
              <p className="text-[12px] font-black text-violet-400 mt-1.5">{future.low}% – {future.high}%</p>
            </>
          ) : (
            <p className="text-[13px] font-bold text-violet-400 mt-2">{t.noRate}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-3 border-t border-zinc-100">
        <span className="flex items-center gap-1.5 text-[12px] font-black">
          <span className="text-zinc-400 uppercase tracking-wider">{t.raschRate}</span>
          <Icon size={13} strokeWidth={3} className={tone} />
          <span className={tone}>
            {rate.perWeek > 0 ? '+' : ''}{rate.perWeek} {t.perWeek}
          </span>
        </span>

        <span className="text-[12px] font-black">
          <span className="text-zinc-400 uppercase tracking-wider">{t.toTarget}</span>{' '}
          <span className="text-zinc-700">
            {target !== null ? `${target} ${t.days}` : t.notImproving}
          </span>
        </span>
      </div>

      <p className="text-[11px] font-medium text-zinc-400 mt-3 leading-relaxed">{t.raschHow}</p>
    </div>
  );
}

// ─── Baseline setup ───────────────────────────────────────────────────────
function BaselineSetup({
  lang, t, onSave, saving,
}: {
  lang: Lang;
  t: Record<string, string>;
  onSave: (baseline: Record<TopicKey, number>) => void;
  saving: boolean;
}) {
  const [values, setValues] = useState<Record<TopicKey, number>>(
    () => Object.fromEntries(TOPIC_KEYS.map((k) => [k, DEFAULT_BASELINE])) as Record<TopicKey, number>,
  );

  return (
    <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-[1rem] bg-violet-50 border-2 border-violet-200 text-violet-600 flex items-center justify-center shrink-0">
          <Sliders size={20} strokeWidth={2.5} />
        </div>
        <h2 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">{t.setupTitle}</h2>
      </div>
      <p className="text-[13px] font-bold text-zinc-500 mb-6">{t.setupHint}</p>

      <div className="flex flex-col gap-4 mb-6">
        {RASCH_TOPICS.map((topic) => (
          <div key={topic.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-bold text-zinc-700 truncate">{topic.label[lang]}</span>
              <span className={`px-2 py-0.5 rounded-lg border text-[12px] font-black shrink-0 ${topic.color}`}>
                {values[topic.key]}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={values[topic.key]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [topic.key]: Number(e.target.value) }))
              }
              className="w-full accent-violet-500"
              aria-label={topic.label[lang]}
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => onSave(values)}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-violet-500 text-white font-black text-[15px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider disabled:opacity-60"
      >
        <Target size={18} strokeWidth={3} />
        {saving ? t.saving : t.save}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useStudentLanguage();
  const t = UI[lang];

  const [levels, setLevels] = useState<RASCHLevels | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // Kept verbatim: a generic "couldn't load" hides the one failure that
  // actually happens here — permission-denied, i.e. the Firestore rules for
  // RASCH_levels were never deployed.
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingBaseline, setEditingBaseline] = useState(false);
  // The chart starts on the overall line; topics are opt-in, so seven series
  // never land on the reader at once.
  const [shown, setShown] = useState<TopicKey[]>([]);

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
        if (cancelled) return;
        console.error('[RASCHmodel] could not load levels', err);
        setErrorDetail(describeError(err, t));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, t]);

  const handleSaveBaseline = useCallback(
    async (baseline: Record<TopicKey, number>) => {
      if (!user) return;
      setSaving(true);
      try {
        const next = await saveBaseline(user.uid, baseline);
        setLevels(next);
        setEditingBaseline(false);
      } catch (err: unknown) {
        console.error('[RASCHmodel] could not save baseline', err);
        setErrorDetail(describeError(err, t));
        setStatus('error');
      } finally {
        setSaving(false);
      }
    },
    [user, t],
  );

  // The Rasch pipeline: project ability forward by the measured learning rate,
  // then SUM P(correct) over the paper. Rasch alone cannot do this — it holds
  // ability fixed — so the learning model in lib/RASCHdynamic.ts supplies the
  // movement. All from the levels doc already in hand: no reads.
  const picture = useMemo(() => learningPicture(levels, 14), [levels]);
  // The seven dimensions of mathematics ability — each with its own θ, each
  // moved by every exam and drill that touched it.
  const dims = useMemo(() => dimensions(levels), [levels]);
  const theta = useMemo(() => overallTheta(levels), [levels]);
  // Mathematics → 7 dimensions → 29 chapters, all on the same 0–3 scale.
  const math = useMemo(() => mathLevel(levels), [levels]);
  const sections = useMemo(() => chapterLevels(levels), [levels]);
  const target = useMemo(
    () => (picture.current ? daysToTarget(picture.current, picture.rate, 75) : null),
    [picture],
  );

  // The old empirical trend (a line through past PERCENTAGES) is the fallback
  // for students with no item-level data yet.
  const overallForecast = useMemo(() => (levels ? forecastOverall(levels) : null), [levels]);
  const topicForecasts = useMemo(() => (levels ? forecastByTopic(levels) : null), [levels]);

  // How many questions of each topic the student has actually solved, from the
  // localStorage archive — no Firestore involved.
  const archive = useSyncExternalStore(subscribeSolved, getSolvedArchive, getServerSolvedArchive);
  const solved_counts = useMemo(() => {
    const out = {} as Record<TopicKey, { solved: number; correct: number }>;
    for (const key of TOPIC_KEYS) {
      const list = archive.byTopic[key] ?? [];
      out[key] = { solved: list.length, correct: list.filter((q) => q.correct).length };
    }
    return out;
  }, [archive]);

  const chartData = useMemo(() => {
    if (!levels) return [];
    const rows = levels.exams.map((exam, i) => {
      const row: Record<string, number | string> = {
        name: `${i + 1}`,
        [t.overall]: exam.score,
      };
      for (const key of TOPIC_KEYS) {
        // scores are appended one per exam, so index i lines up with exams[i];
        // read from the end in case a topic joined the history later.
        const scores = levels.topics[key]?.scores ?? [];
        const offset = scores.length - levels.exams.length;
        const value = scores[i + offset];
        if (value !== undefined) row[key] = value;
      }
      return row;
    });

    // The forecast, drawn as a dashed continuation. `predicted` is set on the
    // LAST real exam too, so the dashed segment starts on the solid line
    // instead of floating in space.
    if (rows.length > 0 && overallForecast && overallForecast.confidence !== 'none') {
      const last = rows[rows.length - 1];
      last[t.predicted] = last[t.overall];
      rows.push({
        name: `${rows.length + 1}`,
        [t.predicted]: overallForecast.expected,
      });
    }
    return rows;
  }, [levels, t.overall, t.predicted, overallForecast]);

  const toggleTopic = (key: TopicKey) =>
    setShown((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  if (authLoading || status === 'loading') {
    return <div className="p-10 text-center text-[14px] font-black text-zinc-400">{t.loading}</div>;
  }
  if (!user) {
    return <div className="p-10 text-center text-[14px] font-black text-zinc-400">{t.signIn}</div>;
  }
  if (status === 'error' || !levels) {
    return (
      <div className="max-w-[900px] mx-auto p-6">
        <div className="flex items-start gap-3 bg-rose-50 border-2 border-rose-200 text-rose-700 rounded-2xl px-4 py-3.5 text-[13px] font-bold">
          <AlertCircle size={18} strokeWidth={3} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p>{t.error}</p>
            {errorDetail && (
              <p className="mt-1 text-[12px] font-medium text-rose-600/80 break-words">{errorDetail}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No baseline yet (or the student is re-picking it) — that comes first, since
  // every level is seeded from it.
  if (!levels.baseline || editingBaseline) {
    return (
      <div className="min-h-screen bg-zinc-100 font-sans py-8 px-4">
        <div className="max-w-[700px] mx-auto">
          <BaselineSetup lang={lang} t={t} onSave={handleSaveBaseline} saving={saving} />
        </div>
      </div>
    );
  }

  const overall = overallLevel(levels);
  const hasExams = levels.exams.length > 0;

  return (
    <div className="min-h-screen bg-zinc-100 font-sans pb-28 md:pb-12">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-8 pt-8 flex flex-col gap-6">

        {/* Nav — get out of here, or straight into another test */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/RASCHmodel"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-zinc-200 border-b-4 rounded-2xl text-[12px] font-black text-zinc-600 active:border-b-2 active:translate-y-[2px] transition-all hover:border-zinc-300"
          >
            <Home size={14} strokeWidth={3} /> {t.home}
          </Link>
          <Link
            href="/RASCHmodel/diagnosis"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-zinc-200 border-b-4 rounded-2xl text-[12px] font-black text-zinc-600 active:border-b-2 active:translate-y-[2px] transition-all hover:border-violet-200 hover:text-violet-600"
          >
            <Brain size={14} strokeWidth={3} /> {t.diagnosis}
          </Link>
          <Link
            href="/RASCHmodel/exam"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-500 text-white border-b-4 border-violet-700 rounded-2xl text-[12px] font-black active:border-b-0 active:translate-y-1 transition-all ml-auto"
          >
            <Rocket size={14} strokeWidth={3} /> {t.newTest}
          </Link>
        </div>

        {/* Header + overall level */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight">{t.title}</h1>
            <p className="text-[14px] font-bold text-zinc-500 mt-1">{t.subtitle}</p>
          </div>
          <div className="bg-white rounded-[1.2rem] border-2 border-zinc-200 border-b-[6px] px-5 py-3 flex items-center gap-4 shrink-0">
            <div>
              <p className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">{t.overall}</p>
              <p className="text-3xl font-black text-violet-600 leading-none mt-0.5">{overall}%</p>
              {/* Mathematics ability: the mean of the seven dimensions. */}
              <p className="text-[10px] font-black text-zinc-300 mt-1">θ {theta.toFixed(2)}</p>
            </div>
            <div className="w-px h-10 bg-zinc-200" />
            <div>
              <p className="text-[18px] font-black text-zinc-800 leading-none">{levels.examCount}</p>
              <p className="text-[11px] font-bold text-zinc-400 mt-0.5">{t.examsTaken}</p>
            </div>
          </div>
        </motion.div>

        <MathLevelCard
          level={math.level}
          theta={math.theta}
          dimensionsMeasured={math.measuredDimensions}
          t={t}
        />

        <AbilityHeptagon dims={dims} lang={lang} t={t} />

        <ChapterLevels sections={sections} t={t} />

        {picture.now ? (
          <RaschForecastCard
            now={picture.now}
            future={picture.future}
            rate={picture.rate}
            target={target}
            t={t}
          />
        ) : (
          overallForecast && <ForecastCard f={overallForecast} t={t} />
        )}

        {/* Per-topic levels — also the chart's accessible table view. Each card
            opens the questions the student actually solved in that topic; that
            list is read from localStorage, so opening it costs no reads. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RASCH_TOPICS.map((topic, i) => {
            const stat = levels.topics[topic.key];
            const solved = solved_counts[topic.key];
            const tf = topicForecasts?.[topic.key];
            return (
              <motion.div
                key={topic.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <Link
                  href={`/RASCHmodel/topic/${topic.key}`}
                  className="group block bg-white rounded-2xl border-2 border-zinc-200 border-b-[6px] p-4 hover:border-zinc-300 active:border-b-2 active:translate-y-[4px] transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-[13px] font-bold text-zinc-700 leading-snug group-hover:text-violet-700 transition-colors">
                      {topic.label[lang]}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <DeltaBadge delta={stat.delta} />
                      <span className="text-[18px] font-black text-zinc-900 leading-none">{stat.level}%</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${stat.level}%`, backgroundColor: topic.hex }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
                      {solved.solved > 0
                        ? `${solved.correct}/${solved.solved} ${t.solvedLabel}`
                        : t.noneSolved}
                      {tf && tf.confidence !== 'none' && (
                        <span className="text-zinc-300">
                          · {t.nextShort} ≈ {tf.expected}%
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-0.5 text-[11px] font-black text-zinc-300 group-hover:text-violet-500 transition-colors">
                      {t.review} <ChevronRight size={12} strokeWidth={3} />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="text-[15px] font-black text-zinc-900">{t.chartTitle}</h2>
            <span className="text-[11px] font-bold text-zinc-400">{t.chartHint}</span>
          </div>

          {!hasExams ? (
            <div className="py-10 flex flex-col items-center gap-4 text-center">
              <p className="text-[13px] font-bold text-zinc-400 max-w-sm">{t.noExams}</p>
              <Link
                href="/RASCHmodel/exam"
                className="flex items-center gap-2 px-5 py-3 bg-violet-500 text-white font-black text-[13px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider"
              >
                <Rocket size={16} strokeWidth={3} /> {t.startExam}
              </Link>
            </div>
          ) : (
            <>
              {/* Legend + series picker in one row above the plot */}
              <div className="flex flex-wrap items-center gap-1.5 my-3">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-zinc-300 bg-zinc-50 text-[11px] font-black text-zinc-700">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: OVERALL_HEX }} />
                  {t.overall}
                </span>
                {RASCH_TOPICS.map((topic) => {
                  const on = shown.includes(topic.key);
                  return (
                    <button
                      key={topic.key}
                      onClick={() => toggleTopic(topic.key)}
                      aria-pressed={on}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[11px] font-black transition-all ${on ? topic.color : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300'
                        }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: on ? topic.hex : '#d4d4d8' }}
                      />
                      {topic.label[lang].split(' ')[0]}
                    </button>
                  );
                })}
              </div>

              <ChartFrame className="h-[260px] -ml-2">
                {({ width, height }) => (
                  <LineChart width={width} height={height} data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="#f4f4f5" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: 700 }}
                      axisLine={{ stroke: '#e4e4e7' }}
                      tickLine={false}
                      label={{ value: t.exam, position: 'insideBottomRight', offset: -2, fill: '#d4d4d8', fontSize: 10 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      unit="%"
                      tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip
                      cursor={{ stroke: '#d4d4d8', strokeWidth: 1 }}
                      contentStyle={{
                        borderRadius: 12,
                        border: '2px solid #e4e4e7',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                      formatter={(value, name) => [
                        `${value}%`,
                        RASCH_TOPICS.find((tp) => tp.key === name)?.label[lang] ?? String(name),
                      ]}
                      labelFormatter={(label) => `${t.exam} ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey={t.overall}
                      stroke={OVERALL_HEX}
                      strokeWidth={2}
                      dot={{ r: 4, strokeWidth: 0, fill: OVERALL_HEX }}
                      activeDot={{ r: 6 }}
                    />
                    {/* Forecast — dashed, hollow dot: visibly not a real result */}
                    <Line
                      type="monotone"
                      dataKey={t.predicted}
                      stroke="#7c3aed"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={{ r: 4, strokeWidth: 2, stroke: '#7c3aed', fill: '#ffffff' }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    {RASCH_TOPICS.filter((tp) => shown.includes(tp.key)).map((tp) => (
                      <Line
                        key={tp.key}
                        type="monotone"
                        dataKey={tp.key}
                        stroke={tp.hex}
                        strokeWidth={2}
                        dot={{ r: 4, strokeWidth: 0, fill: tp.hex }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                )}
              </ChartFrame>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setEditingBaseline(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-zinc-200 border-b-4 rounded-2xl text-[12px] font-black text-zinc-500 active:border-b-2 active:translate-y-[2px] transition-all"
          >
            <Sliders size={14} strokeWidth={3} /> {t.editBaseline}
          </button>
          <p className="text-[11px] font-bold text-zinc-400">
            {t.level} = mean(last {LEVEL_WINDOW})
          </p>
        </div>

      </div>
    </div>
  );
}
