// app/(student)/RASCHmodel/_components/ExamReview.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, BookOpen, ChevronDown, EyeOff } from 'lucide-react';

import QuestionCreator from '@/components/QuestionCreator';
import { Banner, Card, cn } from '@/components/student-ui';
import {
  examExpectedText, examMode, examPartExpected, isExamItemCorrect, isExamPartCorrect, partKey,
} from '@/lib/ExamTeacher';
import { MathText, pickLangText } from './ExamRunner';
import type { ExamQuestion } from '@/types/Exam';
import type { Lang, LocalizedText } from '@/types/Math';

/**
 * The per-question review shown after a paper is submitted: what was asked, what
 * the student put down, what was right, and the explanation.
 *
 * Shared by the mock exam and the teacher quiz for the same reason `ExamRunner`
 * is — a block's answer lives under per-part keys, and any surface that forgets
 * to branch on that renders `[object Object]`. One implementation, both papers.
 *
 * ⚠️ `hideAnswers` is a real mode, not a styling flag. A teacher who intends to
 * reuse a paper across two groups can withhold the key; the review then shows
 * only whether each question was right, never the correct answer or the
 * explanation. It must never leak the key through the "correct answer" line, the
 * per-part expected value, or the explanation button.
 */

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    yourAnswer: 'Sizning javobingiz',
    correctAnswer: "To'g'ri javob",
    explanation: 'Izoh',
    hidden: "O'qituvchi to'g'ri javoblarni yopib qo'ygan — faqat qaysi savol to'g'ri yechilgani ko'rinadi.",
  },
  ru: {
    yourAnswer: 'Ваш ответ',
    correctAnswer: 'Правильный ответ',
    explanation: 'Объяснение',
    hidden: 'Учитель скрыл правильные ответы — видно только, какие вопросы решены верно.',
  },
  en: {
    yourAnswer: 'Your answer',
    correctAnswer: 'Correct answer',
    explanation: 'Explanation',
    hidden: 'Your teacher withheld the answer key — only which questions were right is shown.',
  },
};

export interface ExamReviewProps {
  questions: ExamQuestion[];
  answers: Record<string, string>;
  /** The language the paper was sat in. */
  examLang: Lang;
  appLang: Lang;
  /** Withhold correct answers and explanations (teacher quizzes only). */
  hideAnswers?: boolean;
}

export default function ExamReview({
  questions, answers, examLang, appLang, hideAnswers = false,
}: ExamReviewProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const t = UI[appLang];

  const pick = (tx?: LocalizedText | null) => pickLangText(examLang, tx);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {hideAnswers && (
        <Banner status="info" icon={<EyeOff size={16} strokeWidth={3} />} title={t.hidden} />
      )}

      {questions.map((q) => {
        const given = answers[q.id];
        const isAnswered = (given ?? '').trim() !== '';
        const correct = isExamItemCorrect(q, answers);
        const mode = examMode(q);
        // A closed item points at the chosen option key; an open one shows the
        // plain-text answer the typed input was graded against.
        const expected = mode === 'open' ? examExpectedText(q, examLang) : q.answer;

        return (
          <Card
            key={q.id}
            variant="outlined"
            className={cn(
              'rounded-m3-md p-4',
              correct ? 'border-success' : isAnswered ? 'border-error' : 'border-outline-variant',
            )}
          >
            <div className="mb-2 flex items-start gap-2">
              <span className="s-num grid h-6 w-6 shrink-0 place-items-center rounded-m3-xs bg-surface-container-high text-[11px] font-black text-on-surface-variant">{q.slotNumber}</span>
              <span className="min-w-0">
                {pick(q.stem) && (
                  <MathText text={pick(q.stem)} className="mb-1 block text-[12px] font-semibold text-on-surface-variant" />
                )}
                <MathText text={pick(q.question)} className="text-[13px] font-bold" />
              </span>
              {correct
                ? <CheckCircle2 size={18} className="ml-auto shrink-0 text-success" />
                : <XCircle size={18} className="ml-auto shrink-0 text-error" />}
            </div>

            {q.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.imageUrl} alt="" className="mb-2 ml-8 max-h-48 w-auto rounded-m3-sm border border-outline-variant bg-surface object-contain" />
            )}

            <QuestionCreator creatorName={q.creatorName} correctedBy={q.correctedBy} className="mb-2 ml-8 text-on-surface-variant" iconSize={9} />

            {mode === 'block' ? (
              <div className="flex flex-col gap-1.5 pl-8">
                {(q.parts ?? []).map((p) => {
                  const pg = answers[partKey(q.id, p.id)];
                  const pCorrect = isExamPartCorrect(p, pg);
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-x-1 text-[12px] font-bold text-on-surface-variant">
                      {pCorrect
                        ? <CheckCircle2 size={13} className="shrink-0 text-success" />
                        : <XCircle size={13} className="shrink-0 text-error" />}
                      <MathText text={pick(p.prompt)} className="text-on-surface" />
                      <span>—</span>
                      {pg ? <MathText text={pg} /> : <span>—</span>}
                      {!pCorrect && !hideAnswers && (
                        <span className="flex items-center gap-1 text-success">
                          · <MathText text={examPartExpected(p, examLang)} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-1 pl-8 text-[12px] font-bold text-on-surface-variant">
                <span>{t.yourAnswer}:</span>
                {isAnswered ? <MathText text={given!} /> : <span>—</span>}
                {!correct && !hideAnswers && (
                  <span className="flex items-center gap-1 text-success">
                    · {t.correctAnswer}: <MathText text={expected} />
                  </span>
                )}
              </div>
            )}

            {/* The explanation ships with the question — it is a field on the doc
                we already read — so this button costs nothing. Collapsed by
                default: 45 open explanations is a wall of text. */}
            {!hideAnswers && pick(q.explanation) && (
              <div className="mt-2 pl-8">
                <button
                  onClick={() => toggle(q.id)}
                  aria-expanded={open.has(q.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-m3-xs border-[1.5px] px-2.5 py-1 text-[11px] font-black s-press',
                    'transition-colors duration-m3-fast ease-m3-std',
                    open.has(q.id)
                      ? 'border-transparent bg-primary-container text-on-primary-container'
                      : 'border-outline-variant text-on-surface-variant hover:bg-state-hover',
                  )}
                >
                  <BookOpen size={12} strokeWidth={3} />
                  {t.explanation}
                  <ChevronDown
                    size={12}
                    strokeWidth={3}
                    className={cn('transition-transform', open.has(q.id) && 'rotate-180')}
                  />
                </button>

                {open.has(q.id) && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mt-2 border-t border-outline-variant pt-2 text-[12px] font-medium text-on-surface-variant"
                  >
                    <MathText text={pick(q.explanation)} />
                  </motion.div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
