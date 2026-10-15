"use client";

/**
 * SAT question-dataset import (docs/SAT_QUIZ.md).
 *
 * A teacher uploads a JSON file of SAT questions; every row is validated
 * against `data/question_topics.json` and written to `teacher_questions` as
 * ordinary v1 documents through the SAME adapter hand-authored questions use
 * (`toQuestionV1`), so they render, filter and grade identically.
 *
 * ⚠️ OWNERSHIP vs VISIBILITY — the thing to not get wrong here.
 * Rows are written with `creatorId = the uploader's uid`, never `''`. The
 * `teacher_questions` create rule requires exactly that, and it is also what we
 * want: the uploader keeps edit/delete rights and their `creatorName` is shown
 * as attribution. Ticking "share" only adds the flat `sharedBank: true` flag,
 * which makes the question visible in every teacher's "Shared" picker tab.
 * It is NOT the anonymous platform pool (`creatorId: ''`) — that one is
 * Admin-SDK-only, owned by nobody, and must stay that way.
 *
 * ⚠️ The taxonomy tree is printed beside the file picker on purpose: the
 * `topic`/`subtopic` values in the file are the taxonomy's own ids, which are
 * persisted into the document and which nobody can guess
 * (`research-organizing-margin-of-error-outliers`).
 */

import { useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, CircleAlert, Copy,
  FileJson, Info, Pencil, Upload, X,
} from "lucide-react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { toQuestionV1 } from "@/lib/questionSchema";
import { findSubject, findTopic, findSubtopic } from "@/lib/questionTopics";
import { SAT_MATH_TAXONOMY_SLUG, SAT_RW_TAXONOMY_SLUG } from "@/lib/SatMathQuiz";
import {
  MAX_IMPORT_ROWS, SAT_IMPORT_EXAMPLE, parseSatImport,
  allowedTypesFor,
  type SatImportReport, type SatImportOk, type SatImportError, type SatImportSubject,
} from "@/lib/SatQuestionImport";
import { Banner, Button, Card, IconButton, PageHeader, Switch, cn } from "@/components/ui";
import { DIFFICULTY_LEVELS, type DifficultyName } from "@/types/question";
import type { QuestionV1 } from "@/types/question";

/** Firestore's own hard cap on one batch. */
const BATCH_LIMIT = 500;

const TR = {
  uz: {
    title: "SAT savollar importi",
    subtitle: "JSON faylni yuklab, savollarni bazaga qo'shing.",
    subject: "Bo'lim",
    math: "Matematika",
    english: "Ingliz tili (R&W)",
    pick: "JSON fayl tanlash",
    format: "Fayl ko'rinishi",
    copy: "Nusxa olish",
    copied: "Nusxa olindi",
    topics: "Mavzular va bo'limlar",
    topicsHint: "Fayldagi \"topic\" va \"subtopic\" qiymatlari aynan shu id'lar bo'lishi shart.",
    valid: "tayyor",
    invalid: "xato",
    dupes: "takror (o'tkazib yuborildi)",
    errorsTitle: "Qabul qilinmagan qatorlar",
    errorsFix: "Quyidagi qatorlarda xato bor — to'g'rilang va import qiling.",
    row: "qator",
    preview: "Ko'rib chiqish",
    share: "Boshqa o'qituvchilarga ham ko'rinsin",
    shareHint: "Savollar sizniki bo'lib qoladi — faqat siz tahrirlay va o'chira olasiz. Ulashilganda ular har bir o'qituvchining SAT «Ulashilgan» ro'yxatida ismingiz bilan ko'rinadi.",
    importBtn: (n: number) => `${n} ta savolni qo'shish`,
    importing: "Qo'shilmoqda…",
    done: (n: number) => `${n} ta savol bazaga qo'shildi.`,
    failed: "Saqlashda xatolik yuz berdi.",
    nothing: "Qo'shiladigan savol yo'q.",
    back: "Orqaga",
    reviewNote: "Import qilingan savollar «review» holatida saqlanadi — bazangizda ko'rinadi va testga qo'shsa bo'ladi.",
    fixAnswer: "Javob",
    fixTopic: "Mavzu",
    fixSubtopic: "Bo'lim",
    fixDifficulty: "Daraja",
    fixApply: "Tasdiqlash",
    promoted: "To'g'rilandi ✓",
    selectPlaceholder: "— tanlang —",
    noTopicFirst: "Avval mavzu tanlang",
  },
  ru: {
    title: "Импорт вопросов SAT",
    subtitle: "Загрузите JSON-файл, чтобы добавить вопросы в базу.",
    subject: "Раздел",
    math: "Математика",
    english: "Английский (R&W)",
    pick: "Выбрать JSON-файл",
    format: "Формат файла",
    copy: "Копировать",
    copied: "Скопировано",
    topics: "Темы и разделы",
    topicsHint: "Значения \"topic\" и \"subtopic\" в файле должны быть именно этими id.",
    valid: "готово",
    invalid: "с ошибкой",
    dupes: "дубликаты (пропущены)",
    errorsTitle: "Непринятые строки",
    errorsFix: "В следующих строках ошибки — исправьте и импортируйте.",
    row: "строка",
    preview: "Предпросмотр",
    share: "Показывать другим учителям",
    shareHint: "Вопросы остаются вашими — только вы можете их менять и удалять. При публикации они появятся во вкладке «Общие» у каждого учителя с вашим именем.",
    importBtn: (n: number) => `Добавить ${n} вопросов`,
    importing: "Добавление…",
    done: (n: number) => `Добавлено вопросов: ${n}.`,
    failed: "Не удалось сохранить.",
    nothing: "Нет вопросов для добавления.",
    back: "Назад",
    reviewNote: "Импортированные вопросы сохраняются со статусом «review» — они видны в вашей базе и их можно добавить в тест.",
    fixAnswer: "Ответ",
    fixTopic: "Тема",
    fixSubtopic: "Раздел",
    fixDifficulty: "Сложность",
    fixApply: "Применить",
    promoted: "Исправлено ✓",
    selectPlaceholder: "— выберите —",
    noTopicFirst: "Сначала выберите тему",
  },
  en: {
    title: "SAT question import",
    subtitle: "Upload a JSON file to add questions to the bank.",
    subject: "Section",
    math: "Math",
    english: "English (R&W)",
    pick: "Choose a JSON file",
    format: "File format",
    copy: "Copy",
    copied: "Copied",
    topics: "Topics and sections",
    topicsHint: "The \"topic\" and \"subtopic\" values in the file must be exactly these ids.",
    valid: "ready",
    invalid: "rejected",
    dupes: "duplicates (skipped)",
    errorsTitle: "Rejected rows",
    errorsFix: "The rows below have errors — fix them and import.",
    row: "row",
    preview: "Preview",
    share: "Show to other teachers too",
    shareHint: "The questions stay yours — only you can edit or delete them. When shared they appear in every teacher's SAT \"Shared\" tab with your name on them.",
    importBtn: (n: number) => `Add ${n} questions`,
    importing: "Adding…",
    done: (n: number) => `${n} questions added to the bank.`,
    failed: "Could not save.",
    nothing: "Nothing to add.",
    back: "Back",
    reviewNote: "Imported questions are saved with status \"review\" — they show in your bank and can be added to a test.",
    fixAnswer: "Answer",
    fixTopic: "Topic",
    fixSubtopic: "Subtopic",
    fixDifficulty: "Difficulty",
    fixApply: "Apply fix",
    promoted: "Fixed ✓",
    selectPlaceholder: "— select —",
    noTopicFirst: "Select a topic first",
  },
} as const;

// ─── error-kind classifier ────────────────────────────────────────────────────

type ErrorKind =
  | "missing_answer"
  | "wrong_answer"
  | "missing_choices"
  | "unknown_topic"
  | "unknown_subtopic"
  | "unknown_difficulty"
  | "other";

function classifyError(reason: string): ErrorKind {
  if (reason.includes('missing "answer"')) return "missing_answer";
  if (reason.includes('"answer":') && reason.includes("not one of")) return "wrong_answer";
  if (reason.includes('"choices"')) return "missing_choices";
  if (reason.includes('unknown "topic"')) return "unknown_topic";
  if (reason.includes('unknown "subtopic"')) return "unknown_subtopic";
  if (reason.includes('unknown "difficulty"')) return "unknown_difficulty";
  return "other";
}

// ─── FixableRow component ─────────────────────────────────────────────────────

type TrLabels = typeof TR[keyof typeof TR];

interface FixableRowProps {
  error: SatImportError;
  subject: SatImportSubject;
  labels: TrLabels;
  onFixed: (idx: number, ok: SatImportOk) => void;
  onDismiss: (idx: number) => void;
}

function FixableRow({ error, subject, labels: t, onFixed, onDismiss }: FixableRowProps) {
  const kind = classifyError(error.reason);
  const subjectNode = findSubject(subject);
  const allowedTypes = allowedTypesFor(subject);
  const raw = error.raw;

  // Seed from the original raw row so valid fields are pre-populated.
  const rawTopicId = typeof raw.topic === "string" ? raw.topic : "";
  const rawSubtopicId = typeof raw.subtopic === "string" ? raw.subtopic : "";
  const rawDifficulty = typeof raw.difficulty === "string" ? raw.difficulty.toLowerCase() : "medium";
  const rawAnswer = typeof raw.answer === "string" ? raw.answer : "";
  const rawType = (typeof raw.type === "string" ? raw.type.toLowerCase() : allowedTypes[0]) as "mcq" | "numeric";

  const [topic, setTopic] = useState(rawTopicId);
  const [subtopic, setSubtopic] = useState(rawSubtopicId);
  const [difficulty, setDifficulty] = useState<DifficultyName>(
    DIFFICULTY_LEVELS.includes(rawDifficulty as DifficultyName) ? (rawDifficulty as DifficultyName) : "medium",
  );
  const [answer, setAnswer] = useState(rawAnswer);
  const [validationErr, setValidationErr] = useState("");
  const [promoted, setPromoted] = useState(false);

  const topics = subjectNode?.topics ?? [];
  const subtopics = useMemo(
    () => topics.find((tp) => tp.id === topic)?.subtopics ?? [],
    [topics, topic],
  );

  const apply = () => {
    setValidationErr("");

    const effectiveAnswer = answer.trim() || rawAnswer;

    if (kind === "unknown_topic" || kind === "unknown_subtopic") {
      if (!topic) { setValidationErr(t.fixTopic + " tanlang"); return; }
      if (!subtopic) { setValidationErr(t.fixSubtopic + " tanlang"); return; }
    }

    if (kind === "missing_answer" || kind === "wrong_answer") {
      if (!effectiveAnswer) { setValidationErr(t.fixAnswer + " kiriting"); return; }
    }

    const resolvedSubjectNode = findSubject(subject);
    const resolvedTopic = findTopic(subject, topic);
    const resolvedSubtopic = findSubtopic(subject, topic, subtopic);

    if (!resolvedSubjectNode) { setValidationErr("Subject not found"); return; }
    if (!resolvedTopic) { setValidationErr(`Unknown topic: "${topic}"`); return; }
    if (!resolvedSubtopic) { setValidationErr(`Unknown subtopic: "${subtopic}"`); return; }

    // Rebuild choices from the original raw row (MCQ only)
    const effectiveType = allowedTypes.includes(rawType) ? rawType : allowedTypes[0];
    const options: Record<string, { uz: string; ru: string; en: string }> = {};
    if (effectiveType === "mcq" && raw.choices) {
      if (Array.isArray(raw.choices)) {
        ["A", "B", "C", "D", "E", "F"].slice(0, (raw.choices as unknown[]).length).forEach((letter, i) => {
          options[letter] = { uz: "", ru: "", en: String((raw.choices as unknown[])[i] ?? "") };
        });
      } else if (typeof raw.choices === "object") {
        for (const [k, v] of Object.entries(raw.choices as Record<string, unknown>)) {
          options[k.toUpperCase()] = { uz: "", ru: "", en: String(v ?? "") };
        }
      }
    }

    const correctValue = effectiveType === "mcq" ? effectiveAnswer.toUpperCase() : effectiveAnswer;
    const diffId = DIFFICULTY_LEVELS.indexOf(difficulty) + 1;

    const questionText = typeof raw.question === "string" ? raw.question : `Row ${error.index + 1} (corrected)`;
    const flat = questionText.replace(/\s+/g, " ");
    const preview = flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;

    const ok: SatImportOk = {
      index: error.index,
      preview,
      type: effectiveType,
      topicName: resolvedTopic.name,
      subtopicName: resolvedSubtopic.name,
      difficulty,
      source: {
        question: { uz: "", ru: "", en: questionText },
        imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
        imageStoragePath: null,
        type: effectiveType,
        options,
        correctAnswer: {
          value: correctValue,
          acceptedAnswers: Array.isArray(raw.acceptedAnswers)
            ? (raw.acceptedAnswers as unknown[]).map(String).filter(Boolean)
            : [],
          caseSensitive: false,
        },
        subject: { id: subject, name: resolvedSubjectNode.name },
        topic: { id: resolvedTopic.id, name: resolvedTopic.name },
        subtopic: { id: resolvedSubtopic.id, name: resolvedSubtopic.name },
        chapter: { id: "", name: "" },
        difficulty: { id: diffId, name: difficulty },
        difficultyId: diffId,
        explanation: {
          uz: "", ru: "",
          en: typeof raw.explanation === "string" ? raw.explanation : "",
        },
        hint: "",
        tags: [],
        curriculum: [],
        language: ["en"],
      },
    };

    setPromoted(true);
    setTimeout(() => onFixed(error.index, ok), 700);
  };

  if (promoted) {
    return (
      <li className="flex items-center gap-2 rounded-m3-md border border-success/30 bg-success-container/20 px-3 py-2.5 text-[12px] font-bold text-on-success-container">
        <Check size={13} className="flex-none text-success" />
        {t.row} {error.index + 1}: {t.promoted}
      </li>
    );
  }

  const isFixable = kind !== "other";

  return (
    <li className="overflow-hidden rounded-m3-md border border-error/25 bg-surface-container">
      {/* ── row header ── */}
      <div className="flex items-start justify-between gap-2 border-b border-error/15 bg-error-container/20 px-3 py-2.5">
        <div className="flex items-start gap-1.5">
          <CircleAlert size={13} className="mt-0.5 flex-none text-error" />
          <div>
            <span className="text-[12px] font-black text-on-surface">{t.row} {error.index + 1}</span>
            <p className="mt-0.5 font-mono text-[10.5px] font-medium text-error">{error.reason}</p>
          </div>
        </div>
        <button
          onClick={() => onDismiss(error.index)}
          title="Dismiss"
          className="flex-none rounded-full p-0.5 text-on-surface-variant/50 transition hover:bg-error/10 hover:text-error"
        >
          <X size={13} />
        </button>
      </div>

      {/* ── editable fields ── */}
      {isFixable && (
        <div className="flex flex-wrap items-end gap-3 px-3 py-2.5">

          {/* topic + subtopic */}
          {(kind === "unknown_topic" || kind === "unknown_subtopic") && (
            <>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {t.fixTopic}
                </label>
                <div className="relative">
                  <select
                    value={topic}
                    onChange={(e) => { setTopic(e.target.value); setSubtopic(""); setValidationErr(""); }}
                    className={cn(
                      "appearance-none rounded-m3-sm border py-1.5 pl-2.5 pr-7 text-[12px] font-medium",
                      "bg-surface-container-highest text-on-surface outline-none",
                      "focus:border-primary focus:ring-1 focus:ring-primary/25 transition",
                      !topic ? "border-error/70" : "border-outline-variant",
                    )}
                  >
                    <option value="">{t.selectPlaceholder}</option>
                    {topics.map((tp) => (
                      <option key={tp.id} value={tp.id}>{tp.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                </div>
                {topic && (
                  <span className="font-mono text-[9.5px] text-on-surface-variant/60">{topic}</span>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {t.fixSubtopic}
                </label>
                <div className="relative">
                  <select
                    value={subtopic}
                    onChange={(e) => { setSubtopic(e.target.value); setValidationErr(""); }}
                    disabled={!topic}
                    className={cn(
                      "appearance-none rounded-m3-sm border py-1.5 pl-2.5 pr-7 text-[12px] font-medium",
                      "bg-surface-container-highest text-on-surface outline-none",
                      "focus:border-primary focus:ring-1 focus:ring-primary/25 transition",
                      "disabled:opacity-40",
                      !subtopic && topic ? "border-error/70" : "border-outline-variant",
                    )}
                  >
                    <option value="">{!topic ? t.noTopicFirst : t.selectPlaceholder}</option>
                    {subtopics.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                </div>
                {subtopic && (
                  <span className="font-mono text-[9.5px] text-on-surface-variant/60">{subtopic}</span>
                )}
              </div>
            </>
          )}

          {/* difficulty */}
          {kind === "unknown_difficulty" && (
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {t.fixDifficulty}
              </label>
              <div className="relative">
                <select
                  value={difficulty}
                  onChange={(e) => { setDifficulty(e.target.value as DifficultyName); setValidationErr(""); }}
                  className={cn(
                    "appearance-none rounded-m3-sm border border-error/70 py-1.5 pl-2.5 pr-7 text-[12px] font-medium",
                    "bg-surface-container-highest text-on-surface outline-none",
                    "focus:border-primary focus:ring-1 focus:ring-primary/25 transition",
                  )}
                >
                  {DIFFICULTY_LEVELS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              </div>
            </div>
          )}

          {/* answer */}
          {(kind === "missing_answer" || kind === "wrong_answer") && (
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {t.fixAnswer}
              </label>
              <input
                type="text"
                value={answer}
                onChange={(e) => { setAnswer(e.target.value); setValidationErr(""); }}
                placeholder={allowedTypes.includes("mcq") ? "A / B / C / D" : "16.25"}
                className={cn(
                  "w-28 rounded-m3-sm border px-2.5 py-1.5 text-[12px] font-medium",
                  "bg-surface-container-highest text-on-surface outline-none",
                  "focus:border-primary focus:ring-1 focus:ring-primary/25 transition",
                  !answer.trim() ? "border-error/70" : "border-outline-variant",
                )}
              />
            </div>
          )}

          {validationErr && (
            <p className="w-full text-[11px] font-bold text-error">{validationErr}</p>
          )}

          <button
            onClick={apply}
            className={cn(
              "flex items-center gap-1.5 self-end rounded-m3-sm bg-primary px-3 py-1.5",
              "text-[11.5px] font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.97]",
            )}
          >
            <Pencil size={11} />
            {t.fixApply}
          </button>
        </div>
      )}
    </li>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SatImportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = TR[(lang as keyof typeof TR) ?? "uz"] ?? TR.uz;

  const [subject, setSubject] = useState<SatImportSubject>(SAT_MATH_TAXONOMY_SLUG);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<SatImportReport | null>(null);
  /** Extra ok rows promoted from the error-fix flow */
  const [fixedRows, setFixedRows] = useState<SatImportOk[]>([]);
  /** Indices that were either fixed or dismissed — hidden from the error list */
  const [dismissedErrors, setDismissedErrors] = useState<Set<number>>(new Set());
  const [share, setShare] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const subjectNode = useMemo(() => findSubject(subject), [subject]);

  const reset = () => {
    setReport(null);
    setFileName("");
    setSaved(null);
    setError("");
    setFixedRows([]);
    setDismissedErrors(new Set());
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setSaved(null);
    setError("");
    setFixedRows([]);
    setDismissedErrors(new Set());
    setFileName(file.name);
    setReport(parseSatImport(await file.text(), subject));
  };

  const handleFixed = useCallback((idx: number, ok: SatImportOk) => {
    setFixedRows((prev) => [...prev.filter((r) => r.index !== idx), ok]);
    setDismissedErrors((prev) => new Set([...prev, idx]));
  }, []);

  const handleDismiss = useCallback((idx: number) => {
    setDismissedErrors((prev) => new Set([...prev, idx]));
  }, []);

  const visibleErrors = useMemo(
    () => (report?.errors ?? []).filter((e) => !dismissedErrors.has(e.index)),
    [report, dismissedErrors],
  );

  const allOkRows = useMemo(
    () => [...(report?.ok ?? []), ...fixedRows].sort((a, b) => a.index - b.index),
    [report, fixedRows],
  );

  const runImport = async () => {
    if (!user || allOkRows.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const creatorName = user.displayName || "";
      const rows = allOkRows;

      // Chunked at Firestore's own 500-write batch cap. Each chunk commits on
      // its own: a later chunk failing leaves the earlier ones written, which
      // is why the success message reports what actually landed rather than
      // what was attempted.
      let written = 0;
      for (let start = 0; start < rows.length; start += BATCH_LIMIT) {
        const batch = writeBatch(db);
        for (const row of rows.slice(start, start + BATCH_LIMIT)) {
          const ref = doc(collection(db, "teacher_questions"));
          const id = `tq_${ref.id}`;
          const payload: QuestionV1 = toQuestionV1(row.source, {
            id,
            creatorId: user.uid,
            creatorName,
            // `exam_import` defaults to status 'review' and tags the doc
            // `exam_import` — right for a bulk dataset, and deliberately NOT
            // overridden to 'published' the way the curated platform import was.
            creationMethod: "exam_import",
            timestamp: serverTimestamp(),
          });
          // `sharedBank` is a visibility flag layered on top of the v1 payload —
          // ownership (creatorId) is untouched. Written only when true so a
          // private import stays byte-identical to a hand-authored document.
          batch.set(doc(db, "teacher_questions", id), share ? { ...payload, sharedBank: true } : payload);
        }
        await batch.commit();
        written += Math.min(BATCH_LIMIT, rows.length - start);
      }

      setSaved(written);
      setReport(null);
      setFileName("");
      setFixedRows([]);
      setDismissedErrors(new Set());
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      console.error("SAT import failed:", e);
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 pb-16 md:p-6">
      <div className="flex items-center gap-3">
        <IconButton aria-label={t.back} onClick={() => router.push("/teacher/sat")}>
          <ArrowLeft size={18} />
        </IconButton>
        <PageHeader title={t.title} subtitle={t.subtitle} />
      </div>

      {/* ── subject ─────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-3 p-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.subject}</span>
        <div className="flex flex-wrap gap-2">
          {([SAT_MATH_TAXONOMY_SLUG, SAT_RW_TAXONOMY_SLUG] as SatImportSubject[]).map((s) => (
            <button
              key={s}
              onClick={() => { setSubject(s); reset(); }}
              className={cn(
                "m3-interactive rounded-m3-sm px-3.5 py-2 text-[12px] font-bold transition-colors",
                subject === s
                  ? "bg-primary text-on-primary"
                  : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant",
              )}
            >
              {s === SAT_MATH_TAXONOMY_SLUG ? t.math : t.english}
            </button>
          ))}
        </div>
      </Card>

      {/* ── the taxonomy, so the teacher knows what to put in the file ──── */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <Info size={15} className="mt-0.5 flex-none text-primary" />
          <div>
            <h2 className="text-[13px] font-black text-on-surface">{t.topics}</h2>
            <p className="mt-0.5 text-[11.5px] font-medium text-on-surface-variant">{t.topicsHint}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(subjectNode?.topics ?? []).map((topic) => (
            <div key={topic.id} className="rounded-m3-md border border-outline-variant p-3">
              <p className="text-[12px] font-black text-on-surface">{topic.name}</p>
              <p className="mb-2 font-mono text-[10.5px] font-bold text-primary">{topic.id}</p>
              <ul className="flex flex-col gap-1">
                {topic.subtopics.map((sub) => (
                  <li key={sub.id} className="leading-tight">
                    <span className="block font-mono text-[10.5px] font-bold text-on-surface-variant">{sub.id}</span>
                    <span className="block text-[11px] font-medium text-on-surface-variant opacity-80">{sub.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* ── the format ──────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-black text-on-surface">{t.format}</h2>
          <Button
            size="sm"
            variant="text"
            icon={copied ? <Check /> : <Copy />}
            onClick={() => {
              navigator.clipboard.writeText(SAT_IMPORT_EXAMPLE);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? t.copied : t.copy}
          </Button>
        </div>
        <pre className="overflow-x-auto rounded-m3-sm bg-surface-container-highest p-3 text-[11px] leading-relaxed text-on-surface">
{SAT_IMPORT_EXAMPLE}
        </pre>
        <p className="text-[11px] font-medium text-on-surface-variant">
          {subject === SAT_RW_TAXONOMY_SLUG ? '"type": "mcq"' : '"type": "mcq" | "numeric"'} · max {MAX_IMPORT_ROWS}
        </p>
      </Card>

      {/* ── the file ────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-3 p-4">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button icon={<FileJson />} onClick={() => fileRef.current?.click()}>{t.pick}</Button>
        {fileName && <p className="text-[12px] font-bold text-on-surface">{fileName}</p>}

        {report?.fatal && <Banner tone="error" title={report.fatal} />}

        {report && !report.fatal && (
          <>
            {/* ── summary badges ── */}
            <div className="flex flex-wrap gap-2 text-[11.5px] font-bold">
              <span className="rounded-m3-xs bg-success-container px-2.5 py-1 text-on-success-container">
                {allOkRows.length} {t.valid}
              </span>
              {visibleErrors.length > 0 && (
                <span className="rounded-m3-xs bg-error-container px-2.5 py-1 text-on-error-container">
                  {visibleErrors.length} {t.invalid}
                </span>
              )}
              {report.duplicates > 0 && (
                <span className="rounded-m3-xs bg-surface-container-highest px-2.5 py-1 text-on-surface-variant">
                  {report.duplicates} {t.dupes}
                </span>
              )}
            </div>

            {/* ── editable rejected rows ── */}
            {visibleErrors.length > 0 && (
              <div className="rounded-m3-md border border-error/30 bg-error-container/10 p-3">
                <div className="mb-2.5 flex items-start gap-1.5">
                  <CircleAlert size={14} className="mt-0.5 flex-none text-error" />
                  <div>
                    <p className="text-[12px] font-black text-on-surface">{t.errorsTitle}</p>
                    <p className="text-[11px] font-medium text-on-surface-variant">{t.errorsFix}</p>
                  </div>
                </div>
                <ul className="flex flex-col gap-2">
                  {visibleErrors.map((e) => (
                    <FixableRow
                      key={e.index}
                      error={e}
                      subject={subject}
                      labels={t}
                      onFixed={handleFixed}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* ── ok preview ── */}
            {allOkRows.length > 0 && (
              <div className="rounded-m3-md border border-outline-variant">
                <p className="border-b border-outline-variant px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {t.preview}
                </p>
                <ul className="flex max-h-72 flex-col divide-y divide-outline-variant overflow-y-auto">
                  {allOkRows.slice(0, 50).map((r) => (
                    <li key={r.index} className="px-3 py-2">
                      <p className="text-[12px] font-medium text-on-surface">{r.preview}</p>
                      <p className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wide text-on-surface-variant">
                        {r.type} · {r.topicName} → {r.subtopicName} · {r.difficulty}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── share + commit ──────────────────────────────────────────────── */}
      {report && !report.fatal && allOkRows.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <label className="flex items-start gap-3">
            <Switch checked={share} onChange={(e) => setShare(e.target.checked)} />
            <span>
              <span className="block text-[12.5px] font-bold text-on-surface">{t.share}</span>
              <span className="mt-0.5 block text-[11.5px] font-medium text-on-surface-variant">{t.shareHint}</span>
            </span>
          </label>

          <p className="flex items-start gap-1.5 text-[11px] font-medium text-on-surface-variant">
            <AlertTriangle size={13} className="mt-0.5 flex-none" /> {t.reviewNote}
          </p>

          {error && <Banner tone="error" title={error} />}

          <Button icon={<Upload />} loading={saving} onClick={runImport}>
            {saving ? t.importing : t.importBtn(allOkRows.length)}
          </Button>
        </Card>
      )}

      {saved !== null && <Banner tone="success" title={t.done(saved)} />}
    </div>
  );
}
