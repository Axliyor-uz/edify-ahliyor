// app/(student)/RASCHmodel/components/MathLevelSummary.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Gauge } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { dimensions, getRASCHLevels, mathLevel } from '@/services/RASCHProgressService';
import { BAND_COLOR, MASTER_LEVEL, formatLevel, levelBand } from '@/lib/RASCHscale';
import { RASCH_TOPICS } from '@/lib/RASCHtopics';
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
  const colors = BAND_COLOR[band];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <Link
        href="/RASCHmodel/progress"
        className="group block bg-white rounded-[1.5rem] border-2 border-zinc-200 border-b-[6px] p-5 hover:border-zinc-300 active:border-b-2 active:translate-y-[4px] transition-all"
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-[1rem] border-2 flex items-center justify-center shrink-0"
            style={{ backgroundColor: colors.hex + '14', borderColor: colors.hex + '40', color: colors.hex }}
          >
            <Gauge size={22} strokeWidth={2.5} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">{t.title}</p>

            {measured ? (
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl font-black leading-none tracking-tight" style={{ color: colors.hex }}>
                  {formatLevel(math.level)}
                </span>
                <span className="text-[15px] font-black text-zinc-300 leading-none">/ {MASTER_LEVEL}</span>
                <span className="text-[12px] font-black ml-1" style={{ color: colors.hex }}>
                  {t[`band_${band}`]}
                </span>
              </div>
            ) : (
              <p className="text-[13px] font-bold text-zinc-400 mt-1">{t.empty}</p>
            )}
          </div>

          <ChevronRight
            size={18}
            strokeWidth={3}
            className="text-zinc-300 shrink-0 group-hover:text-violet-500 transition-colors"
          />
        </div>

        {measured && (
          <>
            {/* The 0–3 track */}
            <div className="mt-4 h-2.5 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(math.level / MASTER_LEVEL) * 100}%`, backgroundColor: colors.hex }}
              />
            </div>

            {/* The seven dimensions, in miniature — the heptagon's data as a strip */}
            <div className="flex items-end gap-1 mt-3 h-8">
              {dims.map((d) => {
                const topic = RASCH_TOPICS.find((tp) => tp.key === d.key)!;
                const unmeasured = d.measured === 0;
                return (
                  <div
                    key={d.key}
                    title={`${topic.label[lang]} — ${unmeasured ? '—' : formatLevel(d.level)}`}
                    className="flex-1 rounded-t-md transition-all"
                    style={{
                      height: unmeasured ? '4px' : `${Math.max(10, (d.level / MASTER_LEVEL) * 100)}%`,
                      backgroundColor: unmeasured ? '#e4e4e7' : topic.hex,
                    }}
                  />
                );
              })}
            </div>
            <p className="text-[10px] font-bold text-zinc-300 mt-1.5">
              {math.measuredDimensions}/7 {t.dims} · θ {math.theta.toFixed(2)}
            </p>
          </>
        )}
      </Link>
    </motion.div>
  );
}
