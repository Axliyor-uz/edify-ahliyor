'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Lock, X, Inbox } from 'lucide-react';
import LatexRenderer from '@/components/LatexRenderer';
import { cn } from '@/components/ui';
import { TEAM_THEME, CORRECT_COLOR, WRONG_COLOR, type Team } from '../_lib/teams';
import { FREEZE_MS, type SideState } from '../_lib/engine';

interface Props {
  team: Team;
  name: string;
  side: SideState;
  clock: number;
  disabled: boolean;
  /** Countdown running — no question yet, show a ready state (not "out of questions"). */
  ready: boolean;
  animate: boolean;
  onAnswer: (optionId: string) => void;
  t: { wait: string; outOfQuestions: string; outHint: string; ready: string };
}

/**
 * Bigger type for short questions, smaller for long ones. Every size is a
 * clamp() over viewport width AND height, so it fits a laptop, a 4K
 * projector and a landscape tablet without breakpoint jumps.
 */
function questionSize(text: string) {
  const n = text.replace(/<[^>]+>/g, '').length;
  if (n < 70) return 'text-[clamp(17px,0.75vw+1.5vh,32px)]';
  if (n < 140) return 'text-[clamp(15px,0.65vw+1.25vh,27px)]';
  if (n < 260) return 'text-[clamp(14px,0.55vw+1vh,22px)]';
  return 'text-[clamp(13px,0.45vw+0.85vh,18px)]';
}

export default function TeamPanel({ team, name, side, clock, disabled, ready, animate, onAnswer, t }: Props) {
  const th = TEAM_THEME[team];
  const q = side.current;
  const fb = side.feedback;
  const frozen = fb?.kind === 'wrong';
  const freezeLeft = frozen ? Math.max(0, fb.until - clock) : 0;
  const ring = 2 * Math.PI * 22;

  return (
    <section
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[clamp(14px,1.4vw,24px)] border-[3px] p-[clamp(8px,0.9vw,16px)]"
      style={{ borderColor: th.solid, background: th.tint }}
      aria-label={name}
    >
      {/* Team header */}
      <header
        className="mb-[clamp(6px,1vh,12px)] flex items-center gap-2 rounded-[clamp(8px,0.9vw,14px)] px-[clamp(8px,0.8vw,14px)] py-[clamp(4px,0.7vh,9px)] text-white"
        style={{ background: th.solid }}
      >
        <span className="h-[clamp(8px,1.1vh,12px)] w-[clamp(8px,1.1vh,12px)] shrink-0 rounded-full bg-white" />
        <h2 className="truncate text-[clamp(13px,0.5vw+0.9vh,19px)] font-extrabold uppercase tracking-wide">{name}</h2>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {q ? (
          <motion.div
            key={q.key}
            className="flex min-h-0 flex-1 flex-col"
            initial={animate ? { opacity: 0, x: team === 'blue' ? -24 : 24 } : { opacity: 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={animate ? { opacity: 0, x: team === 'blue' ? 24 : -24 } : { opacity: 0 }}
            transition={{ duration: animate ? 0.22 : 0.1, ease: [0.2, 0, 0, 1] }}
          >
            {/* Question */}
            <div className="mb-[clamp(6px,1vh,12px)] min-h-0 flex-1 overflow-y-auto rounded-[clamp(10px,1vw,18px)] bg-surface-container-lowest p-[clamp(10px,1.1vw,20px)] shadow-elev-1 custom-scrollbar">
              <LatexRenderer latex={q.text} className={cn('block font-bold leading-snug text-on-surface', questionSize(q.text))} />
              {q.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.imageUrl} alt="" className="mx-auto mt-3 max-h-[clamp(70px,20vh,240px)] rounded-xl object-contain" />
              )}
            </div>

            {/* Answers */}
            <div className="grid shrink-0 gap-[clamp(5px,0.8vh,10px)]">
              {q.options.map((o) => {
                const picked = fb?.optionId === o.id;
                const state = picked ? fb!.kind : null;
                return (
                  <motion.button
                    key={o.id}
                    type="button"
                    disabled={disabled || !!fb}
                    onClick={() => onAnswer(o.id)}
                    initial={false}
                    animate={state === 'wrong' && animate ? { x: [0, -9, 9, -6, 6, 0] } : state === 'correct' && animate ? { scale: [1, 1.03, 1] } : { x: 0, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    whileTap={animate && !fb ? { scale: 0.97 } : undefined}
                    className={cn(
                      'group flex min-h-[clamp(40px,6.6vh,72px)] w-full items-center gap-[clamp(8px,0.8vw,14px)] rounded-[clamp(10px,1vw,18px)] border-2 px-[clamp(8px,0.8vw,14px)] py-[clamp(4px,0.6vh,8px)] text-left transition-colors',
                      !state && 'border-outline-variant bg-surface-container-lowest text-on-surface enabled:hover:border-[var(--team)] disabled:cursor-default',
                      state && 'border-transparent text-white',
                      fb && !picked && 'opacity-55',
                    )}
                    style={{
                      ['--team' as string]: th.solid,
                      ...(state === 'correct' ? { background: CORRECT_COLOR } : state === 'wrong' ? { background: WRONG_COLOR } : null),
                    }}
                  >
                    <span
                      className="flex h-[clamp(24px,3.6vh,38px)] w-[clamp(24px,3.6vh,38px)] shrink-0 items-center justify-center rounded-[clamp(7px,0.8vh,12px)] text-[clamp(12px,1.6vh,17px)] font-extrabold"
                      style={state ? { background: 'rgba(255,255,255,.22)', color: '#fff' } : { background: th.solid, color: '#fff' }}
                    >
                      {state === 'correct' ? <Check size={18} strokeWidth={3} /> : state === 'wrong' ? <X size={18} strokeWidth={3} /> : o.letter}
                    </span>
                    <span className="min-w-0 flex-1 text-[clamp(13px,0.45vw+1.15vh,22px)] font-semibold leading-snug">
                      <LatexRenderer latex={o.text} />
                      {o.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.imageUrl} alt="" className="mt-1 max-h-[clamp(36px,7vh,80px)] rounded-lg object-contain" />
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : ready ? (
          <motion.div
            key="ready"
            className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full font-t-display text-[26px] font-black text-white shadow-elev-2" style={{ background: th.solid }}>
              {name.trim().charAt(0).toUpperCase()}
            </span>
            <p className="text-[18px] font-bold text-on-surface">{t.ready}</p>
          </motion.div>
        ) : !fb ? (
          <motion.div
            key="empty"
            className="flex flex-1 flex-col items-center justify-center gap-2 text-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <Inbox size={34} className="text-on-surface-variant" />
            <p className="text-[17px] font-bold text-on-surface">{t.outOfQuestions}</p>
            <p className="max-w-[240px] text-[13px] font-medium text-on-surface-variant">{t.outHint}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Freeze overlay after a wrong answer — the right answer is never shown */}
      <AnimatePresence>
        {frozen && (
          <motion.div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-scrim backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18, delay: 0.35 }}
          >
            <div className="relative h-[60px] w-[60px]">
              <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90">
                <circle cx={26} cy={26} r={22} fill="var(--m3-surface-container-lowest)" stroke="rgba(255,255,255,.35)" strokeWidth={4} />
                <circle
                  cx={26} cy={26} r={22} fill="none" stroke={th.solid} strokeWidth={4} strokeLinecap="round"
                  strokeDasharray={ring} strokeDashoffset={ring * (1 - freezeLeft / FREEZE_MS)}
                />
              </svg>
              <Lock size={20} className="absolute inset-0 m-auto" style={{ color: th.solid }} />
            </div>
            <p className="rounded-full bg-surface-container-lowest px-4 py-1.5 text-[14px] font-bold text-on-surface shadow-elev-2">
              {t.wait} · {Math.ceil(freezeLeft / 1000)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
