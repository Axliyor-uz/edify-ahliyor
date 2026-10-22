'use client';

import { createPortal } from 'react-dom';
import { Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Maximize, Minimize, Pause, Play, X, MonitorSmartphone, ListChecks } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, Card, ConfirmDialog, PageHeader, MOTION_ON } from '@/components/ui';
import { fetchTeacherTest } from '@/services/teacherTestService';
import type { Lang } from '@/types/Math';

import { analyzeTest, buildDeck, neededForMinutes } from '../_lib/questionDeck';
import { useBigScreen } from '../_lib/useBigScreen';
import { initialState, reducer, WIN_STEPS } from './_lib/engine';
import { FIELD, TEAM_THEME, type Team } from './_lib/teams';
import { tugText } from './_lib/i18n';
import type { PickedTest } from '../_components/TestPicker';
import QuestionSource from '../_components/QuestionSource';
import { suggestCount } from '../_lib/aiSet';
import GameSettings from './_components/GameSettings';
import Scoreboard, { TimerPill, TugMeter } from './_components/Scoreboard';
import RopeArena from './_components/RopeArena';
import TeamPanel from './_components/TeamPanel';
import Countdown from './_components/Countdown';
import ResultCard from './_components/ResultCard';
import Confetti from '../_components/Confetti';

/**
 * Arqon tortish — classroom tug-of-war on one screen (docs/GAMES.md).
 * Setup (pick a test, names, time) → full-screen play → result. No Firestore
 * writes; the only read is the teacher's own `custom_tests`.
 */

const KEYS: Record<Team, string[]> = { blue: ['1', '2', '3', '4'], red: ['7', '8', '9', '0'] };

export default function TugOfWarPage() {
  return (
    <Suspense fallback={null}>
      <TugOfWar />
    </Suspense>
  );
}

function TugOfWar() {
  const { user } = useAuth() as { user: { uid: string } | null };
  const { lang } = useTeacherLanguage();
  const t = tugText(lang);
  const L = lang as Lang;
  const router = useRouter();
  const presetId = useSearchParams().get('testId');
  const reduced = useReducedMotion();
  const animate = MOTION_ON && !reduced;
  const bigScreen = useBigScreen();

  const [phase, setPhase] = useState<'setup' | 'play'>('setup');
  const [picked, setPicked] = useState<PickedTest | null>(null);
  const [rawNames, setRawNames] = useState<Record<Team, string>>({ blue: '', red: '' });
  const [minutes, setMinutes] = useState<number | null>(2);
  const [gameId, setGameId] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());

  const names: Record<Team, string> = {
    blue: rawNames.blue.trim() || t.blueDefault,
    red: rawNames.red.trim() || t.redDefault,
  };

  // ?testId= from the library's quick-launch button.
  useEffect(() => {
    if (!presetId || !user) return;
    let alive = true;
    fetchTeacherTest(presetId, user.uid)
      .then((test) => {
        if (!alive) return;
        if (!test) toast.error(t.testMissing);
        else setPicked({ test, analysis: analyzeTest(test.rawQuestions, L) });
      })
      .catch(() => alive && toast.error(t.testMissing));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, user?.uid]);

  const startGame = useCallback(() => {
    if (!picked) return;
    dispatch({ type: 'init', deck: buildDeck(picked.analysis.usable, L), durationMs: minutes === null ? null : minutes * 60_000 });
    setGameId((g) => g + 1);
    setPhase('play');
  }, [picked, minutes, L]);

  // Game clock — every rule reads `now` from here.
  useEffect(() => {
    if (state.status !== 'playing') return;
    const id = window.setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 100);
    return () => window.clearInterval(id);
  }, [state.status]);

  // Keyboard for laptops: Blue 1–4, Red 7 8 9 0, P / Space = pause.
  const live = useRef(state);
  useEffect(() => { live.current = state; }, [state]);
  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      const s = live.current;
      if (e.key === 'p' || e.key === 'P' || e.key === ' ') {
        if (s.status === 'playing' || s.status === 'paused') {
          e.preventDefault();
          dispatch({ type: s.status === 'playing' ? 'pause' : 'resume', now: performance.now() });
        }
        return;
      }
      if (s.status !== 'playing') return;
      for (const team of ['blue', 'red'] as Team[]) {
        const idx = KEYS[team].indexOf(e.key);
        const opt = idx >= 0 ? s.sides[team].current?.options[idx] : undefined;
        if (opt) dispatch({ type: 'answer', team, optionId: opt.id, now: performance.now() });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  // Don't lose a running game to an accidental tab close.
  useEffect(() => {
    if (phase !== 'play' || state.status === 'finished') return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [phase, state.status]);

  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const leavePlay = () => {
    setConfirmExit(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    dispatch({ type: 'init', deck: [], durationMs: null });
    setPhase('setup');
  };

  const requestExit = () => {
    if (state.status === 'finished') return leavePlay();
    if (state.status === 'playing') dispatch({ type: 'pause', now: performance.now() });
    setConfirmExit(true);
  };

  const answer = (team: Team) => (optionId: string) =>
    dispatch({ type: 'answer', team, optionId, now: performance.now() });

  // ── SETUP ────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:px-6">
        <Link href="/teacher/games" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-on-surface-variant hover:text-primary">
          <ArrowLeft size={15} /> {t.back}
        </Link>
        <PageHeader title={t.title} subtitle={t.subtitle} />

        <div className="grid items-start gap-5 lg:grid-cols-[1.05fr_1fr]">
          <Card className="flex flex-col gap-3">
            <h2 className="text-[15px] font-bold text-on-surface">{t.step1}</h2>
            {user && (
              <QuestionSource uid={user.uid} lang={L} picked={picked} onPick={setPicked} suggestedCount={suggestCount(minutes === null ? Infinity : neededForMinutes(minutes))} t={t} />
            )}
          </Card>

          <div className="flex flex-col gap-5">
            <Card className="flex flex-col gap-3">
              <h2 className="text-[15px] font-bold text-on-surface">{t.step2}</h2>
              {picked && <p className="truncate text-[13px] font-semibold text-primary">{picked.test.title}</p>}
              <GameSettings
                picked={picked}
                names={rawNames}
                onName={(team, v) => setRawNames((n) => ({ ...n, [team]: v }))}
                minutes={minutes}
                onMinutes={setMinutes}
                onStart={startGame}
                t={t}
              />
            </Card>

            <Card variant="filled" className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-[14px] font-bold text-on-surface"><ListChecks size={16} className="text-primary" /> {t.rulesTitle}</h3>
              <ol className="ml-5 list-decimal space-y-1 text-[12.5px] font-medium leading-relaxed text-on-surface-variant">
                {t.rules.map((r) => <li key={r}>{r}</li>)}
              </ol>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ── PLAY ─────────────────────────────────────────────────────────────────
  const finished = state.status === 'finished';
  const leading: Team | null = state.rope < 0 ? 'blue' : state.rope > 0 ? 'red' : null;
  const oneLeft = state.status === 'playing' && leading && Math.abs(state.rope) === WIN_STEPS - 1;
  const panelsLocked = state.status !== 'playing';

  // Portal to <body>: the shell wraps pages in a transformed motion.div, which
  // would turn `fixed` into "fixed to the page column" — under the sidebar.
  // Theme tokens live on <html>, so they still apply out here.
  return createPortal(
    <div style={{ background: FIELD.page }} className="font-t-body fixed inset-0 z-[90] flex flex-col gap-[clamp(8px,1.2vh,16px)] p-[clamp(8px,1.2vh,18px)]">
      {!bigScreen ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <MonitorSmartphone size={44} className="text-primary" />
          <p className="text-[18px] font-bold text-on-surface">{t.bigScreen}</p>
          <p className="max-w-xs text-[14px] font-medium text-on-surface-variant">{t.bigScreenHint}</p>
          <Button variant="outlined" icon={<X />} onClick={leavePlay}>{t.exit}</Button>
        </div>
      ) : (
        <>
          <Scoreboard
            names={names}
            scores={{ blue: state.sides.blue.correct, red: state.sides.red.correct }}
            title={picked?.test.title ?? t.title}
            subtitle={t.title}
            animate={animate}
          />

          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-[clamp(8px,0.9vw,16px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)_minmax(0,1fr)]">
            <TeamPanel
              team="blue" name={names.blue} side={state.sides.blue} clock={state.clock}
              disabled={panelsLocked} ready={state.status === 'countdown'} animate={animate} onAnswer={answer('blue')} t={t}
            />

            <div
              className="relative flex min-h-0 flex-col items-center overflow-hidden rounded-[clamp(14px,1.4vw,24px)] border border-outline-variant shadow-elev-1"
              style={{ background: FIELD.sky }}
            >
              {/* Top: clock */}
              <div className="flex shrink-0 justify-center pt-[clamp(10px,1.8vh,24px)]">
                <TimerPill remainingMs={state.durationMs === null ? null : state.remainingMs} animate={animate} />
              </div>

              {/* Middle: the stage, centered in all the free height */}
              <div className="flex min-h-0 w-full flex-1 items-center justify-center px-[clamp(4px,0.6vw,12px)]">
                <RopeArena state={state} animate={animate} />
              </div>

              {/* Bottom: rope meter + "one pull left" */}
              <div className="flex shrink-0 flex-col items-center gap-[clamp(6px,1vh,12px)] pb-[clamp(12px,2vh,28px)]">
                <TugMeter rope={state.rope} />
                <div className="flex h-[clamp(24px,3.4vh,36px)] items-center">
                  <AnimatePresence>
                    {oneLeft && leading && (
                      <motion.span
                        initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }}
                        className="inline-block rounded-full px-[1em] py-[0.3em] text-[clamp(11px,1.4vh,16px)] font-extrabold text-white shadow-elev-2"
                        style={{ background: TEAM_THEME[leading].solid }}
                      >
                        {t.oneLeft}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {state.status === 'countdown' && (
                <Countdown key={gameId} go={t.go} animate={animate} onDone={() => dispatch({ type: 'begin', now: performance.now() })} />
              )}
            </div>

            <TeamPanel
              team="red" name={names.red} side={state.sides.red} clock={state.clock}
              disabled={panelsLocked} ready={state.status === 'countdown'} animate={animate} onAnswer={answer('red')} t={t}
            />
          </div>

          {/* Footer row: teacher controls bottom-left, on their own row so the
              team panels end above them and nothing ever overlaps answers. */}
          <div className="flex h-[clamp(30px,4vh,42px)] shrink-0 items-center">
            <div className="flex h-full items-center gap-1.5">
              {state.status === 'playing' && (
                <ControlButton label={t.pause} onClick={() => dispatch({ type: 'pause', now: performance.now() })}>
                  <Pause className="h-[45%] w-[45%]" />
                </ControlButton>
              )}
              <ControlButton label={t.fullscreen} onClick={toggleFullscreen}>
                {isFull ? <Minimize className="h-[45%] w-[45%]" /> : <Maximize className="h-[45%] w-[45%]" />}
              </ControlButton>
              <ControlButton label={t.exit} onClick={requestExit}><X className="h-[50%] w-[50%]" /></ControlButton>
            </div>
          </div>

          {/* Pause covers EVERYTHING — nobody reads questions while paused */}
          <AnimatePresence>
            {state.status === 'paused' && (
              <motion.div
                className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-surface"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'resume', now: performance.now() })}
                  aria-label={t.resume}
                  className="flex h-[clamp(64px,10vh,96px)] w-[clamp(64px,10vh,96px)] items-center justify-center rounded-full bg-primary text-on-primary shadow-elev-2 transition-transform hover:scale-105"
                >
                  <Play className="ml-1 h-[42%] w-[42%]" />
                </button>
                <span className="font-t-display text-[clamp(24px,4vh,40px)] font-black text-on-surface">{t.paused}</span>
                <span className="text-[clamp(13px,1.6vh,16px)] font-medium text-on-surface-variant">{t.pausedHint}</span>
                <div className="mt-2 flex gap-2">
                  <Button size="lg" icon={<Play />} onClick={() => dispatch({ type: 'resume', now: performance.now() })}>{t.resume}</Button>
                  <Button size="lg" variant="outlined" icon={<X />} onClick={requestExit}>{t.exit}</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {finished && animate && state.winner && state.winner !== 'draw' && (
            <Confetti key={gameId} color={TEAM_THEME[state.winner].solid} />
          )}
          {finished && (
            <ResultCard
              state={state}
              names={names}
              animate={animate}
              onReplay={startGame}
              onSettings={leavePlay}
              onExit={() => { leavePlay(); router.push('/teacher/games'); }}
              t={{ ...t, exit: t.exitGame }}
            />
          )}

        </>
      )}

      <ConfirmDialog
        open={confirmExit}
        onClose={() => setConfirmExit(false)}
        onConfirm={leavePlay}
        title={t.exitConfirmTitle}
        description={t.exitConfirmDesc}
        confirmText={t.exitConfirm}
        cancelText={t.cancel}
        danger
      />
    </div>,
    document.body,
  );
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="m3-interactive flex h-full aspect-square items-center justify-center rounded-[clamp(8px,1vh,12px)] border border-outline-variant bg-surface-container-lowest text-on-surface-variant opacity-70 shadow-elev-1 transition hover:text-on-surface hover:opacity-100"
    >
      {children}
    </button>
  );
}
