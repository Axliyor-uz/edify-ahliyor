"use client";

import { useMemo, useState } from "react";
import { PenTool, Save } from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/lib/AuthContext";
import { SUBJECTS, findSubject, findTopic } from "@/lib/questionTopics";
import { normalizeQuestion } from "@/lib/questionSchema";
import {
  emptyOption, newQuestionId, saveQuestion, validateDraft,
  type OptionDraft, type QuestionDraft,
} from "@/services/questionBankService";
import { teacherQuizItem } from "@/lib/RASCHquiz";
import { Button, Select, TextArea, TextField, cn } from "@/components/ui";
import type { DifficultyName, QuestionType } from "@/types/question";
import type { RaschQuizItem } from "@/types/TeacherRaschQuiz";

/**
 * Write a brand-new question straight into the paper.
 *
 * It saves to **`teacher_questions`** through the ordinary
 * `questionBankService.saveQuestion` — the same v1 write every other creation
 * method makes (docs/QUESTIONS.md) — and only then adds it to the quiz. So a
 * question written here is a normal bank question: reusable in a later paper,
 * editable in the builder, and visible in "Mening savollarim". It is never a
 * paper-only orphan.
 *
 * ⚠️ The topic path is REQUIRED and validated: `toQuestionV1` throws
 * `InvalidTopicError` unless the subject/topic/subtopic triple exists in
 * data/question_topics.json. That is also what makes the question findable by the
 * Rasch model at all — the syllabus position is where the dimension and the skill
 * come from. This form asks for it rather than shipping a placeholder.
 *
 * Images, blocks and multiple-select are deliberately NOT offered here. That is
 * what `/teacher/create/question` and `/teacher/create/block` are for, and both
 * write to the same bank — the "my questions" tab picks them up immediately.
 */

export interface ComposeStrings {
  heading: string;
  hint: string;
  subject: string; topic: string; subtopic: string;
  type: string; mcq: string; open: string; numeric: string;
  question: string;
  correct: string;
  wrong: string;
  answer: string;
  difficulty: string; easy: string; medium: string; hard: string;
  explanation: string;
  save: string;
  saved: string;
  full: string;
  errNoPrompt: string;
  errNoTopic: string;
  errNoAnswer: string;
  errNoOptions: string;
  errDuplicate: string;
  errSave: string;
}

const WRONG_SLOTS = 3;

const emptyDraft = (): QuestionDraft => ({
  questionText: "",
  imageUrl: null,
  imageStoragePath: null,
  subjectId: "", subjectName: "",
  topicId: "", topicName: "",
  subtopicId: "", subtopicName: "",
  type: "mcq",
  status: "published",
  correctOption: emptyOption(),
  incorrectOptions: Array.from({ length: WRONG_SLOTS }, emptyOption),
  extraCorrectKeys: [],
  acceptedAnswers: [],
  caseSensitive: false,
  explanation: "",
  hint: "",
  difficulty: "medium",
  points: 1,
  estimatedTime: 60,
  tags: [],
  curriculum: [],
});

export default function QuickCompose({
  t, disabled, onAdd,
}: {
  t: ComposeStrings;
  disabled: boolean;
  onAdd: (item: RaschQuizItem) => void;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const subject = useMemo(() => findSubject(draft.subjectId), [draft.subjectId]);
  const topic = useMemo(
    () => (draft.subjectId && draft.topicId ? findTopic(draft.subjectId, draft.topicId) : undefined),
    [draft.subjectId, draft.topicId],
  );

  const patch = (p: Partial<QuestionDraft>) => setDraft((d) => ({ ...d, ...p }));

  const setOption = (index: number | "correct", value: string) =>
    setDraft((d) => {
      if (index === "correct") return { ...d, correctOption: { ...d.correctOption, text: value } };
      const next: OptionDraft[] = [...d.incorrectOptions];
      next[index] = { ...next[index], text: value };
      return { ...d, incorrectOptions: next };
    });

  const isClosed = draft.type === "mcq";

  const errorFor = (key: string) => ({
    noPrompt: t.errNoPrompt,
    noTopic: t.errNoTopic,
    noAnswer: t.errNoAnswer,
    noOptions: t.errNoOptions,
    duplicateOption: t.errDuplicate,
  }[key] ?? t.errSave);

  async function save() {
    if (!user) return;
    const check = validateDraft(draft);
    if (!check.ok) {
      toast.error(errorFor(check.errorKey ?? ""));
      return;
    }

    setSaving(true);
    try {
      const id = newQuestionId();
      const payload = await saveQuestion(
        draft,
        id,
        user.uid,
        user.displayName || "",
        "teacher_created",
      );
      // The saved payload IS the stored document, so the item is built from the
      // same shape a later read would produce — no drift between "just written"
      // and "loaded back".
      onAdd(teacherQuizItem(normalizeQuestion({ ...payload, id })));
      setDraft((d) => ({ ...emptyDraft(), subjectId: d.subjectId, subjectName: d.subjectName, topicId: d.topicId, topicName: d.topicName, subtopicId: d.subtopicId, subtopicName: d.subtopicName, difficulty: d.difficulty }));
      toast.success(t.saved);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t.errSave);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="flex items-center gap-2 text-[14px] font-bold text-on-surface">
          <PenTool size={15} className="text-primary" /> {t.heading}
        </h3>
        <p className="mt-1 text-[12px] font-medium text-on-surface-variant">{t.hint}</p>
      </div>

      {/* The topic path — required, and the reason the question can be measured. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          label={t.subject}
          value={draft.subjectId}
          onChange={(e) => {
            const s = findSubject(e.target.value);
            patch({
              subjectId: s?.id ?? "", subjectName: s?.name ?? "",
              topicId: "", topicName: "", subtopicId: "", subtopicName: "",
            });
          }}
        >
          <option value="">—</option>
          {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>

        <Select
          label={t.topic}
          value={draft.topicId}
          disabled={!subject}
          onChange={(e) => {
            const tp = subject?.topics.find((x) => x.id === e.target.value);
            patch({ topicId: tp?.id ?? "", topicName: tp?.name ?? "", subtopicId: "", subtopicName: "" });
          }}
        >
          <option value="">—</option>
          {(subject?.topics ?? []).map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
        </Select>

        <Select
          label={t.subtopic}
          value={draft.subtopicId}
          disabled={!topic}
          onChange={(e) => {
            const st = topic?.subtopics.find((x) => x.id === e.target.value);
            patch({ subtopicId: st?.id ?? "", subtopicName: st?.name ?? "" });
          }}
        >
          <option value="">—</option>
          {(topic?.subtopics ?? []).map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t.type}
          value={draft.type}
          onChange={(e) => patch({ type: e.target.value as QuestionType })}
        >
          <option value="mcq">{t.mcq}</option>
          <option value="open">{t.open}</option>
          <option value="numeric">{t.numeric}</option>
        </Select>

        <Select
          label={t.difficulty}
          value={draft.difficulty}
          onChange={(e) => patch({ difficulty: e.target.value as DifficultyName })}
        >
          <option value="easy">{t.easy}</option>
          <option value="medium">{t.medium}</option>
          <option value="hard">{t.hard}</option>
        </Select>
      </div>

      <TextArea
        label={t.question}
        rows={3}
        value={draft.questionText}
        onChange={(e) => patch({ questionText: e.target.value })}
        supporting="LaTeX: $x^2 + 1$"
      />

      {/* The correct answer is entered in its own field and SHUFFLED into a
          letter on save (questionBankService), so it never lands predictably
          on A — a paper rendered without shuffling would otherwise leak it. */}
      <TextField
        label={isClosed ? t.correct : t.answer}
        value={draft.correctOption.text}
        onChange={(e) => setOption("correct", e.target.value)}
        className={cn(isClosed && "border-l-2 border-success pl-2")}
      />

      {isClosed && (
        <div className="grid gap-2 sm:grid-cols-3">
          {draft.incorrectOptions.map((opt, i) => (
            <TextField
              key={i}
              label={`${t.wrong} ${i + 1}`}
              value={opt.text}
              onChange={(e) => setOption(i, e.target.value)}
            />
          ))}
        </div>
      )}

      <TextArea
        label={t.explanation}
        rows={2}
        value={draft.explanation}
        onChange={(e) => patch({ explanation: e.target.value })}
      />

      <Button icon={<Save />} loading={saving} disabled={disabled || !user} onClick={save} className="self-start">
        {disabled ? t.full : t.save}
      </Button>
    </div>
  );
}
