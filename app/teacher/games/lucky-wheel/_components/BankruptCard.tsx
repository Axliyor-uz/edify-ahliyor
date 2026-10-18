'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Bomb, Trophy } from 'lucide-react';
import { GAME_TEAMS, STAGE } from '../../_lib/stage';
import { WHEEL } from '../_lib/theme';
import type { WheelText } from '../_lib/i18n';

interface Props {
  name: string;
  /** Team that plays next; null = that was the last turn. */
  nextTeam: number | null;
  names: string[];
  onNext: () => void;
  animate: boolean;
  t: WheelText;
}

/** The wheel stopped on Bankrot: no question, no points, scores kept. */
export default function BankruptCard({ name, nextTeam, names, onNext, animate, t }: Props) {
  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center bg-scrim-bg p-4 backdrop-blur-[2px]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="flex w-full max-w-[min(520px,90vw)] flex-col items-center gap-[clamp(10px,1.8vh,20px)] rounded-[clamp(18px,2vw,32px)] px-[clamp(20px,3vw,48px)] py-[clamp(20px,4vh,44px)] text-center text-white shadow-elev-3"
        style={{ background: `linear-gradient(160deg, ${WHEEL.bankrupt}, ${WHEEL.bankruptDeep})` }}
        initial={animate ? { scale: 0.7, y: 30 } : false}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
      >
        <motion.span
          className="flex h-[clamp(64px,11vh,110px)] w-[clamp(64px,11vh,110px)] items-center justify-center rounded-full bg-white/10"
          animate={animate ? { rotate: [0, -14, 12, -8, 6, 0], scale: [1, 1.12, 1] } : undefined}
          transition={{ rotate: { duration: 0.7, delay: 0.15 }, scale: { duration: 0.5, delay: 0.15 } }}
        >
          <Bomb className="h-1/2 w-1/2" strokeWidth={2.2} />
        </motion.span>
        <div>
          <p className="text-[clamp(12px,1.7vh,16px)] font-bold uppercase tracking-[0.18em] text-white/70">{name}</p>
          <p className="font-t-display text-[clamp(32px,6.5vh,64px)] font-black leading-tight">{t.bankrupt}</p>
          <p className="mt-1 text-[clamp(14px,2.1vh,20px)] font-semibold text-white/80">{t.bankruptNote}</p>
        </div>
        <motion.button
          type="button"
          onClick={onNext}
          className="mt-[clamp(4px,1vh,12px)] inline-flex items-center gap-[0.5em] rounded-full px-[1.4em] py-[0.65em] text-[clamp(14px,2vh,20px)] font-extrabold text-white shadow-elev-2"
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
      </motion.div>
    </motion.div>
  );
}
