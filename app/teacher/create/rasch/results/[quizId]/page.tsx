"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, KeyRound, Users } from "lucide-react";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { useAuth } from "@/lib/AuthContext";
import { getQuiz, listQuizResults } from "@/services/teacherRaschQuizService";
import { RASCH_TOPICS } from "@/lib/RASCHtopics";
import { thetaToLevel } from "@/lib/RASCHscale";
import {
  Banner, Card, EmptyState, IconButton, PageHeader, Skeleton, StatTile, Table, Td, Th, TRow, cn,
} from "@/components/ui";
import type { RaschQuizResult, TeacherRaschQuiz } from "@/types/TeacherRaschQuiz";

/**
 * Who has sat one paper, and how they did.
 *
 * Reads `teacher_rasch_results where quizId == … and teacherId == …` — equality
 * filters only, so it needs no composite index, and the `teacherId` clause is
 * what makes the query PROVABLE against the read rule (drop it and Firestore
 * returns permission-denied, not fewer rows).
 */

const TR: Record<string, Record<string, string>> = {
  uz: {
    back: "Orqaga",
    title: "Natijalar",
    code: "Kirish kodi",
    students: "O'quvchilar",
    average: "O'rtacha ball",
    averageLevel: "O'rtacha daraja",
    student: "O'quvchi",
    score: "Ball",
    percent: "Foiz",
    level: "Daraja",
    time: "Vaqt",
    when: "Sana",
    emptyTitle: "Hali hech kim yechmagan",
    emptyDesc: "Kodni o'quvchilaringizga bering — natijalar shu yerda paydo bo'ladi.",
    loadFailed: "Natijalarni yuklab bo'lmadi",
    notFound: "Test topilmadi",
    byTopic: "Bo'limlar bo'yicha",
    min: "daq",
  },
  ru: {
    back: "Назад",
    title: "Результаты",
    code: "Код доступа",
    students: "Учеников",
    average: "Средний балл",
    averageLevel: "Средний уровень",
    student: "Ученик",
    score: "Балл",
    percent: "Процент",
    level: "Уровень",
    time: "Время",
    when: "Дата",
    emptyTitle: "Пока никто не решал",
    emptyDesc: "Дайте код ученикам — результаты появятся здесь.",
    loadFailed: "Не удалось загрузить результаты",
    notFound: "Тест не найден",
    byTopic: "По разделам",
    min: "мин",
  },
  en: {
    back: "Back",
    title: "Results",
    code: "Access code",
    students: "Students",
    average: "Average score",
    averageLevel: "Average level",
    student: "Student",
    score: "Score",
    percent: "Percent",
    level: "Level",
    time: "Time",
    when: "Date",
    emptyTitle: "Nobody has sat it yet",
    emptyDesc: "Give the code to your students — results will appear here.",
    loadFailed: "Could not load the results",
    notFound: "Test not found",
    byTopic: "By section",
    min: "min",
  },
};

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

  const [quiz, setQuiz] = useState<TeacherRaschQuiz | null>(null);
  const [rows, setRows] = useState<RaschQuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const avgPercent = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.percent, 0) / rows.length)
    : 0;
  // The Rasch level, not the raw percent — the whole point of a Rasch paper is
  // that ability is reported on a scale, and 0–5 is the scale the student sees
  // on their own progress page (docs/RASCH_SKILLS.md).
  const measured = rows.filter((r) => typeof r.theta === "number");
  const avgLevel = measured.length
    ? thetaToLevel(measured.reduce((sum, r) => sum + (r.theta ?? 0), 0) / measured.length)
    : null;

  // Per-dimension averages across everyone who sat it — where the class as a
  // whole is weak, which is the thing a teacher acts on.
  const topicAverages = RASCH_TOPICS.map((topic) => {
    const cells = rows.map((r) => r.topics?.[topic.key]).filter((c) => c && c.total > 0);
    const correct = cells.reduce((sum, c) => sum + (c?.correct ?? 0), 0);
    const total = cells.reduce((sum, c) => sum + (c?.total ?? 0), 0);
    return { topic, correct, total, percent: total > 0 ? Math.round((correct / total) * 100) : null };
  }).filter((row) => row.total > 0);

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
              <StatTile icon={<BarChart3 />} label={t.average} value={`${avgPercent}%`} />
              <StatTile
                icon={<BarChart3 />}
                label={t.averageLevel}
                value={avgLevel === null ? "—" : avgLevel.toFixed(1)}
              />
            </div>

            {topicAverages.length > 0 && (
              <Card className="p-4">
                <h2 className="mb-3 text-[14px] font-bold text-on-surface">{t.byTopic}</h2>
                <div className="flex flex-col gap-1.5">
                  {topicAverages.map((row) => (
                    <div key={row.topic.key} className="flex items-center justify-between gap-3 text-[12px] font-medium">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: row.topic.hex }} />
                        <span className="truncate text-on-surface-variant">
                          {row.topic.label[lang as "uz" | "ru" | "en"]}
                        </span>
                      </span>
                      <span className={cn(
                        "flex-none font-bold",
                        (row.percent ?? 0) < 50 ? "text-error" : (row.percent ?? 0) < 75 ? "text-warning" : "text-success",
                      )}>
                        {row.percent}% <span className="font-normal text-on-surface-variant">({row.correct}/{row.total})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="overflow-x-auto p-0">
              <Table>
                <thead>
                  <TRow>
                    <Th>{t.student}</Th>
                    <Th>{t.score}</Th>
                    <Th>{t.percent}</Th>
                    <Th>{t.level}</Th>
                    <Th>{t.time}</Th>
                    <Th>{t.when}</Th>
                  </TRow>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <TRow key={r.studentId}>
                      <Td className="font-bold text-on-surface">{r.studentName || r.studentId.slice(0, 8)}</Td>
                      <Td>{r.correct}/{r.total}</Td>
                      <Td className={cn(
                        "font-bold",
                        r.percent < 50 ? "text-error" : r.percent < 75 ? "text-warning" : "text-success",
                      )}>
                        {r.percent}%
                      </Td>
                      <Td>{typeof r.theta === "number" ? thetaToLevel(r.theta).toFixed(1) : "—"}</Td>
                      <Td>{Math.round(r.durationSec / 60)} {t.min}</Td>
                      <Td>{new Date(r.submittedAt).toLocaleDateString()}</Td>
                    </TRow>
                  ))}
                </tbody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
