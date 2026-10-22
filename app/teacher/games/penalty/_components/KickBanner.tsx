'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Check, Trophy, X } from 'lucide-react';
import { GAME_TEAMS, STAGE } from '../../_lib/stage';
import type { Outcome, Shot } from '../_lib/engine';
import type { PenaltyText } from '../_lib/i18n';

interface Props {
  shot: Shot;
  outcome: Outcome | null;
  /** Team that took the kick. */
  team: number;
  /** Team that kicks next; null = the game is over. */
  nextTeam: number | null;
  names: string[];
  onNext: () => void;
  animate: boolean;
  t: PenaltyText;
}

/** What happened to the kick, low on the pitch so the goal stays visible. */
export default function KickBanner({ shot, outcome, team, nextTeam, names, onNext, animate, t }: Props) {
  const goal = shot === 'goal';
  const note = goal ? t.goalNote : shot === 'saved' ? t.savedNote : outcome === 'timeout' ? t.timeoutNote : t.missNote;
  // Result colors mean the result (like the tally pips); the team shows in its name.
  const color = goal ? STAGE.correct : STAGE.wrong;

  return (
    <motion.div
      className="absolute inset-x-0 bottom-[4%] z-20 flex justify-center px-4"
      initial={{ opacity: 0, y: animate ? 30 : 0 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex max-w-[min(900px,100%)] items-center gap-[clamp(12px,1.6vw,28px)] rounded-[clamp(18px,2vw,32px)] bg-surface-container-lowest py-[clamp(10px,1.4vh,18px)] pl-[clamp(10px,1.2vw,18px)] pr-[clamp(12px,1.4vw,22px)] shadow-elev-3">
        <motion.span
          className="flex h-[clamp(48px,8.5vh,92px)] w-[clamp(48px,8.5vh,92px)] shrink-0 items-center justify-center rounded-[clamp(12px,1.4vw,22px)] text-white"
          style={{ background: color }}
          initial={animate ? { scale: 0.3, rotate: -20 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 14 }}
        >
          {goal ? <Check className="h-[58%] w-[58%]" strokeWidth={3.5} /> : <X className="h-[58%] w-[58%]" strokeWidth={3.5} />}
        </motion.span>
        <div className="min-w-0 flex-1">
          <motion.p
            className="font-t-display text-[clamp(30px,6vh,66px)] font-black leading-none tracking-tight"
            style={{ color }}
            initial={animate ? { opacity: 0, x: -14 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {goal ? t.goal : t.noGoal}
          </motion.p>
          <p className="mt-[0.35em] text-[clamp(13px,1.9vh,19px)] font-semibold text-on-surface-variant">
            <span className="font-extrabold" style={{ color: GAME_TEAMS[team].solid }}>{names[team]}</span> · {note}
          </p>
        </div>

        <motion.button
          type="button"
          onClick={onNext}
          className="inline-flex shrink-0 items-center gap-[0.5em] rounded-full px-[1.4em] py-[0.65em] text-[clamp(14px,2vh,20px)] font-extrabold text-white shadow-elev-2"
          style={{ background: nextTeam === null ? `linear-gradient(160deg, ${STAGE.gold}, ${STAGE.goldDeep})` : GAME_TEAMS[nextTeam].solid }}
          whileHover={animate ? { scale: 1.04 } : undefined}
          whileTap={animate ? { scale: 0.96 } : undefined}
        >
          {nextTeam === null ? (
            <>
              <Trophy className="h-[1.2em] w-[1.2em]" />
              <span>{t.results}</span>
            </>
          ) : (
            <>
              <span className="flex flex-col items-start leading-tight">
                <span>{t.next}</span>
                <span className="text-[0.7em] font-bold opacity-85">{t.nextTurn(names[nextTeam])}</span>
              </span>
              <ArrowRight className="h-[1.2em] w-[1.2em]" />
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
