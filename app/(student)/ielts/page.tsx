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

// Extracted per architecture doc (Section 3-B)
import JoinIeltsModal from './_components/JoinIeltsModal';

// ─── Static data ──────────────────────────────────────────────────────────────
const SKILLS: { icon: typeof Headphones; label: string; desc: string; tone: TileProps['tone'] }[] = [
  { icon: Headphones, label: 'Listening', desc: '40 savoldan iborat, audio yozuvlarni tinglash', tone: 'secondary' },
  { icon: BookOpen,   label: 'Reading',   desc: "40 savoldan iborat, matnlarni o'qish va tahlil",  tone: 'success' },
  { icon: PenLine,    label: 'Writing',   desc: 'Grafikni tavsiflash va insho yozish',               tone: 'gold' },
  { icon: Mic,        label: 'Speaking',  desc: "Og'zaki intervyu, 3 qismdan iborat",                tone: 'primary' },
];

function bandBadgeStatus(band: number) {
  if (band >= 8)   return 'success' as const;
  if (band >= 6.5) return 'gold' as const;
  return                  'error' as const;
}

// ─── Group card ───────────────────────────────────────────────────────────────
function GroupCard({ group }: { group: IeltsGroup }) {
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
          {group.studentIds?.length ?? 0} O'quvchi
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
      Guruhga Qo'shilish
    </Button>
  );

  return (
    <Page>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="IELTS Hub"
        subtitle={
          hasGroups
            ? `${groups.length} ta guruhga a'zosiz`
            : "O'qituvchingizning IELTS guruhiga qo'shiling."
        }
        actions={joinButton}
      />

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {hasGroups ? (

        /* ── ENROLLED VIEW ── */
        <div className="flex flex-col gap-s-section">
          <div className="grid gap-s-gap sm:grid-cols-2">
            {groups.map(g => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>

          {/* Inline tip */}
          <Banner
            status="gold"
            icon="💡"
            title={
              <span className="font-bold">
                Yangi guruhga qo'shilish uchun{' '}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="font-black underline underline-offset-2"
                >
                  bu yerni bosing
                </button>{' '}
                va yangi <span className="font-black">I-XXXX</span> kodini kiriting.
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
              title="Hali hech qanday guruh yo'q"
              description="O'qituvchingizdan I-XXXX formatidagi IELTS guruh kodini oling va quyidagi tugmani bosing."
              action={joinButton}
            />
          </Card>

          {/* Skills info tiles */}
          <div className="grid grid-cols-1 gap-s-gap sm:grid-cols-2">
            {SKILLS.map(({ icon: Icon, label, desc, tone }) => (
              <Card key={label} interactive className="flex items-start gap-4">
                <Tile tone={tone}>
                  <Icon size={20} strokeWidth={2.5} />
                </Tile>
                <div className="min-w-0">
                  <p className="s-display text-[15px] font-bold">{label}</p>
                  <p className="mt-0.5 text-[13px] font-bold leading-snug text-on-surface-variant">{desc}</p>
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
                Guruh kodi <span className="font-black">I-</span> prefiksi bilan
                boshlanadi. Masalan:{' '}
                <span className="rounded-m3-sm bg-surface px-1.5 py-0.5 font-mono font-black text-on-surface">
                  I-X8K2
                </span>
              </span>
            }
          />
        </div>

      )}

      {/* ── Modal (Section 3-B) ── */}
      <JoinIeltsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </Page>
  );
}
