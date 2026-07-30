"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, ChevronDown, Users } from "lucide-react";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { useAuth } from "@/lib/AuthContext";
import { findSubject } from "@/lib/questionTopics";
import { examSlotKeys } from "@/lib/ExamTeacher";
import {
  PAPER_TOTAL, cohortStats, evenPrinted, normalizedScore, paperMarks, paperSlots,
  paperTotal, scoreFor,
} from "@/lib/RASCHmarks";
import { genericSubject, hydrateMilliyQuiz, subjectName } from "@/lib/MilliyQuiz";
import { getMilliyQuiz, listMilliyResults } from "@/services/milliyQuizService";
import {
  Banner, Card, EmptyState, IconButton, PageHeader, Skeleton, StatTile, cn,
} from "@/components/ui";
import type { MilliyQuiz, MilliyQuizResult } from "@/types/MilliyQuiz";
import type { Lang } from "@/types/Math";

/**
 * Who sat one subject paper, and how the class did.
 *
 * ## 🟢 The SAME dynamic marking as maths (2026-07-30)
 *
 * Every question is priced from the share of the cohort that solved it —
 * `ball = 1.3 + 4.7·(1−p̂)²`, so a question everybody gets right is worth the
 * least and one almost nobody gets is worth the most, and the whole paper is
 * capped at 100. The student's score is `Σ(balls earned) / Σ(balls) × 100`.
 * ⚠️ That is what makes ten hard answers beat ten easy ones — a flat "20 of 30"
 * cannot say it. All of it is [lib/RASCHmarks.ts](../../../../../../lib/RASCHmarks.ts),
 * shared verbatim with the maths paper.
 *
 * ⚠️ **`evenPrinted` is the one difference.** The maths paper has DTM printed
 * per-position values to fall back on; this one has no published protocol, so an
 * unanswered slot falls back to an even split of 100. From the first sitting on,
 * the cohort curve takes over and the two subjects are marked identically.
 *
 * ⚠️ **Still NO ability model.** θ and the 0–5 levels come from the 3PL fit in
 * `lib/RASCHtheta.ts`, which IS anchored on calibrated maths item difficulty.
 * Marks are cohort arithmetic and portable; θ is not. Nothing here shows a level.
 *
 * Cost: **1 read** (the paper) + **1 query** (every sitting). The per-question
 * solve rate adds nothing — it is derived from rows already fetched.
 */

const TR: Record<string, Record<string, string>> = {
  uz: {
    back: "Orqaga",
    scoreHint: "Ball dinamik: sinf ko'p yechgan savol arzon, kam yechilgan savol qimmat baholanadi. Variant jami 100 ball. Yangi o'quvchi ishlagani sayin ballar qayta hisoblanadi.",
    rawCorrect: "to'g'ri",
    ball: 'ball',
    legacyRow: 'savollar bo\u2018yicha saqlanmagan',
    paperTotal: 'Variant jami',
    provisional: "5 tadan kam javob \u2014 ball hali o'zgarishi mumkin",
    solvedShort: 'yechgan',
    title: "Natijalar",
    loading: "Yuklanmoqda…",
    emptyTitle: "Hali hech kim ishlamagan",
    emptyDesc: "O'quvchilar kodni kiritib variantni ishlagach, natijalar shu yerda ko'rinadi.",
    sat: "Ishlagan", average: "O'rtacha", best: "Eng yaxshi",
    students: "O'quvchilar",
    perQuestion: "Savollar bo'yicha",
    perQuestionHint: "Har bir savolni sinfning qanchasi to'g'ri ishlagani. Foiz past bo'lsa — savol qiyin yoki mavzu o'zlashtirilmagan.",
    solved: "to'g'ri ishlagan",
    noItemData: "Bu sitting savol darajasida saqlanmagan — eski natija.",
    question: "savol",
    topics: "Mavzular bo'yicha (sinf)",
    loadFailed: "Natijalarni yuklab bo'lmadi",
    notFound: "Variant topilmadi",
    closedLabel: "Yopiq", openLabel: "Ochiq",
  },
  ru: {
    back: "Назад",
    scoreHint: 'Балл динамический: чем больше учеников решили вопрос, тем он дешевле; редко решаемый вопрос стоит дорого. Всего за вариант — 100 баллов. С каждой новой попыткой баллы пересчитываются.',
    rawCorrect: 'верно',
    ball: 'балл',
    legacyRow: 'не сохранено по вопросам',
    paperTotal: 'Всего за вариант',
    provisional: 'меньше 5 ответов — балл ещё может измениться',
    solvedShort: 'решили',
    title: "Результаты",
    loading: "Загрузка…",
    emptyTitle: "Пока никто не проходил",
    emptyDesc: "Как только ученики введут код и пройдут вариант, результаты появятся здесь.",
    sat: "Прошли", average: "Средний", best: "Лучший",
    students: "Ученики",
    perQuestion: "По вопросам",
    perQuestionHint: "Какая доля класса решила каждый вопрос верно. Низкий процент — вопрос сложный или тема не усвоена.",
    solved: "решили верно",
    noItemData: "Эта попытка не сохранена по вопросам — старый результат.",
    question: "вопрос",
    topics: "По темам (класс)",
    loadFailed: "Не удалось загрузить результаты",
    notFound: "Вариант не найден",
    closedLabel: "Закрытый", openLabel: "Открытый",
  },
  en: {
    back: "Back",
    scoreHint: 'Marks are dynamic: the more of the class that solved a question, the less it is worth; a question few solve is worth the most. The paper totals 100. Every new sitting reprices it.',
    rawCorrect: 'correct',
    ball: 'marks',
    legacyRow: 'not saved per question',
    paperTotal: 'Paper total',
    provisional: 'fewer than 5 answers — the mark is still moving',
    solvedShort: 'solved',
    title: "Results",
    loading: "Loading…",
    emptyTitle: "Nobody has sat it yet",
    emptyDesc: "Once students enter the code and finish the paper, their results show up here.",
    sat: "Sat it", average: "Average", best: "Best",
    students: "Students",
    perQuestion: "Per question",
    perQuestionHint: "The share of the class that got each question right. A low percentage means a hard question, or a topic that has not landed.",
    solved: "solved it",
    noItemData: "This sitting was not saved per question — an older result.",
    question: "question",
    topics: "By topic (class)",
    loadFailed: "Could not load the results",
    notFound: "Paper not found",
    closedLabel: "Closed", openLabel: "Typed",
  },
};

const pct = (n: number) => `${Math.round(n)}%`;

export default function MilliyResultsPage() {
  const router = useRouter();
  const params = useParams<{ subject: string; quizId: string }>();
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = TR[lang] || TR.uz;
  const L = (lang === "ru" || lang === "en" ? lang : "uz") as Lang;

  const subject = genericSubject(params.subject);

  const [quiz, setQuiz] = useState<MilliyQuiz | null>(null);
  const [results, setResults] = useState<MilliyQuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [paper, rows] = await Promise.all([
        getMilliyQuiz(params.quizId),
        listMilliyResults(params.quizId, user.uid),
      ]);
      if (!paper) { setError(t.notFound); return; }
      setQuiz(paper);
      setResults(rows);
    } catch (err) {
      console.error(err);
      setError(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [user, params.quizId, t.notFound, t.loadFailed]);

  useEffect(() => { load(); }, [load]);

  /**
   * The paper's slots, the cohort's per-slot counts, and the marks in force right
   * now. ⚠️ Derived on every render from the sittings that exist — so a
   * question's ball MOVES when another student sits the paper. That is the
   * feature, and the page says so on screen.
   */
  const marks = useMemo(() => {
    if (!quiz) return [];
    const slots = paperSlots(hydrateMilliyQuiz(quiz.questions));
    return paperMarks(slots, cohortStats(results), evenPrinted(slots.length));
  }, [quiz, results]);

  const total = useMemo(() => paperTotal(marks), [marks]);
  const markByKey = useMemo(() => new Map(marks.map((m) => [m.key, m])), [marks]);

  /** Each student's dynamic score. `null` for a sitting saved without `items`. */
  const scores = useMemo(() => {
    const out = new Map<string, { earned: number | null; score: number | null }>();
    for (const r of results) {
      out.set(r.studentId, {
        earned: scoreFor(marks, r.items),
        score: normalizedScore(marks, r.items),
      });
    }
    return out;
  }, [marks, results]);

  /** Ranked by the dynamic score, falling back to percent for legacy rows. */
  const ranked = useMemo(
    () => [...results].sort((a, b) =>
      (scores.get(b.studentId)?.score ?? b.percent) - (scores.get(a.studentId)?.score ?? a.percent),
    ),
    [results, scores],
  );

  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const values = results.map((r) => scores.get(r.studentId)?.score ?? r.percent);
    return {
      sat: results.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      best: Math.max(...values),
    };
  }, [results, scores]);

  /**
   * One row per numbered question: its topic, its ball, and the class solve rate.
   *
   * ⚠️ Sittings with no `items` map are EXCLUDED from the denominator (inside
   * `cohortStats`) rather than counted as wrong — an older client wrote no
   * outcomes, and treating "unknown" as "wrong" would make every question look
   * harder than it is and would inflate its ball.
   */
  const slotStats = useMemo(() => {
    if (!quiz) return [];
    return hydrateMilliyQuiz(quiz.questions).flatMap((q) => {
      const keys = examSlotKeys(q);
      return keys.map((key, i) => {
        const mark = markByKey.get(key);
        return {
          key,
          slot: q.slotNumber + i,
          topic: q.topic || "",
          typed: q.testType === "O",
          seen: mark?.seen ?? 0,
          correct: mark?.correct ?? 0,
          ball: mark?.ball ?? 0,
          provisional: mark?.provisional ?? true,
        };
      });
    });
  }, [quiz, markByKey]);

  const measured = slotStats.some((s) => s.seen > 0);

  /** Class totals per topic slug, summed over every sitting that recorded them. */
  const topicTotals = useMemo(() => {
    const acc = new Map<string, { correct: number; total: number }>();
    for (const r of results) {
      for (const [slug, v] of Object.entries(r.topics ?? {})) {
        const prev = acc.get(slug) ?? { correct: 0, total: 0 };
        acc.set(slug, { correct: prev.correct + v.correct, total: prev.total + v.total });
      }
    }
    return [...acc.entries()].sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));
  }, [results]);

  const topicNames = useMemo(() => {
    const taxonomy = subject?.taxonomySlug ? findSubject(subject.taxonomySlug) : undefined;
    return new Map((taxonomy?.topics ?? []).map((tp) => [tp.id, tp.name]));
  }, [subject?.taxonomySlug]);

  const base = `/teacher/milliy-sertifikat/${params.subject}`;

  return (
    <div className="min-h-[100dvh] bg-surface pb-24">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
        <div className="flex items-center gap-2">
          <IconButton aria-label={t.back} size="sm" onClick={() => router.push(base)}>
            <ArrowLeft />
          </IconButton>
          <PageHeader
            className="flex-1"
            title={t.title}
            subtitle={[
              subject ? subjectName(subject, L) : null,
              quiz?.title || null,
            ].filter(Boolean).join(" · ")}
          />
        </div>

        {error && <Banner tone="error" title={error} />}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-m3-lg" />)}
          </div>
        ) : results.length === 0 ? (
          <EmptyState icon={<Users />} title={t.emptyTitle} description={t.emptyDesc} />
        ) : (
          <>
            {stats && (
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile label={t.sat} value={String(stats.sat)} icon={<Users />} />
                <StatTile label={t.average} value={pct(stats.avg)} icon={<BadgeCheck />} />
                <StatTile label={t.best} value={pct(stats.best)} icon={<BadgeCheck />} />
              </div>
            )}

            {/* ── students ─────────────────────────────────────────────── */}
            <Card className="p-4">
              <h2 className="mb-1 text-[14px] font-bold text-on-surface">{t.students}</h2>
              <p className="mb-3 text-[11px] font-medium leading-relaxed text-on-surface-variant">{t.scoreHint}</p>
              <ul className="flex flex-col gap-2">
                {ranked.map((r) => {
                  const open = openRow === r.studentId;
                  const hasItems = !!r.items && Object.keys(r.items).length > 0;
                  const mine = scores.get(r.studentId);
                  // ⚠️ A legacy sitting has no per-slot outcomes, so it cannot be
                  // priced — it shows the percent it was saved with, labelled.
                  const shown = mine?.score ?? r.percent;
                  return (
                    <li key={r.studentId} className="rounded-m3-md border border-outline-variant bg-surface-container-lowest">
                      <button
                        onClick={() => setOpenRow(open ? null : r.studentId)}
                        className="flex w-full items-center gap-3 p-3 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-on-surface">
                            {r.studentName || r.studentId}
                          </span>
                          <span className="block text-[11px] font-medium text-on-surface-variant">
                            {r.correct}/{r.total} {t.rawCorrect} · {Math.round(r.durationSec / 60)} min
                            {mine?.earned !== null && mine?.earned !== undefined
                              ? ` · ${mine.earned.toFixed(2)}/${total.toFixed(2)} ${t.ball}`
                              : ` · ${t.legacyRow}`}
                          </span>
                        </span>
                        <span className={cn(
                          "s-num flex-none text-[15px] font-black tabular-nums",
                          shown >= 60 ? "text-success" : shown >= 40 ? "text-warning" : "text-error",
                        )}>
                          {shown.toFixed(1)}
                        </span>
                        <ChevronDown size={16} className={cn("flex-none text-on-surface-variant transition-transform", open && "rotate-180")} />
                      </button>

                      {open && (
                        <div className="border-t border-outline-variant p-3">
                          {!hasItems ? (
                            <p className="text-[11px] font-medium text-on-surface-variant">{t.noItemData}</p>
                          ) : (
                            <>
                              {/* The ball this student TOOK on every question — 0
                                  where they got it wrong. This grid adds up to the
                                  headline by construction. */}
                              <ul className="flex flex-wrap gap-1.5">
                                {slotStats.map((sl) => {
                                  const got = r.items?.[sl.key];
                                  return (
                                    <li
                                      key={sl.key}
                                      title={`${t.question} ${sl.slot}${sl.topic ? ` · ${sl.topic}` : ""} · ${sl.ball.toFixed(2)}`}
                                      className={cn(
                                        "flex min-w-[52px] flex-col items-center rounded-m3-xs px-1.5 py-1",
                                        got === undefined
                                          ? "bg-surface-container text-on-surface-variant"
                                          : got
                                            ? "bg-success-container text-on-success-container"
                                            : "bg-error-container text-on-error-container",
                                      )}
                                    >
                                      <span className="text-[10px] font-black tabular-nums opacity-70">{sl.slot}</span>
                                      <span className="text-[11px] font-black tabular-nums">
                                        {got ? sl.ball.toFixed(2) : "0"}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* ── per-topic, weakest first ─────────────────────────────── */}
            {topicTotals.length > 0 && (
              <Card className="p-4">
                <h2 className="mb-3 text-[14px] font-bold text-on-surface">{t.topics}</h2>
                <ul className="flex flex-col gap-1.5">
                  {topicTotals.map(([slug, v]) => (
                    <li key={slug} className="flex items-center justify-between gap-3 text-[12px] font-medium">
                      <span className="min-w-0 truncate text-on-surface-variant">{topicNames.get(slug) || slug || "—"}</span>
                      <span className="flex-none font-bold tabular-nums text-on-surface">
                        {v.correct}/{v.total} · {pct(v.total ? (v.correct / v.total) * 100 : 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* ── per-question: the ball, and why it is that ball ──────── */}
            {measured && (
              <Card className="p-4">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[14px] font-bold text-on-surface">{t.perQuestion}</h2>
                  <span className="s-num text-[12px] font-black tabular-nums text-on-surface-variant">
                    {t.paperTotal}: {total.toFixed(2)}/{PAPER_TOTAL}
                  </span>
                </div>
                <p className="mb-3 text-[11px] font-medium leading-relaxed text-on-surface-variant">{t.perQuestionHint}</p>
                <ul className="flex flex-col gap-1.5">
                  {slotStats.map((sl) => {
                    const rate = sl.seen > 0 ? (sl.correct / sl.seen) * 100 : null;
                    return (
                      <li key={sl.key} className="flex items-center gap-3 text-[12px] font-medium">
                        <span className="grid h-6 w-6 flex-none place-items-center rounded-m3-xs bg-surface-container text-[11px] font-black text-on-surface-variant">
                          {sl.slot}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-on-surface-variant">
                          {sl.topic || "—"}
                          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide">
                            {sl.typed ? t.openLabel : t.closedLabel}
                          </span>
                        </span>
                        <span className="flex-none text-[11px] font-medium tabular-nums text-on-surface-variant">
                          {rate === null ? "—" : `${pct(rate)} ${t.solved}`}
                        </span>
                        {/* The ball. A dashed edge means it is live but still
                            moving — fewer than 5 answers behind it. */}
                        <span
                          title={sl.provisional ? t.provisional : undefined}
                          className={cn(
                            "s-num flex-none rounded-m3-xs px-2 py-1 text-[12px] font-black tabular-nums",
                            sl.provisional && "border border-dashed border-outline",
                            sl.ball >= 4 ? "bg-error-container text-on-error-container"
                              : sl.ball >= 2.5 ? "bg-warning-container text-on-warning-container"
                              : "bg-success-container text-on-success-container",
                          )}
                        >
                          {sl.ball.toFixed(2)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
