// app/(student)/RASCHmodel/components/MathematicsCard.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator, ChevronRight, ChevronDown,
  Pi, Triangle, Sigma, Ruler, BarChart3,
  Star, Clock, BookOpen,
} from 'lucide-react';

import { getMathTopics } from '@/lib/Mathstructure';
import type { ChapterStructure, Lang, TopicStructure } from '@/types/Math';

// ─── i18n (UI chrome strings only — question content is localized separately) ─
const UI_STRINGS: Record<Lang, Record<string, string>> = {
  uz: {
    title: 'Matematika', subtitle: "Barcha mavzular bo'yicha mashq qiling",
    topicsLabel: 'mavzu', sectionsLabel: "Bo'limlar",
    lessonsLabel: 'Darslar', avgLabel: "O'rtacha",
    avgValue: '15 daq',
    tip: "Har bir mavzuni bosib, savollarni yechishni boshlang.",
  },
  ru: {
    title: 'Математика', subtitle: 'Практикуйтесь по всем темам',
    topicsLabel: 'тем', sectionsLabel: 'Разделы',
    lessonsLabel: 'Уроки', avgLabel: 'В среднем',
    avgValue: '15 мин',
    tip: 'Нажмите на тему, чтобы начать решать вопросы.',
  },
  en: {
    title: 'Mathematics', subtitle: 'Practice across all topics',
    topicsLabel: 'topics', sectionsLabel: 'Sections',
    lessonsLabel: 'Lessons', avgLabel: 'Average',
    avgValue: '15 min',
    tip: 'Tap a topic to start solving questions.',
  },
};

// ─── Icon / color mapping by topic name (topic names come from syllabus.json) ─
const TOPIC_VISUALS: Record<string, { icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  Algebra: { icon: Sigma, color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  Geometriya: { icon: Triangle, color: 'text-emerald-500', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  Trigonometriya: { icon: Pi, color: 'text-violet-500', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
  Statistika: { icon: BarChart3, color: 'text-amber-500', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
};
const DEFAULT_VISUAL = { icon: Calculator, color: 'text-zinc-500', bgColor: 'bg-zinc-50', borderColor: 'border-zinc-200' };

// ─── Chapter row ──────────────────────────────────────────────────────────
// Just the chapter name. It used to carry per-difficulty question counts, which
// cost 3 Firestore COUNT aggregations per chapter (87 in all) every time the
// cache went cold — for a number nobody acts on. The whole tree is now rendered
// from the bundled syllabus: zero reads.
function ChapterRow({
  chapter, topicId, index, lang,
}: {
  chapter: ChapterStructure;
  topicId: string;
  index: number;
  lang: Lang;
}) {
  const router = useRouter();

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, 8) * 0.04 }}
      onClick={() =>
        router.push(
          `/RASCHmodel/practice?${new URLSearchParams({ topicId, chapterId: chapter.chapterId, lang }).toString()}`,
        )
      }
      className="w-full group/topic flex items-center gap-3 p-3.5 rounded-2xl border-2 border-zinc-100 hover:border-violet-200 hover:bg-violet-50/40 active:translate-y-[2px] active:border-b-2 transition-all text-left"
    >
      <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[12px] font-black text-zinc-400 shrink-0 group-hover/topic:bg-violet-100 group-hover/topic:text-violet-600 group-hover/topic:border-violet-200 transition-colors">
        {index + 1}
      </div>

      <span className="flex-1 min-w-0 text-[14px] font-bold text-zinc-800 truncate group-hover/topic:text-violet-800 transition-colors">
        {chapter.name}
      </span>

      <div className="w-7 h-7 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-300 shrink-0 group-hover/topic:bg-violet-500 group-hover/topic:text-white group-hover/topic:border-violet-500 transition-all">
        <ChevronRight size={14} strokeWidth={3} />
      </div>
    </motion.button>
  );
}

// ─── Section Accordion (Algebra / Geometriya) ─────────────────────────────
function SectionAccordion({
  topic, index, t, lang,
}: {
  topic: TopicStructure;
  index: number;
  t: Record<string, string>;
  lang: Lang;
}) {
  const [isOpen, setIsOpen] = useState(index === 0);
  const visual = TOPIC_VISUALS[topic.name] ?? DEFAULT_VISUAL;
  const Icon = visual.icon;

  const lessonCount = useMemo(
    () => topic.chapters.reduce((sum, c) => sum + c.subtopics.length, 0),
    [topic],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
      <div className="bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] overflow-hidden hover:border-zinc-300 transition-colors">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-4 p-5 text-left group"
        >
          <div className={`w-12 h-12 rounded-[1rem] border-2 flex items-center justify-center shrink-0 ${visual.bgColor} ${visual.borderColor} ${visual.color}`}>
            <Icon size={22} strokeWidth={2.5} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] font-black text-zinc-900 tracking-tight group-hover:text-violet-700 transition-colors">
              {topic.name}
            </h3>
            <p className="text-[12px] font-bold text-zinc-400 mt-0.5">
              {topic.chapters.length} {t.topicsLabel} · {lessonCount} {t.lessonsLabel.toLowerCase()}
            </p>
          </div>

          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all shrink-0 ${isOpen
              ? 'bg-violet-500 border-violet-600 text-white'
              : 'bg-zinc-50 border-zinc-200 text-zinc-400 group-hover:bg-violet-50 group-hover:border-violet-200 group-hover:text-violet-500'
            }`}>
            <ChevronDown size={18} strokeWidth={3} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-2 border-t-2 border-zinc-100 pt-4">
                {topic.chapters.map((chapter, cIndex) => (
                  <ChapterRow
                    key={chapter.chapterId}
                    chapter={chapter}
                    topicId={topic.topicId}
                    index={cIndex}
                    lang={lang}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Stats Row (derived from the syllabus — 0 Firestore reads) ────────────
function StatsRow({ topics, t }: { topics: TopicStructure[]; t: Record<string, string> }) {
  const { chapterCount, lessonCount } = useMemo(() => {
    const chapters = topics.flatMap((tp) => tp.chapters);
    return {
      chapterCount: chapters.length,
      lessonCount: chapters.reduce((s, c) => s + c.subtopics.length, 0),
    };
  }, [topics]);

  const stats = [
    { icon: BookOpen, label: t.topicsLabel, value: chapterCount, color: 'bg-blue-50 border-blue-200 text-blue-500' },
    { icon: Star, label: t.lessonsLabel, value: lessonCount, color: 'bg-amber-50 border-amber-200 text-amber-500' },
    { icon: Ruler, label: t.sectionsLabel, value: topics.length, color: 'bg-emerald-50 border-emerald-200 text-emerald-500' },
    { icon: Clock, label: t.avgLabel, value: t.avgValue, color: 'bg-violet-50 border-violet-200 text-violet-500' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ icon: SIcon, label, value, color }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.06 }}
          className="bg-white rounded-2xl border-2 border-zinc-200 border-b-[6px] p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-transform"
        >
          <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 ${color}`}>
            <SIcon size={18} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[18px] font-black text-zinc-900 leading-none">{value}</p>
            <p className="text-[11px] font-bold text-zinc-400 mt-0.5 uppercase tracking-wider">{label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function MathematicsCard({ lang = 'uz' }: { lang?: Lang }) {
  // The syllabus is bundled at build time (data/syllabus.json) — rendering this
  // whole card touches Firestore zero times.
  const topics = useMemo(() => getMathTopics(), []);
  const t = UI_STRINGS[lang];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-4"
      >
        <div className="w-14 h-14 bg-blue-50 border-2 border-blue-200 rounded-[1.2rem] text-blue-500 flex items-center justify-center">
          <Calculator size={28} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">{t.title}</h2>
          <p className="text-[14px] font-bold text-zinc-500 mt-0.5">{t.subtitle}</p>
        </div>
      </motion.div>

      <StatsRow topics={topics} t={t} />

      <div className="flex flex-col gap-4">
        {topics.map((topic, index) => (
          <SectionAccordion
            key={topic.topicId}
            topic={topic}
            index={index}
            t={t}
            lang={lang}
          />
        ))}
      </div>

      <p className="text-[12px] font-bold text-zinc-400 px-1">{t.tip}</p>
    </div>
  );
}
