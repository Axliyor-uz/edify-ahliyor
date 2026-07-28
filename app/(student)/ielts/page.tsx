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
  Users, ChevronRight, Hash, Clock, ListChecks, Play,
} from 'lucide-react';
import { IeltsGroup } from '@/types/ielts';
import {
  Page, PageHeader, Card, Tile, Chip, Button, Banner, FilterChip,
  EmptyState, LoadingState,
} from '@/components/student-ui';
import { useStudentLanguage } from '../layout';
import { fetchPlatformTests, fetchMyAttempts } from '@/services/ieltsService';
import { typeBreakdown } from '@/lib/ielts/testSchema';
import type { IeltsListeningTest, IeltsReadingTest, IeltsSkill } from '@/lib/ielts/types';
import { typeLabel } from './_components/typeLabels';

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
type PlatformTestDoc = { id: string } & Record<string, unknown>;
type AttemptDoc = { id: string } & Record<string, unknown>;
const CACHE_TTL = 60_000;
const platformTestsCache: Record<string, { at: number; data: PlatformTestDoc[] }> = {};
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

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-outline-variant px-s-card py-4">
          <div className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-widest text-on-surface-variant">
            <Users size={14} strokeWidth={3} />
            {group.studentIds?.length ?? 0} {t.students}
          </div>
          <div className="flex items-center gap-1 font-mono text-[12px] font-black text-on-surface-variant">
            <Hash size={12} className="text-outline" />
            {group.joinCode}
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
  test: PlatformTestDoc; skill: IeltsSkill; bestBand: number | null; t: any;
}) {
  const title = String(test.test_title || test.id);
  const totalQuestions = Number(test.total_questions || 0);
  const minutes = Number(test.total_time_minutes || 0);

  // Question-type mix — only computable for reading/listening (full docs are fetched).
  let mixChips: { label: string; n: number }[] = [];
  if (skill === 'reading' || skill === 'listening') {
    const breakdown = typeBreakdown(test as unknown as IeltsReadingTest | IeltsListeningTest);
    mixChips = Object.entries(breakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, n]) => ({ label: typeLabel(type), n }));
  }

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

  // Practice library state
  const [skill, setSkill] = useState<IeltsSkill>('reading');
  const [tests, setTests] = useState<PlatformTestDoc[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptDoc[]>([]);

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
        setLoading(false);
      },
      () => setLoading(false)
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
    fetchPlatformTests(skill)
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

  // testId → best band across my attempts (server band or teacher grade for W/S).
  const bestBandByTest: Record<string, number> = {};
  for (const a of attempts) {
    const band = typeof a.bandScore === 'number'
      ? a.bandScore
      : typeof (a.teacherGrade as { band?: number } | undefined)?.band === 'number'
        ? (a.teacherGrade as { band: number }).band
        : null;
    const testId = String(a.testId || '');
    if (band == null || !testId) continue;
    if (bestBandByTest[testId] == null || band > bestBandByTest[testId]) bestBandByTest[testId] = band;
  }

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

        {/* ── My groups ───────────────────────────────────────────────────── */}
        {hasGroups ? (
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

          {/* Skill filter chips */}
          <div className="flex flex-wrap gap-2">
            {SKILLS.map(({ icon: Icon, key }) => (
              <FilterChip
                key={key}
                selected={skill === key}
                onClick={() => setSkill(key)}
                icon={<Icon size={15} strokeWidth={2.5} />}
              >
                {t.skills[key]}
              </FilterChip>
            ))}
          </div>

          {testsLoading ? (
            <LoadingState rows={3} />
          ) : tests.length === 0 ? (
            <Card>
              <EmptyState
                icon="📚"
                title={t.practice.emptyTitle}
                description={t.practice.emptyDesc}
              />
            </Card>
          ) : (
            <div className="grid gap-s-gap sm:grid-cols-2">
              {tests.map(test => (
                <PracticeTestCard
                  key={test.id}
                  test={test}
                  skill={skill}
                  bestBand={bestBandByTest[test.id] ?? bestBandByTest[String(test.test_id || '')] ?? null}
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
