// app/(student)/RASCHmodel/components/MathLevelSummary.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Gauge } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { dimensions, getRASCHLevels, mathLevel } from '@/services/RASCHProgressService';
import { MASTER_LEVEL, formatLevel, levelBand, type LevelBand } from '@/lib/RASCHscale';
import { RASCH_TOPICS } from '@/lib/RASCHtopics';
import {
  Card, Chip, ProgressBar, Tile, cn, MOTION_ON, springTransition,
  type ChipProps, type ProgressBarProps, type TileProps,
} from '@/components/student-ui';
import type { RASCHLevels } from '@/types/RASCH';
import type { Lang } from '@/types/Math';

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    title: 'Matematika darajangiz',
    empty: 'Darajangizni bilish uchun test topshiring',
    emptyCta: 'Testni boshlash',
    details: "Batafsil",
    master: 'master',
    dims: "o'lchamdan",
    band_beginner: "Boshlang'ich", band_basic: 'Asosiy', band_confident: 'Ishonchli',
    band_advanced: 'Yuqori', band_master: 'Master',
  },
  ru: {
    title: 'Ваш уровень по математике',
    empty: 'Пройдите тест, чтобы узнать свой уровень',
    emptyCta: 'Начать тест',
    details: 'Подробнее',
    master: 'мастер',
    dims: 'из измерений',
    band_beginner: 'Начальный', band_basic: 'Базовый', band_confident: 'Уверенный',
    band_advanced: 'Продвинутый', band_master: 'Мастер',
  },
  en: {
    title: 'Your mathematics level',
    empty: 'Sit an exam to find out your level',
    emptyCta: 'Start an exam',
    details: 'Details',
    master: 'master',
    dims: 'of dimensions',
    band_beginner: 'Beginner', band_basic: 'Basic', band_confident: 'Confident',
    band_advanced: 'Advanced', band_master: 'Master',
  },
};

/**
 * Band → design tokens. The band's name is always printed beside the color, so
 * the level never depends on hue alone to be readable.
 */
const BAND_TONE: Record<LevelBand, {
  tile: NonNullable<TileProps['tone']>;
  chip: NonNullable<ChipProps['status']>;
  bar: NonNullable<ProgressBarProps['tone']>;
  text: string;
}> = {
  beginner: { tile: 'neutral', chip: 'neutral', bar: 'primary', text: 'text-on-surface-variant' },
  basic: { tile: 'secondary', chip: 'info', bar: 'primary', text: 'text-secondary' },
  confident: { tile: 'primary', chip: 'primary', bar: 'primary', text: 'text-primary' },
  advanced: { tile: 'success', chip: 'success', bar: 'success', text: 'text-success' },
  master: { tile: 'gold', chip: 'gold', bar: 'gold', text: 'text-gold' },
};

/**
 * The headline level — on the Rasch landing page and on the student dashboard,
 * which is why the wrapper's spacing is the caller's to set.
 *
 * Reads the SAME single document the progress page reads, through the same
 * localStorage-backed cache (12h) — so the dashboard, /RASCHmodel and /progress
 * share one document read between them, not three.
 */
export default function MathLevelSummary({
  lang,
  className = 'mb-6',
}: {
  lang: Lang;
  className?: string;
}) {
  const { user, loading } = useAuth();
  const t = UI[lang];

  const [levels, setLevels] = useState<RASCHLevels | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    getRASCHLevels(user.uid)
      .then((next) => {
        if (cancelled) return;
        setLevels(next);
        setReady(true);
      })
      .catch((err: unknown) => {
        // A level is a nice-to-have on this page — never let it break the page.
        console.error('[RASCH] level summary failed', err);
        if (!cancelled) setReady(true);
      });

    return () => { cancelled = true; };
  }, [user, loading]);

  const math = useMemo(() => mathLevel(levels), [levels]);
  const dims = useMemo(() => dimensions(levels), [levels]);
  const measured = math.measuredDimensions > 0;

  if (!user || !ready) return null;

  const band = levelBand(math.level);
  const tone = BAND_TONE[band];

  return (
    <motion.div
      initial={MOTION_ON ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
      className={className}
    >
      <Link href="/RASCHmodel/progress" className="group block">
        <Card interactive>
          <div className="flex items-center gap-4">
            <Tile tone={tone.tile}>
              <Gauge size={22} strokeWidth={2.5} />
            </Tile>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-wider text-on-surface-variant">{t.title}</p>

              {measured ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                  <span className={cn('s-num text-3xl font-black leading-none tracking-tight', tone.text)}>
                    {formatLevel(math.level)}
                  </span>
                  <span className="s-num text-[15px] font-black leading-none text-on-surface-variant">
                    / {MASTER_LEVEL}
                  </span>
                  <Chip status={tone.chip} className="ml-1">{t[`band_${band}`]}</Chip>
                </div>
              ) : (
                <p className="mt-1 text-[13px] font-bold text-on-surface-variant">{t.empty}</p>
              )}
            </div>

            <ChevronRight
              size={18}
              strokeWidth={3}
              className="shrink-0 text-outline transition-colors group-hover:text-primary"
            />
          </div>

          {measured && (
            <>
              {/* The 0–3 track */}
              <ProgressBar
                value={(math.level / MASTER_LEVEL) * 100}
                tone={tone.bar}
                label={t.title}
                className="mt-4"
              />

              {/* The seven dimensions, in miniature — the heptagon's data as a strip.
                  Each bar carries its topic's identity color, the same one the
                  progress chart uses; unmeasured bars fall back to a surface token. */}
              <div className="mt-3 flex h-8 items-end gap-1">
                {dims.map((d) => {
                  const topic = RASCH_TOPICS.find((tp) => tp.key === d.key)!;
                  const unmeasured = d.measured === 0;
                  return (
                    <div
                      key={d.key}
                      title={`${topic.label[lang]} — ${unmeasured ? '—' : formatLevel(d.level)}`}
                      className={cn(
                        'flex-1 rounded-t-md transition-all',
                        unmeasured && 'bg-surface-container-highest',
                      )}
                      style={{
                        height: unmeasured ? '4px' : `${Math.max(10, (d.level / MASTER_LEVEL) * 100)}%`,
                        ...(unmeasured ? {} : { backgroundColor: topic.hex }),
                      }}
                    />
                  );
                })}
              </div>
              <p className="s-num mt-1.5 text-[10px] font-bold text-on-surface-variant">
                {math.measuredDimensions}/7 {t.dims} · θ {math.theta.toFixed(2)}
              </p>
            </>
          )}
        </Card>
      </Link>
    </motion.div>
  );
}
