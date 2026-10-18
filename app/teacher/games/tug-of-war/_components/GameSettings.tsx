'use client';

import { AlertTriangle, Infinity as InfinityIcon, Play, ShieldCheck } from 'lucide-react';
import { Banner, Button, Card, Chip, TextField } from '@/components/ui';
import { MIN_GAME_QUESTIONS, estimateMinutes, neededForMinutes, type SkipReason } from '../../_lib/questionDeck';
import { TEAM_THEME, TEAMS, type Team } from '../_lib/teams';
import type { TugText } from '../_lib/i18n';
import type { PickedTest } from '../../_components/TestPicker';

export const TIME_OPTIONS: (number | null)[] = [1, 2, 3, 5, null];
export const NAME_MAX = 20;

interface Props {
  picked: PickedTest | null;
  names: Record<Team, string>;
  onName: (team: Team, value: string) => void;
  minutes: number | null;
  onMinutes: (m: number | null) => void;
  onStart: () => void;
  t: TugText;
}

const fmtMin = (m: number) => (m < 1 ? '<1' : m >= 10 ? String(Math.round(m)) : m.toFixed(1).replace(/\.0$/, ''));

export default function GameSettings({ picked, names, onName, minutes, onMinutes, onStart, t }: Props) {
  const usable = picked?.analysis.usable.length ?? 0;
  const enough = usable >= MIN_GAME_QUESTIONS;
  const lasts = estimateMinutes(usable);
  const short = enough && minutes !== null && usable < neededForMinutes(minutes);

  const skipped: { key: SkipReason; label: string }[] = [
    { key: 'open', label: t.skippedOpen },
    { key: 'multi', label: t.skippedMulti },
    { key: 'block', label: t.skippedBlock },
    { key: 'broken', label: t.skippedBroken },
  ];
  const anySkipped = picked ? skipped.some((s) => picked.analysis.skipped[s.key] > 0) : false;

  return (
    <div className="flex flex-col gap-4">
      {/* Team names — framed in their fixed team colors */}
      <div>
        <p className="mb-2 text-[13px] font-bold text-on-surface">{t.teamNames}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEAMS.map((team) => (
            <div key={team} className="rounded-m3-md border-2 p-2.5" style={{ borderColor: TEAM_THEME[team].solid, background: TEAM_THEME[team].tint }}>
              <TextField
                label={team === 'blue' ? t.blueLabel : t.redLabel}
                value={names[team]}
                maxLength={NAME_MAX}
                placeholder={team === 'blue' ? t.blueDefault : t.redDefault}
                onChange={(e) => onName(team, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Time */}
      <div>
        <p className="mb-2 text-[13px] font-bold text-on-surface">{t.time}</p>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((m) => (
            <Chip key={m ?? 'inf'} selected={minutes === m} onClick={() => onMinutes(m)} icon={m === null ? <InfinityIcon /> : undefined}>
              {m === null ? t.infinite : `${m} ${t.min}`}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[12px] font-medium text-on-surface-variant">{minutes === null ? t.infiniteHint : t.timedHint}</p>
      </div>

      {/* Question summary */}
      {picked && (
        <Card variant="outlined" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-bold text-on-surface">{t.summary}</p>
            <p className="text-[12px] font-semibold text-on-surface-variant">{t.lasts(fmtMin(lasts))}</p>
          </div>
          <div className="flex items-center justify-between rounded-m3-sm bg-surface-container-low px-3 py-2">
            <span className="text-[13px] font-semibold text-on-surface">{t.usable}</span>
            <b className={`text-[16px] tabular-nums ${enough ? 'text-on-surface' : 'text-error'}`}>{usable} / {picked.analysis.total}</b>
          </div>
          {anySkipped && (
            <>
              {skipped.filter((s) => picked.analysis.skipped[s.key] > 0).map((s) => (
                <div key={s.key} className="flex items-center justify-between px-3 text-[12.5px] font-medium text-on-surface-variant">
                  <span>{s.label}</span>
                  <span className="tabular-nums">−{picked.analysis.skipped[s.key]}</span>
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
      {short && (
        <Banner tone="warning" icon={<AlertTriangle />}>{t.shortWarn(fmtMin(lasts))}</Banner>
      )}

      <p className="flex items-start gap-2 text-[12px] font-medium text-on-surface-variant">
        <ShieldCheck size={15} className="mt-px shrink-0 text-primary" /> {t.fair}
      </p>

      <Button size="lg" icon={<Play />} disabled={!picked || !enough} onClick={onStart} className="w-full">
        {t.start}
      </Button>
    </div>
  );
}
