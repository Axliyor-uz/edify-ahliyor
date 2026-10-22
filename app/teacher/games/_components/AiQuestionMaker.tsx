'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Coins, Eye, EyeOff, Library, RefreshCw, Sparkles, X } from 'lucide-react';
import { Banner, Button, IconButton, Skeleton, Switch, cn, MOTION_ON } from '@/components/ui';
import LatexRenderer from '@/components/LatexRenderer';
import { getText, normalizeQuestions } from '@/lib/questionSchema';
import { fixMath } from '@/lib/ai/fixMath';
import { useMonthlyLimit } from '@/hooks/useMonthlyLimit';
import {
  fetchDtmBankQuestions, generateGameQuestions, GameQuestionFailure,
  type GameDifficulty, type GameQuestionError, type GameQuestionLanguage,
} from '@/services/gameQuestionService';
import type { Lang } from '@/types/Math';
import { MIN_GAME_QUESTIONS } from '../_lib/questionDeck';
import { COUNT_OPTIONS, type AiSet } from '../_lib/aiSet';
import { aiText } from '../_lib/aiText';
import AiSourcePicker, { Field, emptyForm, formFromSet, isBankForm, sourceTitle, toSource, type SourceForm } from './AiSourcePicker';

/**
 * "AI bilan yaratish": source (own topic / school syllabus / exam) → questions → a quick check → play.
 * Three views: the form, the wait, the ready list (answers hidden by default,
 * since the setup screen is often already on the projector).
 */

const DIFFICULTIES: GameDifficulty[] = ['easy', 'medium', 'hard'];
const LANGUAGES: { id: GameQuestionLanguage; label: string }[] = [
  { id: 'uz', label: "O'zbekcha" },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
];

interface Props {
  lang: Lang;
  /** What this game's current settings need. */
  suggestedCount: number;
  set: AiSet | null;
  onSet: (set: AiSet | null) => void;
  onBusy: (busy: boolean) => void;
}

export default function AiQuestionMaker({ lang, suggestedCount, set, onSet, onBusy }: Props) {
  const t = aiText(lang);
  const reduced = useReducedMotion();
  const animate = MOTION_ON && !reduced;
  const limit = useMonthlyLimit();

  const [view, setView] = useState<'form' | 'loading' | 'ready'>(set ? 'ready' : 'form');
  const [form, setForm] = useState<SourceForm>(() => (set ? formFromSet(set.source, set.title) : emptyForm()));
  const [difficulty, setDifficulty] = useState<GameDifficulty>(set?.difficulty ?? 'medium');
  /** null = follow the game's suggestion until the teacher picks a number. */
  const [pickedCount, setPickedCount] = useState<number | null>(null);
  const [language, setLanguage] = useState<GameQuestionLanguage>(set?.language ?? lang);
  const [error, setError] = useState<GameQuestionError | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  const count = pickedCount ?? suggestedCount;
  /** DTM bank: ready questions, free — no credits, no language choice. */
  const bank = isBankForm(form);
  const remaining = bank || limit.isUnlimited ? Infinity : limit.remaining;
  const outOfCredits = !limit.loading && remaining < COUNT_OPTIONS[0];
  const shortOfCredits = !limit.loading && !outOfCredits && count > remaining;
  const source = toSource(form);
  const canGenerate = !!source && (bank || (!limit.loading && !outOfCredits && !shortOfCredits));

  const generate = async () => {
    if (!canGenerate || !source) return;
    const title = sourceTitle(form, t);
    setError(null);
    setView('loading');
    onBusy(true);
    try {
      const questions = source.kind === 'dtm-bank'
        ? await fetchDtmBankQuestions(source, difficulty, count)
        : await generateGameQuestions({ source, difficulty, count, language });
      onSet({ id: Date.now().toString(36), title, source, difficulty, language, questions });
      setShowAnswers(false);
      setView('ready');
    } catch (e) {
      setError(e instanceof GameQuestionFailure ? e.code : 'FAILED');
      setView('form');
    } finally {
      onBusy(false);
    }
  };

  const remove = (id: string) => {
    if (!set) return;
    onSet({ ...set, questions: set.questions.filter((q) => q.id !== id) });
  };

  const fade = {
    initial: animate ? { opacity: 0, y: 8 } : false,
    animate: { opacity: 1, y: 0 },
    exit: animate ? { opacity: 0, y: -8 } : undefined,
    transition: { duration: 0.2 },
  } as const;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {view === 'form' && (
        <motion.div key="form" {...fade} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-m3-md bg-t-primary-soft p-3 text-on-surface">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-elev-1">
              <Sparkles size={20} />
            </span>
            <p className="text-[13.5px] font-semibold leading-snug">{t.intro}</p>
          </div>

          {set && (
            <button type="button" onClick={() => setView('ready')} className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline">
              <ArrowLeft size={15} /> {t.ready(set.questions.length)}
            </button>
          )}

          <AiSourcePicker form={form} onChange={setForm} onSubmit={generate} t={t} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.difficulty}>
              <Segmented
                value={difficulty}
                onChange={setDifficulty}
                items={DIFFICULTIES.map((d, i) => ({ id: d, label: <><Bars level={i + 1} />{t.levels[d]}</> }))}
              />
            </Field>
            <Field label={t.count}>
              <Segmented
                value={count}
                onChange={setPickedCount}
                items={COUNT_OPTIONS.map((c) => ({
                  id: c,
                  disabled: c > remaining,
                  label: (
                    <span className="flex flex-col items-center leading-none">
                      {c}
                      {c === suggestedCount && <small className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wide opacity-80">{t.suggested}</small>}
                    </span>
                  ),
                }))}
              />
            </Field>
          </div>

          {!bank && (
            <Field label={t.language}>
              <Segmented value={language} onChange={setLanguage} items={LANGUAGES.map((l) => ({ id: l.id, label: l.label }))} />
            </Field>
          )}

          {error && (
            <Banner tone="error" icon={<AlertTriangle />}>
              {t.errors[error]}
              {error === 'LIMIT_REACHED' && <> <Link href="/teacher/subscription" className="font-bold text-primary underline">{t.upgrade}</Link></>}
            </Banner>
          )}
          {outOfCredits && !error && (
            <Banner tone="warning" icon={<AlertTriangle />}>
              {t.errors.LIMIT_REACHED} <Link href="/teacher/subscription" className="font-bold text-primary underline">{t.upgrade}</Link>
            </Banner>
          )}
          {shortOfCredits && <Banner tone="warning" icon={<AlertTriangle />}>{t.notEnoughCredits(remaining)}</Banner>}

          <div className="flex flex-col gap-2">
            <Button size="lg" icon={bank ? <Library /> : <Sparkles />} disabled={!canGenerate} onClick={generate} className="w-full">
              {bank ? t.fetchBank : t.generate}
            </Button>
            {!bank && !limit.loading && (
              <p className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-on-surface-variant">
                <Coins size={14} className="text-primary" /> {limit.isUnlimited ? t.unlimited : t.left(limit.remaining)}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {view === 'loading' && (
        <motion.div key="loading" {...fade} className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <motion.span
              className="absolute inset-0 rounded-full bg-t-primary-soft"
              animate={animate ? { scale: [1, 1.25, 1] } : undefined}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.span
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-elev-2"
              animate={animate ? { rotate: [0, 12, -12, 0] } : undefined}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles size={30} />
            </motion.span>
          </div>
          <div>
            <p className="text-[17px] font-extrabold text-on-surface">{t.loadingTitle}</p>
            <p className="mt-1 text-[13px] font-medium text-on-surface-variant">{t.loadingHint}</p>
          </div>
          <p className="max-w-full truncate rounded-full bg-surface-container-high px-3 py-1 text-[12.5px] font-semibold text-on-surface-variant">
            {sourceTitle(form, t)} · {t.questions(count)} · {t.levels[difficulty]}
          </p>
          <div className="grid w-full gap-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-m3-md" />)}
          </div>
        </motion.div>
      )}

      {view === 'ready' && set && (
        <motion.div key="ready" {...fade} className="flex flex-col gap-3">
          <ReadyList set={set} lang={lang} showAnswers={showAnswers} onShowAnswers={setShowAnswers} onRemove={remove} t={t} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="tonal" icon={<RefreshCw />} onClick={() => setView('form')}>{t.again}</Button>
            <p className="min-w-0 flex-1 text-right text-[11.5px] font-medium text-on-surface-variant">{t.kept}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReadyList({ set, lang, showAnswers, onShowAnswers, onRemove, t }: {
  set: AiSet;
  lang: Lang;
  showAnswers: boolean;
  onShowAnswers: (v: boolean) => void;
  onRemove: (id: string) => void;
  t: ReturnType<typeof aiText>;
}) {
  const questions = normalizeQuestions(set.questions, lang);
  const tooFew = questions.length < MIN_GAME_QUESTIONS;

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-m3-md bg-success-container px-3 py-2.5 text-on-success-container">
        <CheckCircle2 size={22} className="shrink-0" />
        <span className="min-w-0">
          <b className="block text-[14.5px] font-extrabold">{t.ready(questions.length)}</b>
          <small className="block truncate text-[12px] font-semibold opacity-85">{set.title} · {t.levels[set.difficulty]}</small>
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <Switch
          checked={showAnswers}
          onChange={(e) => onShowAnswers(e.target.checked)}
          label={<span className="flex items-center gap-1.5 font-semibold">{showAnswers ? <Eye size={15} /> : <EyeOff size={15} />} {t.showAnswers}</span>}
        />
        {!showAnswers && <p className="text-[12px] font-medium text-on-surface-variant">{t.answersHint}</p>}
      </div>

      <ol className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 custom-scrollbar">
        {questions.map((q, i) => (
          <li key={q.id} className="group flex gap-3 rounded-m3-md border border-outline-variant bg-surface-container-lowest p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-t-primary-soft text-[12.5px] font-extrabold tabular-nums text-primary">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <LatexRenderer latex={fixMath(getText(q.question, lang))} className="block text-[14px] font-semibold leading-snug text-on-surface" />
              {showAnswers && (
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {q.optionList.map((o) => {
                    const correct = o.id === q.answer;
                    return (
                      <span
                        key={o.id}
                        className={cn(
                          'flex items-center gap-1.5 rounded-m3-sm px-2.5 py-1.5 text-[13px] font-medium',
                          correct ? 'bg-success-container font-bold text-on-success-container' : 'bg-surface-container-high text-on-surface-variant',
                        )}
                      >
                        {correct ? <Check size={14} className="shrink-0" strokeWidth={3} /> : <span className="w-3.5 shrink-0" />}
                        <LatexRenderer latex={fixMath(getText(o.text, lang))} />
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <IconButton size="sm" aria-label={t.remove} title={t.remove} onClick={() => onRemove(q.id)} className="shrink-0 self-start hover:text-error">
              <X />
            </IconButton>
          </li>
        ))}
      </ol>

      {tooFew && <Banner tone="error" icon={<AlertTriangle />}>{t.tooFew(questions.length, MIN_GAME_QUESTIONS)}</Banner>}
    </>
  );
}

/** One row of equal buttons — one choice, big enough to tap on a board. */
function Segmented<T extends string | number>({ value, onChange, items }: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: React.ReactNode; disabled?: boolean }[];
}) {
  return (
    <div className="flex gap-1 rounded-m3-md bg-surface-container-high p-1" role="radiogroup">
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={it.disabled}
            onClick={() => onChange(it.id)}
            className={cn(
              'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-m3-sm px-2 py-1.5 text-[13px] font-bold transition-colors',
              on ? 'bg-primary text-on-primary shadow-elev-1' : 'text-on-surface-variant hover:bg-state-hover',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** Signal-style bars: 1, 2 or 3 filled — difficulty at a glance. */
function Bars({ level }: { level: number }) {
  return (
    <span className="flex items-end gap-[2px]" aria-hidden>
      {[1, 2, 3].map((b) => (
        <span key={b} className={cn('w-[3px] rounded-full bg-current', b > level && 'opacity-30')} style={{ height: 4 + b * 3 }} />
      ))}
    </span>
  );
}
