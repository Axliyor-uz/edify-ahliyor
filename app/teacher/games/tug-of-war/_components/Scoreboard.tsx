'use client';

import { motion } from 'framer-motion';
import { Infinity as InfinityIcon, Timer } from 'lucide-react';
import { FIELD, TEAM_THEME, type Team } from '../_lib/teams';
import { WIN_STEPS } from '../_lib/engine';

const fmt = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

function TeamScore({ team, name, score, animate }: { team: Team; name: string; score: number; animate: boolean }) {
  const th = TEAM_THEME[team];
  const right = team === 'red';
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <span className="truncate text-[clamp(13px,0.55vw+0.9vh,20px)] font-extrabold uppercase tracking-wide" style={{ color: th.solid }}>{name}</span>
      <motion.span
        key={score}
        initial={animate && score > 0 ? { scale: 1.45 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 14 }}
        className="min-w-[1.5em] rounded-[0.28em] px-[0.3em] py-[0.1em] text-center font-t-display text-[clamp(20px,1vw+1.9vh,38px)] font-black tabular-nums leading-none text-white"
        style={{ background: th.solid }}
      >
        {score}
      </motion.span>
    </div>
  );
}

/** Top bar: team names + scores on the sides, the game/test title in the middle. */
export default function Scoreboard({ names, scores, title, subtitle, animate }: {
  names: Record<Team, string>;
  scores: Record<Team, number>;
  title: string;
  subtitle: string;
  animate: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-4 rounded-[clamp(14px,1.4vw,24px)] border border-outline-variant bg-surface-container-lowest px-[clamp(12px,1.4vw,28px)] py-[clamp(6px,1vh,14px)] shadow-elev-1">
      <TeamScore team="blue" name={names.blue} score={scores.blue} animate={animate} />
      <div className="hidden min-w-0 max-w-[38%] shrink text-center lg:block">
        <p className="truncate font-t-display text-[clamp(14px,0.5vw+1vh,22px)] font-extrabold leading-tight text-on-surface">{title}</p>
        <p className="truncate text-[clamp(10px,0.9vh,13px)] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">{subtitle}</p>
      </div>
      <TeamScore team="red" name={names.red} score={scores.red} animate={animate} />
    </div>
  );
}

/** Clock pill for the arena; ∞ in endless mode, pulses through the last 10 s. */
export function TimerPill({ remainingMs, animate }: { remainingMs: number | null; animate: boolean }) {
  const urgent = remainingMs !== null && remainingMs <= 10_000 && remainingMs > 0;
  const secondKey = remainingMs !== null ? Math.ceil(remainingMs / 1000) : -1;
  return (
    <motion.div
      key={urgent ? secondKey : 'calm'}
      initial={urgent && animate ? { scale: 1.12 } : false}
      animate={{ scale: 1 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-2 rounded-[clamp(12px,1.2vw,20px)] px-[clamp(12px,1.2vw,24px)] py-[clamp(2px,0.5vh,8px)] font-t-display text-[clamp(22px,0.8vw+2.2vh,42px)] font-black tabular-nums shadow-elev-1"
      style={urgent ? { background: FIELD.timerUrgentBg, color: FIELD.timerUrgentFg } : { background: FIELD.timerBg, color: FIELD.timerFg }}
    >
      {remainingMs === null ? (
        <InfinityIcon className="h-[1.1em] w-[1.1em]" strokeWidth={2.6} aria-label="∞" />
      ) : (
        <>
          <Timer className="h-[0.75em] w-[0.75em] opacity-60" strokeWidth={2.4} />
          {fmt(remainingMs)}
        </>
      )}
    </motion.div>
  );
}

/** Rope position at a glance: 5 blue cells · center · 5 red cells. */
export function TugMeter({ rope }: { rope: number }) {
  const cells = Array.from({ length: WIN_STEPS * 2 }, (_, i) => i - WIN_STEPS + (i >= WIN_STEPS ? 1 : 0)); // -5..-1, 1..5
  return (
    <div className="flex items-center gap-1" aria-label={`${rope}`}>
      {cells.map((c) => {
        const team: Team = c < 0 ? 'blue' : 'red';
        const lit = (c < 0 && rope <= c) || (c > 0 && rope >= c);
        return (
          <motion.span
            key={c}
            initial={false}
            animate={{ opacity: lit ? 1 : 0.25 }}
            transition={{ duration: 0.3 }}
            className="h-[clamp(7px,1vh,12px)] w-[clamp(14px,1.5vw,30px)] rounded-full"
            style={{ background: TEAM_THEME[team].solid, marginLeft: c === 1 ? 10 : undefined }}
          />
        );
      })}
    </div>
  );
}
