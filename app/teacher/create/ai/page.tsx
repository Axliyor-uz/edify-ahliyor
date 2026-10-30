"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";
import { toQuestionV1, InvalidTopicError } from "@/lib/questionSchema";
import { aiModelFor } from "@/lib/ai/models";
import type { TopicPath } from "@/lib/questionTopics";
import { useAuth } from "@/lib/AuthContext";
import TestConfigurationModal, { type TestSettings } from "@/app/teacher/create/_components/TestConfigurationModal";
import TopicAssignModal from "@/app/teacher/create/_components/TopicAssignModal";
import { useTeacherLanguage } from "@/app/teacher/layout";

import { Button, Chip, Dialog, uiToast } from "@/components/ui";
import { useMonthlyLimit } from "@/hooks/useMonthlyLimit";
import AiMonthlyLimitCard from "@/app/teacher/create/_components/AiMonthlyLimitCard";
import GeneratingOverlay from "@/app/teacher/create/_components/GeneratingOverlay";
import DraftQuestionCard from "@/app/teacher/create/_components/DraftQuestionCard";
import { pickText } from "@/app/teacher/create/_components/MathText";
import { ActionBar, CreateHeader, EmptyHint, Field, INPUT, Segmented, Stepper } from "@/app/teacher/create/_components/CreateKit";

const SUBJECTS = [
  "Matematika", "Fizika", "Kimyo", "Biologiya", "Ona tili va adabiyot",
  "Tarix", "Geografiya", "Informatika", "Huquqshunoslik",
];

/** Max questions per request (the API's cap). */
const MAX_PER_RUN = 15;

type Difficulty = "easy" | "medium" | "hard" | "olympiad";

// --- TRANSLATION DICTIONARY ---
const AI_TRANSLATIONS = {
  uz: {
    title: "AI bilan yaratish", back: "Orqaga",
    subject: "Fan", topic: "Mavzu", topicPlaceholder: "Masalan: Kvadrat ildizlar",
    level: "Daraja", count: "Savollar soni",
    lowLimit: (n: number) => `Bu oy yana ${n} ta savol yaratish mumkin.`,
    generate: "Yaratish",
    emptyTitle: "Hali savol yo'q", emptyText: "Fan va mavzuni tanlang, so'ng «Yaratish»ni bosing.",
    listTitle: "Savollar", summary: (n: number) => `${n} ta savol`,
    moreHint: "Yana qo'shish uchun mavzuni o'zgartirib, qayta yarating.",
    saveToBank: "Bazaga saqlash", publish: "Nashr qilish",
    difficulties: { easy: "Oson", medium: "O'rtacha", hard: "Qiyin", olympiad: "Olimpiada" },
    subjects: {
      "Matematika": "Matematika", "Fizika": "Fizika", "Kimyo": "Kimyo", "Biologiya": "Biologiya",
      "Ona tili va adabiyot": "Ona tili", "Tarix": "Tarix", "Geografiya": "Geografiya",
      "Informatika": "Informatika", "Huquqshunoslik": "Huquq",
    } as Record<string, string>,
    toasts: {
      errSelectSubjectTopic: "Fan va mavzuni kiriting.",
      added: (n: number) => `${n} ta savol qo'shildi`,
      errGeneric: "Xatolik yuz berdi.",
      errCreateFirst: "Oldin savol yarating.",
      errPickTopic: "Savollar uchun mavzu tanlang.",
      savedToBank: "Bazaga saqlandi",
      errSaveBank: "Saqlab bo'lmadi.",
      errEnterTitle: "Test nomini kiriting.",
      published: "Test nashr qilindi",
      errPublish: "Nashr qilib bo'lmadi.",
    },
    limitTitle: "Limit yetmaydi",
    limitLeft: (n: number) => `Bu oy ${n} ta savol qoldi. Sonini kamaytiring yoki tarifni oshiring.`,
    limitReached: "Oylik AI limit tugadi. Tarifni oshiring yoki keyingi oyni kuting.",
    viewPlans: "Tariflar", close: "Yopish",
    titleModal: { title: "Test nomi", placeholder: "Masalan: 7-sinf, kasrlar", cancel: "Bekor qilish", next: "Davom etish" },
  },
  en: {
    title: "Create with AI", back: "Back",
    subject: "Subject", topic: "Topic", topicPlaceholder: "E.g. Square roots",
    level: "Level", count: "Questions",
    lowLimit: (n: number) => `You can generate ${n} more questions this month.`,
    generate: "Generate",
    emptyTitle: "No questions yet", emptyText: "Pick a subject and a topic, then press Generate.",
    listTitle: "Questions", summary: (n: number) => `${n} questions`,
    moreHint: "To add more, change the topic and generate again.",
    saveToBank: "Save to bank", publish: "Publish",
    difficulties: { easy: "Easy", medium: "Medium", hard: "Hard", olympiad: "Olympiad" },
    subjects: {
      "Matematika": "Maths", "Fizika": "Physics", "Kimyo": "Chemistry", "Biologiya": "Biology",
      "Ona tili va adabiyot": "Native language", "Tarix": "History", "Geografiya": "Geography",
      "Informatika": "Computer science", "Huquqshunoslik": "Law",
    } as Record<string, string>,
    toasts: {
      errSelectSubjectTopic: "Enter a subject and a topic.",
      added: (n: number) => `${n} questions added`,
      errGeneric: "Something went wrong.",
      errCreateFirst: "Generate questions first.",
      errPickTopic: "Pick a topic for the questions.",
      savedToBank: "Saved to your bank",
      errSaveBank: "Could not save.",
      errEnterTitle: "Enter a test title.",
      published: "Test published",
      errPublish: "Could not publish.",
    },
    limitTitle: "Not enough limit",
    limitLeft: (n: number) => `${n} questions left this month. Ask for fewer or upgrade your plan.`,
    limitReached: "Your monthly AI limit is used up. Upgrade your plan or wait for next month.",
    viewPlans: "Plans", close: "Close",
    titleModal: { title: "Test title", placeholder: "E.g. Grade 7, fractions", cancel: "Cancel", next: "Continue" },
  },
  ru: {
    title: "Создать с ИИ", back: "Назад",
    subject: "Предмет", topic: "Тема", topicPlaceholder: "Например: Квадратные корни",
    level: "Уровень", count: "Вопросов",
    lowLimit: (n: number) => `В этом месяце можно создать ещё ${n} вопросов.`,
    generate: "Создать",
    emptyTitle: "Вопросов пока нет", emptyText: "Выберите предмет и тему, затем нажмите «Создать».",
    listTitle: "Вопросы", summary: (n: number) => `Вопросов: ${n}`,
    moreHint: "Чтобы добавить ещё, измените тему и создайте снова.",
    saveToBank: "В базу", publish: "Опубликовать",
    difficulties: { easy: "Лёгкий", medium: "Средний", hard: "Сложный", olympiad: "Олимпиада" },
    subjects: {
      "Matematika": "Математика", "Fizika": "Физика", "Kimyo": "Химия", "Biologiya": "Биология",
      "Ona tili va adabiyot": "Родной язык", "Tarix": "История", "Geografiya": "География",
      "Informatika": "Информатика", "Huquqshunoslik": "Право",
    } as Record<string, string>,
    toasts: {
      errSelectSubjectTopic: "Укажите предмет и тему.",
      added: (n: number) => `Добавлено вопросов: ${n}`,
      errGeneric: "Произошла ошибка.",
      errCreateFirst: "Сначала создайте вопросы.",
      errPickTopic: "Выберите тему для вопросов.",
      savedToBank: "Сохранено в базу",
      errSaveBank: "Не удалось сохранить.",
      errEnterTitle: "Введите название теста.",
      published: "Тест опубликован",
      errPublish: "Не удалось опубликовать.",
    },
    limitTitle: "Не хватает лимита",
    limitLeft: (n: number) => `В этом месяце осталось ${n} вопросов. Уменьшите количество или повысьте тариф.`,
    limitReached: "Месячный лимит ИИ исчерпан. Повысьте тариф или дождитесь следующего месяца.",
    viewPlans: "Тарифы", close: "Закрыть",
    titleModal: { title: "Название теста", placeholder: "Например: 7 класс, дроби", cancel: "Отмена", next: "Продолжить" },
  },
};

interface AIQuestion {
  id: string;
  uiDifficulty: string;
  question: { uz: string; ru: string; en: string };
  options: { A: { uz: string; ru: string; en: string }; B: { uz: string; ru: string; en: string }; C: { uz: string; ru: string; en: string }; D: { uz: string; ru: string; en: string }; };
  answer: string;
  explanation: { uz: string; ru: string; en: string };
  difficultyId: number;
  /** The free text the teacher typed into the generator — a display chip only,
   *  NOT taxonomy. The bank topic is chosen in TopicAssignModal at save time. */
  topicLabel: string;
}

/* ─── topic taxonomy ────────────────────────────────────────────────────────
 * The subject/topic the teacher typed into the generator is free text — it is NOT
 * the question-bank taxonomy (data/question_topics.json). `toQuestionV1()` throws
 * InvalidTopicError on anything else, so the teacher files the batch through
 * TopicAssignModal before a single doc is written. */

/** Short plain-text label for one topic-picker row. */
const getPlainText = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 120);
  const v = value as Record<string, unknown>;
  const raw = v.uz ?? v.ru ?? v.en ?? "";
  return typeof raw === "string" ? raw.slice(0, 120) : getPlainText(raw);
};

/** ⚠️ objects, not bare strings — `normalizeQuestion` reads `.id`/`.name`. */
const topicFields = (p: TopicPath) => ({
  subject: { id: p.subjectId, name: p.subjectName },
  topic: { id: p.topicId, name: p.topicName },
  subtopic: { id: p.subtopicId, name: p.subtopicName },
  chapter: { id: "", name: "" },
});

/** custom_tests header name: the shared value, or "Aralash" when the batch spans several. */
const sharedName = (paths: TopicPath[], key: "subjectName" | "topicName" | "subtopicName") => {
  const uniq = [...new Set(paths.map((p) => p[key]))];
  return uniq.length === 1 ? uniq[0] : "Aralash";
};

export default function GeneralAIGeneratorPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = AI_TRANSLATIONS[lang] ?? AI_TRANSLATIONS.uz;

  const aiData = useMonthlyLimit();

  const [selectedSubject, setSelectedSubject] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [count, setCount] = useState(5);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<AIQuestion[]>([]);
  /** Index of the first question of the newest batch — scrolled into view once. */
  const [scrollTarget, setScrollTarget] = useState<number | null>(null);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingToBank, setIsSavingToBank] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [topicIntent, setTopicIntent] = useState<"bank" | "publish">("bank");
  const [topicPaths, setTopicPaths] = useState<TopicPath[]>([]);
  const [testTitle, setTestTitle] = useState("");

  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [limitModalMessage, setLimitModalMessage] = useState("");

  const isReadyToGenerate = selectedSubject && topicInput.trim().length > 2;
  const maxCount = aiData.isUnlimited ? MAX_PER_RUN : Math.max(1, Math.min(MAX_PER_RUN, aiData.remaining));
  const busy = isGenerating || isPublishing || isSavingToBank;

  useEffect(() => {
    if (scrollTarget === null || isGenerating) return;
    document.getElementById(`ai-q-${scrollTarget}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollTarget(null);
  }, [scrollTarget, isGenerating]);

  const handleGenerate = async () => {
    if (!isReadyToGenerate) return uiToast.error(t.toasts.errSelectSubjectTopic);

    // 🟢 NEW: Pre-check monthly limits
    if (!aiData.isUnlimited && aiData.remaining < count) {
      setLimitModalMessage(t.limitLeft(aiData.remaining));
      setIsLimitModalOpen(true);
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/teacher/create/ai/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid,
          subject: selectedSubject,
          topic: topicInput,
          difficulty,
          count,
          language: "uz"
        }),
      });

      const data = await response.json();

      // 🟢 NEW: Gatekeeper error handling
      if (!response.ok) {
        if (data.code === 'LIMIT_REACHED') {
          setLimitModalMessage(t.limitReached);
          setIsLimitModalOpen(true);
          return;
        }
        throw new Error(data.error);
      }

      let diffVal = 2;
      if (difficulty === "easy") diffVal = 1;
      else if (difficulty === "medium") diffVal = 2;
      else if (difficulty === "hard") diffVal = 3;
      else if (difficulty === "olympiad") diffVal = 4;

      // The generator's subject/topic are free text — the bank taxonomy is chosen
      // by the teacher in TopicAssignModal at save time.
      const enrichedQuestions: AIQuestion[] = data.questions.map((q: Omit<AIQuestion, "id" | "topicLabel" | "difficultyId" | "uiDifficulty">) => ({
        ...q,
        id: `tq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        topicLabel: topicInput,
        difficultyId: diffVal,
        uiDifficulty: difficulty
      }));

      setScrollTarget(generatedQuestions.length);
      setGeneratedQuestions(prev => [...prev, ...enrichedQuestions]);
      uiToast.success(t.toasts.added(enrichedQuestions.length));
    } catch (error) {
      uiToast.error((error instanceof Error && error.message) || t.toasts.errGeneric);
    } finally {
      setIsGenerating(false);
    }
  };

  const removeQuestion = (idToDelete: string) => setGeneratedQuestions(prev => prev.filter(q => q.id !== idToDelete));

  // --- TOPIC GATE (runs before BOTH save paths) ---
  const openTopicModal = (intent: "bank" | "publish") => {
    if (generatedQuestions.length === 0) return uiToast.error(t.toasts.errCreateFirst);
    setTopicIntent(intent);
    setIsTopicModalOpen(true);
  };

  const handleTopicConfirm = (paths: TopicPath[]) => {
    setTopicPaths(paths);
    if (topicIntent === "bank") {
      void handleSaveToBank(paths);
      return;
    }
    // publish: topic first, then title, then TestConfigurationModal.
    setIsTopicModalOpen(false);
    setIsTitleModalOpen(true);
  };

  /** Defensive: toQuestionV1 should never throw once the modal is wired. */
  const onInvalidTopic = (intent: "bank" | "publish") => {
    uiToast.error(t.toasts.errPickTopic);
    setTopicIntent(intent);
    setIsTopicModalOpen(true);
  };

  const handleSaveToBank = async (paths: TopicPath[]) => {
    if (generatedQuestions.length === 0) return uiToast.error(t.toasts.errCreateFirst);
    if (!user) return;

    setIsSavingToBank(true);
    const batch = writeBatch(db);

    try {
      generatedQuestions.forEach((q, i) => {
        const id = `tq_${doc(collection(db, "teacher_questions")).id}`;
        const v1 = toQuestionV1(
          {
            ...q,
            ...topicFields(paths[i]),
            difficulty: q.uiDifficulty?.toLowerCase() || "medium",
            difficultyId: q.difficultyId,
            tags: ["general_ai", "smart"],
            language: ["uz"],
            solutions: [],
          },
          {
            id,
            creatorId: user.uid,
            creatorName: user.displayName || "Teacher",
            creationMethod: "ai_generated",
            status: "published",
            aiModel: aiModelFor('questions'),
            timestamp: serverTimestamp(),
          },
        );
        batch.set(doc(db, "teacher_questions", id), v1);
      });

      await batch.commit();
      setIsTopicModalOpen(false);
      uiToast.success(t.toasts.savedToBank);
      setGeneratedQuestions([]);
      router.push('/teacher/create/my_questions');
    } catch (error) {
      if (error instanceof InvalidTopicError) {
        onInvalidTopic("bank");
        return;
      }
      console.error("Save to bank error:", error);
      uiToast.error(t.toasts.errSaveBank);
    } finally {
      setIsSavingToBank(false);
    }
  };

  const handleTitleSubmit = () => {
    if (!testTitle.trim()) return uiToast.error(t.toasts.errEnterTitle);
    setIsTitleModalOpen(false);
    setIsConfigModalOpen(true);
  };

  const handleFinalPublish = async (testSettings: TestSettings) => {
    if (!user) return;
    if (topicPaths.length !== generatedQuestions.length) {
      setIsConfigModalOpen(false);
      return onInvalidTopic("publish");
    }
    setIsPublishing(true);
    const batch = writeBatch(db);
    const finalQuestionsToSave: ReturnType<typeof toQuestionV1>[] = [];

    try {
      generatedQuestions.forEach((q, i) => {
        const id = `tq_${doc(collection(db, "teacher_questions")).id}`;
        const source = {
          ...q,
          ...topicFields(topicPaths[i]),
          difficulty: q.uiDifficulty?.toLowerCase() || "medium",
          difficultyId: q.difficultyId,
          tags: ["general_ai", "smart"],
          language: ["uz"],
          solutions: [],
        };
        const meta = {
          id,
          creatorId: user.uid,
          creatorName: user.displayName || "Teacher",
          creationMethod: "ai_generated" as const,
          status: "published" as const,
          aiModel: aiModelFor('questions'),
        };

        batch.set(doc(db, "teacher_questions", id), toQuestionV1(source, { ...meta, timestamp: serverTimestamp() }));
        // The embedded snapshot needs a CONCRETE time: Firestore rejects serverTimestamp() sentinels inside arrays.
        finalQuestionsToSave.push(toQuestionV1(source, { ...meta, timestamp: Timestamp.now() }));
      });

      batch.set(doc(collection(db, "custom_tests")), {
        teacherId: user.uid,
        title: testTitle,
        track: "general_ai",
        subjectName: sharedName(topicPaths, "subjectName"),
        topicName: sharedName(topicPaths, "topicName"),
        chapterName: "",
        subtopicName: sharedName(topicPaths, "subtopicName"),
        questions: finalQuestionsToSave,
        duration: testSettings.duration,
        shuffle: testSettings.shuffleQuestions,
        resultsVisibility: testSettings.resultsVisibility,
        accessCode: testSettings.accessCode,
        status: "active",
        createdAt: serverTimestamp(),
        questionCount: finalQuestionsToSave.length,
      });

      await batch.commit();
      uiToast.success(t.toasts.published);
      router.push("/teacher/dashboard");
    } catch (error) {
      if (error instanceof InvalidTopicError) {
        setIsConfigModalOpen(false);
        onInvalidTopic("publish");
        return;
      }
      uiToast.error(t.toasts.errPublish);
    } finally {
      setIsPublishing(false);
    }
  };

  const difficulties: { value: Difficulty; label: string }[] = (["easy", "medium", "hard", "olympiad"] as const)
    .map((value) => ({ value, label: t.difficulties[value] }));

  return (
    <div className="flex min-h-full flex-col font-t-body">
      <GeneratingOverlay open={isGenerating} count={count} />

      <CreateHeader title={t.title} backLabel={t.back} right={<AiMonthlyLimitCard aiData={aiData} />} />

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-6 md:py-8 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-10">

        {/* SETTINGS */}
        <form
          className="space-y-6 lg:sticky lg:top-[72px] lg:self-start"
          onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
        >
          <Field label={t.subject}>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.map((id) => (
                <Chip key={id} selected={selectedSubject === id} onClick={() => setSelectedSubject(id)}>
                  {t.subjects[id] ?? id}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label={t.topic} htmlFor="ai-topic">
            <textarea
              id="ai-topic"
              rows={2}
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder={t.topicPlaceholder}
              className={`${INPUT} resize-none`}
            />
          </Field>

          <Field label={t.level}>
            <Segmented label={t.level} value={difficulty} onChange={setDifficulty} options={difficulties} />
          </Field>

          <Field
            label={t.count}
            hint={!aiData.loading && !aiData.isUnlimited && aiData.remaining < MAX_PER_RUN ? t.lowLimit(aiData.remaining) : undefined}
          >
            <Stepper label={t.count} value={count} onChange={setCount} min={1} max={maxCount} />
          </Field>

          <Button type="submit" size="lg" icon={<Sparkles />} className="w-full" disabled={busy} loading={isGenerating}>
            {t.generate}
          </Button>
        </form>

        {/* RESULTS */}
        <section className="mt-10 min-w-0 lg:mt-0" aria-label={t.listTitle}>
          {generatedQuestions.length === 0 ? (
            <EmptyHint icon={<Sparkles />} title={t.emptyTitle} text={t.emptyText} />
          ) : (
            <>
              <h2 className="mb-3 text-sm font-medium text-on-surface-variant">
                {t.listTitle} · <span className="tabular-nums">{generatedQuestions.length}</span>
              </h2>
              <div className="space-y-3">
                {generatedQuestions.map((q, idx) => (
                  <div key={q.id} id={`ai-q-${idx}`} className="scroll-mt-20">
                    <DraftQuestionCard
                      index={idx}
                      question={pickText(q.question)}
                      options={Object.entries(q.options ?? {}).map(([key, value]) => ({ key, text: pickText(value) }))}
                      correct={[q.answer]}
                      explanation={pickText(q.explanation)}
                      meta={[q.topicLabel, t.difficulties[q.uiDifficulty as Difficulty]]}
                      onRemove={() => removeQuestion(q.id)}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-6 text-center text-xs text-on-surface-variant">{t.moreHint}</p>
            </>
          )}
        </section>
      </div>

      {generatedQuestions.length > 0 && (
        <ActionBar summary={t.summary(generatedQuestions.length)}>
          <Button variant="outlined" loading={isSavingToBank} disabled={busy} onClick={() => openTopicModal("bank")}>
            {t.saveToBank}
          </Button>
          <Button loading={isPublishing} disabled={busy} onClick={() => openTopicModal("publish")}>
            {t.publish}
          </Button>
        </ActionBar>
      )}

      {/* LIMIT */}
      <Dialog
        open={isLimitModalOpen}
        onClose={() => setIsLimitModalOpen(false)}
        title={t.limitTitle}
        description={limitModalMessage}
        actions={
          <>
            <Button variant="text" onClick={() => setIsLimitModalOpen(false)}>{t.close}</Button>
            <Button onClick={() => router.push("/teacher/subscription")}>{t.viewPlans}</Button>
          </>
        }
      />

      {/* TEST TITLE (publish: topic → title → settings) */}
      <Dialog
        open={isTitleModalOpen}
        onClose={() => setIsTitleModalOpen(false)}
        title={t.titleModal.title}
        actions={
          <>
            <Button variant="text" onClick={() => setIsTitleModalOpen(false)}>{t.titleModal.cancel}</Button>
            <Button onClick={handleTitleSubmit}>{t.titleModal.next}</Button>
          </>
        }
      >
        <form className="mt-4" onSubmit={(e) => { e.preventDefault(); handleTitleSubmit(); }}>
          <input
            type="text"
            value={testTitle}
            onChange={(e) => setTestTitle(e.target.value)}
            placeholder={t.titleModal.placeholder}
            aria-label={t.titleModal.title}
            className={INPUT}
            autoFocus
          />
        </form>
      </Dialog>

      <TopicAssignModal
        open={isTopicModalOpen}
        questions={generatedQuestions.map(q => getPlainText(q.question))}
        isSaving={isSavingToBank}
        onClose={() => setIsTopicModalOpen(false)}
        onConfirm={handleTopicConfirm}
      />

      <TestConfigurationModal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} onConfirm={handleFinalPublish} questionCount={generatedQuestions.length} testTitle={testTitle} isSaving={isPublishing} />
    </div>
  );
}
