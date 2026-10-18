'use client';

import { createPortal } from 'react-dom';
import { Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Bomb, Flag, ListChecks, Maximize, Minimize, MonitorSmartphone, Pause, Volume2, VolumeX, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, Card, ConfirmDialog, PageHeader, MOTION_ON } from '@/components/ui';
import { fetchTeacherTest } from '@/services/teacherTestService';
import type { Lang } from '@/types/Math';

import { analyzeTest, buildDeck, isCorrectPick } from '../_lib/questionDeck';
import { sfx, useGameSound } from '../_lib/sound';
import { useBigScreen } from '../_lib/useBigScreen';
import { GAME_TEAMS, STAGE } from '../_lib/stage';
import TestPicker, { type PickedTest } from '../_components/TestPicker';
import Confetti from '../_components/Confetti';
import StageBackdrop from '../_components/StageBackdrop';
import TeamBar from '../_components/TeamBar';
import QuestionCard from '../_components/QuestionCard';
import Podium from '../_components/Podium';
import { ControlButton, PauseOverlay } from '../_components/PlayControls';
import { initialState, isLastTurn, MAX_MULTIPLIER, questionsNeeded, reducer, SEGMENTS } from './_lib/engine';
import { WHEEL } from './_lib/theme';
import { wheelText } from './_lib/i18n';
import WheelSettings, { roundChoices } from './_components/WheelSettings';
import Wheel from './_components/Wheel';
import BankruptCard from './_components/BankruptCard';

/**
 * Omad g'ildiragi — lucky wheel quiz (docs/GAMES.md).
 * Setup (test, 2–4 teams, rounds, timer) → full-screen wheel → podium.
 * No Firestore writes; the only read is the teacher's own `custom_tests`.
 */

/** Pause on the landed segment before the question opens / the respin. */
const REVEAL_MS = { points: 1100, double: 1500 };

export default function LuckyWheelPage() {
  return (
    <Suspense fallback={null}>
      <LuckyWheel />
    </Suspense>
  );
}

function LuckyWheel() {
  const { user } = useAuth() as { user: { uid: string } | null };
  const { lang } = useTeacherLanguage();
  const t = wheelText(lang);
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
  const [rounds, setRounds] = useState(5);
  const [answers, setAnswers] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());

  const names = rawNames.slice(0, teamCount).map((n, i) => n.trim() || t.defaultNames[i]);

  // Largest allowed round count not above the teacher's choice.
  const choices = roundChoices(picked?.analysis.usable.length ?? 0, teamCount);
  const roundCount = !choices.length || choices.includes(rounds) ? rounds : (choices.filter((n) => n <= rounds).pop() ?? choices[0]);

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
      deck: buildDeck(picked.analysis.usable, L).slice(0, questionsNeeded(teamCount, roundCount)),
      teamCount,
      rounds: roundCount,
      timeLimitMs: seconds === null ? null : seconds * 1000,
    });
    setPhase('play');
    sfx.flip();
    // Projector game: go full screen right away (allowed — we're inside the click).
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }, [picked, L, teamCount, roundCount, seconds]);

  // Question clock — runs only while a timed question is open.
  const timed = state.phase === 'answers' && state.endsAt !== null && state.pausedAt === null;
  useEffect(() => {
    if (!timed) return;
    const id = window.setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 100);
    return () => window.clearInterval(id);
  }, [timed]);

  // Landed: a beat on the segment, then the question opens (or the respin).
  const segment = state.target === null ? null : SEGMENTS[state.target];
  // Waits while a confirm dialog is open, so a timer never starts behind it.
  const dialogOpen = confirmExit || confirmFinish;
  useEffect(() => {
    if (state.phase !== 'landed' || !segment || dialogOpen) return;
    const id = window.setTimeout(
      () => dispatch({ type: 'reveal', now: performance.now() }),
      segment.kind === 'double' ? REVEAL_MS.double : REVEAL_MS.points,
    );
    return () => window.clearTimeout(id);
  }, [state.phase, state.spinId, segment, dialogOpen]);

  // Sounds that follow state rather than a click.
  const secs = state.remainingMs === null ? null : Math.ceil(state.remainingMs / 1000);
  useEffect(() => {
    if (timed && secs !== null && secs > 0 && secs <= 5) sfx.tick();
  }, [secs, timed]);
  useEffect(() => {
    if (state.phase === 'landed') (segment?.kind === 'double' ? sfx.double : sfx.land)();
    if (state.phase === 'result' && state.outcome === 'bankrupt') sfx.bankrupt();
    if (state.phase === 'result' && state.outcome === 'timeout') sfx.timeout();
    if (state.phase === 'finished' && phase === 'play') sfx.win();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.outcome, state.spinId, phase]);

  // ── Actions (each one plays its own sound) ──────────────────────────────
  const spin = () => {
    if (state.phase !== 'spin' || state.pausedAt !== null) return;
    dispatch({ type: 'spin', target: Math.floor(Math.random() * SEGMENTS.length) });
  };
  const land = () => dispatch({ type: 'land' });
  const answer = (optionId: string) => {
    if (state.phase !== 'answers' || !state.question) return;
    const ok = isCorrectPick(state.question, optionId);
    setAnswers((n) => n + 1);
    dispatch({ type: 'answer', optionId, now: performance.now() });
    if (ok) sfx.correct(); else sfx.wrong();
  };
  const next = () => dispatch({ type: 'next' });

  // Keyboard: Space/Enter = spin or continue, A–F or 1–6 = answer, P = pause.
  const live = useRef({ state, answer, next, spin });
  useEffect(() => { live.current = { state, answer, next, spin }; });
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
        if (s.phase === 'spin') { e.preventDefault(); c.spin(); }
        else if (s.phase === 'result') { e.preventDefault(); c.next(); }
        return;
      }
      if (s.phase === 'answers' && s.question) {
        const k = e.key.toLowerCase();
        const idx = 'abcdef'.indexOf(k) >= 0 ? 'abcdef'.indexOf(k) : '123456'.indexOf(k);
        const opt = idx >= 0 ? s.question.options[idx] : undefined;
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
    dispatch({ type: 'init', deck: [], teamCount: 2, rounds: 1, timeLimitMs: null });
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
              <WheelSettings
                picked={picked}
                teamCount={teamCount}
                onTeamCount={setTeamCount}
                names={rawNames}
                onName={(i, v) => setRawNames((n) => n.map((x, k) => (k === i ? v : x)))}
                seconds={seconds}
                onSeconds={setSeconds}
                rounds={roundCount}
                onRounds={setRounds}
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
  const turnTeam = GAME_TEAMS[state.turn];
  const nextTeam = isLastTurn(state) ? null : (state.turn + 1) % state.teamCount;
  const cardOpen = state.question !== null && (state.phase === 'answers' || (state.phase === 'result' && state.outcome !== 'bankrupt'));
  const bankrupt = state.phase === 'result' && state.outcome === 'bankrupt';
  const canSpin = state.phase === 'spin' && !dialogOpen;
  const canPause = state.endsAt !== null && state.phase === 'answers';
  // Floating "+50" on the team card right after a correct answer.
  const delta = state.phase === 'result' && state.gained !== null
    ? state.scores.map((_, i) => (i === state.turn ? state.gained! : 0))
    : null;

  // What the hub shows once the wheel has stopped.
  const showLanded = segment && (state.phase === 'landed' || state.phase === 'answers' || state.phase === 'result');
  const nextMultiplier = Math.min(MAX_MULTIPLIER, state.multiplier * 2);
  const hub = !showLanded ? null : segment.kind === 'bankrupt' ? (
    <Bomb className="h-[clamp(24px,6vh,60px)] w-[clamp(24px,6vh,60px)]" strokeWidth={2.4} style={{ color: WHEEL.bankrupt }} />
  ) : segment.kind === 'double' ? (
    <span className="font-t-display text-[clamp(24px,6vh,60px)] font-black leading-none" style={{ color: WHEEL.doubleDeep }}>×{nextMultiplier}</span>
  ) : (
    <>
      <span className="font-t-display text-[clamp(24px,6vh,60px)] font-black leading-none" style={{ color: turnTeam.solid }}>
        {state.stake ?? segment.value * state.multiplier}
      </span>
      <span className="text-[clamp(9px,1.4vh,14px)] font-bold uppercase tracking-wider text-on-surface-variant">{t.pts}</span>
    </>
  );

  // The line above the wheel.
  const prompt = state.phase === 'landed' && segment
    ? (segment.kind === 'double' ? t.doubleNote : segment.kind === 'points' ? t.segPoints(segment.value * state.multiplier) : null)
    : state.phase === 'spin' || state.phase === 'spinning'
      ? (state.multiplier > 1 ? t.spinAgain(names[state.turn]) : t.spinPrompt(names[state.turn]))
      : null;
  const promptGold = state.phase === 'landed' && segment?.kind === 'double';

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

          {/* Prompt + wheel, with the question / bankrot card over them */}
          <div className="relative flex min-h-0 flex-1 flex-col gap-[clamp(6px,1vh,12px)]">
            <div className="flex h-[clamp(28px,4.4vh,48px)] shrink-0 items-center justify-center gap-2">
              <AnimatePresence mode="wait">
                {!finished && prompt && (
                  <motion.p
                    key={prompt}
                    className="inline-flex items-center gap-[0.5em] rounded-full px-[1.1em] py-[0.3em] text-[clamp(13px,2.3vh,24px)] font-extrabold shadow-elev-1"
                    style={promptGold
                      ? { background: `linear-gradient(160deg, ${WHEEL.double}, ${WHEEL.doubleDeep})`, color: WHEEL.doubleInk }
                      : { background: turnTeam.solid, color: '#ffffff' }}
                    initial={animate ? { y: -12, opacity: 0, scale: 0.9 } : { opacity: 0 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 12, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                  >
                    {prompt}
                    {state.multiplier > 1 && state.phase !== 'landed' && (
                      <span
                        className="rounded-full px-[0.5em] font-t-display font-black"
                        style={{ background: `linear-gradient(160deg, ${WHEEL.double}, ${WHEEL.doubleDeep})`, color: WHEEL.doubleInk }}
                      >
                        ×{state.multiplier}
                      </span>
                    )}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="aspect-square" style={{ height: 'min(97%, 58vw)' }}>
                  <Wheel
                    spinId={state.spinId}
                    target={state.target}
                    spinning={state.phase === 'spinning'}
                    canSpin={canSpin}
                    highlight={showLanded ? state.target : null}
                    result={hub}
                    color={turnTeam.solid}
                    onSpin={spin}
                    onLanded={land}
                    spinLabel={t.spin}
                    weakLabel={t.weakSpin}
                    bankruptLabel={t.bankrupt}
                    animate={animate}
                  />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {cardOpen && state.question && (
                <QuestionCard
                  key={`q-${state.spinId}`}
                  question={state.question}
                  turn={state.turn}
                  nextTeam={nextTeam}
                  names={names}
                  badge={
                    <span className="inline-flex items-baseline gap-[0.15em]">
                      {state.stake}
                      {state.multiplier > 1 && <span className="text-[0.42em] opacity-85">×{state.multiplier}</span>}
                    </span>
                  }
                  done={state.phase === 'result'}
                  outcome={state.outcome === 'bankrupt' ? null : state.outcome}
                  picked={state.picked}
                  gained={state.gained}
                  timeLimitMs={state.timeLimitMs}
                  remainingMs={state.remainingMs}
                  onAnswer={answer}
                  onNext={next}
                  animate={animate}
                  t={t}
                />
              )}
              {bankrupt && (
                <BankruptCard
                  key={`b-${state.spinId}`}
                  name={names[state.turn]}
                  nextTeam={nextTeam}
                  names={names}
                  onNext={next}
                  animate={animate}
                  t={t}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Footer: teacher controls left, round progress center, finish right */}
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
            {!finished ? (
              <div className="flex items-center gap-[clamp(6px,0.8vw,12px)]">
                <span className="text-[clamp(11px,1.5vh,15px)] font-bold text-on-surface-variant">{t.roundOf(state.round, state.rounds)}</span>
                <span className="flex gap-1">
                  {Array.from({ length: state.rounds }, (_, i) => (
                    <span
                      key={i}
                      className="h-[clamp(6px,0.9vh,9px)] w-[clamp(6px,0.9vh,9px)] rounded-full transition-colors duration-300"
                      style={{ background: i < state.round ? turnTeam.solid : 'var(--m3-outline-variant)', opacity: i < state.round - 1 ? 0.45 : 1 }}
                    />
                  ))}
                </span>
              </div>
            ) : <span />}
            <div className="flex justify-end">
              {state.phase === 'spin' && (
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

          <PauseOverlay
            open={state.pausedAt !== null && !confirmExit}
            onResume={() => dispatch({ type: 'resume', now: performance.now() })}
            t={t}
          />

          {/* Celebrations */}
          {animate && state.phase === 'result' && state.outcome === 'correct' && (
            <Confetti key={`c-${answers}`} color={turnTeam.solid} />
          )}
          {animate && state.phase === 'landed' && segment?.kind === 'double' && (
            <Confetti key={`d-${state.spinId}`} color={WHEEL.double} />
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
