'use client';

import { createPortal } from 'react-dom';
import { Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Flag, ListChecks, Maximize, Minimize, MonitorSmartphone, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, Card, ConfirmDialog, PageHeader, MOTION_ON } from '@/components/ui';
import { fetchTeacherTest } from '@/services/teacherTestService';
import type { Lang } from '@/types/Math';

import { analyzeTest, buildDeck, isCorrectPick } from '../_lib/questionDeck';
import { sfx, useGameSound } from '../_lib/sound';
import { useBigScreen } from '../_lib/useBigScreen';
import TestPicker, { type PickedTest } from '../_components/TestPicker';
import Confetti from '../_components/Confetti';
import { initialState, reducer } from './_lib/engine';
import { BOARD_TEAMS, STAGE } from './_lib/theme';
import { boardText } from './_lib/i18n';
import BoardSettings, { tileChoices } from './_components/BoardSettings';
import StageBackdrop from './_components/StageBackdrop';
import TeamBar from './_components/TeamBar';
import TileGrid from './_components/TileGrid';
import QuestionCard from './_components/QuestionCard';
import Podium from './_components/Podium';

/**
 * Savol doskasi — Baamboozle-style question board (docs/GAMES.md).
 * Setup (test, 2–4 teams, timer, board size) → full-screen board → podium.
 * No Firestore writes; the only read is the teacher's own `custom_tests`.
 */

export default function QuestionBoardPage() {
  return (
    <Suspense fallback={null}>
      <QuestionBoard />
    </Suspense>
  );
}

function QuestionBoard() {
  const { user } = useAuth() as { user: { uid: string } | null };
  const { lang } = useTeacherLanguage();
  const t = boardText(lang);
  const L = lang as Lang;
  const router = useRouter();
  const presetId = useSearchParams().get('testId');
  const reduced = useReducedMotion();
  const animate = MOTION_ON && !reduced;
  const bigScreen = useBigScreen();
  const [muted, toggleMute] = useGameSound();

  const [phase, setPhase] = useState<'setup' | 'play'>('setup');
  const [picked, setPicked] = useState<PickedTest | null>(null);
  const [teamCount, setTeamCount] = useState(2);
  const [rawNames, setRawNames] = useState(['', '', '', '']);
  const [seconds, setSeconds] = useState<number | null>(30);
  const [tiles, setTiles] = useState(16);
  const [gameId, setGameId] = useState(0);
  const [answers, setAnswers] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());

  const names = rawNames.slice(0, teamCount).map((n, i) => n.trim() || t.defaultNames[i]);

  // Largest allowed board size not above the teacher's choice.
  const choices = tileChoices(picked?.analysis.usable.length ?? 0);
  const tileCount = !choices.length || choices.includes(tiles) ? tiles : (choices.filter((n) => n <= tiles).pop() ?? choices[0]);

  // ?testId= from the library's quick-launch.
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
    dispatch({
      type: 'init',
      deck: buildDeck(picked.analysis.usable, L),
      tileCount,
      teamCount,
      timeLimitMs: seconds === null ? null : seconds * 1000,
    });
    setGameId((g) => g + 1);
    setPhase('play');
    sfx.flip();
    // Projector game: go full screen right away (allowed — we're inside the click).
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }, [picked, L, tileCount, teamCount, seconds]);

  // Question clock — runs only while a timed question is open.
  const timed = state.phase === 'answers' && state.endsAt !== null && state.pausedAt === null;
  useEffect(() => {
    if (!timed) return;
    const id = window.setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 100);
    return () => window.clearInterval(id);
  }, [timed]);

  // Sounds that follow state rather than a click.
  const secs = state.remainingMs === null ? null : Math.ceil(state.remainingMs / 1000);
  useEffect(() => {
    if (timed && secs !== null && secs > 0 && secs <= 5) sfx.tick();
  }, [secs, timed]);
  useEffect(() => {
    if (state.phase === 'result' && state.outcome === 'timeout') sfx.timeout();
    if (state.phase === 'finished' && phase === 'play') sfx.win();
  }, [state.phase, state.outcome, phase]);

  // ── Actions (each one plays its own sound) ──────────────────────────────
  const pick = (index: number) => {
    dispatch({ type: 'pick', index, now: performance.now() });
    sfx.flip();
  };
  const answer = (optionId: string) => {
    if (state.phase !== 'answers' || state.active === null) return;
    const ok = isCorrectPick(state.tiles[state.active].question, optionId);
    setAnswers((n) => n + 1);
    dispatch({ type: 'answer', optionId, now: performance.now() });
    if (ok) sfx.correct(); else sfx.wrong();
  };
  const next = () => dispatch({ type: 'next' });

  // Keyboard: Enter/Space = continue, A–F or 1–6 = answer, P = pause.
  const live = useRef({ state, answer, next });
  useEffect(() => { live.current = { state, answer, next }; });
  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [role="dialog"]')) return;
      const c = live.current;
      const s = c.state;
      if (e.key === 'p' || e.key === 'P') {
        if (s.endsAt !== null && s.phase === 'answers') {
          dispatch({ type: s.pausedAt === null ? 'pause' : 'resume', now: performance.now() });
        }
        return;
      }
      if (s.pausedAt !== null) return;
      if (e.key === 'Enter' || e.key === ' ') {
        if (s.phase === 'result') { e.preventDefault(); c.next(); }
        return;
      }
      if (s.phase === 'answers' && s.active !== null) {
        const k = e.key.toLowerCase();
        const idx = 'abcdef'.indexOf(k) >= 0 ? 'abcdef'.indexOf(k) : '123456'.indexOf(k);
        const opt = idx >= 0 ? s.tiles[s.active].question.options[idx] : undefined;
        if (opt) c.answer(opt.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  // Don't lose a running game to an accidental tab close.
  useEffect(() => {
    if (phase !== 'play' || state.phase === 'finished') return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [phase, state.phase]);

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
    dispatch({ type: 'init', deck: [], tileCount: 0, teamCount: 2, timeLimitMs: null });
    setPhase('setup');
  };

  const requestExit = () => {
    if (state.phase === 'finished') return leavePlay();
    if (state.endsAt !== null && state.pausedAt === null) dispatch({ type: 'pause', now: performance.now() });
    setConfirmExit(true);
  };

  const cancelExit = () => {
    setConfirmExit(false);
    if (state.pausedAt !== null) dispatch({ type: 'resume', now: performance.now() });
  };

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
              <TestPicker uid={user.uid} lang={L} selectedId={picked?.test.id ?? null} onSelect={setPicked} t={t} />
            )}
          </Card>

          <div className="flex flex-col gap-5">
            <Card className="flex flex-col gap-3">
              <h2 className="text-[15px] font-bold text-on-surface">{t.step2}</h2>
              {picked && <p className="truncate text-[13px] font-semibold text-primary">{picked.test.title}</p>}
              <BoardSettings
                picked={picked}
                teamCount={teamCount}
                onTeamCount={setTeamCount}
                names={rawNames}
                onName={(i, v) => setRawNames((n) => n.map((x, k) => (k === i ? v : x)))}
                seconds={seconds}
                onSeconds={setSeconds}
                tiles={tileCount}
                onTiles={setTiles}
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
  const finished = state.phase === 'finished';
  const cardOpen = state.active !== null && (state.phase === 'answers' || state.phase === 'result');
  // Floating "+20" on the team card right after a correct answer.
  const delta = state.phase === 'result' && state.gained !== null
    ? state.scores.map((_, i) => (i === state.turn ? state.gained! : 0))
    : null;
  const left = state.tiles.filter((x) => !x.used).length;
  const turnTeam = BOARD_TEAMS[state.turn];
  const canPause = state.endsAt !== null && state.phase === 'answers';

  // Portal to <body>: the shell's transformed page wrapper would otherwise
  // make `fixed` relative to the page column (see tug-of-war, docs/GAMES.md).
  return createPortal(
    <div style={{ background: STAGE.page }} className="font-t-body fixed inset-0 z-[90] flex flex-col overflow-hidden">
      <StageBackdrop animate={animate} />

      {!bigScreen ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <MonitorSmartphone size={44} className="text-primary" />
          <p className="text-[18px] font-bold text-on-surface">{t.bigScreen}</p>
          <p className="max-w-xs text-[14px] font-medium text-on-surface-variant">{t.bigScreenHint}</p>
          <Button variant="outlined" icon={<X />} onClick={leavePlay}>{t.exit}</Button>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col gap-[clamp(8px,1.4vh,18px)] p-[clamp(8px,1.4vh,20px)]">
          <TeamBar
            names={names}
            scores={state.scores}
            turn={state.turn}
            delta={delta}
            deltaKey={answers}
            turnLabel={t.turn}
            animate={animate}
          />

          {/* Board + the question card that opens over it */}
          <div className="relative flex min-h-0 flex-1 flex-col gap-[clamp(6px,1vh,12px)]">
            <div className="flex h-[clamp(26px,4vh,44px)] shrink-0 items-center justify-center">
              <AnimatePresence mode="wait">
                {!finished && (
                  <motion.p
                    key={state.turn}
                    className="rounded-full px-[1.1em] py-[0.3em] text-[clamp(13px,2.2vh,22px)] font-extrabold text-white shadow-elev-1"
                    style={{ background: turnTeam.solid }}
                    initial={animate ? { y: -12, opacity: 0, scale: 0.9 } : { opacity: 0 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 12, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                  >
                    {t.pickTile(names[state.turn])}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <TileGrid
              key={gameId}
              tiles={state.tiles}
              active={cardOpen ? state.active : null}
              disabled={state.phase !== 'board'}
              onPick={pick}
              morph={animate}
              animate={animate}
            />

            <AnimatePresence>
              {cardOpen && (
                <QuestionCard
                  key={`q-${state.active}`}
                  state={state}
                  names={names}
                  onAnswer={answer}
                  onNext={next}
                  morph={animate}
                  animate={animate}
                  t={t}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Footer: teacher controls left, tiles left center, finish right */}
          <div className="grid h-[clamp(30px,4vh,42px)] shrink-0 grid-cols-[1fr_auto_1fr] items-center">
            <div className="flex h-full items-center gap-1.5">
              {canPause && (
                <ControlButton label={t.pause} onClick={() => dispatch({ type: 'pause', now: performance.now() })}>
                  <Pause className="h-[45%] w-[45%]" />
                </ControlButton>
              )}
              <ControlButton label={muted ? t.unmute : t.mute} onClick={toggleMute}>
                {muted ? <VolumeX className="h-[45%] w-[45%]" /> : <Volume2 className="h-[45%] w-[45%]" />}
              </ControlButton>
              <ControlButton label={t.fullscreen} onClick={toggleFullscreen}>
                {isFull ? <Minimize className="h-[45%] w-[45%]" /> : <Maximize className="h-[45%] w-[45%]" />}
              </ControlButton>
              <ControlButton label={t.exit} onClick={requestExit}><X className="h-[50%] w-[50%]" /></ControlButton>
            </div>
            <p className="text-[clamp(11px,1.5vh,15px)] font-bold text-on-surface-variant">{!finished && t.tilesLeft(left)}</p>
            <div className="flex justify-end">
              {state.phase === 'board' && (
                <button
                  type="button"
                  onClick={() => setConfirmFinish(true)}
                  className="inline-flex h-full items-center gap-1.5 rounded-full px-3 text-[clamp(11px,1.5vh,14px)] font-bold text-on-surface-variant opacity-70 transition hover:bg-state-hover hover:opacity-100"
                >
                  <Flag className="h-[1.1em] w-[1.1em]" /> {t.finishEarly}
                </button>
              )}
            </div>
          </div>

          {/* Pause hides the question; the clock is stopped */}
          <AnimatePresence>
            {state.pausedAt !== null && !confirmExit && (
              <motion.div
                className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-surface"
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Celebrations */}
          {animate && state.phase === 'result' && state.outcome === 'correct' && (
            <Confetti key={`c-${answers}`} color={turnTeam.solid} />
          )}
          {finished && (
            <Podium
              names={names}
              scores={state.scores}
              animate={animate}
              onReplay={startGame}
              onSettings={leavePlay}
              onExit={() => { leavePlay(); router.push('/teacher/games'); }}
              t={t}
            />
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmExit}
        onClose={cancelExit}
        onConfirm={leavePlay}
        title={t.exitConfirmTitle}
        description={t.exitConfirmDesc}
        confirmText={t.exitConfirm}
        cancelText={t.cancel}
        danger
      />
      <ConfirmDialog
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        onConfirm={() => { setConfirmFinish(false); dispatch({ type: 'finish' }); }}
        title={t.finishConfirmTitle}
        description={t.finishConfirmDesc}
        confirmText={t.finishConfirm}
        cancelText={t.cancel}
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
