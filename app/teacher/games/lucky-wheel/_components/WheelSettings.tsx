'use client';

import { Play } from 'lucide-react';
import { Button, Chip } from '@/components/ui';
import { MIN_GAME_QUESTIONS } from '../../_lib/questionDeck';
import type { PickedTest } from '../../_components/TestPicker';
import { QuestionSummary, TeamSetup, TimerField } from '../../_components/TeamGameSettings';
import { questionsNeeded } from '../_lib/engine';
import type { WheelText } from '../_lib/i18n';

export const ROUND_OPTIONS = [3, 5, 8, 10];

/** Round counts this test can serve (one question per turn); a short test gets one fitting count. */
export function roundChoices(usable: number, teamCount: number): number[] {
  const fits = ROUND_OPTIONS.filter((r) => questionsNeeded(teamCount, r) <= usable);
  if (fits.length) return fits;
  const most = Math.floor(usable / teamCount);
  return usable >= MIN_GAME_QUESTIONS && most >= 1 ? [most] : [];
}

interface Props {
  picked: PickedTest | null;
  teamCount: number;
  onTeamCount: (n: number) => void;
  names: string[];
  onName: (i: number, value: string) => void;
  seconds: number | null;
  onSeconds: (s: number | null) => void;
  rounds: number;
  onRounds: (n: number) => void;
  onStart: () => void;
  t: WheelText;
}

export default function WheelSettings({
  picked, teamCount, onTeamCount, names, onName, seconds, onSeconds, rounds, onRounds, onStart, t,
}: Props) {
  const usable = picked?.analysis.usable.length ?? 0;
  const enough = usable >= MIN_GAME_QUESTIONS;
  const choices = roundChoices(usable, teamCount);
  const shown = choices.length && !ROUND_OPTIONS.includes(choices[0]) ? choices : ROUND_OPTIONS;
  const limited = !!picked && enough && choices.length < ROUND_OPTIONS.length;

  return (
    <div className="flex flex-col gap-4">
      <TeamSetup teamCount={teamCount} onTeamCount={onTeamCount} names={names} onName={onName} t={t} />

      <div>
        <p className="mb-2 text-[13px] font-bold text-on-surface">{t.rounds}</p>
        <div className="flex flex-wrap gap-2">
          {shown.map((r) => (
            <Chip key={r} selected={rounds === r} disabled={!!picked && !choices.includes(r)} onClick={() => onRounds(r)}>
              {r}
            </Chip>
          ))}
        </div>
        {picked && enough && (
          <p className="mt-2 text-[12px] font-medium text-on-surface-variant">
            {t.roundsHint(questionsNeeded(teamCount, rounds))}{limited ? ` ${t.roundsLimited}` : ''}
          </p>
        )}
      </div>

      <TimerField seconds={seconds} onSeconds={onSeconds} t={t} />
      <QuestionSummary picked={picked} t={t} />

      <Button size="lg" icon={<Play />} disabled={!picked || !enough || !choices.length} onClick={onStart} className="w-full">
        {t.start}
      </Button>
    </div>
  );
}
