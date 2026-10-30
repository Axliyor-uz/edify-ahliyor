"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Trash2 } from "lucide-react";
import { IconButton, cn } from "@/components/ui";
import { useTeacherLanguage } from "@/app/teacher/layout";
import MathText from "./MathText";

const TEXT = {
  uz: { solution: "Yechim", hide: "Yechimni yopish", remove: "O'chirish" },
  en: { solution: "Solution", hide: "Hide solution", remove: "Remove" },
  ru: { solution: "Решение", hide: "Скрыть решение", remove: "Удалить" },
} as const;

export interface DraftQuestionCardProps {
  /** 0-based position; shown as 1, 2, 3… */
  index: number;
  /** Already-picked text (one language) — MathText renders the math. */
  question: string;
  options?: { key: string; text: string }[];
  /** Keys of the correct option(s). */
  correct?: string[];
  explanation?: string;
  /** Small grey labels in the header (topic, difficulty…). Empty ones are skipped. */
  meta?: (string | undefined | null)[];
  onRemove?: () => void;
  /** Extra body below the options (open answers, rubrics…). */
  children?: ReactNode;
}

/** One AI-generated question, as the teacher reviews it before saving. */
export default function DraftQuestionCard({ index, question, options = [], correct = [], explanation, meta = [], onRemove, children }: DraftQuestionCardProps) {
  const { lang } = useTeacherLanguage();
  const t = TEXT[lang] ?? TEXT.uz;
  const [showSolution, setShowSolution] = useState(false);
  const labels = meta.filter((m): m is string => !!m && !!m.trim());
  const hasSolution = !!explanation?.trim();

  return (
    <article className="rounded-m3-lg border border-outline-variant bg-surface-container-lowest p-4 md:p-5">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 grid h-6 min-w-6 place-items-center rounded-m3-xs bg-surface-container px-1.5 text-xs font-semibold tabular-nums text-on-surface-variant">
          {index + 1}
        </span>
        <p className="min-w-0 flex-1 truncate pt-1 text-xs text-on-surface-variant">{labels.join(" · ")}</p>
        {onRemove && (
          <IconButton size="sm" aria-label={t.remove} title={t.remove} onClick={onRemove} className="-mr-2 -mt-1 hover:text-error">
            <Trash2 />
          </IconButton>
        )}
      </header>

      <div className="mt-3 text-[15px] leading-relaxed text-on-surface">
        <MathText text={question} />
      </div>

      {options.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {options.map(({ key, text }) => {
            const isCorrect = correct.includes(key);
            return (
              <li
                key={key}
                className={cn(
                  "flex items-baseline gap-2.5 rounded-m3-sm border px-3 py-2 text-sm text-on-surface",
                  isCorrect ? "border-success ring-1 ring-inset ring-success" : "border-outline-variant",
                )}
              >
                <span className={cn("w-4 shrink-0 text-xs font-semibold", isCorrect ? "text-success" : "text-on-surface-variant")}>{key}</span>
                <span className="min-w-0 flex-1 break-words"><MathText text={text} /></span>
                {isCorrect && <Check size={16} className="shrink-0 self-center text-success" aria-label="✓" />}
              </li>
            );
          })}
        </ul>
      )}

      {children}

      {hasSolution && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowSolution((s) => !s)}
            aria-expanded={showSolution}
            className="inline-flex items-center gap-1 rounded-m3-xs py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface"
          >
            {showSolution ? t.hide : t.solution}
            <ChevronDown size={14} className={cn("transition-transform", showSolution && "rotate-180")} />
          </button>
          {showSolution && (
            <div className="mt-2 rounded-m3-sm bg-surface-container px-3 py-2.5 text-sm leading-relaxed text-on-surface">
              <MathText text={explanation} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}
