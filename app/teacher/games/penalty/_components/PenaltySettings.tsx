'use client';

import { Play } from 'lucide-react';
import { Button, Chip } from '@/components/ui';
import { MIN_GAME_QUESTIONS } from '../../_lib/questionDeck';
import type { PickedTest } from '../../_components/TestPicker';
import { QuestionSummary, TeamSetup, TimerField } from '../../_components/TeamGameSettings';
import { questionsNeeded } from '../_lib/engine';
import type { PenaltyText } from '../_lib/i18n';

/** 3 kicks each = 6 questions = MIN_GAME_QUESTIONS, so any playable test allows 3. */
export const KICK_OPTIONS = [3, 5, 10];

/** Kick counts this test can serve (one question per kick). */
export const kickChoices = (usable: number) => KICK_OPTIONS.filter((k) => questionsNeeded(k) <= usable);

interface Props {
  picked: PickedTest | null;
  names: string[];
  onName: (i: number, value: string) => void;
  seconds: number | null;
  onSeconds: (s: number | null) => void;
  kicks: number;
  onKicks: (n: number) => void;
  onStart: () => void;
  t: PenaltyText;
}

export default function PenaltySettings({ picked, names, onName, seconds, onSeconds, kicks, onKicks, onStart, t }: Props) {
  const usable = picked?.analysis.usable.length ?? 0;
  const enough = usable >= MIN_GAME_QUESTIONS;
  const choices = kickChoices(usable);

  return (
    <div className="flex flex-col gap-4">
      <TeamSetup teamCount={2} names={names} onName={onName} t={t} />

      <div>
        <p className="mb-2 text-[13px] font-bold text-on-surface">{t.kicks}</p>
        <div className="flex flex-wrap gap-2">
          {KICK_OPTIONS.map((k) => (
            <Chip key={k} selected={kicks === k} disabled={!!picked && !choices.includes(k)} onClick={() => onKicks(k)}>
              {k}
            </Chip>
          ))}
        </div>
        {picked && enough && (
          <p className="mt-2 text-[12px] font-medium text-on-surface-variant">
            {t.kicksHint(questionsNeeded(kicks))}{choices.length < KICK_OPTIONS.length ? ` ${t.kicksLimited}` : ''}
          </p>
        )}
      </div>

      <TimerField seconds={seconds} onSeconds={onSeconds} t={t} />
      <QuestionSummary picked={picked} t={t} />

      <Button size="lg" icon={<Play />} disabled={!picked || !enough} onClick={onStart} className="w-full">
        {t.start}
      </Button>
    </div>
  );
}
