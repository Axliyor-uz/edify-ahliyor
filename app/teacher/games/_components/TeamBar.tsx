'use client';

import { useEffect } from 'react';
import { AnimatePresence, animate as animateValue, motion, useMotionValue, useTransform } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { GAME_TEAMS, STAGE } from '../_lib/stage';

/** Score that counts up/down to its new value. */
export function Score({ value, animate, delay = 0.35, from }: { value: number; animate: boolean; delay?: number; from?: number }) {
  const mv = useMotionValue(animate && from !== undefined ? from : value);
  const shown = useTransform(mv, (v) => Math.round(v));
  useEffect(() => {
    if (!animate) { mv.set(value); return; }
    const c = animateValue(mv, value, { duration: 0.9, ease: 'easeOut', delay });
    return () => c.stop();
  }, [value, animate, mv, delay]);
  return <motion.span className="tabular-nums">{shown}</motion.span>;
}

interface Props {
  names: string[];
  scores: number[];
  turn: number;
  /** Per-team score change of the last reward + a key to replay the float. */
  delta: number[] | null;
  deltaKey: number;
  turnLabel: string;
  animate: boolean;
}

export default function TeamBar({ names, scores, turn, delta, deltaKey, turnLabel, animate }: Props) {
  return (
    <div className="grid shrink-0 gap-[clamp(8px,1vw,16px)]" style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
      {names.map((name, i) => {
        const c = GAME_TEAMS[i];
        const active = i === turn;
        const d = delta?.[i] ?? 0;
        return (
          <motion.div
            key={i}
            className="relative flex items-center gap-[clamp(8px,0.8vw,14px)] rounded-[clamp(12px,1.2vw,20px)] bg-surface-container-lowest px-[clamp(10px,1vw,18px)] py-[clamp(6px,1vh,12px)] transition-shadow duration-300"
            style={{
              boxShadow: active
                ? `0 0 0 3px ${c.solid}, 0 10px 28px -10px ${c.solid}`
                : '0 0 0 1px var(--m3-outline-variant), 0 1px 2px rgba(0,0,0,0.06)',
            }}
            animate={{ y: active && animate ? -3 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <span
              className="flex h-[clamp(30px,4.4vh,48px)] w-[clamp(30px,4.4vh,48px)] shrink-0 items-center justify-center rounded-full font-t-display text-[clamp(14px,2vh,22px)] font-black text-white"
              style={{ background: c.solid }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[clamp(12px,1.7vh,18px)] font-extrabold" style={{ color: c.solid }}>{name}</p>
              <AnimatePresence>
                {active && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-0.5 text-[clamp(10px,1.3vh,13px)] font-bold uppercase tracking-wider text-on-surface-variant"
                  >
                    <motion.span
                      animate={animate ? { y: [0, 3, 0] } : undefined}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                      className="inline-flex"
                    >
                      <ChevronDown size={14} strokeWidth={3} style={{ color: c.solid }} />
                    </motion.span>
                    {turnLabel}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <span className="font-t-display text-[clamp(24px,4.4vh,48px)] font-black leading-none text-on-surface">
              <Score value={scores[i]} animate={animate} />
            </span>

            {/* Floating +20 / −20 after a reward */}
            <AnimatePresence>
              {d !== 0 && (
                <motion.span
                  key={`${deltaKey}-${i}`}
                  className="pointer-events-none absolute -bottom-[0.6em] right-[clamp(10px,1vw,18px)] rounded-full px-[0.6em] py-[0.1em] font-t-display text-[clamp(13px,2vh,20px)] font-black text-white shadow-elev-2"
                  style={{ background: d > 0 ? STAGE.correct : STAGE.wrong }}
                  initial={{ opacity: 0, y: -10, scale: 0.6 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [-10, 0, 0, 12], scale: [0.6, 1.15, 1, 1] }}
                  transition={{ duration: 2.2, times: [0, 0.15, 0.8, 1], delay: 0.2 }}
                >
                  {d > 0 ? `+${d}` : `−${-d}`}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
