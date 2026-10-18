'use client';

import { Play } from 'lucide-react';
import { Button, Chip } from '@/components/ui';
import { MIN_GAME_QUESTIONS } from '../../_lib/questionDeck';
import type { PickedTest } from '../../_components/TestPicker';
import { QuestionSummary, TeamSetup, TimerField } from '../../_components/TeamGameSettings';
import type { BoardText } from '../_lib/i18n';

export const TILE_OPTIONS = [12, 16, 20, 24];

/** Board sizes this test can fill; a short test gets one size = all its questions. */
export function tileChoices(usable: number): number[] {
  const fits = TILE_OPTIONS.filter((n) => n <= usable);
  return fits.length ? fits : usable >= MIN_GAME_QUESTIONS ? [usable] : [];
}

interface Props {
  picked: PickedTest | null;
  teamCount: number;
  onTeamCount: (n: number) => void;
  names: string[];
  onName: (i: number, value: string) => void;
  seconds: number | null;
  onSeconds: (s: number | null) => void;
  tiles: number;
  onTiles: (n: number) => void;
  onStart: () => void;
  t: BoardText;
}

export default function BoardSettings({
  picked, teamCount, onTeamCount, names, onName, seconds, onSeconds, tiles, onTiles, onStart, t,
}: Props) {
  const usable = picked?.analysis.usable.length ?? 0;
  const enough = usable >= MIN_GAME_QUESTIONS;
  const choices = tileChoices(usable);
  const limited = !!picked && enough && choices.length < TILE_OPTIONS.length;

  return (
    <div className="flex flex-col gap-4">
      <TeamSetup teamCount={teamCount} onTeamCount={onTeamCount} names={names} onName={onName} t={t} />
      <TimerField seconds={seconds} onSeconds={onSeconds} t={t} />

      {/* Board size */}
      <div>
        <p className="mb-2 text-[13px] font-bold text-on-surface">{t.tiles}</p>
        <div className="flex flex-wrap gap-2">
          {(choices.length && !TILE_OPTIONS.includes(choices[0]) ? choices : TILE_OPTIONS).map((n) => (
            <Chip key={n} selected={tiles === n} disabled={!!picked && !choices.includes(n)} onClick={() => onTiles(n)}>
              {n}
            </Chip>
          ))}
        </div>
        {picked && enough && (
          <p className="mt-2 text-[12px] font-medium text-on-surface-variant">
            {t.tilesHint(tiles)}{limited ? ` ${t.tilesLimited}` : ''}
          </p>
        )}
      </div>

      <QuestionSummary picked={picked} t={t} />

      <Button size="lg" icon={<Play />} disabled={!picked || !enough} onClick={onStart} className="w-full">
        {t.start}
      </Button>
    </div>
  );
}
