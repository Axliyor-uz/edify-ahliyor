"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, ChevronDown, KeyRound, Users } from "lucide-react";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { useAuth } from "@/lib/AuthContext";
import { getQuiz, listQuizResults } from "@/services/teacherRaschQuizService";
import { hydrateQuiz } from "@/lib/RASCHquiz";
import { EXAM_BLUEPRINT } from "@/lib/Examblueprint";
import {
  MIN_RESPONSES, cohortStats, paperMarks, paperSlots, paperTotal, scoreFor,
} from "@/lib/RASCHmarks";
import { RASCH_TOPICS, type TopicKey } from "@/lib/RASCHtopics";
import { MASTER_LEVEL, formatLevel, levelBand, thetaToLevel } from "@/lib/RASCHscale";
import { BAND_LABEL, BAND_VARS } from "@/lib/RASCHband";
import {
  Banner, Card, EmptyState, IconButton, PageHeader, Skeleton, StatTile, cn,
} from "@/components/ui";
import type { RaschQuizResult, TeacherRaschQuiz } from "@/types/TeacherRaschQuiz";

/**
 * Who has sat one paper, and — per student, per dimension — WHERE it went wrong.
 *
 * Everything here is reported on the **0–5 Rasch level**, the same scale the
 * student sees on their own progress page. A percentage answers "how much of
 * this paper did they get", which depends on the paper; a level answers "how
 * hard a problem can they solve", which does not. The raw `correct/total` rides
 * alongside as the evidence, never as the headline.
 *
 * Reads `teacher_rasch_results where quizId == … and teacherId == …` — equality
 * filters only, so it needs no composite index, and the `teacherId` clause is
 * what makes the query PROVABLE against the read rule (drop it and Firestore
 * returns permission-denied, not fewer rows).
 */

/**
 * Below this many items in a dimension, the level is shown but dimmed and marked.
 *
 * ⚠️ Rasch does not stop working on four items — the standard error explodes. A
 * dimension the paper touched twice can read 4.2/5 off one lucky answer, and a
 * teacher acting on that is being misled by a number that looks precise. The
 * threshold is the blueprint's own thinnest real section (Numbers gets 2 of 45),
 * so anything at or under it is flagged rather than trusted.
 */
const THIN_EVIDENCE = 4;

const TR: Record<string, Record<string, string>> = {
  uz: {
    back: "Orqaga",
    title: "Natijalar",
    code: "Kirish kodi",
    students: "O'quvchilar",
    average: "O'rtacha daraja",
    averageScore: "O'rtacha ball",
    student: "O'quvchi",
    score: "Ball",
    level: "Daraja",
    time: "Vaqt",
    when: "Sana",
    emptyTitle: "Hali hech kim yechmagan",
    emptyDesc: "Kodni o'quvchilaringizga bering — natijalar shu yerda paydo bo'ladi.",
    loadFailed: "Natijalarni yuklab bo'lmadi",
    notFound: "Test topilmadi",
    byTopic: "Bo'limlar bo'yicha — sinf o'rtachasi",
    byTopicHint: `Daraja 0–${MASTER_LEVEL} Rasch shkalasida: o'quvchi ishonchli yecha oladigan masalaning qiyinligi. Qavsdagi son — to'g'ri javoblar.`,
    perStudent: "O'quvchining kuchli va kuchsiz tomonlari",
    weakest: "Eng kuchsiz",
    strongest: "Eng kuchli",
    notMeasured: "O'lchanmagan",
    notMeasuredHint: "Bu variantda bu bo'lim bo'yicha savol bo'lmagan.",
    thin: "kam savol",
    thinHint: `Bu bo'limda ${THIN_EVIDENCE} tadan kam savol bor — daraja taxminiy.`,
    legacy: "Bu natija bo'limlar darajasi qo'shilishidan oldin saqlangan.",
    expand: "Bo'limlar bo'yicha",
    min: "daq",
    marksTitle: "Savollar bahosi — sinf natijasiga qarab",
    marksHint: "Har bir bo'limning DTM ballari o'zgarmaydi — faqat qaysi savolga qaysi ball tushishi aniqlanadi: eng kam yechilgan savol shu bo'limning eng katta bali bilan, eng ko'p yechilgani eng kichigi bilan baholanadi.",
    marksProvisional: `${MIN_RESPONSES} tadan kam javob — hozircha boshlang'ich ball`,
    qNo: "№",
    qType: "Turi",
    solvedBy: "Yechganlar",
    ballCol: "Ball",
    dynamicScore: "Dinamik ball",
    avgDynamic: "O'rtacha dinamik ball",
    noItems: "—",
    noItemsHint: "Bu natija savol-baholash qo'shilishidan oldin saqlangan.",
    typeLegend: "Y-1 — bitta to'g'ri javobli yopiq test. Y-2 — moslashtirishni talab qiladigan yopiq test. O — qisqa javobli ochiq test.",
    perQuestion: "Savollar bo'yicha oldi",
    earned: "olgan",
  },
  ru: {
    back: "Назад",
    title: "Результаты",
    code: "Код доступа",
    students: "Учеников",
    average: "Средний уровень",
    averageScore: "Средний балл",
    student: "Ученик",
    score: "Балл",
    level: "Уровень",
    time: "Время",
    when: "Дата",
    emptyTitle: "Пока никто не решал",
    emptyDesc: "Дайте код ученикам — результаты появятся здесь.",
    loadFailed: "Не удалось загрузить результаты",
    notFound: "Тест не найден",
    byTopic: "По разделам — среднее по классу",
    byTopicHint: `Уровень по шкале Rasch 0–${MASTER_LEVEL}: сложность задачи, которую ученик решает уверенно. В скобках — верные ответы.`,
    perStudent: "Сильные и слабые стороны ученика",
    weakest: "Слабее всего",
    strongest: "Сильнее всего",
    notMeasured: "Не измерено",
    notMeasuredHint: "В этом варианте не было вопросов по этому разделу.",
    thin: "мало вопросов",
    thinHint: `В этом разделе меньше ${THIN_EVIDENCE} вопросов — уровень приблизительный.`,
    legacy: "Этот результат сохранён до появления уровней по разделам.",
    expand: "По разделам",
    min: "мин",
    marksTitle: "Цена вопросов — по результатам класса",
    marksHint: "Баллы раздела по ДТМ не меняются — определяется лишь, какому вопросу какой достанется: наименее решённый получает самый большой балл раздела, наиболее решённый — самый маленький.",
    marksProvisional: `Меньше ${MIN_RESPONSES} ответов — пока начальная цена`,
    qNo: "№",
    qType: "Тип",
    solvedBy: "Решили",
    ballCol: "Балл",
    dynamicScore: "Динамический балл",
    avgDynamic: "Средний динамический балл",
    noItems: "—",
    noItemsHint: "Этот результат сохранён до появления оценки по вопросам.",
    typeLegend: "Y-1 — закрытый тест с одним верным ответом. Y-2 — закрытый тест на соответствие. O — открытый тест с кратким ответом.",
    perQuestion: "Балл по каждому вопросу",
    earned: "набрано",
  },
  en: {
    back: "Back",
    title: "Results",
    code: "Access code",
    students: "Students",
    average: "Average level",
    averageScore: "Average score",
    student: "Student",
    score: "Score",
    level: "Level",
    time: "Time",
    when: "Date",
    emptyTitle: "Nobody has sat it yet",
    emptyDesc: "Give the code to your students — results will appear here.",
    loadFailed: "Could not load the results",
    notFound: "Test not found",
    byTopic: "By section — class average",
    byTopicHint: `The level is a 0–${MASTER_LEVEL} Rasch scale: how hard a problem the student solves reliably. Correct answers in brackets.`,
    perStudent: "Where this student is strong and weak",
    weakest: "Weakest",
    strongest: "Strongest",
    notMeasured: "Not measured",
    notMeasuredHint: "This paper asked nothing from this section.",
    thin: "few items",
    thinHint: `Fewer than ${THIN_EVIDENCE} items in this section — the level is approximate.`,
    legacy: "This result was saved before per-section levels existed.",
    expand: "By section",
    min: "min",
    marksTitle: "What each question is worth — from how the class answered",
    marksHint: "A section's DTM balls never change — only which question gets which: the least-solved question in a section takes its dearest ball, the most-solved its cheapest.",
    marksProvisional: `Fewer than ${MIN_RESPONSES} answers — still the starting price`,
    qNo: "#",
    qType: "Type",
    solvedBy: "Solved by",
    ballCol: "Ball",
    dynamicScore: "Dynamic score",
    avgDynamic: "Average dynamic score",
    noItems: "—",
    noItemsHint: "This result was saved before per-question marking existed.",
    typeLegend: "Y-1 — closed item with one correct answer. Y-2 — closed matching item. O — open item with a short answer.",
    perQuestion: "Ball per question",
    earned: "earned",
  },
};

/** One dimension's standing, ready to render. `level: null` ⇒ not measured. */
interface DimRow {
  key: TopicKey;
  label: string;
  hex: string;
  level: number | null;
  correct: number;
  total: number;
}

/** The 0–5 level with its band colour, or a dash. Never a bare percentage. */
function LevelBar({ level, total, t }: { level: number | null; total: number; t: Record<string, string> }) {
  if (level === null) {
    return (
      <span className="flex-none text-[11px] font-bold text-on-surface-variant" title={t.notMeasuredHint}>
        {t.notMeasured}
      </span>
    );
  }
  const band = levelBand(level);
  const vars = BAND_VARS[band];
  const thin = total > 0 && total < THIN_EVIDENCE;

  return (
    <span className="flex flex-none items-center gap-2">
      {thin && (
        <span
          className="rounded-m3-xs bg-surface-container-high px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-on-surface-variant"
          title={t.thinHint}
        >
          {t.thin}
        </span>
      )}
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-container-high">
        <span
          className="block h-full rounded-full"
          style={{ width: `${(level / MASTER_LEVEL) * 100}%`, backgroundColor: vars.color }}
        />
      </span>
      <span className="w-16 text-right text-[12.5px] font-black" style={{ color: vars.color }}>
        {formatLevel(level)}
        <span className="font-bold text-on-surface-variant">/{MASTER_LEVEL}</span>
      </span>
    </span>
  );
}

function DimList({ rows, t }: { rows: DimRow[]; t: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-3 text-[12px] font-medium">
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: r.hex }} />
            <span className="truncate text-on-surface-variant">{r.label}</span>
            {r.total > 0 && (
              <span className="flex-none text-[10.5px] font-bold text-outline">({r.correct}/{r.total})</span>
            )}
          </span>
          <LevelBar level={r.level} total={r.total} t={t} />
        </div>
      ))}
    </div>
  );
}

export default function RaschQuizResultsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = TR[lang] || TR.uz;
  const L = (lang === "ru" || lang === "en" ? lang : "uz") as "uz" | "ru" | "en";

  const [quiz, setQuiz] = useState<TeacherRaschQuiz | null>(null);
  const [rows, setRows] = useState<RaschQuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [found, results] = await Promise.all([
        getQuiz(quizId),
        listQuizResults(quizId, user.uid),
      ]);
      if (!found) { setError(t.notFound); return; }
      setQuiz(found);
      setRows(results);
    } catch (err) {
      console.error(err);
      setError(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [quizId, user, t.notFound, t.loadFailed]);

  useEffect(() => { load(); }, [load]);

  // ── one student's seven dimensions ──────────────────────────────────────
  const dimsFor = (r: RaschQuizResult): DimRow[] =>
    RASCH_TOPICS.map((topic) => {
      const cell = r.topics?.[topic.key];
      const theta = r.topicTheta?.[topic.key];
      return {
        key: topic.key,
        label: topic.label[L],
        hex: topic.hex,
        // No θ ⇒ either the paper never touched this dimension, or the result
        // predates `topicTheta`. Both render as "not measured" — deriving a
        // level from the percentage would report a different quantity.
        level: typeof theta === "number" ? thetaToLevel(theta) : null,
        correct: cell?.correct ?? 0,
        total: cell?.total ?? 0,
      };
    });

  // ── the class, per dimension ────────────────────────────────────────────
  // ⚠️ Averaged in LOGITS, then mapped once. The 0–5 scale is piecewise-linear
  // in θ, so averaging levels and averaging abilities are different numbers —
  // and only the second one is the class's ability.
  const classDims: DimRow[] = RASCH_TOPICS.map((topic) => {
    const thetas = rows
      .map((r) => r.topicTheta?.[topic.key])
      .filter((v): v is number => typeof v === "number");
    const correct = rows.reduce((sum, r) => sum + (r.topics?.[topic.key]?.correct ?? 0), 0);
    const total = rows.reduce((sum, r) => sum + (r.topics?.[topic.key]?.total ?? 0), 0);
    return {
      key: topic.key,
      label: topic.label[L],
      hex: topic.hex,
      level: thetas.length > 0 ? thetaToLevel(thetas.reduce((a, b) => a + b, 0) / thetas.length) : null,
      correct,
      total,
    };
  }).filter((row) => row.total > 0 || row.level !== null);

  // ── the dynamic marks ───────────────────────────────────────────────────
  // Derived, never stored: the cohort is exactly the rows already fetched, so
  // this costs no extra read — and a mark moves the moment another student sits
  // the paper, which is the whole point (lib/RASCHmarks.ts).
  const marks = quiz ? paperMarks(paperSlots(hydrateQuiz(quiz.questions)), cohortStats(rows)) : [];
  const outOf = paperTotal(marks);

  // Grouped for display: the budget is a per-SECTION fact, so the table has to
  // be read section by section or the "3.5 across two questions" rule is
  // invisible. `marks` is in slot order, which already runs section by section.
  const markSections = EXAM_BLUEPRINT.flatMap((section) => {
    const own = marks.filter((m) => m.sectionId === section.id);
    return own.length === 0 ? [] : [{ section, marks: own, budget: own[0].sectionBudget }];
  });
  const dynamicScores = rows.map((r) => scoreFor(marks, r.items));
  const scored = dynamicScores.filter((v): v is number => v !== null);
  const avgDynamic = scored.length
    ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
    : null;

  const avgPercent = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.percent, 0) / rows.length)
    : 0;
  const measured = rows.filter((r) => typeof r.theta === "number");
  const avgLevel = measured.length
    ? thetaToLevel(measured.reduce((sum, r) => sum + (r.theta ?? 0), 0) / measured.length)
    : null;

  return (
    <div className="min-h-[100dvh] bg-surface pb-24">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
        <div className="flex items-center gap-2">
          <IconButton aria-label={t.back} size="sm" onClick={() => router.push("/teacher/create/rasch")}>
            <ArrowLeft />
          </IconButton>
          <PageHeader className="flex-1" title={quiz?.title || t.title} subtitle={t.title} />
        </div>

        {error && <Banner tone="error" title={error} />}

        {quiz && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-m3-md border border-outline-variant bg-surface-container px-3 py-2">
              <KeyRound size={14} className="text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.code}</span>
              <span className="text-[18px] font-black tracking-[0.2em] text-on-surface">{quiz.accessCode}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-m3-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Users />} title={t.emptyTitle} description={t.emptyDesc} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile icon={<Users />} label={t.students} value={String(rows.length)} />
              <StatTile
                icon={<BarChart3 />}
                label={t.average}
                value={avgLevel === null ? "—" : formatLevel(avgLevel)}
                suffix={avgLevel === null ? undefined : `/ ${MASTER_LEVEL}`}
              />
              <StatTile
                icon={<BarChart3 />}
                label={avgDynamic === null ? t.averageScore : t.avgDynamic}
                value={avgDynamic === null ? `${avgPercent}%` : String(avgDynamic)}
                suffix={avgDynamic === null ? undefined : `/ ${outOf}`}
              />
            </div>

            {classDims.length > 0 && (
              <Card className="p-4">
                <h2 className="mb-1 text-[14px] font-bold text-on-surface">{t.byTopic}</h2>
                <p className="mb-3 text-[11px] font-normal leading-relaxed text-on-surface-variant">{t.byTopicHint}</p>
                <DimList rows={classDims} t={t} />
              </Card>
            )}

            {/* What each question turned out to be worth. Grouped by section,
                because the budget is a per-section fact — a flat grid of 45
                hides the one rule that matters ("these two share 3.5"). The
                colour is the SOLVE RATE, not the mark: "nobody got 31" is the
                finding, the bigger ball is only its consequence. */}
            {markSections.length > 0 && (
              <Card className="p-4">
                <h2 className="mb-1 text-[14px] font-bold text-on-surface">{t.marksTitle}</h2>
                <p className="mb-3 text-[11px] font-normal leading-relaxed text-on-surface-variant">{t.marksHint}</p>

                <div className="flex flex-col gap-3">
                  {markSections.map(({ section, marks: own, budget }) => (
                    <div key={section.id}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-[11.5px] font-bold text-on-surface">
                          {section.label[L]}
                          <span className="ml-1.5 font-black text-on-surface-variant">{section.testType}</span>
                        </p>
                        {/* The number that never moves, however the split lands. */}
                        <p className="shrink-0 text-[11.5px] font-black text-primary">
                          {budget.toFixed(1)}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                        {own.map((m) => {
                          const pct = m.p === null ? null : Math.round(m.p * 100);
                          return (
                            <div
                              key={m.key}
                              title={m.provisional ? t.marksProvisional : `${m.correct}/${m.seen}`}
                              className={cn(
                                "rounded-m3-sm border px-2 py-1.5",
                                m.provisional
                                  ? "border-outline-variant bg-surface-container"
                                  : pct !== null && pct < 34
                                    ? "border-error bg-error-container"
                                    : pct !== null && pct < 67
                                      ? "border-outline bg-surface-container-high"
                                      : "border-success bg-success-container",
                              )}
                            >
                              <span className="text-[10px] font-black uppercase tracking-wider opacity-70">
                                {t.qNo}{m.number}
                              </span>
                              <p className="flex items-baseline gap-1 text-[15px] font-black leading-none">
                                {m.ball.toFixed(1)}
                                {/* What this position prints in the protocol —
                                    without it a teacher cannot tell a moved
                                    mark from the official table. */}
                                {m.ball !== m.printedBall && (
                                  <span className="text-[9.5px] font-bold line-through opacity-60">
                                    {m.printedBall.toFixed(1)}
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 text-[9.5px] font-bold opacity-70">
                                {pct === null ? "—" : `${pct}% · ${m.correct}/${m.seen}`}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {marks.some((m) => m.provisional) && (
                  <p className="mt-3 text-[11px] font-medium text-on-surface-variant">{t.marksProvisional}</p>
                )}

                {/* The protocol's own definitions — a teacher reading "Y-2" on a
                    row should not have to look them up. */}
                <p className="mt-3 border-t border-outline-variant pt-2 text-[10.5px] font-medium leading-relaxed text-on-surface-variant">
                  {t.typeLegend}
                </p>
              </Card>
            )}

            {/* One row per student; tap to see the same seven dimensions for
                them alone. That is the question this page exists to answer —
                a class average tells you the topic is weak, not who to help. */}
            <Card className="flex flex-col gap-2 p-4">
              <h2 className="mb-1 text-[14px] font-bold text-on-surface">{t.perStudent}</h2>

              {rows.map((r, ri) => {
                const dims = dimsFor(r);
                const dynamic = dynamicScores[ri];
                const rated = dims.filter((d) => d.level !== null);
                const weakest = rated.length ? rated.reduce((a, b) => (b.level! < a.level! ? b : a)) : null;
                const strongest = rated.length ? rated.reduce((a, b) => (b.level! > a.level! ? b : a)) : null;
                const level = typeof r.theta === "number" ? thetaToLevel(r.theta) : null;
                const vars = level === null ? null : BAND_VARS[levelBand(level)];
                const isOpen = open === r.studentId;

                return (
                  <div key={r.studentId} className="rounded-m3-md border border-outline-variant">
                    <button
                      onClick={() => setOpen(isOpen ? null : r.studentId)}
                      aria-expanded={isOpen}
                      className="m3-interactive flex w-full items-center gap-3 rounded-m3-md p-3 text-left transition-colors hover:bg-surface-container"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-bold text-on-surface">
                          {r.studentName || r.studentId.slice(0, 8)}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">
                          {/* The dynamic mark leads; the raw count stays as the
                              evidence behind it, never as the headline. */}
                          {dynamic === null ? (
                            <span title={t.noItemsHint}>{t.noItems}</span>
                          ) : (
                            <span className="font-black text-on-surface">
                              {dynamic}/{outOf}
                            </span>
                          )}{" "}
                          · {r.correct}/{r.total} · {Math.round(r.durationSec / 60)} {t.min} ·{" "}
                          {new Date(r.submittedAt).toLocaleDateString()}
                        </p>
                      </div>

                      {level !== null && vars && (
                        <span className="flex flex-none items-center gap-2">
                          <span
                            className="rounded-full px-2.5 py-1 text-[11px] font-black"
                            style={{ backgroundColor: vars.container, color: vars.onContainer }}
                          >
                            {BAND_LABEL[L][levelBand(level)]}
                          </span>
                          <span className="text-[19px] font-black leading-none" style={{ color: vars.color }}>
                            {formatLevel(level)}
                            <span className="text-[12px] font-bold text-on-surface-variant">/{MASTER_LEVEL}</span>
                          </span>
                        </span>
                      )}

                      <ChevronDown
                        size={16}
                        className={cn("flex-none text-on-surface-variant transition-transform", isOpen && "rotate-180")}
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-outline-variant p-3">
                        {rated.length === 0 ? (
                          <p className="text-[11.5px] font-medium text-on-surface-variant">{t.legacy}</p>
                        ) : (
                          <>
                            {/* The headline of the headline: the two dimensions
                                worth naming out loud before reading the list. */}
                            <div className="mb-3 grid gap-2 sm:grid-cols-2">
                              {weakest && (
                                <div className="rounded-m3-sm bg-error-container px-3 py-2">
                                  <p className="text-[9.5px] font-black uppercase tracking-wider text-on-error-container opacity-75">{t.weakest}</p>
                                  <p className="mt-0.5 text-[12.5px] font-bold text-on-error-container">
                                    {weakest.label} · {formatLevel(weakest.level!)}/{MASTER_LEVEL}
                                  </p>
                                </div>
                              )}
                              {strongest && (
                                <div className="rounded-m3-sm bg-success-container px-3 py-2">
                                  <p className="text-[9.5px] font-black uppercase tracking-wider text-on-success-container opacity-75">{t.strongest}</p>
                                  <p className="mt-0.5 text-[12.5px] font-bold text-on-success-container">
                                    {strongest.label} · {formatLevel(strongest.level!)}/{MASTER_LEVEL}
                                  </p>
                                </div>
                              )}
                            </div>
                            <DimList rows={dims} t={t} />
                          </>
                        )}

                        {/* Every ball this student actually took, question by
                            question. The dimension levels above say WHERE they
                            are weak; this says what it cost them. */}
                        {r.items && marks.length > 0 && (
                          <div className="mt-3 border-t border-outline-variant pt-3">
                            <div className="mb-1.5 flex items-baseline justify-between gap-3">
                              <p className="text-[11px] font-bold text-on-surface">{t.perQuestion}</p>
                              <p className="text-[11px] font-black text-primary">
                                {dynamic}/{outOf} {t.earned}
                              </p>
                            </div>
                            <div className="grid grid-cols-5 gap-1 sm:grid-cols-9">
                              {marks.map((m) => {
                                const got = !!r.items?.[m.key];
                                return (
                                  <div
                                    key={m.key}
                                    title={`${t.qNo}${m.number} · ${m.ball.toFixed(1)}`}
                                    className={cn(
                                      "rounded-m3-xs px-1 py-1 text-center",
                                      got
                                        ? "bg-success-container text-on-success-container"
                                        : "bg-error-container text-on-error-container",
                                    )}
                                  >
                                    <p className="text-[9px] font-bold opacity-70">{m.number}</p>
                                    <p className="text-[11px] font-black leading-none">
                                      {got ? m.ball.toFixed(1) : "0"}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
