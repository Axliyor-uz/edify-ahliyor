// app/(student)/RASCHmodel/page.tsx
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, Rocket, Target, TrendingUp, Brain, Dumbbell } from 'lucide-react';

// Components
import MathematicsCard from './components/MathematicsCard';
import MathLevelSummary from './components/MathLevelSummary';
import { useStudentLanguage } from '../layout';
import { Button, Card, Page, PageHeader, Tile, MOTION_ON, springTransition } from '@/components/student-ui';
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
  // One language switcher for the whole student app — it lives in the top navbar
  // (app/(student)/layout.tsx) and reaches every page through this context.
  const { lang } = useStudentLanguage();
  const t = UI[lang];

  // The secondary destinations share one row and wrap freely, so a long label
  // ("Тренировка" is twice the width of "Mashq") can never push the primary
  // action off a phone screen.
  const actions = (
    <>
      {[
        { icon: TrendingUp, label: t.progress, href: '/RASCHmodel/progress' },
        { icon: Brain, label: t.diagnosis, href: '/RASCHmodel/diagnosis' },
        { icon: Dumbbell, label: t.practice, href: '/RASCHmodel/practice' },
      ].map(({ icon: Icon, label, href }) => (
        <Link key={href} href={href}>
          <Button variant="outlined" size="sm" icon={<Icon size={16} strokeWidth={3} />}>
            {label}
          </Button>
        </Link>
      ))}

      <Link href="/RASCHmodel/exam">
        <Button size="sm" icon={<Rocket size={16} strokeWidth={3} />}>
          {t.quickStart}
        </Button>
      </Link>
    </>
  );

  return (
    <Page>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Tile tone="primary" size="sm">
              <Target size={20} strokeWidth={2.5} />
            </Tile>
            RA<span className="text-primary">SCH</span>
          </span>
        }
        subtitle={t.subtitle}
        actions={actions}
      />

      {/* ── Where the student actually stands ───────────────────────────── */}
      <MathLevelSummary lang={lang} />

      {/* ── Info Banner ─────────────────────────────────────────────────── */}
      <motion.div
        initial={MOTION_ON ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="mb-6"
      >
        <Card variant="gradient" className="relative overflow-hidden">
          {/* Background pattern */}
          <div className="pointer-events-none absolute inset-0 opacity-10" aria-hidden>
            <div className="absolute right-8 top-2 h-20 w-20 rounded-full border-4 border-current" />
            <div className="absolute bottom-2 right-28 h-12 w-12 rounded-full border-4 border-current" />
            <div className="absolute right-48 top-4 h-8 w-8 rounded-full border-4 border-current" />
          </div>

          <div className="relative flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-m3-sm border-2 border-current">
              <Sparkles size={22} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 className="s-display text-[17px] font-bold tracking-tight">{t.bannerTitle}</h3>
              <p className="mt-1 text-[13px] font-bold leading-snug opacity-85">{t.bannerDesc}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ── Mathematics Section ─────────────────────────────────────────── */}
      <MathematicsCard lang={lang} />
    </Page>
  );
}
