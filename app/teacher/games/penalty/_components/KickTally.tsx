'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn } from '@/components/ui';
import { GAME_TEAMS, STAGE } from '../../_lib/stage';
import { kickerOf, type Shot } from '../_lib/engine';

interface Props {
  names: string[];
  kicks: Shot[];
  starter: number;
  kicksPerTeam: number;
  goals: [number, number];
  /** Team taking the current kick; null once the game is over. */
  current: number | null;
  animate: boolean;
}

/** One pip per kick: ✓ goal, ✕ saved / missed, empty ring = still to kick. */
function Pip({ shot, color, animate }: { shot: Shot | undefined; color: string; animate: boolean }) {
  const done = shot !== undefined;
  const goal = shot === 'goal';
  return (
    <motion.span
      className="flex h-[clamp(14px,2.4vh,26px)] w-[clamp(14px,2.4vh,26px)] items-center justify-center rounded-full text-white"
      style={done ? { background: goal ? STAGE.correct : STAGE.wrong } : { boxShadow: `inset 0 0 0 2px ${color}`, opacity: 0.5 }}
      initial={done && animate ? { scale: 1.5 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
    >
      {done && (goal ? <Check className="h-[65%] w-[65%]" strokeWidth={4} /> : <X className="h-[65%] w-[65%]" strokeWidth={4} />)}
    </motion.span>
  );
}

function TeamSide({ team, name, shots, slots, active, mirror, animate }: {
  team: number; name: string; shots: Shot[]; slots: number; active: boolean; mirror: boolean; animate: boolean;
}) {
  const c = GAME_TEAMS[team];
  return (
    <div
      className={cn('flex min-w-0 items-center gap-[clamp(8px,1vw,16px)] rounded-[clamp(12px,1.2vw,20px)] px-[clamp(10px,1.2vw,20px)] py-[clamp(6px,1vh,12px)] transition-shadow duration-300', mirror && 'flex-row-reverse')}
      style={{ background: c.tint, boxShadow: active ? `0 0 0 3px ${c.solid}` : '0 0 0 1px var(--m3-outline-variant)' }}
    >
      <span className="h-[clamp(28px,4.4vh,44px)] w-[clamp(6px,0.6vw,10px)] shrink-0 rounded-full" style={{ background: c.solid }} />
      <div className={cn('flex min-w-0 flex-1 flex-col gap-[clamp(4px,0.6vh,8px)]', mirror && 'items-end')}>
        <p className="max-w-full truncate text-[clamp(13px,2vh,22px)] font-extrabold" style={{ color: c.solid }}>{name}</p>
        <div className={cn('flex flex-wrap gap-[clamp(3px,0.4vw,6px)]', mirror && 'justify-end')}>
          {Array.from({ length: slots }, (_, i) => (
            // Keyed by the result, so a pip pops once when its kick is recorded.
            <Pip key={`${i}-${shots[i] ?? ''}`} shot={shots[i]} color={c.solid} animate={animate} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Top bar: both teams' kick pips and the score in the middle. */
export default function KickTally({ names, kicks, starter, kicksPerTeam, goals, current, animate }: Props) {
  const shotsOf = (team: number) => kicks.filter((_, i) => kickerOf(starter, i) === team);
  // Sudden death adds one pip per extra pair (including the kick in play).
  const slots = Math.max(kicksPerTeam, Math.ceil((kicks.length + (current === null ? 0 : 1)) / 2));

  return (
    <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-[clamp(8px,1.2vw,20px)]">
      <TeamSide team={0} name={names[0]} shots={shotsOf(0)} slots={slots} active={current === 0} mirror={false} animate={animate} />
      <div className="flex items-center gap-[0.25em] rounded-[clamp(12px,1.2vw,20px)] bg-surface-container-lowest px-[0.5em] py-[0.1em] font-t-display text-[clamp(30px,6vh,64px)] font-black tabular-nums leading-none shadow-elev-1">
        {[0, 1].map((team) => (
          <motion.span
            key={`${team}-${goals[team]}`}
            style={{ color: GAME_TEAMS[team].solid, order: team * 2 }}
            initial={animate && goals[team] > 0 ? { scale: 1.6 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 14 }}
          >
            {goals[team]}
          </motion.span>
        ))}
        <span className="text-on-surface-variant" style={{ order: 1 }}>:</span>
      </div>
      <TeamSide team={1} name={names[1]} shots={shotsOf(1)} slots={slots} active={current === 1} mirror animate={animate} />
    </div>
  );
}
