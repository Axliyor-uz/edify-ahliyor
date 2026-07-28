"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowDown, ArrowUp, Blocks, Database, HelpCircle, KeyRound,
  Save, Send, Target, Trash2,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { useAuth } from "@/lib/AuthContext";
import LatexRenderer from "@/components/LatexRenderer";
import { RASCH_TOPICS } from "@/lib/RASCHtopics";
import {
  BLUEPRINT_TOPIC_TARGET, RASCH_QUIZ_DEFAULT_MINUTES, RASCH_QUIZ_TOTAL,
  QUIZ_MAX_BYTES, checkQuizAdd, itemPreview, quizByteSize, quizDifficultyCounts,
  quizItemTopic, quizQuotaGaps, quizSlotCount, quizTopicCounts, slimQuizItem,
  topicForQuizChapter,
} from "@/lib/RASCHquiz";
import {
  getQuiz, newQuizId, pickedIds, reserveAccessCode, saveQuiz, setQuizStatus,
} from "@/services/teacherRaschQuizService";
import { BankPicker, MyBankPicker, type PickerStrings } from "../_components/QuestionPickers";
import { clearDraft, readDraft, writeDraft } from "../_components/draft";
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

/** `{name}` / `{want}` … in a dictionary string, filled at the call site. */
const fmt = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));

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
    coverageHint: "Har bir bo'lim uchun talab qilingan son — aynan shuncha bo'lishi shart, ko'p ham, kam ham emas.",
    difficulty: "Qiyinlik",
    easy: "Oson", medium: "O'rta", hard: "Qiyin",
    addTitle: "Savol qo'shish",
    addHint: "O'zingiz yozgan savollardan yoki Edify bazasidan tanlang. Yangi savol yaratsangiz, u savollar bazangizga saqlanadi va shu yerda paydo bo'ladi.",
    newSingle: "Bitta savol yaratish",
    newSingleHint: "Variantli, yozma yoki sonli javob; rasm ham qo'shsa bo'ladi.",
    newBlock: "Ko'p savolli test yaratish",
    newBlockHint: "Bitta shart ostida bir nechta savol — umumiy variantli yoki yozma.",
    mine: "Yozgan savollaringiz",
    bank: "Edify bazasi",
    load: "Yuklash", loadMore: "Yana 10 ta", none: "Savol topilmadi",
    added: "Qo'shilgan", add: "Qo'shish", block: "Blok",
    imageOnly: "Rasmli savol", full: "To'ldi",
    kind: "Savol turi", kindAll: "Hammasi", kindClosed: "Yopiq", kindOpen: "Ochiq",
    source: "Kim yozgan", srcAi: "AI", srcMine: "O'zim",
    subject: "Fan", chapter: "Bo'lim", reads: "ta hujjat o'qildi",
    quotaFull: "to'ldi", quotaLeft: "yana kerak:",
    draftKept: "Variantingiz saqlab qo'yildi — savol yaratib qaytsangiz yo'qolmaydi.",
    discardDraft: "Tozalash",
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
    overTopic: `"{name}" bo'limiga aynan {want} ta savol kerak — bu bo'lim to'ldi.`,
    needSection: `"{name}" bo'limida {have} ta savol bor, {want} ta bo'lishi kerak.`,
    loadFailed: "Testni yuklab bo'lmadi",
    size: "hajmi",
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
    coverageHint: "Для каждого раздела указано требуемое число — ровно столько, не больше и не меньше.",
    difficulty: "Сложность",
    easy: "Лёгкие", medium: "Средние", hard: "Трудные",
    addTitle: "Добавить вопрос",
    addHint: "Выбирайте из своих вопросов или из Edify database. Созданный вопрос сохранится в вашей базе и появится здесь.",
    newSingle: "Создать один вопрос",
    newSingleHint: "С вариантами, письменный или числовой ответ; можно с картинкой.",
    newBlock: "Создать тест с несколькими вопросами",
    newBlockHint: "Несколько вопросов под одним условием — с общими вариантами или письменные.",
    mine: "Ваши вопросы",
    bank: "Edify database",
    load: "Загрузить", loadMore: "Ещё 10", none: "Вопросы не найдены",
    added: "Добавлен", add: "Добавить", block: "Блок",
    imageOnly: "Вопрос с картинкой", full: "Заполнено",
    kind: "Тип вопроса", kindAll: "Все", kindClosed: "Закрытые", kindOpen: "Открытые",
    source: "Кто написал", srcAi: "ИИ", srcMine: "Я сам",
    subject: "Предмет", chapter: "Раздел", reads: "документов прочитано",
    quotaFull: "заполнено", quotaLeft: "ещё нужно:",
    draftKept: "Ваш вариант сохранён — он не потеряется, пока вы создаёте вопрос.",
    discardDraft: "Очистить",
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
    overTopic: "В разделе «{name}» нужно ровно {want} вопрос(ов) — раздел заполнен.",
    needSection: "В разделе «{name}» {have} вопрос(ов), а должно быть {want}.",
    loadFailed: "Не удалось загрузить тест",
    size: "размер",
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
    coverageHint: "Each section needs exactly the number shown — no more, no fewer.",
    difficulty: "Difficulty",
    easy: "Easy", medium: "Medium", hard: "Hard",
    addTitle: "Add a question",
    addHint: "Pick from your own questions or from the Edify database. A question you create is saved to your bank and appears here.",
    newSingle: "Create one question",
    newSingleHint: "Multiple choice, written or numeric answer; an image if you want one.",
    newBlock: "Create a multi-question test",
    newBlockHint: "Several questions under one stem — shared options or written answers.",
    mine: "Your questions",
    bank: "Edify database",
    load: "Load", loadMore: "10 more", none: "No questions found",
    added: "Added", add: "Add", block: "Block",
    imageOnly: "Image question", full: "Full",
    kind: "Question type", kindAll: "All", kindClosed: "Closed", kindOpen: "Open",
    source: "Written by", srcAi: "AI", srcMine: "Me",
    subject: "Subject", chapter: "Chapter", reads: "documents read",
    quotaFull: "full", quotaLeft: "still needed:",
    draftKept: "Your paper is saved — it survives going off to write a question.",
    discardDraft: "Start over",
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
    overTopic: `"{name}" needs exactly {want} question(s) — that section is full.`,
    needSection: `"{name}" has {have} question(s) but needs {want}.`,
    loadFailed: "Could not load the test",
    size: "size",
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
  const [restored, setRestored] = useState(false);
  const [source, setSource] = useState("mine");

  // ── load: the local draft first, then the server copy ───────────────────
  //
  // The draft wins when it belongs to this paper. It is only ever written when
  // the teacher leaves to write a question, so if one exists it is strictly
  // newer than what is stored — restoring the server copy over it would throw
  // away exactly the work the stash was protecting.
  useEffect(() => {
    const draft = readDraft();
    const mine = draft && (editId ? draft.quizId === editId : true);

    if (draft && mine) {
      setTitle(draft.title);
      setMinutes(draft.minutes);
      setShuffle(draft.shuffle);
      setShowAnswers(draft.showAnswers);
      setAccessCode(draft.accessCode);
      setStatus(draft.status);
      setItems(draft.items);
      setRestored(true);
      setLoading(false);
      return;
    }

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
    // Runs once per paper: `editId` and the error string are the only inputs,
    // and re-running it would stomp on whatever the teacher has since picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // ── derived: the blueprint picture, recomputed for free on every change ──
  const slots = useMemo(() => quizSlotCount(items), [items]);
  const topicCounts = useMemo(() => quizTopicCounts(items), [items]);
  const diffCounts = useMemo(() => quizDifficultyCounts(items), [items]);
  const bytes = useMemo(() => quizByteSize(items), [items]);
  const already = useMemo(() => pickedIds(items), [items]);
  const gaps = useMemo(() => quizQuotaGaps(items), [items]);
  const full = slots >= RASCH_QUIZ_TOTAL;
  /** Publishable: 45 slots AND every dimension exactly at its quota. */
  const complete = full && gaps.length === 0;

  const topicName = useCallback(
    (key: string) => RASCH_TOPICS.find((tp) => tp.key === key)?.label[lang as "uz" | "ru" | "en"] ?? key,
    [lang],
  );

  /**
   * The quota of one dimension, in the shape the pickers render. Same numbers as
   * the coverage panel — both read `topicCounts`, so a row can never disagree
   * with the panel above it.
   */
  const roomOf = useCallback((topic: string | null) => {
    if (!topic || !(topic in BLUEPRINT_TOPIC_TARGET)) return null;
    const key = topic as keyof typeof BLUEPRINT_TOPIC_TARGET;
    return { name: topicName(key), have: topicCounts[key] ?? 0, want: BLUEPRINT_TOPIC_TARGET[key] };
  }, [topicCounts, topicName]);

  const roomForItem = useCallback(
    (item: RaschQuizItem) => roomOf(quizItemTopic(item)),
    [roomOf],
  );

  /** Which dimension a `questions1` chapter feeds — no read needed to know it. */
  const roomForChapter = useCallback(
    (topicId: string, chapterId: string) => roomOf(topicForQuizChapter(topicId, chapterId)),
    [roomOf],
  );

  /**
   * Every add is checked against BOTH ceilings — the paper's 45 slots and the
   * picked question's own dimension quota. The refusal is announced: a teacher
   * who picked a 5th geometry question for a 4-question section must be told
   * why nothing appeared, not left thinking the button is broken.
   *
   * ⚠️ The check runs OUTSIDE the state updater. `setItems(prev => …)` may be
   * invoked twice in dev, and a toast fired from inside would fire twice with it.
   */
  const addItem = useCallback((item: RaschQuizItem) => {
    // A `shared_options` block occupies one slot per sub-question, so it is
    // added whole or not at all — truncating it would break its shared pool.
    const slim = slimQuizItem(item);
    const check = checkQuizAdd(items, slim);

    if (!check.ok) {
      if (check.reason === "full") toast.error(t.overFull);
      else if (check.reason === "topicFull") {
        toast.error(fmt(t.overTopic, { name: topicName(check.topic), want: check.want }));
      }
      return;
    }
    setItems((prev) => (prev.some((q) => q.id === slim.id) ? prev : [...prev, slim]));
  }, [items, t, topicName]);

  const removeItem = (id: string) => setItems((prev) => prev.filter((q) => q.id !== id));

  const move = (index: number, delta: number) =>
    setItems((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  /**
   * Park the paper in localStorage before leaving for a question builder.
   *
   * Without this, the two "create a question" links would silently destroy up to
   * 45 hand-picked questions — the builder holds the paper in component state
   * and those links are ordinary navigations. It also closes a hazard that was
   * already there: a back-swipe used to lose the paper too.
   */
  const stash = () => {
    writeDraft({ quizId, title, minutes, shuffle, showAnswers, accessCode, status, items });
  };

  /** Throw the restored draft away and start the paper over. */
  const discard = () => {
    clearDraft();
    setTitle('');
    setMinutes(RASCH_QUIZ_DEFAULT_MINUTES);
    setShuffle(true);
    setShowAnswers(true);
    setAccessCode('');
    setStatus('draft');
    setItems([]);
    setRestored(false);
  };

  // ── save ─────────────────────────────────────────────────────────────────
  async function persist(publish: boolean) {
    if (!user) return;
    if (!title.trim()) { toast.error(t.needTitle); return; }
    if (publish && slots !== RASCH_QUIZ_TOTAL) { toast.error(t.needFull); return; }
    // A paper built here can never break a quota, but one loaded from before the
    // rule existed can — and it must not be re-published against the wrong shape.
    if (publish && gaps.length > 0) {
      const gap = gaps[0];
      toast.error(fmt(t.needSection, { name: topicName(gap.topic), have: gap.have, want: gap.want }));
      return;
    }
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
      // Safely on the server — the local copy is no longer the newest thing.
      clearDraft();
      setRestored(false);
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
    load: t.load, loadMore: t.loadMore, none: t.none,
    added: t.added, add: t.add, block: t.block,
    imageOnly: t.imageOnly, full: t.full,
    kind: t.kind, kindAll: t.kindAll, kindClosed: t.kindClosed, kindOpen: t.kindOpen,
    source: t.source, srcAi: t.srcAi, srcMine: t.srcMine,
    subject: t.subject, chapter: t.chapter, difficulty: t.difficulty,
    easy: t.easy, medium: t.medium, hard: t.hard, reads: t.reads,
    quotaFull: t.quotaFull, quotaLeft: t.quotaLeft,
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

        {restored && (
          <Banner tone="info" title={t.draftKept}>
            <Button size="sm" variant="text" onClick={discard}>{t.discardDraft}</Button>
          </Banner>
        )}

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
              <span className={cn("text-[15px] font-black", complete ? "text-success" : "text-on-surface-variant")}>
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
                // Over is only reachable on a paper built before the quota rule —
                // the picker refuses the question that would cause it.
                return (
                  <div key={topic.key} className="flex items-center justify-between gap-3 text-[12px] font-medium">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: topic.hex }} />
                      <span className="truncate text-on-surface-variant">{topic.label[lang as "uz" | "ru" | "en"]}</span>
                    </span>
                    <span
                      className={cn(
                        "flex-none font-bold tabular-nums",
                        have === want ? "text-success" : have > want ? "text-error" : "text-on-surface-variant",
                      )}
                    >
                      {have}<span className="font-normal text-on-surface-variant">/{want}</span>
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
          <h2 className="mb-1 text-[14px] font-bold text-on-surface">{t.addTitle}</h2>
          <p className="mb-3 text-[12px] font-medium leading-relaxed text-on-surface-variant">{t.addHint}</p>

          {/* Writing a question happens in the REAL builders, not in a cut-down
              form embedded here. A question is a first-class bank document
              (docs/QUESTIONS.md) — images on the prompt and on every option,
              blocks, the validated topic path — and a second half-featured
              editor would have drifted from the canonical one the moment either
              was touched. These two cover the two shapes a question can take. */}
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <Link
              href="/teacher/create/question"
              onClick={stash}
              className="m3-interactive flex items-start gap-3 rounded-m3-md border border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container"
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-m3-sm bg-tertiary-container text-on-tertiary-container">
                <HelpCircle size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-on-surface">{t.newSingle}</span>
                <span className="mt-0.5 block text-[11px] font-medium leading-snug text-on-surface-variant">
                  {t.newSingleHint}
                </span>
              </span>
            </Link>

            <Link
              href="/teacher/create/block"
              onClick={stash}
              className="m3-interactive flex items-start gap-3 rounded-m3-md border border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:bg-surface-container"
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-m3-sm bg-primary-container text-on-primary-container">
                <Blocks size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-on-surface">{t.newBlock}</span>
                <span className="mt-0.5 block text-[11px] font-medium leading-snug text-on-surface-variant">
                  {t.newBlockHint}
                </span>
              </span>
            </Link>
          </div>

          {/* Two pools. The teacher's own questions come FIRST and are the
              default — a paper is normally built from questions a teacher wrote —
              with the national bank there to top up the sections they have not
              written for yet. Without it, publishing would need 45 own questions
              before the button ever unlocked. */}
          <div className="border-t border-outline-variant pt-3">
            <Tabs
              tabs={[{ id: "mine", label: t.mine }, { id: "bank", label: t.bank }]}
              value={source}
              onChange={setSource}
              className="mb-3"
            />

            {source === "mine" && user && (
              <MyBankPicker
                t={pickerStrings}
                uid={user.uid}
                picked={already}
                disabled={full}
                onAdd={addItem}
                roomForItem={roomForItem}
              />
            )}
            {source === "bank" && (
              <BankPicker
                t={pickerStrings}
                picked={already}
                disabled={full}
                onAdd={addItem}
                roomForItem={roomForItem}
                roomForChapter={roomForChapter}
              />
            )}
          </div>
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
          <span className={cn("text-[13px] font-black", complete ? "text-success" : "text-on-surface-variant")}>
            {slots}/{RASCH_QUIZ_TOTAL}
          </span>
          <Button variant="outlined" icon={<Save />} loading={saving} onClick={() => persist(false)} className="ml-auto">
            {t.save}
          </Button>
          <Button icon={<Send />} loading={saving} disabled={!complete} onClick={() => persist(true)}>
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
