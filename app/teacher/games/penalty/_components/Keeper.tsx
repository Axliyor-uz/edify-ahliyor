'use client';

import { motion } from 'framer-motion';
import { PITCH } from '../_lib/theme';

/**
 * The goalkeeper, front view, drawn around his feet at (0, 0), about 200
 * units tall. One rig, four moves: idle bob (question), side-to-side sway
 * (aim), dive (kick), a small hop while a wrong-answer kick flies over.
 * Dives turn around the body's center, so the keeper flies across the goal
 * mouth instead of falling onto the grass in front of it.
 */

/**
 * Dive per zone: top-left, bottom-left, center, bottom-right, top-right.
 * Solved so a glove ends on the zone where Stadium aims the ball — a save
 * lands in the hands, not on the face. Center: a small hop; Stadium sends a
 * saved center shot into the chest (`KEEPER_CHEST`).
 */
const DIVES = [
  { x: -170, y: -37, rotate: -70 },
  { x: -138, y: -40, rotate: -88 },
  { x: 0, y: -10, rotate: 0 },
  { x: 138, y: -40, rotate: 88 },
  { x: 170, y: -37, rotate: 70 },
];

/** The static figure, shared with the hub card art. */
export function KeeperFigure({ color }: { color: string }) {
  return (
    <>
      {/* boots, socks, shorts */}
      <ellipse cx={-16} cy={-5} rx={15} ry={7} fill={PITCH.boot} />
      <ellipse cx={16} cy={-5} rx={15} ry={7} fill={PITCH.boot} />
      <rect x={-25} y={-60} width={18} height={54} rx={7} fill={color} />
      <rect x={7} y={-60} width={18} height={54} rx={7} fill={color} />
      <rect x={-32} y={-94} width={64} height={40} rx={9} fill={PITCH.shorts} />
      {/* arms up, ready (sleeves in the team color) */}
      <line x1={-30} y1={-146} x2={-70} y2={-182} stroke={color} strokeWidth={18} strokeLinecap="round" />
      <line x1={30} y1={-146} x2={70} y2={-182} stroke={color} strokeWidth={18} strokeLinecap="round" />
      <circle cx={-73} cy={-186} r={16} fill={PITCH.glove} stroke={PITCH.gloveEdge} strokeWidth={3} />
      <circle cx={73} cy={-186} r={16} fill={PITCH.glove} stroke={PITCH.gloveEdge} strokeWidth={3} />
      {/* shirt with collar and the keeper's number */}
      <rect x={-38} y={-158} width={76} height={74} rx={20} fill={color} />
      <path d="M-13 -158 L0 -146 L13 -158" fill="none" stroke={PITCH.line} strokeWidth={4} strokeLinejoin="round" opacity={0.85} />
      <text x={0} y={-104} textAnchor="middle" fontSize={32} fontWeight={900} fill={PITCH.line} opacity={0.9}>1</text>
      {/* head */}
      <circle cx={0} cy={-182} r={24} fill={PITCH.skin} />
      <path d="M-24 -186 A24 24 0 0 1 24 -186 Q12 -196 0 -194 Q-12 -196 -24 -186 Z" fill={PITCH.hair} />
      <circle cx={-8} cy={-180} r={2.8} fill={PITCH.shorts} />
      <circle cx={8} cy={-180} r={2.8} fill={PITCH.shorts} />
    </>
  );
}

export type KeeperMove = 'idle' | 'sway' | 'dive' | 'watch';

interface Props {
  color: string;
  move: KeeperMove;
  /** Zone of the dive (move 'dive'). */
  zone: number | null;
  /** Seconds before the dive starts (the kicker's run-up). */
  delay: number;
  animate: boolean;
}

export default function Keeper({ color, move, zone, delay, animate }: Props) {
  const settle = { duration: animate ? 0.4 : 0 };
  // Loops repeat only their own property; everything else settles back (e.g. getting up after a dive).
  const loop = (duration: number) => ({ duration, repeat: Infinity, repeatType: 'reverse' as const, ease: 'easeInOut' as const });
  const target =
    move === 'dive'
      ? { ...DIVES[zone ?? 2], transition: { delay: animate ? delay : 0, duration: animate ? 0.38 : 0, ease: 'easeOut' as const } }
    : move === 'watch'
      ? { x: 0, y: animate ? [0, 0, -24, 0] : 0, rotate: 0, transition: { default: settle, y: { delay: animate ? delay : 0, duration: 0.6 } } }
    : move === 'sway' && animate
      ? { x: [-26, 26], y: 0, rotate: 0, transition: { default: settle, x: loop(0.9) } }
    : move === 'idle' && animate
      ? { x: 0, y: [0, -5], rotate: 0, transition: { default: settle, y: loop(1.1) } }
      : { x: 0, y: 0, rotate: 0, transition: settle };

  return (
    <motion.g animate={target} style={{ originX: 0.5, originY: 0.5 }}>
      <KeeperFigure color={color} />
    </motion.g>
  );
}
