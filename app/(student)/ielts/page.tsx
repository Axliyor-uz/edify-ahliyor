// app/(student)/ielts/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  Plus, Target,
  BookOpen, Mic, PenLine, Headphones,
  Users, ChevronRight, Hash,
} from 'lucide-react';
import { IeltsGroup } from '@/types/ielts';
import {
  Page, PageHeader, Card, Tile, Chip, Button, Banner,
  EmptyState, LoadingState, type TileProps,
} from '@/components/student-ui';
import { useStudentLanguage } from '../layout';

// Extracted per architecture doc (Section 3-B)
import JoinIeltsModal from './_components/JoinIeltsModal';

// --- TRANSLATIONS ---
const IELTS_TRANSLATIONS: any = {
  uz: {
    title: "IELTS Hub",
    join: "Guruhga Qo'shilish",
    subtitleMember: (n: number) => `${n} ta guruhga a'zosiz`,
    subtitleEmpty: "O'qituvchingizning IELTS guruhiga qo'shiling.",
    students: "O'quvchi",
    tip: { before: "Yangi guruhga qo'shilish uchun", link: "bu yerni bosing", middle: "va yangi", after: "kodini kiriting." },
    emptyTitle: "Hali hech qanday guruh yo'q",
    emptyDesc: "O'qituvchingizdan I-XXXX formatidagi IELTS guruh kodini oling va quyidagi tugmani bosing.",
    codeTip: { before: "Guruh kodi", after: "prefiksi bilan boshlanadi. Masalan:" },
    skills: {
      listening: "40 savoldan iborat, audio yozuvlarni tinglash",
      reading: "40 savoldan iborat, matnlarni o'qish va tahlil",
      writing: "Grafikni tavsiflash va insho yozish",
      speaking: "Og'zaki intervyu, 3 qismdan iborat",
    },
  },
  en: {
    title: "IELTS Hub",
    join: "Join a Group",
    subtitleMember: (n: number) => `You are a member of ${n} ${n === 1 ? 'group' : 'groups'}`,
    subtitleEmpty: "Join your teacher's IELTS group.",
    students: "Students",
    tip: { before: "To join a new group,", link: "click here", middle: "and enter a new", after: "code." },
    emptyTitle: "No groups yet",
    emptyDesc: "Get the I-XXXX IELTS group code from your teacher and press the button below.",
    codeTip: { before: "The group code starts with the", after: "prefix. For example:" },
    skills: {
      listening: "40 questions, listening to audio recordings",
      reading: "40 questions, reading and analyzing texts",
      writing: "Describing a graph and writing an essay",
      speaking: "Oral interview in 3 parts",
    },
  },
  ru: {
    title: "IELTS Hub",
    join: "Вступить в группу",
    subtitleMember: (n: number) => `Вы состоите в ${n} ${n === 1 ? 'группе' : 'группах'}`,
    subtitleEmpty: "Присоединитесь к IELTS группе вашего учителя.",
    students: "Учеников",
    tip: { before: "Чтобы вступить в новую группу,", link: "нажмите здесь", middle: "и введите новый код", after: "" },
    emptyTitle: "Пока нет ни одной группы",
    emptyDesc: "Получите у учителя код IELTS группы в формате I-XXXX и нажмите кнопку ниже.",
    codeTip: { before: "Код группы начинается с префикса", after: "— например:" },
    skills: {
      listening: "40 вопросов, прослушивание аудиозаписей",
      reading: "40 вопросов, чтение и анализ текстов",
      writing: "Описание графика и написание эссе",
      speaking: "Устное интервью из 3 частей",
    },
  },
};

// ─── Static data ──────────────────────────────────────────────────────────────
const SKILLS: { icon: typeof Headphones; label: string; key: string; tone: TileProps['tone'] }[] = [
  { icon: Headphones, label: 'Listening', key: 'listening', tone: 'secondary' },
  { icon: BookOpen,   label: 'Reading',   key: 'reading',   tone: 'success' },
  { icon: PenLine,    label: 'Writing',   key: 'writing',   tone: 'gold' },
  { icon: Mic,        label: 'Speaking',  key: 'speaking',  tone: 'primary' },
];

function bandBadgeStatus(band: number) {
  if (band >= 8)   return 'success' as const;
  if (band >= 6.5) return 'gold' as const;
  return                  'error' as const;
}

// ─── Group card ───────────────────────────────────────────────────────────────
function GroupCard({ group, t }: { group: IeltsGroup; t: any }) {
  const band = Number(group.targetBand);
  return (
    <Card interactive flush className="group flex flex-col overflow-hidden">

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

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {hasGroups ? (

        /* ── ENROLLED VIEW ── */
        <div className="flex flex-col gap-s-section">
          <div className="grid gap-s-gap sm:grid-cols-2">
            {groups.map(g => (
              <GroupCard key={g.id} group={g} t={t} />
            ))}
          </div>

          {/* Inline tip */}
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
        </div>

      ) : (

        /* ── EMPTY VIEW ── */
        <div className="flex flex-col gap-s-section">
          {/* Prompt card */}
          <Card>
            <EmptyState
              icon={<Target size={30} strokeWidth={2.5} />}
              title={t.emptyTitle}
              description={t.emptyDesc}
              action={joinButton}
            />
          </Card>

          {/* Skills info tiles */}
          <div className="grid grid-cols-1 gap-s-gap sm:grid-cols-2">
            {SKILLS.map(({ icon: Icon, label, key, tone }) => (
              <Card key={label} interactive className="flex items-start gap-4">
                <Tile tone={tone}>
                  <Icon size={20} strokeWidth={2.5} />
                </Tile>
                <div className="min-w-0">
                  <p className="s-display text-[15px] font-bold">{label}</p>
                  <p className="mt-0.5 text-[13px] font-bold leading-snug text-on-surface-variant">{t.skills[key]}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Tip badge */}
          <Banner
            status="gold"
            icon="💡"
            title={
              <span className="font-bold">
                {t.codeTip.before} <span className="font-black">I-</span>{' '}
                {t.codeTip.after}{' '}
                <span className="rounded-m3-sm bg-surface px-1.5 py-0.5 font-mono font-black text-on-surface">
                  I-X8K2
                </span>
              </span>
            }
          />
        </div>

      )}

      {/* ── Modal (Section 3-B) ── */}
      <JoinIeltsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} lang={lang} />
    </Page>
  );
}
