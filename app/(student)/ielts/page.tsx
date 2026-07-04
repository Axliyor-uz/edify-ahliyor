// app/(student)/ielts/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  Sparkles, Plus, Target,
  BookOpen, Mic, PenLine, Headphones,
  Users, ChevronRight, Hash,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { IeltsGroup } from '@/types/ielts';

// Extracted per architecture doc (Section 3-B)
import JoinIeltsModal from './_components/JoinIeltsModal';

// ─── Static data ──────────────────────────────────────────────────────────────
const SKILLS = [
  { icon: Headphones, label: 'Listening', desc: '40 savoldan iborat, audio yozuvlarni tinglash', color: 'bg-blue-50 border-blue-200 text-blue-500' },
  { icon: BookOpen,   label: 'Reading',   desc: "40 savoldan iborat, matnlarni o'qish va tahlil",  color: 'bg-emerald-50 border-emerald-200 text-emerald-500' },
  { icon: PenLine,    label: 'Writing',   desc: 'Grafikni tavsiflash va insho yozish',               color: 'bg-amber-50 border-amber-200 text-amber-500' },
  { icon: Mic,        label: 'Speaking',  desc: "Og'zaki intervyu, 3 qismdan iborat",                color: 'bg-violet-50 border-violet-200 text-violet-500' },
];

function bandBadgeColor(band: number) {
  if (band >= 8)   return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (band >= 6.5) return 'bg-amber-50   border-amber-200   text-amber-700';
  return                  'bg-rose-50    border-rose-200    text-rose-700';
}

// ─── Group card ───────────────────────────────────────────────────────────────
function GroupCard({ group, index }: { group: IeltsGroup; index: number }) {
  const band = Number(group.targetBand);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
    >
      <div className="group bg-white rounded-[2rem] border-2 border-zinc-200 border-b-[6px] hover:border-violet-300 hover:border-b-violet-400 active:translate-y-[4px] active:border-b-2 transition-all flex flex-col overflow-hidden">

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          {/* Band badge + arrow */}
          <div className="flex items-start justify-between gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border-2 font-black text-[12px] ${bandBadgeColor(band)}`}>
              🎯 Band {band.toFixed(1)}
            </span>
            <div className="w-9 h-9 rounded-xl bg-zinc-50 border-2 border-zinc-200 text-zinc-400 flex items-center justify-center group-hover:bg-violet-500 group-hover:text-white group-hover:border-violet-500 transition-all shrink-0">
              <ChevronRight size={18} strokeWidth={3} />
            </div>
          </div>

          {/* Title + description */}
          <div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tight leading-tight group-hover:text-violet-700 transition-colors line-clamp-2">
              {group.title}
            </h3>
            {group.description && (
              <p className="text-[13px] font-bold text-zinc-500 mt-1 line-clamp-2 leading-snug">
                {group.description}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t-2 border-zinc-100 flex items-center justify-between group-hover:bg-violet-50/50 transition-colors mt-auto">
          <div className="flex items-center gap-1.5 text-[12px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-violet-600 transition-colors">
            <Users size={14} strokeWidth={3} />
            {group.studentIds?.length ?? 0} O'quvchi
          </div>
          <div className="flex items-center gap-1 text-[12px] font-black text-zinc-400 font-mono">
            <Hash size={12} className="text-zinc-300" />
            {group.joinCode}
          </div>
        </div>

      </div>
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-8">
      <div className="pt-8 pb-8 flex items-end justify-between gap-5 animate-pulse">
        <div className="space-y-3">
          <div className="h-10 w-48 bg-zinc-200 rounded-xl" />
          <div className="h-5 w-64 bg-zinc-200 rounded-lg" />
        </div>
        <div className="h-12 w-44 bg-zinc-200 rounded-2xl shrink-0" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4 animate-pulse">
        {[1, 2].map(i => (
          <div key={i} className="h-52 bg-zinc-200 rounded-[2rem] border-2 border-zinc-100" />
        ))}
      </div>
    </div>
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
      <div className="min-h-screen bg-zinc-100 font-sans pb-28 md:pb-12">
        <PageSkeleton />
      </div>
    );
  }

  const hasGroups = groups.length > 0;

  return (
    <div className="min-h-screen bg-zinc-100 font-sans pb-28 md:pb-12">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="pt-8 pb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-violet-50 border-2 border-violet-200 rounded-[1.2rem] text-violet-500 flex items-center justify-center">
                <Sparkles size={24} strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight">
                IELTS Hub
              </h1>
            </div>
            <p className="text-[15px] font-bold text-zinc-500 pl-1">
              {hasGroups
                ? `${groups.length} ta guruhga a'zosiz`
                : "O'qituvchingizning IELTS guruhiga qo'shiling."}
            </p>
          </div>

          {/* + Join button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-violet-500 text-white font-black text-[14px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all shrink-0 uppercase tracking-wider hover:bg-violet-600"
          >
            <Plus size={18} strokeWidth={3} />
            Guruhga Qo'shilish
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        {hasGroups ? (

          /* ── ENROLLED VIEW ── */
          <div className="flex flex-col gap-5">
            <div className="grid sm:grid-cols-2 gap-4">
              {groups.map((g, i) => (
                <GroupCard key={g.id} group={g} index={i} />
              ))}
            </div>

            {/* Inline tip */}
            <div className="flex items-center gap-3 bg-white border-2 border-zinc-200 rounded-2xl px-4 py-3.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center shrink-0 text-[14px]">
                💡
              </div>
              <p className="text-[13px] font-bold text-zinc-500 leading-snug">
                Yangi guruhga qo'shilish uchun{' '}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="font-black text-violet-600 underline decoration-violet-300 underline-offset-2 hover:text-violet-700 transition-colors"
                >
                  bu yerni bosing
                </button>{' '}
                va yangi <span className="font-black text-zinc-800">I-XXXX</span> kodini kiriting.
              </p>
            </div>
          </div>

        ) : (

          /* ── EMPTY VIEW ── */
          <div className="flex flex-col gap-5">
            {/* Prompt card */}
            <div className="bg-white border-2 border-dashed border-zinc-300 rounded-[2rem] p-8 md:p-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-zinc-100 border-2 border-zinc-200 rounded-[1.5rem] flex items-center justify-center text-zinc-400 mb-5 rotate-6 hover:rotate-0 transition-transform">
                <Target size={32} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-black text-zinc-900 tracking-tight mb-2">
                Hali hech qanday guruh yo'q
              </h2>
              <p className="text-[14px] font-bold text-zinc-500 max-w-sm leading-relaxed mb-6">
                O'qituvchingizdan{' '}
                <span className="font-black text-zinc-800">I-XXXX</span>{' '}
                formatidagi IELTS guruh kodini oling va quyidagi tugmani bosing.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-7 py-3.5 bg-violet-500 text-white font-black text-[14px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider hover:bg-violet-600"
              >
                <Plus size={18} strokeWidth={3} />
                Guruhga Qo'shilish
              </button>
            </div>

            {/* Skills info tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SKILLS.map(({ icon: Icon, label, desc, color }) => (
                <div
                  key={label}
                  className="bg-white border-2 border-zinc-200 border-b-[6px] rounded-[1.5rem] p-5 flex items-start gap-4 hover:-translate-y-0.5 transition-transform"
                >
                  <div className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center shrink-0 ${color}`}>
                    <Icon size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="font-black text-zinc-900 text-[15px] tracking-tight">{label}</p>
                    <p className="text-[13px] font-bold text-zinc-500 mt-0.5 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tip badge */}
            <div className="flex items-center gap-3 bg-white border-2 border-zinc-200 rounded-2xl px-4 py-3.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center shrink-0 text-[14px]">
                💡
              </div>
              <p className="text-[13px] font-bold text-zinc-500 leading-snug">
                Guruh kodi <span className="font-black text-zinc-800">I-</span> prefiksi bilan
                boshlanadi. Masalan:{' '}
                <span className="font-black text-zinc-800 bg-zinc-100 px-1.5 py-0.5 rounded-lg border border-zinc-200">
                  I-X8K2
                </span>
              </p>
            </div>
          </div>

        )}
      </div>

      {/* ── Modal (Section 3-B) ── */}
      <JoinIeltsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}