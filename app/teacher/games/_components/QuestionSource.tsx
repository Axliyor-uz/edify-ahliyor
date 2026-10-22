'use client';

import { useRef, useState } from 'react';
import { Library, Sparkles } from 'lucide-react';
import { cn } from '@/components/ui';
import type { Lang } from '@/types/Math';
import { aiSetToPicked, loadAiSet, saveAiSet, type AiSet } from '../_lib/aiSet';
import { aiText } from '../_lib/aiText';
import TestPicker, { type PickedTest, type PickerText } from './TestPicker';
import AiQuestionMaker from './AiQuestionMaker';

/**
 * Step 1 of every game: where the questions come from —
 * the teacher's own tests, or a set made with AI on the spot.
 * Whichever tab is open owns the selection.
 */

type Source = 'tests' | 'ai';

interface Props {
  uid: string;
  lang: Lang;
  picked: PickedTest | null;
  onPick: (picked: PickedTest | null) => void;
  /** How many questions this game's current settings need. */
  suggestedCount: number;
  t: PickerText;
}

export default function QuestionSource({ uid, lang, picked, onPick, suggestedCount, t }: Props) {
  const tx = aiText(lang);
  const [source, setSource] = useState<Source>('tests');
  /** undefined = not read from storage yet (the AI tab was never opened). */
  const [aiSet, setAiSet] = useState<AiSet | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  /** The test picked before switching to AI, restored on the way back. */
  const lastTest = useRef<PickedTest | null>(null);

  const switchTo = (next: Source) => {
    if (next === source || busy) return;
    if (next === 'ai') {
      lastTest.current = picked;
      const set = aiSet === undefined ? loadAiSet(uid) : aiSet;
      setAiSet(set);
      onPick(set ? aiSetToPicked(set, lang) : null);
    } else {
      onPick(lastTest.current);
    }
    setSource(next);
  };

  const changeSet = (set: AiSet | null) => {
    setAiSet(set);
    saveAiSet(uid, set);
    onPick(set ? aiSetToPicked(set, lang) : null);
  };

  const tabs: { id: Source; label: string; icon: React.ReactNode }[] = [
    { id: 'tests', label: tx.tabTests, icon: <Library size={17} /> },
    { id: 'ai', label: tx.tabAi, icon: <Sparkles size={17} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-m3-md bg-surface-container-high p-1">
        {tabs.map((tab) => {
          const on = tab.id === source;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={busy && !on}
              onClick={() => switchTo(tab.id)}
              className={cn(
                'flex min-h-11 items-center justify-center gap-2 rounded-m3-sm px-3 text-[14px] font-bold transition-colors disabled:opacity-50',
                on ? 'bg-primary text-on-primary shadow-elev-1' : 'text-on-surface-variant hover:bg-state-hover',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Both stay mounted once opened: no re-fetch of the tests, and the form keeps what was typed. */}
      <div hidden={source !== 'tests'}>
        <TestPicker uid={uid} lang={lang} selectedId={picked?.test.id ?? null} onSelect={onPick} t={t} />
      </div>
      {aiSet !== undefined && (
        <div hidden={source !== 'ai'}>
          <AiQuestionMaker lang={lang} suggestedCount={suggestedCount} set={aiSet} onSet={changeSet} onBusy={setBusy} />
        </div>
      )}
    </div>
  );
}
