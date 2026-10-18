"use client";

import { motion } from "framer-motion";
import { Check, Zap } from "lucide-react";

import Puller from "../tug-of-war/_components/Puller";
import { FIELD } from "../tug-of-war/_lib/teams";

/**
 * Animated card scenes for the games hub (docs/GAMES.md). Each fills its
 * parent box. `on = false` (motion off / reduced motion) renders a still frame.
 * Colors come from M3 tokens so every palette and dark mode work; only the
 * tug scene reuses the game's own fixed FIELD look.
 */

export type GameArtKey = "tug" | "quiz" | "board" | "wheel";

const loop = (duration: number, extra: object = {}) => ({ duration, repeat: Infinity, ease: "easeInOut" as const, ...extra });

/** Arqon tortish: the real game's figures on the sky + grass field. */
function TugArt({ on }: { on: boolean }) {
  const GROUND = 150;
  const S = 0.66;
  const ROPE = GROUND - 65 * S;
  return (
    <div className="h-full w-full" style={{ background: FIELD.sky }}>
      <svg viewBox="0 0 320 180" className="h-full w-full" aria-hidden>
        <ellipse cx={160} cy={GROUND + 4} rx={150} ry={20} fill={FIELD.grass} stroke={FIELD.grassRing} strokeWidth={2} />
        <line x1={160} x2={160} y1={GROUND - 10} y2={GROUND + 14} stroke="#ffffff" strokeWidth={2} strokeDasharray="3 4" opacity={0.8} />
        <motion.g animate={on ? { x: [-5, 5, -5] } : undefined} transition={loop(2.4)}>
          <path d={`M36 ${ROPE + 1} Q160 ${ROPE + 5} 284 ${ROPE + 1}`} fill="none" stroke="#b08850" strokeWidth={4.5} strokeLinecap="round" />
          <path d={`M36 ${ROPE + 1} Q160 ${ROPE + 5} 284 ${ROPE + 1}`} fill="none" stroke="#7d5f35" strokeWidth={4.5} strokeDasharray="3 6" strokeLinecap="round" opacity={0.5} />
          <motion.g
            animate={on ? { rotate: [-10, 10, -10] } : undefined}
            transition={loop(1.2)}
            style={{ originX: 0.5, originY: 0 }}
          >
            <path d={`M159 ${ROPE + 6} L152 ${ROPE + 28} L160 ${ROPE + 22} Z`} fill="#f59e0b" />
          </motion.g>
          <circle cx={160} cy={ROPE + 4} r={5.5} fill="#f59e0b" stroke="#b45309" strokeWidth={2} />
          <g transform={`translate(70 ${GROUND}) scale(${S})`}><Puller team="blue" pose="idle" back delay={0.3} animate={on} /></g>
          <g transform={`translate(114 ${GROUND}) scale(${S})`}><Puller team="blue" pose="idle" animate={on} /></g>
          <g transform={`translate(206 ${GROUND}) scale(${-S} ${S})`}><Puller team="red" pose="idle" delay={0.7} animate={on} /></g>
          <g transform={`translate(250 ${GROUND}) scale(${-S} ${S})`}><Puller team="red" pose="idle" back delay={1} animate={on} /></g>
        </motion.g>
      </svg>
    </div>
  );
}

const QUIZ_TILES = ["var(--m3-error)", "var(--m3-primary)", "var(--m3-warning)", "var(--m3-success)"];

/** Jonli viktorina: a question card, a shrinking timer and a correct answer that lights up. */
function QuizArt({ on }: { on: boolean }) {
  const T = 3;
  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      style={{ background: "linear-gradient(160deg, color-mix(in oklab, var(--m3-primary) 28%, var(--m3-surface-container-lowest)), color-mix(in oklab, var(--m3-primary) 8%, var(--m3-surface-container-lowest)))" }}
    >
      <div className="flex w-[58%] flex-col gap-2 rounded-m3-md bg-surface-container-lowest p-3 shadow-elev-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
          <motion.div
            className="h-full rounded-full bg-primary"
            style={{ originX: 0 }}
            animate={on ? { scaleX: [1, 0] } : undefined}
            transition={{ duration: T, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div className="h-2 w-4/5 rounded-full bg-surface-container-highest" />
        <div className="h-2 w-1/2 rounded-full bg-surface-container-highest" />
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {QUIZ_TILES.map((c, i) => (
            <motion.div
              key={c}
              className="relative flex h-7 items-center justify-center rounded-m3-sm"
              style={{ background: c }}
              animate={on ? (i === 3 ? { scale: [1, 1, 1.08, 1, 1] } : { opacity: [1, 1, 0.35, 0.35, 1] }) : undefined}
              transition={{ duration: T, repeat: Infinity, times: [0, 0.62, 0.7, 0.95, 1] }}
            >
              {i === 3 && (
                <motion.span
                  className="text-on-success"
                  animate={on ? { opacity: [0, 0, 1, 1, 0], scale: [0.4, 0.4, 1, 1, 0.4] } : { opacity: 1 }}
                  transition={{ duration: T, repeat: Infinity, times: [0, 0.62, 0.7, 0.95, 1] }}
                >
                  <Check size={16} strokeWidth={3} />
                </motion.span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
      <motion.span
        className="absolute right-[12%] top-[14%] flex h-9 w-9 items-center justify-center rounded-full bg-warning text-on-warning shadow-elev-1"
        animate={on ? { y: [0, -6, 0], rotate: [0, -8, 0] } : undefined}
        transition={loop(1.6)}
      >
        <Zap size={18} fill="currentColor" />
      </motion.span>
    </div>
  );
}

const BOARD_PICKS = [5, 2, 10, 7];

/** Savol doskasi: a points board where tiles get picked one after another. */
function BoardArt({ on }: { on: boolean }) {
  const STEP = 1.1;
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "linear-gradient(160deg, color-mix(in oklab, var(--m3-tertiary) 28%, var(--m3-surface-container-lowest)), color-mix(in oklab, var(--m3-tertiary) 8%, var(--m3-surface-container-lowest)))" }}
    >
      <div className="grid w-[64%] grid-cols-4 gap-1.5 rounded-m3-md bg-surface-container-lowest p-2 shadow-elev-2">
        {Array.from({ length: 12 }, (_, i) => {
          const pick = BOARD_PICKS.indexOf(i);
          return (
            <motion.div
              key={i}
              className="flex h-8 items-center justify-center rounded-m3-xs bg-tertiary text-[11px] font-extrabold text-on-tertiary"
              animate={on && pick >= 0 ? { scale: [1, 1.18, 1], y: [0, -3, 0] } : undefined}
              transition={{ duration: 0.7, repeat: Infinity, repeatDelay: STEP * BOARD_PICKS.length - 0.7, delay: pick * STEP, ease: "easeOut" }}
            >
              {(Math.floor(i / 4) + 1) * 100}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const WHEEL_COLORS = ["var(--m3-primary)", "var(--m3-tertiary)", "var(--m3-warning)", "var(--m3-success)"];

/** Omad g'ildiragi: the wheel spins, slows down and the pointer ticks. */
function WheelArt({ on }: { on: boolean }) {
  const R = 58;
  const CX = 160;
  const CY = 98;
  const seg = (i: number) => {
    const a0 = ((i * 45 - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * 45 - 90) * Math.PI) / 180;
    return `M${CX} ${CY} L${CX + R * Math.cos(a0)} ${CY + R * Math.sin(a0)} A${R} ${R} 0 0 1 ${CX + R * Math.cos(a1)} ${CY + R * Math.sin(a1)} Z`;
  };
  const spin = { duration: 2.8, repeat: Infinity, repeatDelay: 1.4, ease: [0.15, 0.85, 0.25, 1] as const };
  return (
    <div
      className="h-full w-full"
      style={{ background: "linear-gradient(160deg, color-mix(in oklab, var(--m3-warning) 26%, var(--m3-surface-container-lowest)), color-mix(in oklab, var(--m3-warning) 8%, var(--m3-surface-container-lowest)))" }}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full" aria-hidden>
        <ellipse cx={CX} cy={CY + R + 10} rx={44} ry={6} fill="var(--m3-shadow)" opacity={0.12} />
        <circle cx={CX} cy={CY} r={R + 5} fill="var(--m3-surface-container-lowest)" />
        <motion.g animate={on ? { rotate: [0, 720] } : undefined} transition={spin} style={{ originX: 0.5, originY: 0.5 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={seg(i)} fill={WHEEL_COLORS[i % 4]} stroke="var(--m3-surface-container-lowest)" strokeWidth={2} />
          ))}
        </motion.g>
        <circle cx={CX} cy={CY} r={11} fill="var(--m3-surface-container-lowest)" stroke="var(--m3-outline-variant)" strokeWidth={2} />
        <motion.path
          d={`M${CX - 9} ${CY - R - 14} L${CX + 9} ${CY - R - 14} L${CX} ${CY - R + 4} Z`}
          fill="var(--m3-on-surface)"
          animate={on ? { rotate: [0, -16, 10, -16, 10, -8, 0, 0] } : undefined}
          transition={{ duration: 4.2, repeat: Infinity, times: [0, 0.08, 0.2, 0.32, 0.45, 0.58, 0.67, 1] }}
          style={{ originX: 0.5, originY: 0.2 }}
        />
      </svg>
    </div>
  );
}

export default function GameArt({ game, on }: { game: GameArtKey; on: boolean }) {
  if (game === "tug") return <TugArt on={on} />;
  if (game === "quiz") return <QuizArt on={on} />;
  if (game === "board") return <BoardArt on={on} />;
  return <WheelArt on={on} />;
}
