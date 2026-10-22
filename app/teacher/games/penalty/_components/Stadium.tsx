'use client';

import { motion } from 'framer-motion';
import { GAME_TEAMS } from '../../_lib/stage';
import { ZONE_COUNT, type Phase, type Shot } from '../_lib/engine';
import { CROWD_NEUTRALS, PITCH } from '../_lib/theme';
import Keeper, { type KeeperMove } from './Keeper';
import Kicker, { RUN_UP } from './Kicker';

/**
 * The penalty scene as one SVG (viewBox 1600 × 700, camera behind the
 * kicker). Background layers reach past the viewBox (`overflow: visible`)
 * so any screen shape is filled. Presentational: the engine decides the
 * shot; this only plays it. Timeline of a kick (seconds):
 *   0 → RUN            kicker runs up
 *   RUN → +FLIGHT      ball flies, keeper dives
 *   KICK_MS            the page records the kick (phase 'result')
 */

const RUN = 0.45;
const FLIGHT = 0.5;
/** Kick timing for the page: boot meets ball (sound), and when to record the kick. */
export const KICK_MS = { impact: RUN * 1000, animated: 1400, still: 500 };

/** Goal mouth (front frame) and the back of the net, seen in perspective. */
const GOAL = { left: 520, right: 1080, top: 100, line: 360 };
const NET_BACK = { left: 558, right: 1042, top: 122, bottom: 338 };
const SPOT = { x: 800, y: 600 };
const KEEPER_AT = { x: 800, y: 358, scale: 0.82 };
/** Kicker's start mark; the run-up ends just left of the ball. */
const KICKER_AT = { x: SPOT.x - 60 - RUN_UP.x, y: 700 };

/** Aim zone centers, in ZONE order: top-left, bottom-left, center (over the keeper), bottom-right, top-right. */
const ZONES = [
  { x: 615, y: 165 }, { x: 615, y: 300 }, { x: 800, y: 150 }, { x: 985, y: 300 }, { x: 985, y: 165 },
];
const ZONE_R = 42;
const CENTER_ZONE = 2;
/** Where a saved center shot ends: the keeper's chest after his small hop. */
const KEEPER_CHEST = { x: KEEPER_AT.x, y: KEEPER_AT.y + KEEPER_AT.scale * (-120 - 10) };

/** Stands: rows of fans in both teams' colors and neutrals (fixed pattern), filling up past the top edge. */
const CROWD = (() => {
  const colors = [GAME_TEAMS[0].solid, GAME_TEAMS[1].solid, ...CROWD_NEUTRALS];
  const fans: { x: number; y: number; color: string }[] = [];
  for (let row = 0; row < 17; row++) {
    for (let i = 0; i < 86; i++) {
      // Fixed pseudo-random pick, so the colors mix instead of forming stripes.
      const pick = Math.floor(Math.abs(Math.sin(i * 12.9898 + row * 78.233) * 43758.5453)) % colors.length;
      fans.push({ x: -300 + i * 26 + (row % 2) * 13, y: 250 - row * 26, color: colors[pick] });
    }
  }
  return fans;
})();

/** Mowing stripes that widen toward the camera. */
const STRIPES = (() => {
  const bands: { y: number; h: number }[] = [];
  let y = 300;
  let h = 22;
  for (let i = 0; y < 1600; i++) {
    if (i % 2 === 1) bands.push({ y, h });
    y += h;
    h *= 1.25;
  }
  return bands;
})();

/**
 * Ball + shadow keyframes (relative to the spot) for each kind of shot.
 * Every array has one value per entry of `times`.
 */
function ballPath(shot: Shot, aimZone: number | null, side: number) {
  if (shot === 'miss' || aimZone === null) {
    // Wrong answer: high over the bar, off to one side.
    return {
      times: [0, 0.5, 1],
      duration: FLIGHT + 0.1,
      ball: { x: [0, side * 90, side * 170], y: [0, -300, -640], scale: [1, 0.65, 0.4], opacity: [1, 1, 0], rotate: [0, 300, 600] },
      shadow: { x: [0, side * 90, side * 170], y: [0, -150, -260], scale: [1, 0.7, 0.4], opacity: [1, 0.5, 0] },
    };
  }
  if (shot === 'saved') {
    const end = aimZone === CENTER_ZONE ? KEEPER_CHEST : ZONES[aimZone];
    const dx = end.x - SPOT.x;
    const dy = end.y - SPOT.y;
    // Into the keeper's gloves, and it stays there.
    return {
      times: [0, 0.5, 1],
      duration: FLIGHT,
      ball: { x: [0, dx * 0.55, dx], y: [0, dy * 0.55 - 70, dy], scale: [1, 0.75, 0.55], opacity: [1, 1, 1], rotate: [0, 300, 520] },
      shadow: { x: [0, dx * 0.55, dx], y: [0, -130, -245], scale: [1, 0.75, 0.5], opacity: [1, 0.8, 0.5] },
    };
  }
  // Goal: into the zone, then a little deeper into the net.
  const dx = ZONES[aimZone].x - SPOT.x;
  const dy = ZONES[aimZone].y - SPOT.y;
  return {
    times: [0, 0.45, 0.85, 1],
    duration: FLIGHT,
    ball: { x: [0, dx * 0.55, dx, dx * 0.96], y: [0, dy * 0.55 - 70, dy, dy + 14], scale: [1, 0.75, 0.55, 0.48], opacity: [1, 1, 1, 1], rotate: [0, 270, 510, 600] },
    shadow: { x: [0, dx * 0.55, dx, dx * 0.96], y: [0, -135, -245, -250], scale: [1, 0.75, 0.5, 0.45], opacity: [1, 0.8, 0.5, 0.4] },
  };
}

/** A classic black-and-white ball of radius 22 around (0, 0). */
export function Ball() {
  return (
    <>
      <circle r={22} fill={PITCH.ball} stroke={PITCH.ballPatch} strokeWidth={2.5} />
      <path d="M0 -8 L7.6 -2.5 L4.7 6.5 L-4.7 6.5 L-7.6 -2.5 Z" fill={PITCH.ballPatch} />
      <path d="M0 -8 V-21 M7.6 -2.5 L19 -7 M4.7 6.5 L12 17 M-4.7 6.5 L-12 17 M-7.6 -2.5 L-19 -7" stroke={PITCH.ballPatch} strokeWidth={2.5} />
    </>
  );
}

interface Props {
  phase: Phase;
  shot: Shot | null;
  aimZone: number | null;
  keeperZone: number | null;
  /** Number of the kick (even/odd picks the side a missed ball flies to). */
  kickNo: number;
  kickerColor: string;
  keeperColor: string;
  /** Zones take taps (aim phase, no dialog open). */
  canAim: boolean;
  onAim: (zone: number) => void;
  zoneLabels: string[];
  animate: boolean;
}

export default function Stadium({
  phase, shot, aimZone, keeperZone, kickNo, kickerColor, keeperColor, canAim, onAim, zoneLabels, animate,
}: Props) {
  const d = (s: number) => (animate ? s : 0);
  const flying = (phase === 'kick' || phase === 'result') && shot !== null;
  const scored = phase === 'result' && shot === 'goal';
  const path = flying ? ballPath(shot, aimZone, kickNo % 2 ? 1 : -1) : null;
  const flight = path && { duration: d(path.duration), delay: d(RUN), times: path.times, ease: 'linear' as const };
  const keeperMove: KeeperMove =
    phase === 'aim' ? 'sway' : flying ? (shot === 'miss' ? 'watch' : 'dive') : 'idle';
  const frame = `M${GOAL.left} ${GOAL.line} V${GOAL.top} H${GOAL.right} V${GOAL.line}`;

  return (
    <svg viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }}>
      <defs>
        <pattern id="pk-net" width={22} height={22} patternUnits="userSpaceOnUse">
          <path d="M22 0 L0 0 0 22" fill="none" stroke={PITCH.net} strokeWidth={1.6} />
        </pattern>
        <linearGradient id="pk-stands-fade" gradientUnits="userSpaceOnUse" x1={0} y1={-220} x2={0} y2={262}>
          <stop offset={0} stopColor={PITCH.standsTop} stopOpacity={0.95} />
          <stop offset={1} stopColor={PITCH.standsTop} stopOpacity={0.2} />
        </linearGradient>
        <radialGradient id="pk-vignette" gradientUnits="userSpaceOnUse" cx={800} cy={330} r={1050}>
          <stop offset={0.55} stopColor={PITCH.vignette} stopOpacity={0} />
          <stop offset={1} stopColor={PITCH.vignette} />
        </radialGradient>
      </defs>

      {/* stands: crowd (jumps on a goal), tier lines, darker toward the roof */}
      <rect x={-2000} y={-1600} width={5600} height={1900} fill={PITCH.stands} />
      <motion.g animate={{ y: scored && animate ? [0, -12, 0, -12, 0] : 0 }} transition={{ duration: 1.2 }}>
        {CROWD.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r={8.5} fill={f.color} />)}
      </motion.g>
      {/* aisles between rows 2–3, 8–9, 14–15 */}
      {[182, 26, -130].map((y) => <rect key={y} x={-2000} y={y} width={5600} height={7} fill={PITCH.tierLine} />)}
      <rect x={-2000} y={-1600} width={5600} height={1862} fill="url(#pk-stands-fade)" />
      <rect x={-2000} y={-1600} width={5600} height={1380} fill={PITCH.standsTop} />

      {/* LED board behind the goal */}
      <rect x={-2000} y={262} width={5600} height={38} fill={PITCH.board} />
      <g fill={PITCH.boardText} fontSize={20} fontWeight={800} letterSpacing={8}>
        {Array.from({ length: 10 }, (_, i) => <text key={i} x={-260 + i * 240} y={288}>EDIFY</text>)}
      </g>

      {/* pitch: stripes + lines */}
      <rect x={-2000} y={300} width={5600} height={2400} fill={PITCH.grass} />
      {STRIPES.map((b) => <rect key={b.y} x={-2000} y={b.y} width={5600} height={b.h} fill={PITCH.grassDark} />)}
      <g fill="none" stroke={PITCH.line} strokeWidth={5} opacity={0.9}>
        <line x1={-2000} y1={GOAL.line} x2={3600} y2={GOAL.line} />
        <polyline points="470,360 440,430 1160,430 1130,360" />
        <polyline points="260,360 150,670 1450,670 1340,360" />
        <path d="M700 670 Q800 735 900 670" />
      </g>
      <ellipse cx={SPOT.x} cy={SPOT.y + 16} rx={9} ry={4} fill={PITCH.line} />

      {/* goal: 3D net (ripples on a goal) + frame */}
      <motion.g
        animate={{ scale: scored && animate ? [1, 1.04, 0.99, 1] : 1 }}
        transition={{ duration: 0.6, delay: 0.05 }}
        style={{ originX: 0.5, originY: 0.5 }}
      >
        {[
          // back, roof, left side, right side
          { points: `${NET_BACK.left},${NET_BACK.top} ${NET_BACK.right},${NET_BACK.top} ${NET_BACK.right},${NET_BACK.bottom} ${NET_BACK.left},${NET_BACK.bottom}`, fill: PITCH.netBack },
          { points: `${GOAL.left},${GOAL.top} ${GOAL.right},${GOAL.top} ${NET_BACK.right},${NET_BACK.top} ${NET_BACK.left},${NET_BACK.top}`, fill: PITCH.netSide },
          { points: `${GOAL.left},${GOAL.top} ${NET_BACK.left},${NET_BACK.top} ${NET_BACK.left},${NET_BACK.bottom} ${GOAL.left},${GOAL.line}`, fill: PITCH.netSide },
          { points: `${GOAL.right},${GOAL.top} ${NET_BACK.right},${NET_BACK.top} ${NET_BACK.right},${NET_BACK.bottom} ${GOAL.right},${GOAL.line}`, fill: PITCH.netSide },
        ].map((panel) => (
          <g key={panel.points}>
            <polygon points={panel.points} fill={panel.fill} />
            <polygon points={panel.points} fill="url(#pk-net)" />
          </g>
        ))}
        <polyline
          points={`${GOAL.left},${GOAL.line} ${NET_BACK.left},${NET_BACK.bottom} ${NET_BACK.right},${NET_BACK.bottom} ${GOAL.right},${GOAL.line}`}
          fill="none" stroke={PITCH.net} strokeWidth={3}
        />
      </motion.g>
      <ellipse cx={GOAL.left} cy={GOAL.line + 2} rx={22} ry={5} fill={PITCH.shadow} />
      <ellipse cx={GOAL.right} cy={GOAL.line + 2} rx={22} ry={5} fill={PITCH.shadow} />
      <path d={frame} fill="none" stroke={PITCH.postShade} strokeWidth={18} strokeLinejoin="round" transform="translate(5 4)" />
      <path d={frame} fill="none" stroke={PITCH.post} strokeWidth={16} strokeLinejoin="round" />

      {/* keeper */}
      <g transform={`translate(${KEEPER_AT.x} ${KEEPER_AT.y}) scale(${KEEPER_AT.scale})`}>
        <Keeper color={keeperColor} move={keeperMove} zone={keeperZone} delay={RUN + 0.05} animate={animate} />
      </g>

      {/* ball + its shadow (snap back to the spot when the next question opens) */}
      <g transform={`translate(${SPOT.x} ${SPOT.y})`}>
        <motion.ellipse
          cx={0} cy={16} rx={26} ry={8} fill={PITCH.shadow}
          animate={path ? path.shadow : { x: 0, y: 0, scale: 1, opacity: 1 }}
          transition={flight ?? { duration: 0 }}
        />
        <motion.g animate={path ? path.ball : { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }} transition={flight ?? { duration: 0 }}>
          <Ball />
        </motion.g>
      </g>

      {/* kicker (closest to the camera) */}
      <g transform={`translate(${KICKER_AT.x} ${KICKER_AT.y})`}>
        <Kicker color={kickerColor} kicking={flying} cheering={scored} runSeconds={RUN} animate={animate} />
      </g>

      <rect x={-2000} y={-1600} width={5600} height={4000} fill="url(#pk-vignette)" pointerEvents="none" />

      {/* aim zones: target rings with a ripple, over everything */}
      {phase === 'aim' && ZONES.slice(0, ZONE_COUNT).map((zone, z) => (
        <g key={z} transform={`translate(${zone.x} ${zone.y})`}>
          <motion.g
            role="button"
            aria-label={zoneLabels[z]}
            onClick={canAim ? () => onAim(z) : undefined}
            style={{ cursor: canAim ? 'pointer' : 'default', originX: 0.5, originY: 0.5 }}
            initial={animate ? { scale: 0, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18, delay: d(z * 0.05) }}
            whileHover={canAim && animate ? { scale: 1.12 } : undefined}
            whileTap={canAim && animate ? { scale: 0.92 } : undefined}
          >
            {animate && (
              <motion.circle
                r={ZONE_R} fill="none" stroke={PITCH.line} strokeWidth={3}
                animate={{ scale: [1, 1.4], opacity: [0.7, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: z * 0.18, ease: 'easeOut' }}
                style={{ originX: 0.5, originY: 0.5 }}
              />
            )}
            <circle r={ZONE_R} fill={PITCH.line} fillOpacity={0.16} stroke={PITCH.line} strokeWidth={4} />
            <circle r={20} fill={kickerColor} stroke={PITCH.line} strokeWidth={3} />
            <text y={8} textAnchor="middle" fontSize={22} fontWeight={900} fill={PITCH.line}>{z + 1}</text>
          </motion.g>
        </g>
      ))}
    </svg>
  );
}
