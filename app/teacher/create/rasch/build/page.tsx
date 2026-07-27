"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowDown, ArrowUp, Database, KeyRound, Save, Send, Target, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { useAuth } from "@/lib/AuthContext";
import LatexRenderer from "@/components/LatexRenderer";
import { RASCH_TOPICS } from "@/lib/RASCHtopics";
import {
  BLUEPRINT_TOPIC_TARGET, RASCH_QUIZ_DEFAULT_MINUTES, RASCH_QUIZ_TOTAL,
  QUIZ_MAX_BYTES, itemPreview, quizByteSize, quizDifficultyCounts, quizSlotCount,
  quizTopicCounts, slimQuizItem,
} from "@/lib/RASCHquiz";
import { examSlotCount } from "@/lib/ExamTeacher";
import {
  getQuiz, newQuizId, pickedIds, reserveAccessCode, saveQuiz, setQuizStatus,
} from "@/services/teacherRaschQuizService";
import { BankPicker, MyBankPicker, type PickerStrings } from "../_components/QuestionPickers";
import QuickCompose, { type ComposeStrings } from "../_components/QuickCompose";
import {
  Banner, Button, Card, IconButton, PageHeader, ProgressBar, Spinner, Switch, Tabs,
  TextField, cn,
} from "@/components/ui";
import type { RaschQuizItem, RaschQuizStatus } from "@/types/TeacherRaschQuiz";

/**
 * Builds one 45-question Rasch paper.
 *
 * The whole draft lives in component state and is written as ONE document when
 * the teacher saves — picking a question costs a read (from whichever bank) and
 * nothing else. Contract + traps: docs/RASCH_QUIZ.md.
 */

const TR: Record<string, Record<string, string>> = {
  uz: {
    back: "Orqaga",
    newTitle: "Yangi Rasch testi",
    editTitle: "Testni tahrirlash",
    subtitle: `Aynan ${RASCH_QUIZ_TOTAL} ta savol. O'quvchi 6 xonali kod bilan ochadi.`,
    name: "Test nomi",
    namePlaceholder: "Masalan: 11-sinf yakuniy variant",
    minutes: "Vaqt (daqiqa)",
    shuffle: "Savollarni aralashtirish",
    shuffleHint: "Har bir o'quvchi savollarni boshqa tartibda ko'radi.",
    showAnswers: "Javoblarni ko'rsatish",
    showAnswersHint: "Yakunlangandan so'ng to'g'ri javoblar va izohlar ko'rinadi.",
    code: "Kirish kodi",
    codePending: "Saqlaganda beriladi",
    progress: "Savollar",
    coverage: "Bo'limlar bo'yicha qamrov",
    coverageHint: "Milliy variantdagi nisbat qavs ichida ko'rsatilgan — majburiy emas, faqat taqqoslash uchun.",
    difficulty: "Qiyinlik",
    easy: "Oson", medium: "O'rta", hard: "Qiyin",
    tabBank: "Milliy baza",
    tabMine: "Mening savollarim",
    tabNew: "Yangi savol",
    paper: "Variant",
    emptyPaper: "Hali savol qo'shilmagan.",
    remove: "Olib tashlash",
    up: "Yuqoriga", down: "Pastga",
    save: "Saqlash",
    saveAndPublish: "Saqlash va faollashtirish",
    saved: "Saqlandi",
    published: "Test faollashtirildi",
    saveFailed: "Saqlab bo'lmadi",
    tooLarge: "Variant juda katta — bir nechta savolni olib tashlang.",
    needTitle: "Test nomini kiriting",
    needFull: `Faollashtirish uchun aynan ${RASCH_QUIZ_TOTAL} ta savol kerak.`,
    overFull: `Variantda ${RASCH_QUIZ_TOTAL} ta savol bor — yana qo'shib bo'lmaydi.`,
    loadFailed: "Testni yuklab bo'lmadi",
    size: "hajmi",
    // pickers
    subject: "Fan", chapter: "Bo'lim", load: "Yuklash", loadMore: "Yana 10 ta",
    loading: "Yuklanmoqda…", none: "Savol topilmadi", added: "Qo'shilgan", add: "Qo'shish",
    block: "Blok", imageOnly: "Rasmli savol", reads: "ta hujjat o'qildi", full: "To'ldi",
    // compose
    composeHeading: "O'z savolingizni yozing",
    composeHint: "Savol savollar bazangizga ham saqlanadi — keyingi variantlarda qayta ishlatasiz.",
    topic: "Mavzu", subtopic: "Ichki mavzu",
    type: "Turi", mcq: "Variantli", open: "Yozma javob", numeric: "Sonli javob",
    question: "Savol matni", correct: "To'g'ri javob", wrong: "Noto'g'ri", answer: "Javob",
    explanation: "Izoh", composeSave: "Saqlab, variantga qo'shish", composeSaved: "Savol qo'shildi",
    errNoPrompt: "Savol matnini kiriting", errNoTopic: "Fan, mavzu va ichki mavzuni tanlang",
    errNoAnswer: "To'g'ri javobni kiriting", errNoOptions: "Kamida bitta noto'g'ri variant kerak",
    errDuplicate: "Variantlar takrorlanmasin", errSave: "Savolni saqlab bo'lmadi",
  },
  ru: {
    back: "Назад",
    newTitle: "Новый тест Rasch",
    editTitle: "Редактирование теста",
    subtitle: `Ровно ${RASCH_QUIZ_TOTAL} вопросов. Ученик открывает 6-значным кодом.`,
    name: "Название теста",
    namePlaceholder: "Например: Итоговый вариант, 11 класс",
    minutes: "Время (минут)",
    shuffle: "Перемешивать вопросы",
    shuffleHint: "Каждый ученик увидит вопросы в своём порядке.",
    showAnswers: "Показывать ответы",
    showAnswersHint: "После завершения видны правильные ответы и объяснения.",
    code: "Код доступа",
    codePending: "Будет выдан при сохранении",
    progress: "Вопросы",
    coverage: "Покрытие по разделам",
    coverageHint: "В скобках — пропорция национального варианта; это ориентир, а не требование.",
    difficulty: "Сложность",
    easy: "Лёгкие", medium: "Средние", hard: "Трудные",
    tabBank: "Национальная база",
    tabMine: "Мои вопросы",
    tabNew: "Новый вопрос",
    paper: "Вариант",
    emptyPaper: "Вопросы ещё не добавлены.",
    remove: "Убрать",
    up: "Вверх", down: "Вниз",
    save: "Сохранить",
    saveAndPublish: "Сохранить и активировать",
    saved: "Сохранено",
    published: "Тест активирован",
    saveFailed: "Не удалось сохранить",
    tooLarge: "Вариант слишком большой — уберите несколько вопросов.",
    needTitle: "Введите название теста",
    needFull: `Для активации нужно ровно ${RASCH_QUIZ_TOTAL} вопросов.`,
    overFull: `В варианте уже ${RASCH_QUIZ_TOTAL} вопросов — больше добавить нельзя.`,
    loadFailed: "Не удалось загрузить тест",
    size: "размер",
    subject: "Предмет", chapter: "Раздел", load: "Загрузить", loadMore: "Ещё 10",
    loading: "Загрузка…", none: "Вопросы не найдены", added: "Добавлен", add: "Добавить",
    block: "Блок", imageOnly: "Вопрос с картинкой", reads: "документов прочитано", full: "Заполнено",
    composeHeading: "Напишите свой вопрос",
    composeHint: "Вопрос также сохранится в вашей базе — используйте его в других вариантах.",
    topic: "Тема", subtopic: "Подтема",
    type: "Тип", mcq: "С вариантами", open: "Письменный ответ", numeric: "Числовой ответ",
    question: "Текст вопроса", correct: "Правильный ответ", wrong: "Неверный", answer: "Ответ",
    explanation: "Объяснение", composeSave: "Сохранить и добавить", composeSaved: "Вопрос добавлен",
    errNoPrompt: "Введите текст вопроса", errNoTopic: "Выберите предмет, тему и подтему",
    errNoAnswer: "Введите правильный ответ", errNoOptions: "Нужен хотя бы один неверный вариант",
    errDuplicate: "Варианты не должны повторяться", errSave: "Не удалось сохранить вопрос",
  },
  en: {
    back: "Back",
    newTitle: "New Rasch test",
    editTitle: "Edit test",
    subtitle: `Exactly ${RASCH_QUIZ_TOTAL} questions. Students open it with a 6-digit code.`,
    name: "Test name",
    namePlaceholder: "e.g. Year 11 final paper",
    minutes: "Time (minutes)",
    shuffle: "Shuffle questions",
    shuffleHint: "Each student sees the questions in their own order.",
    showAnswers: "Show answers",
    showAnswersHint: "Correct answers and explanations are revealed after submitting.",
    code: "Access code",
    codePending: "Issued when you save",
    progress: "Questions",
    coverage: "Coverage by section",
    coverageHint: "The national paper's share is in brackets — a reference, not a requirement.",
    difficulty: "Difficulty",
    easy: "Easy", medium: "Medium", hard: "Hard",
    tabBank: "National bank",
    tabMine: "My questions",
    tabNew: "New question",
    paper: "The paper",
    emptyPaper: "No questions added yet.",
    remove: "Remove",
    up: "Up", down: "Down",
    save: "Save",
    saveAndPublish: "Save & publish",
    saved: "Saved",
    published: "Test is live",
    saveFailed: "Could not save",
    tooLarge: "The paper is too large — remove a few questions.",
    needTitle: "Give the test a name",
    needFull: `Publishing needs exactly ${RASCH_QUIZ_TOTAL} questions.`,
    overFull: `The paper already has ${RASCH_QUIZ_TOTAL} questions.`,
    loadFailed: "Could not load the test",
    size: "size",
    subject: "Subject", chapter: "Chapter", load: "Load", loadMore: "10 more",
    loading: "Loading…", none: "No questions found", added: "Added", add: "Add",
    block: "Block", imageOnly: "Image question", reads: "documents read", full: "Full",
    composeHeading: "Write your own question",
    composeHint: "It is saved to your question bank too — reuse it in later papers.",
    topic: "Topic", subtopic: "Subtopic",
    type: "Type", mcq: "Multiple choice", open: "Written answer", numeric: "Numeric answer",
    question: "Question text", correct: "Correct answer", wrong: "Wrong", answer: "Answer",
    explanation: "Explanation", composeSave: "Save & add to paper", composeSaved: "Question added",
    errNoPrompt: "Enter the question text", errNoTopic: "Choose a subject, topic and subtopic",
    errNoAnswer: "Enter the correct answer", errNoOptions: "At least one wrong option is needed",
    errDuplicate: "Options must not repeat", errSave: "Could not save the question",
  },
};

function BuilderInner() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id");
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = TR[lang] || TR.uz;

  const [quizId] = useState(() => editId || newQuizId());
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(RASCH_QUIZ_DEFAULT_MINUTES);
  const [shuffle, setShuffle] = useState(true);
  const [showAnswers, setShowAnswers] = useState(true);
  const [accessCode, setAccessCode] = useState("");
  const [status, setStatus] = useState<RaschQuizStatus>("draft");
  const [items, setItems] = useState<RaschQuizItem[]>([]);

  const [loading, setLoading] = useState(!!editId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("bank");

  // ── load an existing paper ───────────────────────────────────────────────
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      try {
        const quiz = await getQuiz(editId);
        if (cancelled || !quiz) {
          if (!cancelled) setLoadError(t.loadFailed);
          return;
        }
        setTitle(quiz.title);
        setMinutes(quiz.durationMinutes || RASCH_QUIZ_DEFAULT_MINUTES);
        setShuffle(quiz.shuffle);
        setShowAnswers(quiz.showAnswers);
        setAccessCode(quiz.accessCode);
        setStatus(quiz.status);
        setItems(quiz.questions);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError(t.loadFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId, t.loadFailed]);

  // ── derived: the blueprint picture, recomputed for free on every change ──
  const slots = useMemo(() => quizSlotCount(items), [items]);
  const topicCounts = useMemo(() => quizTopicCounts(items), [items]);
  const diffCounts = useMemo(() => quizDifficultyCounts(items), [items]);
  const bytes = useMemo(() => quizByteSize(items), [items]);
  const already = useMemo(() => pickedIds(items), [items]);
  const full = slots >= RASCH_QUIZ_TOTAL;

  const addItem = useCallback((item: RaschQuizItem) => {
    setItems((prev) => {
      if (prev.some((q) => q.id === item.id)) return prev;
      // A `shared_options` block occupies one slot per sub-question, so it is
      // added whole or not at all — truncating it would break its shared pool.
      const slim = slimQuizItem(item);
      const cost = examSlotCount({ ...slim, slotNumber: 0, sectionLabel: { uz: "", ru: "", en: "" } });
      if (quizSlotCount(prev) + cost > RASCH_QUIZ_TOTAL) {
        toast.error(t.overFull);
        return prev;
      }
      return [...prev, slim];
    });
  }, [t.overFull]);

  const removeItem = (id: string) => setItems((prev) => prev.filter((q) => q.id !== id));

  const move = (index: number, delta: number) =>
    setItems((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  // ── save ─────────────────────────────────────────────────────────────────
  async function persist(publish: boolean) {
    if (!user) return;
    if (!title.trim()) { toast.error(t.needTitle); return; }
    if (publish && slots !== RASCH_QUIZ_TOTAL) { toast.error(t.needFull); return; }
    if (bytes > QUIZ_MAX_BYTES) { toast.error(t.tooLarge); return; }

    setSaving(true);
    try {
      // The code is minted on the FIRST save and never regenerated: a teacher who
      // has already read it out to a class must not have it change under them.
      const code = accessCode || await reserveAccessCode();
      const nextStatus: RaschQuizStatus = publish ? "published" : status;

      await saveQuiz(quizId, {
        title: title.trim(),
        description: "",
        teacherId: user.uid,
        teacherName: user.displayName || "",
        accessCode: code,
        questions: items,
        questionCount: slots,
        durationMinutes: Math.max(1, minutes),
        shuffle,
        showAnswers,
        status: nextStatus,
      });

      // saveQuiz writes the status it was given; this only runs when the paper
      // was already stored and is being flipped live from a separate control.
      if (publish && nextStatus !== "published") await setQuizStatus(quizId, "published");

      setAccessCode(code);
      setStatus(nextStatus);
      toast.success(publish ? t.published : t.saved);
      if (publish) router.push("/teacher/create/rasch");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error && err.message.startsWith("QUIZ_TOO_LARGE")
        ? t.tooLarge
        : t.saveFailed;
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const pickerStrings: PickerStrings = {
    subject: t.subject, chapter: t.chapter, difficulty: t.difficulty,
    easy: t.easy, medium: t.medium, hard: t.hard,
    load: t.load, loadMore: t.loadMore, loading: t.loading, none: t.none,
    added: t.added, add: t.add, block: t.block, imageOnly: t.imageOnly,
    reads: t.reads, full: t.full,
  };

  const composeStrings: ComposeStrings = {
    heading: t.composeHeading, hint: t.composeHint,
    subject: t.subject, topic: t.topic, subtopic: t.subtopic,
    type: t.type, mcq: t.mcq, open: t.open, numeric: t.numeric,
    question: t.question, correct: t.correct, wrong: t.wrong, answer: t.answer,
    difficulty: t.difficulty, easy: t.easy, medium: t.medium, hard: t.hard,
    explanation: t.explanation, save: t.composeSave, saved: t.composeSaved, full: t.full,
    errNoPrompt: t.errNoPrompt, errNoTopic: t.errNoTopic, errNoAnswer: t.errNoAnswer,
    errNoOptions: t.errNoOptions, errDuplicate: t.errDuplicate, errSave: t.errSave,
  };

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center"><Spinner size={28} /></div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface pb-32">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6">
        <div className="flex items-center gap-2">
          <IconButton aria-label={t.back} size="sm" onClick={() => router.push("/teacher/create/rasch")}>
            <ArrowLeft />
          </IconButton>
          <PageHeader
            className="flex-1"
            title={editId ? t.editTitle : t.newTitle}
            subtitle={t.subtitle}
          />
        </div>

        {loadError && <Banner tone="error" title={loadError} />}

        {/* ── settings ─────────────────────────────────────────────────── */}
        <Card className="flex flex-col gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <TextField
              label={t.name}
              value={title}
              placeholder={t.namePlaceholder}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TextField
              label={t.minutes}
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || RASCH_QUIZ_DEFAULT_MINUTES)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
              <Switch checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
              <span>
                {t.shuffle}
                <span className="block text-[11px] font-normal text-on-surface-variant">{t.shuffleHint}</span>
              </span>
            </label>

            <label className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
              <Switch checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
              <span>
                {t.showAnswers}
                <span className="block text-[11px] font-normal text-on-surface-variant">{t.showAnswersHint}</span>
              </span>
            </label>

            <div className="ml-auto flex items-center gap-2 rounded-m3-md border border-outline-variant bg-surface-container px-3 py-2">
              <KeyRound size={14} className="text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.code}</span>
              <span className="text-[18px] font-black tracking-[0.2em] text-on-surface">
                {accessCode || <span className="text-[11px] font-medium tracking-normal text-on-surface-variant">{t.codePending}</span>}
              </span>
            </div>
          </div>
        </Card>

        {/* ── progress + coverage ──────────────────────────────────────── */}
        <Card className="flex flex-col gap-4 p-4">
          <div>
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <span className="text-[13px] font-bold text-on-surface">{t.progress}</span>
              <span className={cn("text-[15px] font-black", full ? "text-success" : "text-on-surface-variant")}>
                {slots}<span className="text-on-surface-variant">/{RASCH_QUIZ_TOTAL}</span>
              </span>
            </div>
            <ProgressBar value={(slots / RASCH_QUIZ_TOTAL) * 100} />
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant">
              <Database size={11} /> {t.size}: {Math.round(bytes / 1024)} KB / {Math.round(QUIZ_MAX_BYTES / 1024)} KB
            </p>
          </div>

          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">{t.coverage}</p>
            <div className="flex flex-col gap-1.5">
              {RASCH_TOPICS.map((topic) => {
                const have = topicCounts[topic.key] ?? 0;
                const want = BLUEPRINT_TOPIC_TARGET[topic.key];
                return (
                  <div key={topic.key} className="flex items-center justify-between gap-3 text-[12px] font-medium">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: topic.hex }} />
                      <span className="truncate text-on-surface-variant">{topic.label[lang as "uz" | "ru" | "en"]}</span>
                    </span>
                    <span className={cn("flex-none font-bold", have === 0 ? "text-on-surface-variant" : "text-on-surface")}>
                      {have} <span className="font-normal text-on-surface-variant">({want})</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] font-normal text-on-surface-variant">{t.coverageHint}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3 text-[11px] font-bold">
            <span className="uppercase tracking-wider text-on-surface-variant">{t.difficulty}</span>
            <span className="rounded-m3-xs bg-success-container px-2 py-1 text-on-success-container">{t.easy}: {diffCounts[1] ?? 0}</span>
            <span className="rounded-m3-xs bg-warning-container px-2 py-1 text-on-warning-container">{t.medium}: {diffCounts[2] ?? 0}</span>
            <span className="rounded-m3-xs bg-error-container px-2 py-1 text-on-error-container">{t.hard}: {diffCounts[3] ?? 0}</span>
          </div>
        </Card>

        {/* ── add questions ────────────────────────────────────────────── */}
        <Card className="p-4">
          <Tabs
            tabs={[
              { id: "bank", label: t.tabBank },
              { id: "mine", label: t.tabMine },
              { id: "new", label: t.tabNew },
            ]}
            value={tab}
            onChange={setTab}
            className="mb-4"
          />

          {tab === "bank" && (
            <BankPicker t={pickerStrings} picked={already} disabled={full} onAdd={addItem} />
          )}
          {tab === "mine" && user && (
            <MyBankPicker t={pickerStrings} uid={user.uid} picked={already} disabled={full} onAdd={addItem} />
          )}
          {tab === "new" && (
            <QuickCompose t={composeStrings} disabled={full} onAdd={addItem} />
          )}
        </Card>

        {/* ── the paper ────────────────────────────────────────────────── */}
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-on-surface">
            <Target size={15} className="text-primary" /> {t.paper}
          </h2>

          {items.length === 0 ? (
            <p className="py-8 text-center text-[12px] font-medium text-on-surface-variant">{t.emptyPaper}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {items.map((q, i) => (
                <li key={q.id} className="flex items-start gap-2 rounded-m3-md border border-outline-variant bg-surface-container-lowest p-2.5">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-m3-xs bg-surface-container text-[11px] font-black text-on-surface-variant">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[12.5px] font-medium text-on-surface">
                      <LatexRenderer latex={itemPreview(q, "uz")} />
                    </div>
                    <p className="mt-0.5 text-[10.5px] font-medium uppercase tracking-wide text-on-surface-variant">
                      {q.chapter} · {q.testType} · {q.difficulty}
                      {q.source === "teacher" && q.creatorName ? ` · ${q.creatorName}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-0.5">
                    <IconButton aria-label={t.up} size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton aria-label={t.down} size="sm" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton aria-label={t.remove} size="sm" onClick={() => removeItem(q.id)}>
                      <Trash2 />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* ── sticky save bar ──────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-outline-variant bg-surface-container-low px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className={cn("text-[13px] font-black", full ? "text-success" : "text-on-surface-variant")}>
            {slots}/{RASCH_QUIZ_TOTAL}
          </span>
          <Button variant="outlined" icon={<Save />} loading={saving} onClick={() => persist(false)} className="ml-auto">
            {t.save}
          </Button>
          <Button icon={<Send />} loading={saving} disabled={!full} onClick={() => persist(true)}>
            {t.saveAndPublish}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RaschQuizBuilderPage() {
  // `useSearchParams` requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><Spinner size={28} /></div>}>
      <BuilderInner />
    </Suspense>
  );
}
