'use client';

import { motion, type TargetAndTransition, type Transition } from 'framer-motion';
import { TEAM_THEME, type Team } from '../_lib/teams';

/**
 * One tug-of-war figure, pure SVG (docs/GAMES.md). Drawn FACING RIGHT with
 * feet at (0,0); Red figures are mirrored by the parent.
 *
 * Rig (all pivots are transforms, so every animation is cheap):
 *   body   — whole figure, pivots at the feet (lurch, fall, hop)
 *   legs   — each pivots at the hip (backward steps, skids)
 *   torso  — upper body, pivots at the hip (lean)
 *   face   — swaps expression per pose (strain / surprised / happy / sad)
 *
 * Pivots: framer rotates SVG groups around their bounding box, so each pivot
 * group carries an invisible <Pivot> box centered EXACTLY on its joint and
 * uses origin 50%/50% — adding art can never shift a joint.
 *
 * Arms are drawn so the hands sit ON the rope at the base lean — the rope
 * height in RopeArena (GROUND − 64) depends on this geometry.
 *
 * This component is the fallback/placeholder for designer art: the `Pose`
 * contract below is exactly what a Rive state machine must accept
 * (docs/GAMES.md → "Designer brief").
 */

export type Pose = 'stand' | 'idle' | 'heave' | 'lurch' | 'droop' | 'fall' | 'cheer';
type Face = 'calm' | 'strain' | 'surprised' | 'happy' | 'sad';

const SKIN = '#f1c27d';
const SKIN_SHADE = '#e0a96a';
const PANTS = '#3b4660';
const SHOE = '#232a3a';
const CAP = '#1f2937';
const INK = '#2b2b33';

const FACE: Record<Pose, Face> = {
  stand: 'calm', idle: 'strain', heave: 'strain', lurch: 'surprised', droop: 'sad', fall: 'sad', cheer: 'happy',
};

/** Upper-body lean in degrees (negative = leaning back, away from the rope). */
const LEAN: Record<Pose, number> = {
  stand: -17, idle: -26, heave: -42, lurch: -19, droop: -17, fall: -20, cheer: 6,
};

interface Props {
  team: Team;
  pose: Pose;
  /** Second puller is a shade darker so the pair reads as two people. */
  back?: boolean;
  /** Seconds — staggers loops so a team never moves in lockstep. */
  delay?: number;
  animate: boolean;
}

function FaceFeatures({ face }: { face: Face }) {
  // Profile facing right, head center (4,-111) r14: eye ≈ (11,-114), mouth ≈ (13,-102).
  switch (face) {
    case 'strain':
      return (
        <g>
          <path d="M7 -119.5 L14 -117" stroke={INK} strokeWidth={1.9} strokeLinecap="round" />
          <path d="M8.5 -114 L13.5 -113.4" stroke={INK} strokeWidth={2} strokeLinecap="round" />
          <path d="M10 -103 h6" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
          <path d="M10.6 -103 h4.8" stroke="#fff" strokeWidth={0.9} strokeLinecap="round" />
        </g>
      );
    case 'surprised':
      return (
        <g>
          <path d="M7.5 -121 L14 -121.3" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={11} cy={-114.5} r={2.2} fill="#fff" stroke={INK} strokeWidth={1.1} />
          <circle cx={11.6} cy={-114.3} r={0.95} fill={INK} />
          <ellipse cx={13.2} cy={-102.5} rx={2.1} ry={2.6} fill={INK} />
        </g>
      );
    case 'happy':
      return (
        <g>
          <path d="M8 -113.5 Q11 -117 14 -113.5" fill="none" stroke={INK} strokeWidth={1.9} strokeLinecap="round" />
          <path d="M8.5 -104.5 Q12.8 -98.5 17 -104.5 Z" fill={INK} />
          <path d="M10.2 -103.4 Q12.8 -101.4 15.3 -103.4" fill="none" stroke="#e05d5d" strokeWidth={1.3} strokeLinecap="round" />
        </g>
      );
    case 'sad':
      return (
        <g>
          <path d="M7.5 -117 L13 -119" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={11} cy={-113.6} r={1.5} fill={INK} />
          <path d="M9.5 -100.8 Q12.8 -104 16 -100.8" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <circle cx={11} cy={-113.8} r={1.6} fill={INK} />
          <path d="M9.6 -103.6 Q12.8 -100.6 15.6 -103.6" fill="none" stroke={INK} strokeWidth={1.7} strokeLinecap="round" />
        </g>
      );
  }
}

/** Invisible box centered on (cx, cy) — makes that point the group's center. */
const Pivot = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill="none" pointerEvents="none" />
);
const CENTER = { originX: 0.5, originY: 0.5 };

export default function Puller({ team, pose, back = false, delay = 0, animate }: Props) {
  const th = TEAM_THEME[team];
  const shirt = back ? th.shade : th.solid;
  const lean = LEAN[pose];

  // ── whole body (pivot: feet) ──
  let body: TargetAndTransition = { x: 0, y: 0, rotate: 0 };
  let bodyT: Transition = { type: 'spring', stiffness: 260, damping: 22 };
  if (pose === 'heave') { body = { x: [0, -15, -8], y: [0, -3, 0], rotate: [0, -6, -3] }; bodyT = { duration: 0.42, ease: 'easeOut' }; }
  if (pose === 'lurch') { body = { x: [0, 17, 10], y: [0, -4, 0], rotate: [0, 9, 4] }; bodyT = { duration: 0.45, ease: 'easeOut' }; }
  if (pose === 'fall') { body = { x: 30, y: 6, rotate: 64 }; bodyT = { duration: 0.75, ease: [0.5, 0, 0.75, 0], delay: delay * 0.6 }; }
  if (pose === 'cheer') { body = { x: 0, y: [0, -16, 0], rotate: 0 }; bodyT = { duration: 0.5, repeat: Infinity, repeatDelay: 0.3, ease: 'easeOut', delay }; }
  if (pose === 'droop') { body = { x: 0, y: 2, rotate: 0 }; bodyT = { duration: 0.3 }; }

  // ── legs (pivot: hip) — heave = two quick backward steps, lurch = skid ──
  let backLeg: TargetAndTransition = { rotate: 0 };
  let frontLeg: TargetAndTransition = { rotate: 0 };
  let legT: Transition = { type: 'spring', stiffness: 300, damping: 20 };
  if (pose === 'heave') {
    backLeg = { rotate: [0, 20, 2, 0] };
    frontLeg = { rotate: [0, 0, 12, 0] };
    legT = { duration: 0.45, ease: 'easeInOut' };
  } else if (pose === 'lurch') {
    backLeg = { rotate: [0, -10, -4] };
    frontLeg = { rotate: [0, -16, -8] };
    legT = { duration: 0.45, ease: 'easeOut' };
  } else if (pose === 'cheer') {
    backLeg = { rotate: [0, 10, 0] };
    frontLeg = { rotate: [0, -10, 0] };
    legT = { duration: 0.5, repeat: Infinity, repeatDelay: 0.3, delay };
  } else if (pose === 'idle' && animate) {
    // Constant brace shuffle — feet dig in, never glued.
    backLeg = { rotate: [0, 6, -1, 0] };
    frontLeg = { rotate: [0, -3, 2, 0] };
    legT = { duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.15 };
  }

  // ── torso (pivot: hip); idle = energetic tug rhythm around the base lean ──
  const torso: TargetAndTransition =
    pose === 'idle' && animate ? { rotate: [lean, lean - 6, lean + 1.5, lean] } : { rotate: lean };
  const torsoT: Transition =
    pose === 'idle' && animate
      ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay }
      : { type: 'spring', stiffness: 420, damping: 18 };

  const still = { duration: 0 };

  return (
    <g>
      {/* ground shadow (doesn't move with the body) */}
      <ellipse cx={6} cy={1} rx={30} ry={4.5} fill="#000" opacity={0.12} />

      <motion.g
        initial={false}
        animate={animate ? body : { x: 0, y: 0, rotate: pose === 'fall' ? 64 : 0 }}
        transition={animate ? bodyT : still}
        style={CENTER}
      >
        <Pivot cx={6} cy={0} r={150} />
        {/* back leg — bent, pushing */}
        <motion.g initial={false} animate={animate ? backLeg : { rotate: 0 }} transition={animate ? legT : still} style={CENTER}>
          <Pivot cx={-2} cy={-52} r={60} />
          <path d="M-2 -52 L-8 -27 L-24 -4" fill="none" stroke={PANTS} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M-31 -2 Q-25 -8 -17 -4 L-15 0 L-31 0 Z" fill={SHOE} />
        </motion.g>
        {/* front leg — straight, braced toward the rope */}
        <motion.g initial={false} animate={animate ? frontLeg : { rotate: 0 }} transition={animate ? legT : still} style={CENTER}>
          <Pivot cx={2} cy={-52} r={60} />
          <path d="M2 -52 L18 -28 L33 -4" fill="none" stroke={PANTS} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M28 -4 Q36 -9 43 -3 L43 0 L28 0 Z" fill={SHOE} />
        </motion.g>

        {/* upper body pivots at the hip */}
        <motion.g
          initial={false}
          animate={animate ? torso : { rotate: lean }}
          transition={animate ? torsoT : still}
          style={CENTER}
        >
          <Pivot cx={0} cy={-52} r={90} />
          {/* back arm (behind torso) */}
          <path d="M3 -88 L22 -66 L38 -47" fill="none" stroke={shirt} strokeWidth={9.5} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={38} cy={-47} r={5} fill={SKIN_SHADE} />
          {/* torso: chapan-style shirt with a collar and belt */}
          <rect x={-13} y={-98} width={27} height={52} rx={12} fill={shirt} />
          <path d="M-1 -98 L4 -84 L9 -98" fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={2} strokeLinejoin="round" />
          <path d="M-12 -70 h25" stroke="#fff" strokeOpacity={0.18} strokeWidth={3} />
          <rect x={-13} y={-56} width={27} height={5} rx={2.5} fill={th.deep} opacity={0.7} />
          {/* neck + head */}
          <rect x={0} y={-102} width={8} height={8} rx={3} fill={SKIN_SHADE} />
          <circle cx={4} cy={-111} r={14} fill={SKIN} />
          <ellipse cx={-2.5} cy={-110} rx={2.6} ry={3.4} fill={SKIN_SHADE} />
          <FaceFeatures face={FACE[pose]} />
          {/* doppi cap with a white motif */}
          <path d="M-10.5 -117 L-9.5 -128.5 Q4 -132.5 17.5 -128.5 L18.5 -117 Q4 -120.5 -10.5 -117 Z" fill={CAP} />
          <path d="M-5.5 -122.5 l2.5 -2.5 l2.5 2.5 l-2.5 2.5 Z M2.5 -123.5 l2.5 -2.5 l2.5 2.5 l-2.5 2.5 Z M10.5 -122.5 l2.5 -2.5 l2.5 2.5 l-2.5 2.5 Z" fill="#fff" opacity={0.85} />
          {/* front arm — straight to the rope */}
          <path d="M7 -89 L26 -66 L42 -46" fill="none" stroke={shirt} strokeWidth={9.5} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={42} cy={-46} r={5.5} fill={SKIN} />
        </motion.g>
      </motion.g>
    </g>
  );
}
