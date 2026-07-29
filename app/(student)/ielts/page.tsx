// app/(student)/ielts/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  Plus, Target,
  BookOpen, Mic, PenLine, Headphones,
  Users, ChevronRight, Clock, ListChecks, Play, TrendingUp, X,
} from 'lucide-react';
import { IeltsGroup } from '@/lib/ielts/types';
import {
  Page, PageHeader, Card, Tile, Chip, Button, Banner, FilterChip,
  EmptyState, ErrorState, LoadingState, Sparkline,
} from '@/components/student-ui';
import { overallBand } from '@/lib/ielts/bands';
import { useStudentLanguage } from '../layout';
import { fetchPlatformTestSummaries, fetchMyAttempts, type PlatformTestSummary } from '@/services/ieltsService';
import type { IeltsSkill } from '@/lib/ielts/types';
import { typeLabel } from '@/lib/ielts/typeLabels';

// Extracted per architecture doc (Section 3-B)
import JoinIeltsModal from './_components/JoinIeltsModal';

// --- TRANSLATIONS ---
const IELTS_TRANSLATIONS: any = {
  uz: {
    title: "IELTS Hub",
    join: "Guruhga Qo'shilish",
    subtitleMember: (n: number) => `${n} ta guruhga a'zosiz`,
    subtitleEmpty: "Guruhga qo'shiling yoki mustaqil mashq qiling.",
    myGroups: "Mening guruhlarim",
    students: "O'quvchi",
    tip: { before: "Yangi guruhga qo'shilish uchun", link: "bu yerni bosing", middle: "va yangi", after: "kodini kiriting." },
    emptyTitle: "Hali hech qanday guruh yo'q",
    emptyDesc: "O'qituvchingizdan I-XXXX formatidagi IELTS guruh kodini oling va quyidagi tugmani bosing.",
    practice: {
      title: "Amaliyot kutubxonasi",
      subtitle: "Istalgan testni istalgan payt yeching — urinishlar cheklanmagan.",
      practiceBtn: "Mashq qilish",
      questions: "savol",
      minutes: "daqiqa",
      writingInfo: "2 ta vazifa",
      speakingInfo: "3 qism",
      bestBand: "Eng yaxshi",
      emptyTitle: "Bu bo'limda hozircha test yo'q",
      emptyDesc: "Tez orada yangi testlar qo'shiladi — keyinroq qaytib ko'ring.",
      loadError: "Testlarni yuklab bo'lmadi",
      typeFilterClear: "Filtrni olib tashlash",
    },
    journey: {
      title: "Mening IELTS yo'lim",
      overall: "Taxminiy umumiy band",
      latest: "Oxirgi",
      best: "Eng yaxshi",
    },
    groupsError: {
      title: "Guruhlarni yuklab bo'lmadi",
      desc: "Internet aloqasini tekshirib, qayta urinib ko'ring.",
      retry: "Qayta urinish",
    },
    skills: { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" },
  },
  en: {
    title: "IELTS Hub",
    join: "Join a Group",
    subtitleMember: (n: number) => `You are a member of ${n} ${n === 1 ? 'group' : 'groups'}`,
    subtitleEmpty: "Join a group or practice on your own.",
    myGroups: "My groups",
    students: "Students",
    tip: { before: "To join a new group,", link: "click here", middle: "and enter a new", after: "code." },
    emptyTitle: "No groups yet",
    emptyDesc: "Get the I-XXXX IELTS group code from your teacher and press the button below.",
    practice: {
      title: "Practice Library",
      subtitle: "Take any test anytime — unlimited retakes.",
      practiceBtn: "Practice",
      questions: "questions",
      minutes: "min",
      writingInfo: "2 tasks",
      speakingInfo: "3 parts",
      bestBand: "Best",
      emptyTitle: "No tests in this section yet",
      emptyDesc: "New tests are coming soon — check back later.",
      loadError: "Could not load tests",
      typeFilterClear: "Clear filter",
    },
    journey: {
      title: "My IELTS journey",
      overall: "Estimated overall band",
      latest: "Latest",
      best: "Best",
    },
    groupsError: {
      title: "Could not load your groups",
      desc: "Check your connection and try again.",
      retry: "Try again",
    },
    skills: { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" },
  },
  ru: {
    title: "IELTS Hub",
    join: "Вступить в группу",
    subtitleMember: (n: number) => `Вы состоите в ${n} ${n === 1 ? 'группе' : 'группах'}`,
    subtitleEmpty: "Вступите в группу или тренируйтесь самостоятельно.",
    myGroups: "Мои группы",
    students: "Учеников",
    tip: { before: "Чтобы вступить в новую группу,", link: "нажмите здесь", middle: "и введите новый код", after: "" },
    emptyTitle: "Пока нет ни одной группы",
    emptyDesc: "Получите у учителя код IELTS группы в формате I-XXXX и нажмите кнопку ниже.",
    practice: {
      title: "Библиотека практики",
      subtitle: "Решайте любой тест в любое время — попытки не ограничены.",
      practiceBtn: "Практика",
      questions: "вопросов",
      minutes: "мин",
      writingInfo: "2 задания",
      speakingInfo: "3 части",
      bestBand: "Лучший",
      emptyTitle: "В этом разделе пока нет тестов",
      emptyDesc: "Новые тесты скоро появятся — загляните позже.",
      loadError: "Не удалось загрузить тесты",
      typeFilterClear: "Сбросить фильтр",
    },
    journey: {
      title: "Мой путь IELTS",
      overall: "Примерный общий балл",
      latest: "Последний",
      best: "Лучший",
    },
    groupsError: {
      title: "Не удалось загрузить группы",
      desc: "Проверьте соединение и попробуйте ещё раз.",
      retry: "Повторить",
    },
    skills: { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" },
  },
};

// ─── Static data ──────────────────────────────────────────────────────────────
const SKILLS: { icon: typeof Headphones; key: IeltsSkill }[] = [
  { icon: BookOpen,   key: 'reading' },
  { icon: Headphones, key: 'listening' },
  { icon: PenLine,    key: 'writing' },
  { icon: Mic,        key: 'speaking' },
];

function bandBadgeStatus(band: number) {
  if (band >= 8)   return 'success' as const;
  if (band >= 6.5) return 'gold' as const;
  return                  'error' as const;
}

// ─── Module-level 60s caches (student-page convention) ───────────────────────
type AttemptDoc = { id: string } & Record<string, unknown>;
const CACHE_TTL = 60_000;
const platformTestsCache: Record<string, { at: number; data: PlatformTestSummary[] }> = {};
const myAttemptsCache: Record<string, { at: number; data: AttemptDoc[] }> = {};

// ─── Group card ───────────────────────────────────────────────────────────────
function GroupCard({ group, t }: { group: IeltsGroup; t: any }) {
  const band = Number(group.targetBand);
  return (
    <Link href={`/ielts/${group.id}`} className="block">
      <Card interactive flush className="group flex h-full flex-col overflow-hidden">

        {/* Body */}
        <div className="flex flex-col gap-4 p-s-card">
          {/* Band badge + arrow */}
          <div className="flex items-start justify-between gap-2">
            <Chip status={bandBadgeStatus(band)} size="md">
              🎯 Band {band.toFixed(1)}
            </Chip>
            <Tile tone="neutral" size="sm" className="group-hover:bg-primary group-hover:text-on-primary">
              <ChevronRight size={18} strokeWidth={3} />
            </Tile>
          </div>

          {/* Title + description */}
          <div>
            <h3 className="s-display text-xl font-bold leading-tight line-clamp-2">
              {group.title}
            </h3>
            {group.description && (
              <p className="mt-1 line-clamp-2 text-[13px] font-bold leading-snug text-on-surface-variant">
                {group.description}
              </p>
            )}
          </div>
        </div>

        {/* Footer — deliberately NO joinCode: members must not be able to re-share the
            group's code and bypass the teacher's request/approve flow. */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-outline-variant px-s-card py-4">
          <div className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-widest text-on-surface-variant">
            <Users size={14} strokeWidth={3} />
            {group.studentIds?.length ?? 0} {t.students}
          </div>
        </div>

      </Card>
    </Link>
  );
}

// ─── Practice test card ───────────────────────────────────────────────────────
function PracticeTestCard({
  test, skill, bestBand, t,
}: {
  test: PlatformTestSummary; skill: IeltsSkill; bestBand: number | null; t: any;
}) {
  const title = test.test_title || test.id;
  const totalQuestions = test.total_questions;
  const minutes = test.total_time_minutes;

  // Question-type mix (reading/listening) — precomputed in ielts_test_meta.
  const mixChips = Object.entries(test.typeBreakdown || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, n]) => ({ label: typeLabel(type), n }));

  const info = skill === 'writing'
    ? t.practice.writingInfo
    : skill === 'speaking'
      ? t.practice.speakingInfo
      : `${totalQuestions} ${t.practice.questions}`;

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="s-display min-w-0 text-[16px] font-bold leading-tight line-clamp-2">{title}</h3>
        {bestBand != null && (
          <Chip status="gold" size="sm">{t.practice.bestBand} {bestBand.toFixed(1)}</Chip>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] font-bold text-on-surface-variant">
        <span className="inline-flex items-center gap-1">
          <ListChecks size={14} strokeWidth={2.5} /> {info}
        </span>
        {minutes > 0 && (
          <span className="s-num inline-flex items-center gap-1">
            <Clock size={14} strokeWidth={2.5} /> {minutes} {t.practice.minutes}
          </span>
        )}
      </div>

      {mixChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mixChips.map(({ label, n }) => (
            <Chip key={label} status="neutral" size="sm">{n} × {label}</Chip>
          ))}
        </div>
      )}

      <div className="mt-auto pt-1">
        <Link href={`/ielts/practice/${skill}/${test.id}`} className="block">
          <Button fullWidth variant="tonal" icon={<Play size={16} strokeWidth={3} />}>
            {t.practice.practiceBtn}
          </Button>
        </Link>
      </div>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function StudentIeltsHubPage() {
  const { user } = useAuth();
  const { lang } = useStudentLanguage();
  const t = IELTS_TRANSLATIONS[lang] || IELTS_TRANSLATIONS.uz;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groups, setGroups]   = useState<IeltsGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupsError, setGroupsError] = useState(false);

  // Practice library state
  const [skill, setSkill] = useState<IeltsSkill>('reading');
  const [tests, setTests] = useState<PlatformTestSummary[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptDoc[]>([]);
  // Deep-link from the group page's weak-types card: /ielts?skill=reading&type=matching_headings
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('skill');
    if (s === 'reading' || s === 'listening' || s === 'writing' || s === 'speaking') setSkill(s);
    const type = params.get('type');
    if (type && (s === 'reading' || s === 'listening')) setTypeFilter(type);
  }, []);

  /**
   * Architecture doc §3-A / §4:
   * Strictly query ielts_groups filtered by studentIds array-contains.
   * onSnapshot gives real-time approval feedback (no refresh needed).
   */
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'ielts_groups'),
      where('studentIds', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as IeltsGroup)));
        setGroupsError(false);
        setLoading(false);
      },
      () => {
        // A real failure must not masquerade as "no groups yet".
        setGroupsError(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  // Platform tests — lazy per selected skill, 60s module cache.
  useEffect(() => {
    let alive = true;
    const cached = platformTestsCache[skill];
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setTests(cached.data);
      setTestsLoading(false);
      return;
    }
    setTestsLoading(true);
    fetchPlatformTestSummaries(skill)
      .then(data => {
        platformTestsCache[skill] = { at: Date.now(), data };
        if (alive) { setTests(data); setTestsLoading(false); }
      })
      .catch(() => { if (alive) { setTests([]); setTestsLoading(false); } });
    return () => { alive = false; };
  }, [skill]);

  // My attempts once (best-band chips on practice cards), 60s module cache.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const cached = myAttemptsCache[user.uid];
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setAttempts(cached.data);
      return;
    }
    fetchMyAttempts(user.uid)
      .then(data => {
        myAttemptsCache[user.uid] = { at: Date.now(), data };
        if (alive) setAttempts(data);
      })
      .catch(() => { /* best-band chips are optional decoration */ });
    return () => { alive = false; };
  }, [user]);

  // Band of an attempt: server grade (R/L) or teacher grade (W/S).
  const bandOf = (a: AttemptDoc): number | null => {
    if (typeof a.bandScore === 'number') return a.bandScore;
    const tg = (a.teacherGrade as { band?: number } | undefined)?.band;
    return typeof tg === 'number' ? tg : null;
  };

  // testId → best band across my attempts (server band or teacher grade for W/S).
  const bestBandByTest: Record<string, number> = {};
  for (const a of attempts) {
    const band = bandOf(a);
    const testId = String(a.testId || '');
    if (band == null || !testId) continue;
    if (bestBandByTest[testId] == null || band > bestBandByTest[testId]) bestBandByTest[testId] = band;
  }

  // "IELTS journey" — cross-group + practice trajectory. attempts arrive newest-first.
  const gradedAttempts = attempts.filter(a => bandOf(a) != null);
  const journeyBands = [...gradedAttempts].reverse().map(a => bandOf(a) as number).slice(-16);
  const journeySkills = SKILLS
    .map(({ key }) => {
      const list = gradedAttempts.filter(a => a.skill === key);
      if (!list.length) return null;
      return {
        key,
        latest: bandOf(list[0]) as number,
        best: Math.max(...list.map(a => bandOf(a) as number)),
      };
    })
    .filter((s): s is { key: IeltsSkill; latest: number; best: number } => s != null);
  const journeyOverall = journeySkills.length ? overallBand(journeySkills.map(s => s.latest)) : null;

  // Weak-type deep-link filter (reading/listening only).
  const visibleTests = typeFilter
    ? tests.filter(test => {
        if (skill !== 'reading' && skill !== 'listening') return true;
        return (test.typeBreakdown?.[typeFilter] || 0) > 0;
      })
    : tests;

  if (loading) {
    return (
      <Page>
        <LoadingState rows={4} />
      </Page>
    );
  }

  const hasGroups = groups.length > 0;

  const joinButton = (
    <Button icon={<Plus size={18} strokeWidth={3} />} onClick={() => setIsModalOpen(true)}>
      {t.join}
    </Button>
  );

  return (
    <Page>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title={t.title}
        subtitle={hasGroups ? t.subtitleMember(groups.length) : t.subtitleEmpty}
        actions={joinButton}
      />

      <div className="flex flex-col gap-s-section">

        {/* ── My IELTS journey (only once there is real data) ─────────────── */}
        {journeyBands.length >= 2 && (
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="s-display inline-flex items-center gap-2 text-lg font-bold">
                <TrendingUp size={20} strokeWidth={2.5} className="text-primary" />
                {t.journey.title}
              </h2>
              {journeyOverall != null && (
                <Chip status="gold" size="md">{t.journey.overall}: {journeyOverall.toFixed(1)}</Chip>
              )}
            </div>
            <Sparkline data={journeyBands} className="text-primary" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {journeySkills.map(s => (
                <div key={s.key} className="rounded-m3-md bg-surface-container px-3 py-2.5">
                  <div className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                    {t.skills[s.key]}
                  </div>
                  <div className="s-num mt-0.5 text-[15px] font-black">
                    {s.latest.toFixed(1)}
                    <span className="ml-1.5 text-[11.5px] font-bold text-on-surface-variant">
                      {t.journey.best} {s.best.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── My groups ───────────────────────────────────────────────────── */}
        {groupsError ? (
          <Card>
            <ErrorState
              title={t.groupsError.title}
              description={t.groupsError.desc}
              retryLabel={t.groupsError.retry}
              onRetry={() => window.location.reload()}
            />
          </Card>
        ) : hasGroups ? (
          <section className="flex flex-col gap-s-gap">
            <h2 className="s-display text-lg font-bold">{t.myGroups}</h2>
            <div className="grid gap-s-gap sm:grid-cols-2">
              {groups.map(g => (
                <GroupCard key={g.id} group={g} t={t} />
              ))}
            </div>
            <Banner
              status="gold"
              icon="💡"
              title={
                <span className="font-bold">
                  {t.tip.before}{' '}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="font-black underline underline-offset-2"
                  >
                    {t.tip.link}
                  </button>{' '}
                  {t.tip.middle} <span className="font-black">I-XXXX</span> {t.tip.after}
                </span>
              }
            />
          </section>
        ) : (
          <Card>
            <EmptyState
              icon={<Target size={30} strokeWidth={2.5} />}
              title={t.emptyTitle}
              description={t.emptyDesc}
              action={joinButton}
            />
          </Card>
        )}

        {/* ── Practice Library ────────────────────────────────────────────── */}
        <section className="flex flex-col gap-s-gap">
          <div>
            <h2 className="s-display text-lg font-bold">{t.practice.title}</h2>
            <p className="mt-0.5 text-[13px] font-bold text-on-surface-variant">{t.practice.subtitle}</p>
          </div>

          {/* Skill filter chips (+ active weak-type filter from the group page deep-link) */}
          <div className="flex flex-wrap gap-2">
            {SKILLS.map(({ icon: Icon, key }) => (
              <FilterChip
                key={key}
                selected={skill === key}
                onClick={() => { setSkill(key); setTypeFilter(null); }}
                icon={<Icon size={15} strokeWidth={2.5} />}
              >
                {t.skills[key]}
              </FilterChip>
            ))}
            {typeFilter && (
              <FilterChip
                selected
                onClick={() => setTypeFilter(null)}
                icon={<X size={15} strokeWidth={2.5} />}
              >
                {typeLabel(typeFilter)} — {t.practice.typeFilterClear}
              </FilterChip>
            )}
          </div>

          {testsLoading ? (
            <LoadingState rows={3} />
          ) : visibleTests.length === 0 ? (
            <Card>
              <EmptyState
                icon="📚"
                title={t.practice.emptyTitle}
                description={t.practice.emptyDesc}
              />
            </Card>
          ) : (
            <div className="grid gap-s-gap sm:grid-cols-2">
              {visibleTests.map(test => (
                <PracticeTestCard
                  key={test.id}
                  test={test}
                  skill={skill}
                  bestBand={bestBandByTest[test.id] ?? null}
                  t={t}
                />
              ))}
            </div>
          )}
        </section>

      </div>

      {/* ── Modal (Section 3-B) ── */}
      <JoinIeltsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} lang={lang} />
    </Page>
  );
}
