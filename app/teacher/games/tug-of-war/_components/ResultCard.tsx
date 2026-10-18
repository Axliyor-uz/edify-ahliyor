'use client';

import { motion } from 'framer-motion';
import { RotateCcw, Settings2, Trophy, Handshake, LogOut } from 'lucide-react';
import { Button } from '@/components/ui';
import { TEAM_THEME, TEAMS, type Team } from '../_lib/teams';
import type { GameState } from '../_lib/engine';

interface Props {
  state: GameState;
  names: Record<Team, string>;
  animate: boolean;
  onReplay: () => void;
  onSettings: () => void;
  onExit: () => void;
  t: {
    over: string; winner: string; draw: string;
    reasonRope: string; reasonTime: string; reasonQuestions: string;
    correct: string; wrong: string; accuracy: string;
    replay: string; settings: string; exit: string;
  };
}

export default function ResultCard({ state, names, animate, onReplay, onSettings, onExit, t }: Props) {
  const { winner, finishReason, sides } = state;
  const won: Team | null = winner && winner !== 'draw' ? winner : null;
  const color = won ? TEAM_THEME[won].solid : 'var(--m3-on-surface-variant)';
  const reason = finishReason === 'rope' ? t.reasonRope : finishReason === 'time' ? t.reasonTime : t.reasonQuestions;

  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-center justify-center bg-scrim p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: animate ? 0.9 : 0 }}
    >
      <motion.div
        className="w-full max-w-[560px] rounded-[28px] border border-outline-variant bg-surface-container-lowest p-6 text-center shadow-elev-3 md:p-8"
        initial={animate ? { y: 24, scale: 0.96, opacity: 0 } : { opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={animate ? { type: 'spring', stiffness: 260, damping: 24, delay: 1 } : { duration: 0.15 }}
      >
        <motion.span
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: won ? TEAM_THEME[won].tintStrong : 'var(--m3-surface-container-high)', color }}
          initial={animate ? { rotate: -20, scale: 0.6 } : false}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 12, delay: animate ? 1.15 : 0 }}
        >
          {won ? <Trophy size={32} strokeWidth={2.2} /> : <Handshake size={32} strokeWidth={2.2} />}
        </motion.span>

        <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{t.over}</p>
        <h2 className="mt-1 font-t-display text-[30px] font-black leading-tight md:text-[38px]" style={{ color }}>
          {won ? `${t.winner}: ${names[won]}` : t.draw}
        </h2>
        <p className="mt-1.5 text-[14px] font-medium text-on-surface-variant">{reason}</p>

        {/* Per-team stats */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {TEAMS.map((team) => {
            const s = sides[team];
            const answered = s.correct + s.wrong;
            const acc = answered ? Math.round((s.correct / answered) * 100) : 0;
            const th = TEAM_THEME[team];
            return (
              <div key={team} className="rounded-2xl border-2 p-3 text-left" style={{ borderColor: th.solid, background: th.tint }}>
                <p className="truncate text-[12px] font-extrabold uppercase tracking-wide" style={{ color: th.solid }}>{names[team]}</p>
                <p className="font-t-display text-[34px] font-black leading-none tabular-nums" style={{ color: th.solid }}>{s.correct}</p>
                <div className="mt-2 space-y-0.5 text-[12px] font-semibold text-on-surface-variant">
                  <p className="flex justify-between"><span>{t.correct}</span><b className="text-on-surface tabular-nums">{s.correct}</b></p>
                  <p className="flex justify-between"><span>{t.wrong}</span><b className="text-on-surface tabular-nums">{s.wrong}</b></p>
                  <p className="flex justify-between"><span>{t.accuracy}</span><b className="text-on-surface tabular-nums">{acc}%</b></p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button size="lg" icon={<RotateCcw />} onClick={onReplay}>{t.replay}</Button>
          <Button size="lg" variant="outlined" icon={<Settings2 />} onClick={onSettings}>{t.settings}</Button>
        </div>
        <button onClick={onExit} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-on-surface-variant hover:text-on-surface">
          <LogOut size={14} /> {t.exit}
        </button>
      </motion.div>
    </motion.div>
  );
}
