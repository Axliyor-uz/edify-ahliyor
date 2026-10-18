'use client';

import { motion } from 'framer-motion';
import { STAGE } from '../_lib/theme';

/** Deterministic pseudo-random in [0,1) — keeps render pure. */
const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

type Shape = 'circle' | 'ring' | 'star' | 'q' | 'tri' | 'plus';
const KINDS: Shape[] = ['circle', 'q', 'star', 'ring', 'plus', 'tri'];

const SHAPES = Array.from({ length: 16 }, (_, i) => ({
  kind: KINDS[i % KINDS.length],
  left: 3 + rnd(i, 1) * 94,
  top: 4 + rnd(i, 2) * 90,
  size: 22 + rnd(i, 3) * 34,
  color: STAGE.shapes[i % STAGE.shapes.length],
  dur: 7 + rnd(i, 4) * 6,
  delay: rnd(i, 5) * -8,
  drift: 10 + rnd(i, 6) * 18,
  spin: (rnd(i, 7) - 0.5) * 50,
}));

function Glyph({ kind, color }: { kind: Shape; color: string }) {
  switch (kind) {
    case 'circle': return <circle cx={20} cy={20} r={14} fill={color} />;
    case 'ring': return <circle cx={20} cy={20} r={13} fill="none" stroke={color} strokeWidth={5} />;
    case 'star': return <path d="M20 3l4.9 10.6 11.6 1.3-8.7 7.8 2.4 11.4L20 28.3 9.8 34.1l2.4-11.4L3.5 14.9l11.6-1.3z" fill={color} />;
    case 'tri': return <path d="M20 5l15 27H5z" fill={color} />;
    case 'plus': return <path d="M16 5h8v11h11v8H24v11h-8V24H5v-8h11z" fill={color} />;
    case 'q': return <text x={20} y={33} textAnchor="middle" fontSize={36} fontWeight={900} fill={color}>?</text>;
  }
}

/** Soft game-show confetti shapes drifting behind the board. */
export default function StageBackdrop({ animate }: { animate: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {SHAPES.map((s, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 40 40"
          className="absolute opacity-[0.16]"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
          animate={animate ? { y: [0, -s.drift, 0], rotate: [0, s.spin, 0] } : undefined}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Glyph kind={s.kind} color={s.color} />
        </motion.svg>
      ))}
    </div>
  );
}
