// app/(student)/ielts/[groupId]/page.tsx — student IELTS group page:
// assignments (status + start/result), band trajectory vs target, weak question types.
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  BookOpen, Headphones, PenLine, Mic, Play, Eye, Lock, Clock, Target,
} from 'lucide-react';
import {
  Page, PageHeader, Card, Tile, Chip, Button,
  EmptyState, LoadingState, ProgressBar,
} from '@/components/student-ui';
import { useStudentLanguage } from '../../layout';
import { fetchAssignments, fetchMyAttempts } from '@/services/ieltsService';
import type { IeltsAssignment, IeltsSkill } from '@/lib/ielts/types';
import { IeltsGroup } from '@/types/ielts';
import { typeLabel } from '../_components/typeLabels';

// --- TRANSLATIONS ---
const T: any = {
  uz: {
    fallbackTitle: 'IELTS guruhi',
    targetBand: 'Maqsad',
    currentBand: 'Hozirgi band',
    assignments: 'Vazifalar',
    emptyAssignments: "Hali vazifa yo'q",
    emptyAssignmentsDesc: "O'qituvchingiz test tayinlaganda shu yerda ko'rinadi.",
    progress: 'Mening natijalarim',
    progressEmpty: "Baholangan urinishlar hali yo'q — birinchi testni yeching!",
    weakTypes: 'Zaif savol turlari',
    accuracy: "to'g'ri",
    start: 'Boshlash',
    result: 'Natija',
    pendingReview: 'Tekshirilmoqda',
    band: 'Band',
    status: { upcoming: 'Kutilmoqda', open: 'Ochiq', done: 'Bajarildi', missed: "O'tkazib yuborildi" },
    mode: { simulation: 'Imtihon', practice: 'Mashq' },
    opens: 'Ochiladi',
    due: 'Muddat',
    attemptsLeft: (n: number) => `${n} ta urinish qoldi`,
    deniedTitle: "Guruh topilmadi yoki siz a'zo emassiz",
    deniedDesc: "Bu guruhga kirish uchun avval o'qituvchi so'rovingizni tasdiqlashi kerak.",
    backToHub: 'IELTS sahifasiga qaytish',
  },
  en: {
    fallbackTitle: 'IELTS group',
    targetBand: 'Target',
    currentBand: 'Current band',
    assignments: 'Assignments',
    emptyAssignments: 'No assignments yet',
    emptyAssignmentsDesc: 'When your teacher assigns a test, it will appear here.',
    progress: 'My progress',
    progressEmpty: 'No graded attempts yet — take your first test!',
    weakTypes: 'Weak question types',
    accuracy: 'correct',
    start: 'Start',
    result: 'Result',
    pendingReview: 'Pending review',
    band: 'Band',
    status: { upcoming: 'Upcoming', open: 'Open', done: 'Done', missed: 'Missed' },
    mode: { simulation: 'Exam', practice: 'Practice' },
    opens: 'Opens',
    due: 'Due',
    attemptsLeft: (n: number) => `${n} ${n === 1 ? 'attempt' : 'attempts'} left`,
    deniedTitle: 'Group not found or you are not a member',
    deniedDesc: 'Your teacher needs to approve your join request before you can open this group.',
    backToHub: 'Back to IELTS hub',
  },
  ru: {
    fallbackTitle: 'IELTS группа',
    targetBand: 'Цель',
    currentBand: 'Текущий band',
    assignments: 'Задания',
    emptyAssignments: 'Заданий пока нет',
    emptyAssignmentsDesc: 'Когда учитель назначит тест, он появится здесь.',
    progress: 'Мой прогресс',
    progressEmpty: 'Оценённых попыток пока нет — пройдите первый тест!',
    weakTypes: 'Слабые типы вопросов',
    accuracy: 'верно',
    start: 'Начать',
    result: 'Результат',
    pendingReview: 'На проверке',
    band: 'Band',
    status: { upcoming: 'Скоро', open: 'Открыто', done: 'Сдано', missed: 'Пропущено' },
    mode: { simulation: 'Экзамен', practice: 'Практика' },
    opens: 'Откроется',
    due: 'Срок',
    attemptsLeft: (n: number) => `Осталось попыток: ${n}`,
    deniedTitle: 'Группа не найдена или вы не участник',
    deniedDesc: 'Учитель должен подтвердить ваш запрос, прежде чем вы сможете открыть эту группу.',
    backToHub: 'Назад к IELTS',
  },
};

const SKILL_ICONS: Record<IeltsSkill, typeof BookOpen> = {
  reading: BookOpen, listening: Headphones, writing: PenLine, speaking: Mic,
};
const LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };

// ─── Module-level 60s caches (student-page convention) ───────────────────────
type AssignmentDoc = { id: string } & IeltsAssignment;
type AttemptDoc = { id: string } & Record<string, unknown>;
const CACHE_TTL = 60_000;
const groupCache: Record<string, { at: number; group: IeltsGroup; assignments: AssignmentDoc[] }> = {};
const attemptsCache: Record<string, { at: number; data: AttemptDoc[] }> = {};

// Firestore Timestamps (do NOT re-derive day keys — display only).
function tsToDate(v: unknown): Date | null {
  const d = (v as { toDate?: () => Date } | null)?.toDate?.();
  return d instanceof Date ? d : null;
}

function formatDate(d: Date, lang: string): string {
  const loc = LOCALES[lang] || LOCALES.uz;
  return `${d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}`;
}

function attemptBand(a: AttemptDoc): number | null {
  if (typeof a.bandScore === 'number') return a.bandScore;
  const tg = a.teacherGrade as { band?: number } | undefined;
  return typeof tg?.band === 'number' ? tg.band : null;
}

// ─── Band trajectory sparkline (inline SVG, kit-token currentColor) ──────────
function BandSparkline({ bands, target }: { bands: number[]; target: number | null }) {
  const w = 280, h = 72;
  const all = target != null ? [...bands, target] : bands;
  let min = Math.min(...all), max = Math.max(...all);
  if (max - min < 1) { min -= 0.5; max += 0.5; }
  const x = (i: number) => bands.length > 1 ? (i / (bands.length - 1)) * (w - 16) + 8 : w / 2;
  const y = (b: number) => h - 10 - ((b - min) / (max - min)) * (h - 20);
  const pts = bands.map((b, i) => `${x(i).toFixed(1)},${y(b).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[72px] w-full text-primary" preserveAspectRatio="none" aria-hidden>
      {target != null && (
        <line
          x1={0} x2={w} y1={y(target)} y2={y(target)}
          className="text-outline" stroke="currentColor" strokeWidth={1.5} strokeDasharray="5 5"
        />
      )}
      <polyline
        points={pts} fill="none" stroke="currentColor"
        strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx={x(bands.length - 1)} cy={y(bands[bands.length - 1])} r={3.5} fill="currentColor" />
    </svg>
  );
}

// ─── Assignment row ───────────────────────────────────────────────────────────
function AssignmentCard({
  a, attempt, groupId, lang, t,
}: {
  a: AssignmentDoc; attempt: AttemptDoc | undefined; groupId: string; lang: string; t: any;
}) {
  const router = useRouter();
  const Icon = SKILL_ICONS[a.skill] || BookOpen;
  const openAt = tsToDate(a.openAt);
  const dueAt = tsToDate(a.dueAt);
  const [now] = useState(() => Date.now());
  const windowOpen = !openAt || openAt.getTime() <= now;
  const pastDue = !!dueAt && dueAt.getTime() < now;

  const status: 'upcoming' | 'open' | 'done' | 'missed' =
    attempt ? 'done' : !windowOpen ? 'upcoming' : pastDue ? 'missed' : 'open';
  const statusChip = {
    upcoming: 'neutral', open: 'info', done: 'success', missed: 'error',
  } as const;

  const attemptsTaken = typeof attempt?.attemptsTaken === 'number' ? attempt.attemptsTaken : (attempt ? 1 : 0);
  const attemptsLeft = Math.max(0, (a.allowedAttempts || 1) - attemptsTaken);
  const canStart = windowOpen && !pastDue && attemptsLeft > 0;

  const resultsVisible = attempt != null && (
    a.resultsVisibility === 'always' || (a.resultsVisibility === 'after_due' && pastDue)
  );

  const isWS = a.skill === 'writing' || a.skill === 'speaking';
  const wsGrade = attempt ? (attempt.teacherGrade as { band?: number } | undefined) : undefined;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Tile tone="primary" size="md"><Icon size={18} strokeWidth={2.5} /></Tile>
        <div className="min-w-0 flex-1">
          <h3 className="s-display text-[15.5px] font-bold leading-tight line-clamp-2">{a.testTitle}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip status={statusChip[status]} size="sm">{t.status[status]}</Chip>
            <Chip status="neutral" size="sm">{t.mode[a.mode] || a.mode}</Chip>
            {isWS && attempt && (
              typeof wsGrade?.band === 'number'
                ? <Chip status="gold" size="sm">{t.band} {wsGrade.band.toFixed(1)}</Chip>
                : <Chip status="warning" size="sm">{t.pendingReview}</Chip>
            )}
            {!isWS && attempt && attemptBand(attempt) != null && resultsVisible && (
              <Chip status="gold" size="sm">{t.band} {attemptBand(attempt)!.toFixed(1)}</Chip>
            )}
          </div>
        </div>
      </div>

      {(openAt || dueAt) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-bold text-on-surface-variant">
          {openAt && (
            <span className="s-num inline-flex items-center gap-1">
              <Clock size={13} strokeWidth={2.5} /> {t.opens}: {formatDate(openAt, lang)}
            </span>
          )}
          {dueAt && (
            <span className="s-num inline-flex items-center gap-1">
              <Target size={13} strokeWidth={2.5} /> {t.due}: {formatDate(dueAt, lang)}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!canStart}
          icon={canStart ? <Play size={15} strokeWidth={3} /> : <Lock size={15} strokeWidth={2.5} />}
          onClick={() => router.push(`/ielts/${groupId}/test/${a.id}`)}
        >
          {t.start}
        </Button>
        {attempt && resultsVisible && (
          <Button
            size="sm"
            variant="tonal"
            icon={<Eye size={15} strokeWidth={2.5} />}
            onClick={() => router.push(`/ielts/review/${attempt.id}`)}
          >
            {t.result}
          </Button>
        )}
        {canStart && attempt && (
          <span className="text-[12px] font-bold text-on-surface-variant">{t.attemptsLeft(attemptsLeft)}</span>
        )}
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IeltsGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { lang } = useStudentLanguage();
  const t = T[lang] || T.uz;

  const [group, setGroup] = useState<IeltsGroup | null>(null);
  const [assignments, setAssignments] = useState<AssignmentDoc[]>([]);
  const [attempts, setAttempts] = useState<AttemptDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!user || !groupId) return;
    let alive = true;

    const load = async () => {
      try {
        const cached = groupCache[groupId];
        if (cached && Date.now() - cached.at < CACHE_TTL) {
          if (alive) { setGroup(cached.group); setAssignments(cached.assignments); }
        } else {
          const snap = await getDoc(doc(db, 'ielts_groups', groupId));
          if (!snap.exists()) { if (alive) { setDenied(true); setLoading(false); } return; }
          const g = { id: snap.id, ...snap.data() } as IeltsGroup;
          const asgs = (await fetchAssignments(groupId)) as AssignmentDoc[];
          groupCache[groupId] = { at: Date.now(), group: g, assignments: asgs };
          if (alive) { setGroup(g); setAssignments(asgs); }
        }

        const aKey = `${user.uid}_${groupId}`;
        const aCached = attemptsCache[aKey];
        if (aCached && Date.now() - aCached.at < CACHE_TTL) {
          if (alive) setAttempts(aCached.data);
        } else {
          const atts = (await fetchMyAttempts(user.uid, { groupId })) as AttemptDoc[];
          attemptsCache[aKey] = { at: Date.now(), data: atts };
          if (alive) setAttempts(atts);
        }
        if (alive) setLoading(false);
      } catch {
        // permission-denied → not a member (or rules-tightened group)
        if (alive) { setDenied(true); setLoading(false); }
      }
    };
    load();
    return () => { alive = false; };
  }, [user, groupId]);

  if (loading) {
    return (
      <Page>
        <LoadingState rows={4} />
      </Page>
    );
  }

  if (denied || !group) {
    return (
      <Page>
        <Card>
          <EmptyState
            icon="🔒"
            title={t.deniedTitle}
            description={t.deniedDesc}
            action={
              <Link href="/ielts">
                <Button variant="tonal">{t.backToHub}</Button>
              </Link>
            }
          />
        </Card>
      </Page>
    );
  }

  // Visible assignments: assignedTo 'all' or explicitly includes me.
  const myAssignments = assignments.filter(
    a => a.assignedTo === 'all' || (Array.isArray(a.assignedTo) && a.assignedTo.includes(user!.uid)),
  );
  const attemptByAssignment = new Map<string, AttemptDoc>();
  for (const a of attempts) {
    const id = String(a.assignmentId || '');
    if (id && !attemptByAssignment.has(id)) attemptByAssignment.set(id, a);
  }

  // Graded bands, oldest → newest (fetchMyAttempts sorts newest first).
  const gradedBands = attempts
    .filter(a => attemptBand(a) != null)
    .slice()
    .reverse()
    .map(a => attemptBand(a)!);
  const currentBand = gradedBands.length ? gradedBands[gradedBands.length - 1] : null;
  const targetBand = Number(group.targetBand) || null;

  // Weak question types: aggregate typeStats across my attempts, 3 worst.
  const agg: Record<string, { correct: number; total: number }> = {};
  for (const a of attempts) {
    const stats = a.typeStats as Record<string, { correct: number; total: number }> | undefined;
    if (!stats) continue;
    for (const [type, s] of Object.entries(stats)) {
      if (!agg[type]) agg[type] = { correct: 0, total: 0 };
      agg[type].correct += s.correct || 0;
      agg[type].total += s.total || 0;
    }
  }
  const weakTypes = Object.entries(agg)
    .filter(([, s]) => s.total > 0)
    .map(([type, s]) => ({ type, pct: Math.round((s.correct / s.total) * 100) }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  return (
    <Page>
      <PageHeader
        title={group.title || t.fallbackTitle}
        subtitle={group.description || undefined}
        onBack={() => router.push('/ielts')}
        actions={
          targetBand != null ? (
            <Chip status="primary" size="md">🎯 {t.targetBand} {targetBand.toFixed(1)}</Chip>
          ) : undefined
        }
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-s-section">

        {/* ── My progress ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-s-gap">
          <h2 className="s-display text-lg font-bold">{t.progress}</h2>
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {currentBand != null && (
                <Chip status="gold" size="md">{t.currentBand}: {currentBand.toFixed(1)}</Chip>
              )}
              {targetBand != null && (
                <Chip status="neutral" size="md">{t.targetBand}: {targetBand.toFixed(1)}</Chip>
              )}
            </div>
            {gradedBands.length >= 2 ? (
              <BandSparkline bands={gradedBands} target={targetBand} />
            ) : gradedBands.length === 0 ? (
              <p className="text-[13px] font-bold text-on-surface-variant">{t.progressEmpty}</p>
            ) : null}
          </Card>
        </section>

        {/* ── Weak question types (only when data exists) ─────────────────── */}
        {weakTypes.length > 0 && (
          <section className="flex flex-col gap-s-gap">
            <h2 className="s-display text-lg font-bold">{t.weakTypes}</h2>
            <Card className="flex flex-col gap-4">
              {weakTypes.map(({ type, pct }) => (
                <div key={type} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-[13px] font-bold">
                    <span>{typeLabel(type)}</span>
                    <span className="s-num text-on-surface-variant">{pct}% {t.accuracy}</span>
                  </div>
                  <ProgressBar value={pct} label={`${typeLabel(type)} — ${pct}%`} size="sm" tone={pct >= 70 ? 'success' : 'primary'} />
                </div>
              ))}
            </Card>
          </section>
        )}

        {/* ── Assignments ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-s-gap">
          <h2 className="s-display text-lg font-bold">{t.assignments}</h2>
          {myAssignments.length === 0 ? (
            <Card>
              <EmptyState icon="📝" title={t.emptyAssignments} description={t.emptyAssignmentsDesc} />
            </Card>
          ) : (
            <div className="flex flex-col gap-s-gap">
              {myAssignments.map(a => (
                <AssignmentCard
                  key={a.id}
                  a={a}
                  attempt={attemptByAssignment.get(a.id)}
                  groupId={groupId}
                  lang={lang}
                  t={t}
                />
              ))}
            </div>
          )}
        </section>

      </div>
    </Page>
  );
}
