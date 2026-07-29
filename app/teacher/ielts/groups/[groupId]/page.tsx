'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTeacherLanguage } from '@/app/teacher/layout';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

import AddIeltsStudentModal from '../_components/AddIeltsStudentModal';
import AssignTestModal from './_components/AssignTestModal';
import IeltsPulseDashboard from './_components/IeltsPulseDashboard';
import IeltsUnifiedFeed from './_components/IeltsUnifiedFeed';
import IeltsRosterTab from './_components/IeltsRosterTab';
import IeltsRequestsTab from './_components/IeltsRequestsTab';
import IeltsReviewsTab from './_components/IeltsReviewsTab';
import { GroupAttempt } from './_components/groupData';
import { fetchGroupAttempts } from '@/services/ieltsService';

import {
  Users, Hash, ChevronLeft, Inbox,
  FileText, Plus, Sparkles, UserPlus, Activity, ClipboardCheck
} from 'lucide-react';

import { IeltsGroup } from '@/types/ielts';
import { IconButton, Spinner, Badge } from '@/components/ui';

// ─── Translations ─────────────────────────────────────────────────────────────
const T: Record<string, any> = {
  uz: {
    back: "Guruhlarga",
    loading: "Yuklanmoqda...",
    buttons: { add: "O'quvchi Qo'shish", assign: "Mock Berish" },
    tabs: { dashboard: "Pulse", assignments: "Topshiriqlar", students: "O'quvchilar", requests: "So'rovlar", reviews: "Tekshirish" },
  },
  en: {
    back: "Groups",
    loading: "Loading...",
    buttons: { add: "Add Student", assign: "Assign Mock" },
    tabs: { dashboard: "Pulse", assignments: "Assignments", students: "Students", requests: "Requests", reviews: "Reviews" },
  },
  ru: {
    back: "Группы",
    loading: "Загрузка...",
    buttons: { add: "Добавить ученика", assign: "Назначить тест" },
    tabs: { dashboard: "Пульс", assignments: "Задания", students: "Ученики", requests: "Запросы", reviews: "Проверка" },
  },
};

type IeltsTab = 'dashboard' | 'assignments' | 'students' | 'requests' | 'reviews';

export default function IeltsGroupDetailsPage() {
  const { groupId } = useParams() as { groupId: string };
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const [group, setGroup]               = useState<IeltsGroup | null>(null);
  const [activeTab, setActiveTab]       = useState<IeltsTab>('dashboard');
  const [requestCount, setRequestCount] = useState(0);
  const [isAddOpen, setIsAddOpen]       = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isPlusOpen, setIsPlusOpen]     = useState(false);

  // Group attempts — one-shot fetch shared by all tabs, refreshed on tab change
  const [attempts, setAttempts]             = useState<GroupAttempt[]>([]);
  const [attemptsLoaded, setAttemptsLoaded] = useState(false);
  // Bumped after creating an assignment so the Assignments tab refetches
  const [feedRefresh, setFeedRefresh]       = useState(0);

  const loadAttempts = useCallback(async () => {
    try {
      const list = await fetchGroupAttempts(groupId);
      setAttempts(list as GroupAttempt[]);
    } catch (e) {
      console.error(e);
    } finally {
      setAttemptsLoaded(true);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    loadAttempts();
  }, [groupId, activeTab, loadAttempts]);

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
      <div className="min-h-[100dvh] bg-surface flex flex-col items-center justify-center gap-3">
        <Spinner size={28} />
        <p className="text-[12px] font-bold text-on-surface-variant uppercase tracking-widest">{t.loading}</p>
      </div>
    );
  }

  const pendingReviews = attempts.filter(a => a.reviewStatus === 'pending_review').length;

  const TABS: { id: IeltsTab; label: string; icon: any; badge: number }[] = [
    { id: 'dashboard',   label: t.tabs.dashboard,   icon: Activity,       badge: 0 },
    { id: 'assignments', label: t.tabs.assignments, icon: FileText,       badge: 0 },
    { id: 'reviews',     label: t.tabs.reviews,     icon: ClipboardCheck, badge: pendingReviews },
    { id: 'students',    label: t.tabs.students,    icon: Users,          badge: 0 },
    { id: 'requests',    label: t.tabs.requests,    icon: Inbox,          badge: requestCount },
  ];

  return (
    <div className="min-h-[100dvh] bg-surface font-t-body flex flex-col selection:bg-primary-container selection:text-on-primary-container">

      {/* ── Modals ── */}
      <AddIeltsStudentModal groupId={groupId} isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      <AssignTestModal
        groupId={groupId}
        group={group}
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        onCreated={() => { setFeedRefresh(n => n + 1); setActiveTab('assignments'); }}
      />

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
              className="fixed top-[56px] right-4 md:right-8 z-50 bg-surface-container-lowest rounded-m3-lg shadow-elev-3 border border-outline-variant w-52 p-1.5 flex flex-col gap-0.5 origin-top-right"
            >
              <button
                onClick={() => { setIsAssignOpen(true); setIsPlusOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-state-hover rounded-m3-md transition-colors text-on-surface w-full text-left group"
              >
                <div className="w-7 h-7 rounded-m3-sm bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                  <Sparkles size={14} strokeWidth={2.5} />
                </div>
                <span className="font-bold text-[13px]">{t.buttons.assign}</span>
              </button>

              <div className="h-px bg-outline-variant mx-2" />

              <button
                onClick={() => { setIsAddOpen(true); setIsPlusOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-state-hover rounded-m3-md transition-colors text-on-surface w-full text-left group"
              >
                <div className="w-7 h-7 rounded-m3-sm bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                  <UserPlus size={14} strokeWidth={2.5} />
                </div>
                <span className="font-bold text-[13px]">{t.buttons.add}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-[color-mix(in_oklab,var(--m3-surface)_85%,transparent)] backdrop-blur-xl border-b border-outline-variant px-4 md:px-6 h-14 flex items-center justify-between shrink-0 gap-3">

        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/teacher/ielts/groups"
            className="m3-interactive w-8 h-8 rounded-m3-md bg-surface-container border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest transition-all shrink-0"
          >
            <ChevronLeft size={17} strokeWidth={2.5} />
          </Link>

          <div className="hidden md:block w-px h-4 bg-outline-variant shrink-0" />

          <div className="flex flex-col min-w-0">
            <h1 className="text-[15px] md:text-[17px] font-black text-on-surface tracking-tight truncate leading-tight">
              {group.title}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-black text-on-tertiary-container bg-tertiary-container border border-transparent px-1.5 py-0.5 rounded-m3-xs tracking-wide">
                🎯 Band {Number(group.targetBand).toFixed(1)}
              </span>
              <span className="hidden sm:flex items-center gap-0.5 text-[10px] font-black text-on-surface-variant bg-surface-container-high border border-outline-variant px-1.5 py-0.5 rounded-m3-xs font-mono">
                <Hash size={9} className="text-primary" />{group.joinCode}
              </span>
            </div>
          </div>
        </div>

        {/* Right */}
        <IconButton
          variant="filled"
          onClick={() => setIsPlusOpen(!isPlusOpen)}
          aria-label="Menyu"
          className="shrink-0"
        >
          <Plus strokeWidth={2.5} className={`transition-transform duration-200 ${isPlusOpen ? 'rotate-45' : ''}`} />
        </IconButton>
      </header>

      {/* ── Tab bar ── */}
      <div className="bg-surface-container-low border-b border-outline-variant px-4 md:px-6 shrink-0">
        <div className="flex gap-0 overflow-x-auto custom-scrollbar">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-3.5 text-[13px] font-bold transition-colors ${
                  isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <tab.icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <Badge className="h-4 min-w-[16px] px-1 text-[9px]">
                    {tab.badge}
                  </Badge>
                )}
                {isActive && (
                  <motion.div
                    layoutId="ielts-tab-line"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-t-full"
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
            {activeTab === 'dashboard' && (
              <IeltsPulseDashboard
                group={group}
                attempts={attempts}
                loaded={attemptsLoaded}
                onOpenReviews={() => setActiveTab('reviews')}
              />
            )}
            {activeTab === 'assignments' && (
              <IeltsUnifiedFeed
                groupId={groupId}
                group={group}
                attempts={attempts}
                refreshKey={feedRefresh}
                onAssign={() => setIsAssignOpen(true)}
              />
            )}
            {activeTab === 'reviews' && (
              <IeltsReviewsTab
                attempts={attempts}
                loaded={attemptsLoaded}
                onGraded={(attemptId, band, comments) =>
                  setAttempts(prev => prev.map(a => a.id === attemptId
                    ? { ...a, reviewStatus: 'graded' as const, teacherGrade: { band, comments, gradedAt: new Date() } }
                    : a))
                }
              />
            )}
            {activeTab === 'students' && (
              <IeltsRosterTab groupId={groupId} studentIds={group.studentIds} attempts={attempts} />
            )}
            {activeTab === 'requests' && <IeltsRequestsTab groupId={groupId} />}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
