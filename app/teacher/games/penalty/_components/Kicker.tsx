'use client';

import { motion } from 'framer-motion';
import { PITCH } from '../_lib/theme';

/**
 * The penalty taker, seen from behind, drawn around his feet at (0, 0).
 * Stands still until the kick, runs up to the ball, kicks with the right
 * leg, and jumps with both arms up after a goal.
 */

/** Run-up: from the start mark to the ball. */
export const RUN_UP = { x: 140, y: -40 };

interface Props {
  color: string;
  /** Run-up + kick (the kick phase and the result after it). */
  kicking: boolean;
  /** Goal scored → celebrate. */
  cheering: boolean;
  /** Run-up length in seconds. */
  runSeconds: number;
  animate: boolean;
}

export default function Kicker({ color, kicking, cheering, runSeconds, animate }: Props) {
  const d = (s: number) => (animate ? s : 0);
  const arm = (side: -1 | 1) => ({
    rotate: cheering ? side * -140 : 0,
    transition: { duration: d(0.3) },
  });

  return (
    <motion.g
      animate={kicking ? RUN_UP : { x: 0, y: 0 }}
      transition={{ duration: kicking ? d(runSeconds) : d(0.4), ease: 'easeIn' }}
    >
      <ellipse cx={0} cy={-2} rx={52} ry={10} fill={PITCH.shadow} />
      <motion.g
        animate={{ y: cheering && animate ? [0, -28, 0, -28, 0] : 0 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      >
        {/* left (standing) leg */}
        <rect x={-30} y={-80} width={22} height={74} rx={8} fill={color} />
        <ellipse cx={-19} cy={-4} rx={16} ry={8} fill={PITCH.boot} />
        {/* right (kicking) leg: swings out at the end of the run-up */}
        <motion.g
          animate={{ rotate: kicking && animate ? [0, 0, -38, 0] : 0 }}
          transition={{ duration: d(runSeconds + 0.3), times: [0, 0.6, 0.8, 1] }}
          style={{ originX: 0.5, originY: 0 }}
        >
          <rect x={8} y={-80} width={22} height={74} rx={8} fill={color} />
          <ellipse cx={19} cy={-4} rx={16} ry={8} fill={PITCH.boot} />
        </motion.g>
        {/* shorts + shirt with the number on the back */}
        <rect x={-38} y={-112} width={76} height={40} rx={10} fill={PITCH.shorts} />
        <rect x={-46} y={-200} width={92} height={98} rx={24} fill={color} />
        <text x={0} y={-132} textAnchor="middle" fontSize={44} fontWeight={900} fill={PITCH.line} opacity={0.9}>10</text>
        {/* arms: down while playing, up while cheering */}
        <motion.line x1={-42} y1={-186} x2={-54} y2={-120} stroke={color} strokeWidth={18} strokeLinecap="round" animate={arm(-1)} style={{ originX: 1, originY: 0 }} />
        <motion.line x1={42} y1={-186} x2={54} y2={-120} stroke={color} strokeWidth={18} strokeLinecap="round" animate={arm(1)} style={{ originX: 0, originY: 0 }} />
        {/* back of the head */}
        <circle cx={0} cy={-226} r={30} fill={PITCH.hair} />
      </motion.g>
    </motion.g>
  );
}
