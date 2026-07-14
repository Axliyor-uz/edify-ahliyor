// app/(student)/RASCHmodel/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Rocket, Target, TrendingUp, Brain, Dumbbell } from 'lucide-react';

// Components
import MathematicsCard from './components/MathematicsCard';
import MathLevelSummary from './components/MathLevelSummary';
import { useStudentLanguage } from '../layout';
import type { Lang } from '@/types/Math';

// ─── i18n ─────────────────────────────────────────────────────────────────────
// This page used to be hardcoded Uzbek while every page it links to (progress,
// diagnosis, practice, exam) was already trilingual — so switching the language
// in the navbar changed everything except the hub the student starts from.
const UI: Record<Lang, Record<string, string>> = {
  uz: {
    subtitle: "Fanlarni tanlang va tezkor mashq qilishni boshlang 🚀",
    progress: 'Darajam',
    diagnosis: 'Tahlil',
    practice: 'Mashq',
    quickStart: 'Tezkor boshlash',
    bannerTitle: 'Imtihonga tayyorlaning!',
    bannerDesc:
      "Har bir fan bo'yicha mavzularni o'rganing, savollarni yeching va bilimingizni sinang. Natijalaringiz real vaqtda kuzatiladi.",
  },
  ru: {
    subtitle: 'Выберите предмет и начните тренировку 🚀',
    progress: 'Мой уровень',
    diagnosis: 'Анализ',
    practice: 'Тренировка',
    quickStart: 'Быстрый старт',
    bannerTitle: 'Готовьтесь к экзамену!',
    bannerDesc:
      'Изучайте темы по каждому предмету, решайте задачи и проверяйте свои знания. Результаты отслеживаются в реальном времени.',
  },
  en: {
    subtitle: 'Pick a subject and start practising 🚀',
    progress: 'My level',
    diagnosis: 'Analysis',
    practice: 'Practice',
    quickStart: 'Quick start',
    bannerTitle: 'Get exam-ready!',
    bannerDesc:
      'Work through the topics of each subject, solve the questions and test what you know. Your results are tracked as you go.',
  },
};

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function RASCHModelPage() {
  const router = useRouter();
  // One language switcher for the whole student app — it lives in the top navbar
  // (app/(student)/layout.tsx) and reaches every page through this context.
  const { lang } = useStudentLanguage();
  const t = UI[lang];

  return (
    <div className="min-h-screen bg-zinc-100 font-sans pb-28 md:pb-12">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        {/* The action row used to be a single flex line of four `shrink-0`
            buttons: on a phone they could not shrink and could not wrap, so the
            row ran off the screen and the primary action was unreachable. The
            three secondary actions now share a 3-up grid and the primary action
            takes the full width beneath them; from `sm` up it is one row again.
            The labels are translated, so they must also be free to truncate —
            "Тренировка" is twice the width of "Mashq". */}
        <div className="pt-8 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="min-w-0"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-[1.2rem] text-white flex items-center justify-center border-b-4 border-indigo-700 shadow-lg shrink-0">
                <Target size={24} strokeWidth={2.5} />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-900 tracking-tight truncate">
                RA<span className="text-violet-600">SCH</span>
              </h1>
            </div>
            <p className="text-[14px] sm:text-[15px] font-bold text-zinc-500 pl-1">
              {t.subtitle}
            </p>
          </motion.div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 lg:shrink-0">
            <div className="grid grid-cols-3 sm:flex gap-2.5">
              {[
                { icon: TrendingUp, label: t.progress, href: '/RASCHmodel/progress', delay: 0.05 },
                { icon: Brain, label: t.diagnosis, href: '/RASCHmodel/diagnosis', delay: 0.07 },
                { icon: Dumbbell, label: t.practice, href: '/RASCHmodel/practice', delay: 0.09 },
              ].map(({ icon: Icon, label, href, delay }) => (
                <motion.button
                  key={href}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay }}
                  onClick={() => router.push(href)}
                  className="min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3.5 bg-white text-zinc-600 font-black text-[11px] sm:text-[14px] rounded-2xl border-2 border-zinc-200 border-b-4 active:border-b-2 active:translate-y-[2px] transition-all uppercase tracking-wider hover:border-violet-200 hover:text-violet-600"
                >
                  <Icon size={18} strokeWidth={3} className="shrink-0" />
                  <span className="truncate max-w-full">{label}</span>
                </motion.button>
              ))}
            </div>

            {/* Primary action — full width on a phone, inline from `sm` up */}
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              onClick={() => router.push('/RASCHmodel/exam')}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3.5 bg-violet-500 text-white font-black text-[13px] sm:text-[14px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider hover:bg-violet-600 shadow-lg shadow-violet-200"
            >
              <Rocket size={18} strokeWidth={3} className="shrink-0" />
              {t.quickStart}
            </motion.button>
          </div>
        </div>

        {/* ── Where the student actually stands ───────────────────────────── */}
        <MathLevelSummary lang={lang} />

        {/* ── Info Banner ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mb-6 bg-gradient-to-r from-violet-500 to-indigo-600 rounded-[1.5rem] p-5 md:p-6 border-b-4 border-indigo-700 text-white relative overflow-hidden"
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-2 right-8 w-20 h-20 border-4 border-white rounded-full" />
            <div className="absolute bottom-2 right-28 w-12 h-12 border-4 border-white rounded-full" />
            <div className="absolute top-4 right-48 w-8 h-8 border-4 border-white rounded-full" />
          </div>

          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-[1rem] flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/20">
              <Sparkles size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-[17px] font-black tracking-tight">{t.bannerTitle}</h3>
              <p className="text-[13px] font-bold text-white/80 mt-1 leading-snug">{t.bannerDesc}</p>
            </div>
          </div>
        </motion.div>

        {/* ── Mathematics Section ─────────────────────────────────────────── */}
        <MathematicsCard lang={lang} />

      </div>
    </div>
  );
}
