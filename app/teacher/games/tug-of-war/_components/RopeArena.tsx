'use client';

import { motion } from 'framer-motion';
import Puller, { type Pose } from './Puller';
import { FIELD, TEAM_THEME, TEAMS, type Team } from '../_lib/teams';
import { WIN_STEPS, type GameState } from '../_lib/engine';

/**
 * The center stage (docs/GAMES.md): two pullers per team on one rope over an
 * oval mat. The rope + all four figures move as ONE spring-driven group so
 * the tug reads physically; while playing, an inner group sways (the
 * struggle). Every pose/rope state is DERIVED from engine state (`clock`,
 * `lastPullAt`, counters) — one-shot effects remount by key, no timers.
 */

// World geometry. The viewBox is cropped tight around the action (incl. the
// max win shift) so the figures render as big as the panel allows.
const CX = 400;
const GROUND = 290;
const STEP = 18;
const ROPE_Y = GROUND - 65; // hand height of Puller at its base lean
const VIEW = { x: 120, y: 120, w: 560, h: 202 };
const HEAVE_MS = 480;
const TAUT_MS = 750;

const FIGURES: { team: Team; x: number; back: boolean; delay: number }[] = [
  { team: 'blue', x: 262, back: true, delay: 0.2 },
  { team: 'blue', x: 330, back: false, delay: 0 },
  { team: 'red', x: 538, back: true, delay: 0.65 },
  { team: 'red', x: 470, back: false, delay: 0.45 },
];
const BACK_HAND = { blue: 302, red: 498 };
const FEET = { blue: [238, 306], red: [562, 494] };

const other = (t: Team): Team => (t === 'blue' ? 'red' : 'blue');
const mirrorX = (x: number) => 2 * CX - x;

function poseFor(team: Team, s: GameState): Pose {
  if (s.status === 'countdown' || s.status === 'paused') return 'stand';
  if (s.status === 'finished') {
    if (s.winner === 'draw' || !s.winner) return 'stand';
    return s.winner === team ? 'cheer' : 'fall';
  }
  const since = (t: Team) => (s.lastPullAt[t] ? s.clock - s.lastPullAt[t] : Infinity);
  if (since(team) < HEAVE_MS) return 'heave';
  if (since(other(team)) < HEAVE_MS) return 'lurch';
  if (s.sides[team].feedback?.kind === 'wrong') return 'droop';
  return 'idle';
}

/** Rope tail lying on the mat behind the back puller (blue side; red mirrors). */
function tailPath(team: Team) {
  const dx = BACK_HAND.blue - 270;
  const pts = [
    [270, ROPE_Y], [236, ROPE_Y + 1], [222, GROUND - 34], [206, GROUND - 6],
    [168, GROUND - 1], [128, GROUND - 3], [96, GROUND - 6], [62, GROUND - 2],
  ].map(([x, y]) => [team === 'blue' ? x + dx : mirrorX(x + dx), y]);
  const p = (i: number) => `${pts[i][0]} ${pts[i][1]}`;
  return `M${p(0)} C ${p(1)}, ${p(2)}, ${p(3)} S ${p(4)}, ${p(5)} S ${p(6)}, ${p(7)}`;
}

const ropePath = (sag: number) =>
  `M${BACK_HAND.blue} ${ROPE_Y} Q ${CX} ${ROPE_Y + sag} ${BACK_HAND.red} ${ROPE_Y}`;

interface Props {
  state: GameState;
  animate: boolean;
}

export default function RopeArena({ state, animate }: Props) {
  const { rope, status, winner, pulls } = state;
  const totalPulls = pulls.blue + pulls.red;
  const playing = status === 'playing';

  // Final drag past the win line for the winner.
  const overshoot = status === 'finished' && winner && winner !== 'draw' && state.finishReason === 'rope'
    ? (winner === 'blue' ? -1 : 1) * STEP * 0.7
    : 0;
  const groupX = rope * STEP + overshoot;

  // Taut right after a pull; slack when paused/standing.
  const lastPull = Math.max(state.lastPullAt.blue, state.lastPullAt.red);
  const taut = playing && lastPull > 0 && state.clock - lastPull < TAUT_MS;
  const sag = playing ? (taut ? 1 : 5) : 11;
  const ropeT = animate ? { type: 'spring' as const, stiffness: 300, damping: 16 } : { duration: 0 };

  return (
    <svg
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full select-none"
      role="img"
      aria-label="Arqon tortish"
    >
      {/* Oval grass mat */}
      <ellipse cx={CX} cy={GROUND + 9} rx={276} ry={24} fill={FIELD.grass} />
      <ellipse cx={CX} cy={GROUND + 7} rx={262} ry={18} fill="none" stroke={FIELD.grassRing} strokeWidth={1.5} />

      {/* Center line (fixed) */}
      <line x1={CX} x2={CX} y1={VIEW.y + 4} y2={GROUND + 28} stroke="var(--m3-outline)" strokeWidth={2} strokeDasharray="5 8" strokeLinecap="round" opacity={0.5} />

      {/* Step dots + win markers on the mat (fixed) */}
      {TEAMS.map((team) => {
        const dir = team === 'blue' ? -1 : 1;
        const winX = CX + dir * WIN_STEPS * STEP;
        const leading = rope !== 0 && (rope < 0 ? 'blue' : 'red') === team;
        const danger = playing && leading && Math.abs(rope) >= WIN_STEPS - 1;
        return (
          <g key={team}>
            {Array.from({ length: WIN_STEPS - 1 }, (_, i) => (
              <circle key={i} cx={CX + dir * (i + 1) * STEP} cy={GROUND + 18} r={2} fill={FIELD.grassDot} opacity={0.7} />
            ))}
            <motion.g
              initial={false}
              animate={danger && animate ? { opacity: [0.55, 1, 0.55], scale: [1, 1.25, 1] } : { opacity: 0.8, scale: 1 }}
              transition={danger && animate ? { duration: 0.7, repeat: Infinity } : { duration: 0.2 }}
              style={{ originX: 0.5, originY: 0.5 }}
            >
              <line x1={winX} x2={winX} y1={GROUND + 4} y2={GROUND + 30} stroke={TEAM_THEME[team].solid} strokeWidth={3} strokeLinecap="round" />
              <path d={`M${winX} ${GROUND + 4} l${dir * 13} 4.5 l${-dir * 13} 4.5 Z`} fill={TEAM_THEME[team].solid} />
            </motion.g>
          </g>
        );
      })}

      {/* Rope + pullers move together (spring to the rope position) */}
      <motion.g
        initial={false}
        animate={{ x: groupX }}
        transition={animate ? { type: 'spring', stiffness: 240, damping: 20, mass: 1.1 } : { duration: 0.15 }}
      >
        {/* …and sway inside it while playing: the struggle never stops */}
        <motion.g
          initial={false}
          animate={animate && playing ? { x: [0, -3, 2.5, -1.5, 0] } : { x: 0 }}
          transition={animate && playing ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        >
          {/* Rope tails on the mat */}
          {TEAMS.map((team) => (
            <g key={`tail-${team}`}>
              <path d={tailPath(team)} fill="none" stroke="#a87f48" strokeWidth={6} strokeLinecap="round" />
              <path d={tailPath(team)} fill="none" stroke="#7a5a30" strokeWidth={6} strokeDasharray="3 6" strokeLinecap="round" opacity={0.5} />
            </g>
          ))}

          {/* Main rope — tightens on a pull and shakes once (remount per pull),
              with a constant tension tremor while playing. */}
          <motion.g
            key={`shake-${totalPulls}`}
            initial={false}
            animate={animate && totalPulls > 0 ? { y: [0, -4, 3, -1.6, 0.7, 0] } : { y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <motion.g
              initial={false}
              animate={animate && playing ? { y: [0, 0.8, -0.6, 0] } : { y: 0 }}
              transition={animate && playing ? { duration: 0.35, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
            >
              <motion.path initial={false} animate={{ d: ropePath(sag) }} transition={ropeT}
                fill="none" stroke="#b08850" strokeWidth={6.5} strokeLinecap="round" />
              <motion.path initial={false} animate={{ d: ropePath(sag) }} transition={ropeT}
                fill="none" stroke="#7d5f35" strokeWidth={6.5} strokeDasharray="3 6" strokeLinecap="round" opacity={0.55} />
            </motion.g>
          </motion.g>

          {/* Pullers */}
          {FIGURES.map((f) => (
            <g key={`${f.team}-${f.x}`} transform={f.team === 'blue' ? `translate(${f.x} ${GROUND})` : `translate(${f.x} ${GROUND}) scale(-1 1)`}>
              <Puller team={f.team} back={f.back} delay={f.delay} pose={poseFor(f.team, state)} animate={animate} />
            </g>
          ))}

          {/* One-shot pull effects: dust behind the pullers, skid dust at the
              dragged team's feet, speed streaks and a floating +1. */}
          {animate && TEAMS.map((team) => pulls[team] > 0 && (
            <g key={`fx-${team}-${pulls[team]}`}>
              {FEET[team].map((x, i) => {
                const dir = team === 'blue' ? -1 : 1;
                return (
                  <motion.circle
                    key={`p${i}`}
                    cx={x} cy={GROUND - 3} r={6.5}
                    fill="var(--m3-outline)"
                    initial={{ opacity: 0.55, scale: 0.4, x: 0, y: 0 }}
                    animate={{ opacity: 0, scale: 1.9, x: dir * 20, y: -10 }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }}
                  />
                );
              })}
              {FEET[other(team)].map((x, i) => {
                const dir = team === 'blue' ? -1 : 1;
                return (
                  <motion.circle
                    key={`s${i}`}
                    cx={x + dir * 30} cy={GROUND - 2} r={4.5}
                    fill="var(--m3-outline)"
                    initial={{ opacity: 0.45, scale: 0.5, x: 0 }}
                    animate={{ opacity: 0, scale: 1.5, x: dir * 24 }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.08 + i * 0.05 }}
                  />
                );
              })}
              {[0, 1, 2].map((i) => {
                const dir = team === 'blue' ? -1 : 1;
                const x0 = (team === 'blue' ? FIGURES[0].x : FIGURES[2].x) + dir * 34;
                const y0 = GROUND - 95 + i * 16;
                return (
                  <motion.line
                    key={`l${i}`}
                    x1={x0} x2={x0 + dir * 22} y1={y0} y2={y0}
                    stroke={TEAM_THEME[team].solid} strokeWidth={3} strokeLinecap="round"
                    initial={{ opacity: 0.85, x: 0 }}
                    animate={{ opacity: 0, x: dir * 18 }}
                    transition={{ duration: 0.45, ease: 'easeOut', delay: i * 0.04 }}
                  />
                );
              })}
              <motion.text
                x={team === 'blue' ? FIGURES[1].x : FIGURES[3].x}
                y={GROUND - 138}
                textAnchor="middle"
                fontSize={22} fontWeight={900}
                fill={TEAM_THEME[team].solid}
                initial={{ opacity: 0, y: 8, scale: 0.6 }}
                animate={{ opacity: [0, 1, 1, 0], y: [8, -6, -14, -24], scale: [0.6, 1.15, 1, 1] }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                style={{ originX: 0.5, originY: 0.5 }}
              >
                +1
              </motion.text>
            </g>
          ))}

          {/* Center ribbon — swings on every pull */}
          <motion.g
            key={`ribbon-${totalPulls}`}
            initial={animate && totalPulls > 0 ? { rotate: rope <= 0 ? 26 : -26 } : false}
            animate={{ rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 7 }}
            style={{ originX: 0.5, originY: 0 }}
          >
            <path d={`M${CX - 2} ${ROPE_Y + 5} L${CX - 11} ${ROPE_Y + 36} L${CX - 1} ${ROPE_Y + 28} Z`} fill="#f59e0b" />
            <path d={`M${CX + 2} ${ROPE_Y + 5} L${CX + 12} ${ROPE_Y + 34} L${CX + 2} ${ROPE_Y + 27} Z`} fill="#d97706" />
            <circle cx={CX} cy={ROPE_Y + 4} r={7} fill="#f59e0b" stroke="#b45309" strokeWidth={2} />
          </motion.g>
        </motion.g>
      </motion.g>
    </svg>
  );
}
