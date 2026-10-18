'use client';

import { motion } from 'framer-motion';
import { Handshake, RotateCcw, Settings2, Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui';
import Confetti from '../../_components/Confetti';
import { ranking } from '../_lib/engine';
import { BOARD_TEAMS, STAGE } from '../_lib/theme';
import type { BoardText } from '../_lib/i18n';
import { Score } from './TeamBar';

interface Props {
  names: string[];
  scores: number[];
  animate: boolean;
  onReplay: () => void;
  onSettings: () => void;
  onExit: () => void;
  t: BoardText;
}

/** Bar height as a share of the tallest, by place (ties share a height). */
const BAR = { 1: 1, 2: 0.72, 3: 0.52, 4: 0.38 } as Record<number, number>;
/** Visual order: 2nd · 1st · 3rd · 4th. */
const ORDER = [1, 0, 2, 3];

// The reveal: bars rise from the lowest place up, then the winner lands.
const BAR_START = 0.35;
const BAR_STEP = 0.35;

export default function Podium({ names, scores, animate, onReplay, onSettings, onExit, t }: Props) {
  const rows = ranking(scores);
  const tie = rows.length > 1 && rows[1].place === 1;
  const winner = rows[0];
  const color = tie ? 'var(--m3-on-surface)' : BOARD_TEAMS[winner.team].solid;
  const stage = ORDER.filter((i) => i < rows.length).map((i) => rows[i]);
  // Rise order: last place first, the winner(s) last.
  const riseIndex = (place: number) => rows.length - place;
  const winnerAt = BAR_START + BAR_STEP * rows.length;
  const d = (s: number) => (animate ? s : 0);

  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden px-4 py-[clamp(12px,3vh,40px)]"
      style={{
        background: tie
          ? STAGE.page
          : `radial-gradient(ellipse at 50% 28%, color-mix(in oklab, ${color} 22%, transparent) 0%, transparent 60%), ${STAGE.page}`,
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}
    >
      {/* Wrapper holds the position: `.m3-interactive` forces position: relative */}
      <div className="absolute right-[clamp(12px,1.6vw,28px)] top-[clamp(12px,1.6vw,28px)] z-10">
        <button
          type="button"
          onClick={onExit}
          aria-label={t.exitGame}
          title={t.exitGame}
          className="m3-interactive flex h-12 w-12 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-elev-1 hover:text-on-surface"
        >
          <X size={22} />
        </button>
      </div>

      {/* Winner */}
      <div className="flex flex-col items-center text-center">
        <motion.div
          className="relative flex h-[clamp(64px,12vh,120px)] w-[clamp(64px,12vh,120px)] items-center justify-center"
          initial={animate ? { scale: 0, rotate: -30 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: d(winnerAt) }}
        >
          {animate && !tie && (
            <motion.svg
              viewBox="-100 -100 200 200"
              className="pointer-events-none absolute h-[210%] w-[210%]"
              animate={{ rotate: 360 }}
              transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
              aria-hidden
            >
              {Array.from({ length: 16 }, (_, i) => (
                <path key={i} d="M-5 -34 L0 -98 L5 -34 Z" fill={STAGE.gold} opacity={0.18} transform={`rotate(${i * 22.5})`} />
              ))}
            </motion.svg>
          )}
          <span
            className="relative flex h-full w-full items-center justify-center rounded-full text-white shadow-elev-3"
            style={{ background: tie ? 'var(--m3-outline)' : `linear-gradient(160deg, ${STAGE.gold}, ${STAGE.goldDeep})` }}
          >
            {tie ? <Handshake className="h-1/2 w-1/2" strokeWidth={2.2} /> : <Trophy className="h-1/2 w-1/2" strokeWidth={2.2} />}
          </span>
        </motion.div>

        <motion.p
          className="relative mt-[clamp(18px,3vh,32px)] text-[clamp(11px,1.6vh,15px)] font-bold uppercase tracking-[0.24em] text-on-surface-variant"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: d(winnerAt + 0.15) }}
        >
          {tie ? t.over : t.winner}
        </motion.p>
        <motion.h2
          className="relative font-t-display text-[clamp(32px,7vh,76px)] font-black leading-[1.05] [text-wrap:balance]"
          style={{ color }}
          initial={animate ? { opacity: 0, scale: 0.85, y: 12 } : { opacity: 0 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: d(winnerAt + 0.25) }}
        >
          {tie ? t.tie : names[winner.team]}
        </motion.h2>
      </div>

      {/* Podium */}
      <div className="relative mt-[clamp(14px,3.5vh,40px)] flex items-end justify-center gap-[clamp(8px,1.4vw,22px)] border-b-[3px] border-outline-variant px-[clamp(16px,3vw,48px)]">
        {stage.map((r) => {
          const c = BOARD_TEAMS[r.team];
          const at = BAR_START + BAR_STEP * riseIndex(r.place);
          return (
            <div key={r.team} className="flex w-[clamp(110px,15vw,220px)] min-w-0 flex-col items-center">
              <motion.div
                className="flex w-full flex-col items-center gap-[0.2em] pb-[clamp(6px,1vh,12px)]"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: d(at + 0.25) }}
              >
                <p className="w-full truncate text-center text-[clamp(13px,2vh,20px)] font-extrabold" style={{ color: c.solid }}>
                  {names[r.team]}
                </p>
                <p className="font-t-display text-[clamp(22px,4.2vh,44px)] font-black leading-none text-on-surface">
                  <Score value={r.score} animate={animate} from={0} delay={d(at + 0.25)} />
                  <span className="ml-1 text-[0.42em] font-bold text-on-surface-variant">{t.pts}</span>
                </p>
              </motion.div>
              <motion.div
                className="relative flex w-full items-start justify-center overflow-hidden rounded-t-[clamp(12px,1.2vw,22px)] pt-[clamp(8px,1.4vh,16px)] shadow-elev-2"
                style={{
                  height: `calc(clamp(110px, 26vh, 280px) * ${BAR[r.place] ?? BAR[4]})`,
                  background: `linear-gradient(180deg, ${c.solid}, ${c.deep})`,
                  originY: 1,
                }}
                initial={animate ? { scaleY: 0 } : false}
                animate={{ scaleY: 1 }}
                transition={{ type: 'spring', stiffness: 140, damping: 20, delay: d(at) }}
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent" />
                <span className="relative font-t-display text-[clamp(28px,6vh,64px)] font-black leading-none text-white/90">{r.place}</span>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <motion.div
        className="mt-[clamp(16px,3.5vh,40px)] flex flex-wrap justify-center gap-3"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: d(winnerAt + 0.7) }}
      >
        <Button size="lg" icon={<RotateCcw />} onClick={onReplay}>{t.replay}</Button>
        <Button size="lg" variant="outlined" icon={<Settings2 />} onClick={onSettings}>{t.settings}</Button>
      </motion.div>

      {animate && !tie && <Confetti color={color} delay={winnerAt + 0.2} />}
    </motion.div>
  );
}
