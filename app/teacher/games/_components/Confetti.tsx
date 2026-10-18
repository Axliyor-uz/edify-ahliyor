'use client';

import { motion } from 'framer-motion';

/** Deterministic pseudo-random in [0,1) — keeps render pure (no Math.random). */
const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const PIECES = Array.from({ length: 42 }, (_, i) => ({
  left: rnd(i, 1) * 100,
  drift: (rnd(i, 2) - 0.5) * 160,
  spin: (rnd(i, 3) - 0.5) * 900,
  delay: rnd(i, 4) * 0.35,
  dur: 1.3 + rnd(i, 5) * 0.7,
  w: 7 + rnd(i, 6) * 6,
  light: rnd(i, 7) > 0.5,
}));

/** A short burst in the winner's color, transform/opacity only. */
export default function Confetti({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden>
      {PIECES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.w, height: p.w * 0.45, background: p.light ? '#fbbf24' : color }}
          initial={{ y: -20, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', x: p.drift, rotate: p.spin, opacity: [1, 1, 0] }}
          transition={{ duration: p.dur, delay: delay + p.delay, ease: [0.25, 0.4, 0.6, 1] }}
        />
      ))}
    </div>
  );
}
