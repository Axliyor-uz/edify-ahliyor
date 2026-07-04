'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTeacherLanguage } from '@/app/teacher/layout';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

import AddIeltsStudentModal from '../_components/AddIeltsStudentModal';
import IeltsPulseDashboard from './_components/IeltsPulseDashboard';
import IeltsUnifiedFeed from './_components/IeltsUnifiedFeed';
import IeltsRosterTab from './_components/IeltsRosterTab';
import IeltsRequestsTab from './_components/IeltsRequestsTab';

import {
  Users, Hash, ChevronLeft, Inbox,
  FileText, Loader2, Plus, Sparkles, UserPlus, Activity
} from 'lucide-react';

import { IeltsGroup } from '@/types/ielts';

// ─── Translations ─────────────────────────────────────────────────────────────
const T: Record<string, any> = {
  uz: {
    back: "Guruhlarga",
    loading: "Yuklanmoqda...",
    buttons: { add: "O'quvchi Qo'shish", assign: "Mock Berish" },
    tabs: { dashboard: "Pulse", assignments: "Topshiriqlar", students: "O'quvchilar", requests: "So'rovlar" },
  },
  en: {
    back: "Groups",
    loading: "Loading...",
    buttons: { add: "Add Student", assign: "Assign Mock" },
    tabs: { dashboard: "Pulse", assignments: "Assignments", students: "Students", requests: "Requests" },
  },
  ru: {
    back: "Группы",
    loading: "Загрузка...",
    buttons: { add: "Добавить ученика", assign: "Назначить тест" },
    tabs: { dashboard: "Пульс", assignments: "Задания", students: "Ученики", requests: "Запросы" },
  },
};

type IeltsTab = 'dashboard' | 'assignments' | 'students' | 'requests';

export default function IeltsGroupDetailsPage() {
  const { groupId } = useParams() as { groupId: string };
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const [group, setGroup]               = useState<IeltsGroup | null>(null);
  const [activeTab, setActiveTab]       = useState<IeltsTab>('dashboard');
  const [requestCount, setRequestCount] = useState(0);
  const [isAddOpen, setIsAddOpen]       = useState(false);
  const [isPlusOpen, setIsPlusOpen]     = useState(false);

  // Group document — live
  useEffect(() => {
    if (!groupId) return;
    const unsub = onSnapshot(doc(db, 'ielts_groups', groupId), (snap) => {
      if (snap.exists()) setGroup({ id: snap.id, ...snap.data() } as IeltsGroup);
      else router.push('/teacher/ielts/groups');
    });
    return () => unsub();
  }, [groupId, router]);

  // Request badge — live
  useEffect(() => {
    if (!groupId) return;
    const q = query(collection(db, 'ielts_groups', groupId, 'requests'));
    const unsub = onSnapshot(q, (snap) => setRequestCount(snap.size));
    return () => unsub();
  }, [groupId]);

  if (!group) {
    return (
      <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-rose-500" size={28} />
        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">{t.loading}</p>
      </div>
    );
  }

  const TABS: { id: IeltsTab; label: string; icon: any; badge: number }[] = [
    { id: 'dashboard',   label: t.tabs.dashboard,   icon: Activity, badge: 0 },
    { id: 'assignments', label: t.tabs.assignments, icon: FileText, badge: 0 },
    { id: 'students',    label: t.tabs.students,    icon: Users,    badge: 0 },
    { id: 'requests',    label: t.tabs.requests,    icon: Inbox,    badge: requestCount },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#F5F5F7] font-sans flex flex-col selection:bg-rose-100 selection:text-rose-900">

      {/* ── Modals ── */}
      <AddIeltsStudentModal groupId={groupId} isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />

      {/* ── Plus dropdown overlay ── */}
      <AnimatePresence>
        {isPlusOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsPlusOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="fixed top-[56px] right-4 md:right-8 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 w-52 p-1.5 flex flex-col gap-0.5 origin-top-right"
            >
              <button
                onClick={() => setIsPlusOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-rose-50 rounded-xl transition-colors text-slate-700 hover:text-rose-700 w-full text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Sparkles size={14} strokeWidth={2.5} />
                </div>
                <span className="font-bold text-[13px]">{t.buttons.assign}</span>
              </button>

              <div className="h-px bg-slate-100 mx-2" />

              <button
                onClick={() => { setIsAddOpen(true); setIsPlusOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-slate-700 w-full text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserPlus size={14} strokeWidth={2.5} />
                </div>
                <span className="font-bold text-[13px]">{t.buttons.add}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 px-4 md:px-6 h-14 flex items-center justify-between shrink-0 gap-3">

        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/teacher/ielts/groups"
            className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-all shrink-0"
          >
            <ChevronLeft size={17} strokeWidth={2.5} />
          </Link>

          <div className="hidden md:block w-px h-4 bg-slate-200 shrink-0" />

          <div className="flex flex-col min-w-0">
            <h1 className="text-[15px] md:text-[17px] font-black text-slate-900 tracking-tight truncate leading-tight">
              {group.title}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md tracking-wide">
                🎯 Band {Number(group.targetBand).toFixed(1)}
              </span>
              <span className="hidden sm:flex items-center gap-0.5 text-[10px] font-black text-slate-500 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded-md font-mono">
                <Hash size={9} className="text-rose-400" />{group.joinCode}
              </span>
            </div>
          </div>
        </div>

        {/* Right */}
        <button
          onClick={() => setIsPlusOpen(!isPlusOpen)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
            isPlusOpen ? 'bg-rose-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
          }`}
        >
          <Plus size={18} strokeWidth={2.5} className={`transition-transform duration-200 ${isPlusOpen ? 'rotate-45' : ''}`} />
        </button>
      </header>

      {/* ── Tab bar ── */}
      <div className="bg-white border-b border-slate-200/80 px-4 md:px-6 shrink-0">
        <div className="flex gap-0 overflow-x-auto custom-scrollbar">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-3.5 text-[13px] font-bold transition-colors ${
                  isActive ? 'text-rose-600' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <tab.icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="w-4 h-4 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="ielts-tab-line"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-rose-600 rounded-t-full"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-6 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'dashboard' && <IeltsPulseDashboard group={group} />}
            {activeTab === 'assignments' && <IeltsUnifiedFeed group={group} />}
            {activeTab === 'students' && <IeltsRosterTab groupId={groupId} studentIds={group.studentIds} />}
            {activeTab === 'requests' && <IeltsRequestsTab groupId={groupId} />}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}