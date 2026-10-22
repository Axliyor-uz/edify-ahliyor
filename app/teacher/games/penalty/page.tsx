'use client';

import { createPortal } from 'react-dom';
import { Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ListChecks, Maximize, Minimize, MonitorSmartphone, Pause, Volume2, VolumeX, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, Card, ConfirmDialog, PageHeader, MOTION_ON } from '@/components/ui';
import { fetchTeacherTest } from '@/services/teacherTestService';
import type { Lang } from '@/types/Math';

import { analyzeTest, buildDeck } from '../_lib/questionDeck';
import { sfx, useGameSound } from '../_lib/sound';
import { useBigScreen } from '../_lib/useBigScreen';
import { GAME_TEAMS, STAGE } from '../_lib/stage';
import type { PickedTest } from '../_components/TestPicker';
import QuestionSource from '../_components/QuestionSource';
import { suggestCount } from '../_lib/aiSet';
import Confetti from '../_components/Confetti';
import StageBackdrop from '../_components/StageBackdrop';
import QuestionCard from '../_components/QuestionCard';
import Podium from '../_components/Podium';
import { ControlButton, PauseOverlay } from '../_components/PlayControls';
import { goals, initialState, isOver, kicker, kickerOf, questionsNeeded, reducer, ZONE_COUNT } from './_lib/engine';
import { penaltyText } from './_lib/i18n';
import { PITCH } from './_lib/theme';
import PenaltySettings, { kickChoices } from './_components/PenaltySettings';
import KickTally from './_components/KickTally';
import KickBanner from './_components/KickBanner';
import Stadium, { KICK_MS } from './_components/Stadium';

/**
 * Penalti seriyasi — penalty shootout quiz (docs/GAMES.md).
 * Setup (test, 2 team names, kicks, timer) → full-screen stadium → podium.
 * No Firestore writes; the only read is the teacher's own `custom_tests`.
 */

/** How long the answered card stays up before the aim / the missed kick. */
const ANSWER_MS = 1200;

export default function PenaltyPage() {
  return (
    <Suspense fallback={null}>
      <Penalty />
    </Suspense>
  );
}

function Penalty() {
  const { user } = useAuth() as { user: { uid: string } | null };
  const { lang } = useTeacherLanguage();
  const t = penaltyText(lang);
  const L = lang as Lang;
  const router = useRouter();
  const presetId = useSearchParams().get('testId');
  const reduced = useReducedMotion();
  const animate = MOTION_ON && !reduced;
  const bigScreen = useBigScreen();
  const [muted, toggleMute] = useGameSound();

  const [phase, setPhase] = useState<'setup' | 'play'>('setup');
  const [picked, setPicked] = useState<PickedTest | null>(null);
  const [rawNames, setRawNames] = useState(['', '']);
  const [seconds, setSeconds] = useState<number | null>(30);
  const [kicks, setKicks] = useState(5);
  /** Games started; the first kick alternates between the teams on every replay. */
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());

  const names = rawNames.map((n, i) => n.trim() || t.defaultNames[i]);

  // Largest allowed kick count not above the teacher's choice.
  const choices = kickChoices(picked?.analysis.usable.length ?? 0);
  const kickCount = !choices.length || choices.includes(kicks) ? kicks : (choices.filter((k) => k <= kicks).pop() ?? choices[0]);

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
      // The whole deck: sudden death uses the questions left after the regular kicks.
      deck: buildDeck(picked.analysis.usable, L),
      kicksPerTeam: kickCount,
      starter: gamesPlayed % 2,
      timeLimitMs: seconds === null ? null : seconds * 1000,
      now: performance.now(),
    });
    setGamesPlayed((n) => n + 1);
    setPhase('play');
    // Projector game: go full screen right away (allowed — we're inside the click).
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }, [picked, L, kickCount, gamesPlayed, seconds]);

  const playing = phase === 'play';

  // Question clock — runs only while a timed question is open.
  const timed = playing && state.phase === 'question' && state.endsAt !== null && state.pausedAt === null;
  useEffect(() => {
    if (!timed) return;
    const id = window.setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 100);
    return () => window.clearInterval(id);
  }, [timed]);

  // Answered: show the outcome for a beat, then aim (correct) or the missed kick.
  useEffect(() => {
    if (!playing || state.phase !== 'answered') return;
    const id = window.setTimeout(() => dispatch({ type: 'proceed' }), ANSWER_MS);
    return () => window.clearTimeout(id);
  }, [playing, state.phase]);

  // Kick: the stadium plays it, then the kick is recorded.
  useEffect(() => {
    if (!playing || state.phase !== 'kick') return;
    const impact = window.setTimeout(sfx.kick, animate ? KICK_MS.impact : 0);
    const done = window.setTimeout(() => dispatch({ type: 'kicked' }), animate ? KICK_MS.animated : KICK_MS.still);
    return () => { window.clearTimeout(impact); window.clearTimeout(done); };
  }, [playing, state.phase, animate]);

  // Sounds that follow state rather than a click.
  const secs = state.remainingMs === null ? null : Math.ceil(state.remainingMs / 1000);
  useEffect(() => {
    if (timed && secs !== null && secs > 0 && secs <= 5) sfx.tick();
  }, [secs, timed]);
  useEffect(() => {
    if (!playing) return;
    if (state.phase === 'question') sfx.whistle();
    if (state.phase === 'answered') (state.outcome === 'correct' ? sfx.correct : state.outcome === 'timeout' ? sfx.timeout : sfx.wrong)();
    if (state.phase === 'result') (state.shot === 'goal' ? sfx.goal : state.shot === 'saved' ? sfx.save : sfx.miss)();
    if (state.phase === 'finished') sfx.win();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, state.phase, state.question]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const answer = (optionId: string) => {
    if (state.phase !== 'question') return;
    // The keeper's dive is drawn now, before the team aims (docs/GAMES.md).
    dispatch({ type: 'answer', optionId, keeperZone: Math.floor(Math.random() * ZONE_COUNT), now: performance.now() });
  };
  const aim = (zone: number) => dispatch({ type: 'aim', zone });
  const next = () => dispatch({ type: 'next', now: performance.now() });

  // Keyboard: A–F / 1–6 = answer, 1–5 = aim, Space/Enter = continue, P = pause.
  const live = useRef({ state, answer, aim, next });
  useEffect(() => { live.current = { state, answer, aim, next }; });
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [role="dialog"]')) return;
      const c = live.current;
      const s = c.state;
      if (e.key === 'p' || e.key === 'P') {
        if (s.phase === 'question' && s.endsAt !== null) {
          dispatch({ type: s.pausedAt === null ? 'pause' : 'resume', now: performance.now() });
        }
        return;
      }
      if (s.pausedAt !== null) return;
      if (s.phase === 'result' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        c.next();
        return;
      }
      if (s.phase === 'aim') {
        const zone = '12345'.indexOf(e.key);
        if (zone >= 0) c.aim(zone);
        return;
      }
      if (s.phase === 'question' && s.question) {
        const k = e.key.toLowerCase();
        const idx = 'abcdef'.indexOf(k) >= 0 ? 'abcdef'.indexOf(k) : '123456'.indexOf(k);
        const opt = idx >= 0 ? s.question.options[idx] : undefined;
        if (opt) c.answer(opt.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  // Don't lose a running game to an accidental tab close.
  useEffect(() => {
    if (!playing || state.phase === 'finished') return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [playing, state.phase]);

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
              <QuestionSource uid={user.uid} lang={L} picked={picked} onPick={setPicked} suggestedCount={suggestCount(questionsNeeded(kicks) + 4)} t={t} />
            )}
          </Card>

          <div className="flex flex-col gap-5">
            <Card className="flex flex-col gap-3">
              <h2 className="text-[15px] font-bold text-on-surface">{t.step2}</h2>
              {picked && <p className="truncate text-[13px] font-semibold text-primary">{picked.test.title}</p>}
              <PenaltySettings
                picked={picked}
                names={rawNames}
                onName={(i, v) => setRawNames((n) => n.map((x, k) => (k === i ? v : x)))}
                seconds={seconds}
                onSeconds={setSeconds}
                kicks={kickCount}
                onKicks={setKicks}
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
  // In 'result' the kick is already recorded, so the kick on screen is the last one.
  const kickIndex = state.phase === 'result' ? state.kicks.length - 1 : state.kicks.length;
  const team = kickerOf(state.starter, kickIndex);
  const round = Math.floor(kickIndex / 2) + 1;
  const suddenDeath = round > state.kicksPerTeam;
  const nextTeam = isOver(state) ? null : kicker(state);
  const score = goals(state);
  const cardOpen = state.question !== null && (state.phase === 'question' || state.phase === 'answered');
  const canPause = state.phase === 'question' && state.endsAt !== null;

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
          <KickTally
            names={names}
            kicks={state.kicks}
            starter={state.starter}
            kicksPerTeam={state.kicksPerTeam}
            goals={score}
            current={finished ? null : team}
            animate={animate}
          />

          {/* Stadium, with the question card / result banner over it */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[clamp(16px,1.8vw,30px)] shadow-elev-2" style={{ background: PITCH.standsTop }}>
            <Stadium
              phase={state.phase}
              shot={state.shot}
              aimZone={state.aimZone}
              keeperZone={state.keeperZone}
              kickNo={kickIndex}
              kickerColor={GAME_TEAMS[team].solid}
              keeperColor={GAME_TEAMS[1 - team].solid}
              canAim={state.phase === 'aim' && !confirmExit}
              onAim={aim}
              zoneLabels={t.zones}
              animate={animate}
            />

            {/* Centered by a wrapper: framer transforms would override Tailwind's translate */}
            <div className="pointer-events-none absolute inset-x-0 top-[3%] z-10 flex justify-center">
              <AnimatePresence>
                {state.phase === 'aim' && (
                  <motion.p
                    key="aim"
                    className="whitespace-nowrap rounded-full px-[1.1em] py-[0.3em] text-[clamp(14px,2.6vh,28px)] font-extrabold text-white shadow-elev-2"
                    style={{ background: GAME_TEAMS[team].solid }}
                    initial={animate ? { opacity: 0, y: -12 } : { opacity: 0 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  >
                    {t.aimPrompt(names[team])}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {cardOpen && state.question && (
                <QuestionCard
                  key={`q-${state.question.key}`}
                  question={state.question}
                  turn={team}
                  nextTeam={null}
                  names={names}
                  badge={round}
                  done={state.phase === 'answered'}
                  outcome={state.outcome}
                  picked={state.picked}
                  gained={null}
                  timeLimitMs={state.timeLimitMs}
                  remainingMs={state.remainingMs}
                  onAnswer={answer}
                  animate={animate}
                  t={t}
                />
              )}
              {state.phase === 'result' && state.shot && (
                <KickBanner
                  key={`r-${kickIndex}`}
                  shot={state.shot}
                  outcome={state.outcome}
                  team={team}
                  nextTeam={nextTeam}
                  names={names}
                  onNext={next}
                  animate={animate}
                  t={t}
                />
              )}
            </AnimatePresence>

            {animate && state.phase === 'result' && state.shot === 'goal' && (
              <Confetti key={`c-${kickIndex}`} color={GAME_TEAMS[team].solid} />
            )}
          </div>

          {/* Footer: teacher controls left, kick progress center */}
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
              suddenDeath ? (
                <span className="rounded-full px-[0.9em] py-[0.2em] text-[clamp(11px,1.6vh,16px)] font-extrabold text-white" style={{ background: STAGE.wrong }}>
                  {t.suddenDeath}
                </span>
              ) : (
                <span className="text-[clamp(11px,1.5vh,15px)] font-bold text-on-surface-variant">{t.kickOf(round, state.kicksPerTeam)}</span>
              )
            ) : <span />}
            <span />
          </div>

          <PauseOverlay
            open={state.pausedAt !== null && !confirmExit}
            onResume={() => dispatch({ type: 'resume', now: performance.now() })}
            t={t}
          />

          {finished && (
            <Podium
              names={names}
              scores={score}
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
    </div>,
    document.body,
  );
}
