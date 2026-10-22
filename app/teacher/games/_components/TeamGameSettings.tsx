'use client';

import { AlertTriangle, Minus, Plus, ShieldCheck, TimerOff } from 'lucide-react';
import { Banner, Card, Chip, TextField } from '@/components/ui';
import { MIN_GAME_QUESTIONS, type SkipReason } from '../_lib/questionDeck';
import { GAME_TEAMS, TEAM_COUNTS } from '../_lib/stage';
import type { PickedTest } from './TestPicker';

/**
 * Setup blocks shared by the team games (Savol doskasi, Omad g'ildiragi):
 * team count + names, the per-question timer, and the question summary.
 */

export const NAME_MAX = 20;
export const TIMER_OPTIONS: (number | null)[] = [15, 30, 60, null];
export const TIMER_STEP = 5;
export const TIMER_MIN = 5;
export const TIMER_MAX = 300;
const TIMER_DEFAULT = 30;

/** Next stepper value; from "off" either button turns the timer on at 30 s. */
const step = (s: number | null, by: number) =>
  s === null ? TIMER_DEFAULT : Math.min(TIMER_MAX, Math.max(TIMER_MIN, s + by));

export interface TeamSettingsText {
  teams: string;
  teamNames: string;
  teamLabel: (i: number) => string;
  defaultNames: string[];
  timer: string;
  timerOff: string;
  sec: string;
  timerHint: string;
  timerOffHint: string;
  summary: string;
  usable: string;
  skippedOpen: string;
  skippedMulti: string;
  skippedBlock: string;
  skippedBroken: string;
  skippedNote: string;
  blockedTitle: string;
  blocked: (usable: number, min: number) => string;
  fair: string;
}

/** Team count chips + one name field per team. Without `onTeamCount` the count is fixed (no chips). */
export function TeamSetup({ teamCount, onTeamCount, names, onName, t }: {
  teamCount: number;
  onTeamCount?: (n: number) => void;
  names: string[];
  onName: (i: number, value: string) => void;
  t: TeamSettingsText;
}) {
  return (
    <>
      {onTeamCount && (
        <div>
          <p className="mb-2 text-[13px] font-bold text-on-surface">{t.teams}</p>
          <div className="flex flex-wrap gap-2">
            {TEAM_COUNTS.map((n) => (
              <Chip key={n} selected={teamCount === n} onClick={() => onTeamCount(n)}>
                <span className="flex items-center gap-1.5">
                  <span className="flex -space-x-1">
                    {GAME_TEAMS.slice(0, n).map((c) => (
                      <span key={c.solid} className="h-2.5 w-2.5 rounded-full ring-2 ring-surface-container-lowest" style={{ background: c.solid }} />
                    ))}
                  </span>
                  {n}
                </span>
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[13px] font-bold text-on-surface">{t.teamNames}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {GAME_TEAMS.slice(0, teamCount).map((c, i) => (
            <div key={c.solid} className="rounded-m3-md border-2 p-2.5" style={{ borderColor: c.solid, background: c.tint }}>
              <TextField
                label={t.teamLabel(i)}
                value={names[i]}
                maxLength={NAME_MAX}
                placeholder={t.defaultNames[i]}
                onChange={(e) => onName(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="m3-interactive flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container transition-transform active:scale-90 disabled:bg-disabled-bg disabled:text-disabled-fg"
    >
      {children}
    </button>
  );
}

/** Timer: − / + stepper for any value, chips for the usual ones. */
export function TimerField({ seconds, onSeconds, t }: { seconds: number | null; onSeconds: (s: number | null) => void; t: TeamSettingsText }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-bold text-on-surface">{t.timer}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1">
          <StepButton label={`−${TIMER_STEP} ${t.sec}`} disabled={seconds !== null && seconds <= TIMER_MIN} onClick={() => onSeconds(step(seconds, -TIMER_STEP))}>
            <Minus size={18} strokeWidth={2.6} />
          </StepButton>
          <span className="min-w-[92px] text-center">
            {seconds === null ? (
              <span className="text-[14px] font-bold text-on-surface-variant">{t.timerOff}</span>
            ) : (
              <>
                <b className="font-t-display text-[22px] font-black tabular-nums text-on-surface">{seconds}</b>
                <span className="ml-1 text-[12px] font-semibold text-on-surface-variant">{t.sec}</span>
              </>
            )}
          </span>
          <StepButton label={`+${TIMER_STEP} ${t.sec}`} disabled={seconds !== null && seconds >= TIMER_MAX} onClick={() => onSeconds(step(seconds, TIMER_STEP))}>
            <Plus size={18} strokeWidth={2.6} />
          </StepButton>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIMER_OPTIONS.map((s) => (
            <Chip key={s ?? 'off'} size="sm" selected={seconds === s} onClick={() => onSeconds(s)} icon={s === null ? <TimerOff /> : undefined}>
              {s === null ? t.timerOff : `${s} ${t.sec}`}
            </Chip>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[12px] font-medium text-on-surface-variant">{seconds === null ? t.timerOffHint : t.timerHint}</p>
    </div>
  );
}

/** Usable / skipped counts, the "not enough" banner and the fairness note. */
export function QuestionSummary({ picked, t }: { picked: PickedTest | null; t: TeamSettingsText }) {
  const usable = picked?.analysis.usable.length ?? 0;
  const enough = usable >= MIN_GAME_QUESTIONS;
  const skipped: { key: SkipReason; label: string }[] = [
    { key: 'open', label: t.skippedOpen },
    { key: 'multi', label: t.skippedMulti },
    { key: 'block', label: t.skippedBlock },
    { key: 'broken', label: t.skippedBroken },
  ];
  const shown = picked ? skipped.filter((s) => picked.analysis.skipped[s.key] > 0) : [];

  return (
    <>
      {picked && (
        <Card variant="outlined" className="flex flex-col gap-2">
          <p className="text-[13px] font-bold text-on-surface">{t.summary}</p>
          <div className="flex items-center justify-between rounded-m3-sm bg-surface-container-low px-3 py-2">
            <span className="text-[13px] font-semibold text-on-surface">{t.usable}</span>
            <b className={`text-[16px] tabular-nums ${enough ? 'text-on-surface' : 'text-error'}`}>{usable} / {picked.analysis.total}</b>
          </div>
          {shown.length > 0 && (
            <>
              {shown.map((s) => (
                <div key={s.key} className="flex items-center justify-between px-3 text-[12.5px] font-medium text-on-surface-variant">
                  <span>{s.label}</span>
                  <span className="tabular-nums">−{picked!.analysis.skipped[s.key]}</span>
                </div>
              ))}
              <p className="px-3 text-[11.5px] text-on-surface-variant">{t.skippedNote}</p>
            </>
          )}
        </Card>
      )}

      {picked && !enough && (
        <Banner tone="error" icon={<AlertTriangle />} title={t.blockedTitle}>
          {t.blocked(usable, MIN_GAME_QUESTIONS)}
        </Banner>
      )}

      <p className="flex items-start gap-2 text-[12px] font-medium text-on-surface-variant">
        <ShieldCheck size={15} className="mt-px shrink-0 text-primary" /> {t.fair}
      </p>
    </>
  );
}
