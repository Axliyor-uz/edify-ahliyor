// app/(student)/RASCHmodel/components/MathematicsCard.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator, ChevronDown,
  Pi, Triangle, Sigma, Ruler, BarChart3,
  Star, Clock, BookOpen,
} from 'lucide-react';

import { getMathTopics } from '@/lib/Mathstructure';
import {
  Card, ListGroup, ListRow, StatTile, Tile, cn, MOTION_ON, springTransition,
  type StatTileProps, type TileProps,
} from '@/components/student-ui';
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

// ─── Icon / tone mapping by topic name (topic names come from syllabus.json) ──
const TOPIC_VISUALS: Record<string, { icon: React.ElementType; tone: NonNullable<TileProps['tone']> }> = {
  Algebra: { icon: Sigma, tone: 'secondary' },
  Geometriya: { icon: Triangle, tone: 'success' },
  Trigonometriya: { icon: Pi, tone: 'primary' },
  Statistika: { icon: BarChart3, tone: 'gold' },
};
const DEFAULT_VISUAL = { icon: Calculator, tone: 'neutral' } as const;

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

  const open = () =>
    router.push(
      `/RASCHmodel/practice?${new URLSearchParams({ topicId, chapterId: chapter.chapterId, lang }).toString()}`,
    );

  return (
    <ListRow
      role="button"
      tabIndex={0}
      clickable
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      leading={
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-m3-sm bg-surface-container-high text-[12px] font-black text-on-surface-variant">
          {index + 1}
        </span>
      }
      title={chapter.name}
    />
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
      initial={MOTION_ON ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay: MOTION_ON ? index * 0.08 : 0 }}
    >
      <Card flush className="overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="flex w-full items-center gap-4 p-s-card text-left"
        >
          <Tile tone={visual.tone}>
            <Icon size={22} strokeWidth={2.5} />
          </Tile>

          <div className="min-w-0 flex-1">
            <h3 className="s-display text-[17px] font-bold tracking-tight">{topic.name}</h3>
            <p className="mt-0.5 text-[12px] font-bold text-on-surface-variant">
              {topic.chapters.length} {t.topicsLabel} · {lessonCount} {t.lessonsLabel.toLowerCase()}
            </p>
          </div>

          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-m3-sm transition-colors duration-m3-fast',
              isOpen ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant',
            )}
          >
            <ChevronDown
              size={18}
              strokeWidth={3}
              className={cn('transition-transform duration-300', isOpen && 'rotate-180')}
            />
          </span>
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
              <div className="border-t border-outline-variant px-s-card pb-s-card pt-s-gap">
                <ListGroup>
                  {topic.chapters.map((chapter, cIndex) => (
                    <ChapterRow
                      key={chapter.chapterId}
                      chapter={chapter}
                      topicId={topic.topicId}
                      index={cIndex}
                      lang={lang}
                    />
                  ))}
                </ListGroup>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
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

  const stats: Array<{
    icon: React.ElementType;
    label: string;
    value: number | string;
    tone: NonNullable<StatTileProps['tone']>;
  }> = [
    { icon: BookOpen, label: t.topicsLabel, value: chapterCount, tone: 'secondary' },
    { icon: Star, label: t.lessonsLabel, value: lessonCount, tone: 'gold' },
    { icon: Ruler, label: t.sectionsLabel, value: topics.length, tone: 'primary' },
    { icon: Clock, label: t.avgLabel, value: t.avgValue, tone: 'surface' },
  ];

  return (
    <div className="grid grid-cols-2 gap-s-gap sm:grid-cols-4">
      {stats.map(({ icon: SIcon, label, value, tone }, i) => (
        <motion.div
          key={label}
          initial={MOTION_ON ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springTransition, delay: MOTION_ON ? i * 0.06 : 0 }}
        >
          <StatTile
            label={label}
            value={value}
            tone={tone}
            icon={<SIcon size={16} strokeWidth={2.8} />}
          />
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
    <div className="flex flex-col gap-s-section">
      {/* Header */}
      <motion.div
        initial={MOTION_ON ? { opacity: 0, y: -10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="flex items-center gap-4"
      >
        <Tile tone="secondary" size="lg">
          <Calculator size={28} strokeWidth={2.5} />
        </Tile>
        <div className="min-w-0">
          <h2 className="s-display text-2xl font-bold tracking-tight md:text-3xl">{t.title}</h2>
          <p className="mt-0.5 text-[14px] font-bold text-on-surface-variant">{t.subtitle}</p>
        </div>
      </motion.div>

      <StatsRow topics={topics} t={t} />

      <div className="flex flex-col gap-s-gap">
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

      <p className="px-1 text-[12px] font-bold text-on-surface-variant">{t.tip}</p>
    </div>
  );
}
