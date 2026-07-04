'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { Users, Plus, Target, Hash, ChevronLeft, BookOpen, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { IeltsGroup } from '@/types/ielts';
import CreateIeltsGroupModal from './_components/CreateIeltsGroupModal';

function bandPill(band: number) {
  if (band >= 8)   return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (band >= 6.5) return 'bg-amber-50   border-amber-200   text-amber-700';
  return                  'bg-rose-50    border-rose-200    text-rose-700';
}

const T: any = {
  uz: {
    heading: "IELTS Guruhlar",
    sub: "Mock imtihonlar, band maqsadlari, o'quvchilar",
    newBtn: "Yangi Guruh",
    back: "IELTS",
    oquvchi: "o'quvchi",
    total: "guruh",
    empty: {
      title: "Guruh yo'q",
      desc: "Birinchi IELTS guruhingizni yarating.",
      btn: "Guruh Yaratish",
    },
  },
  en: {
    heading: "IELTS Groups",
    sub: "Mock exams, band targets, student rosters",
    newBtn: "New Group",
    back: "IELTS",
    oquvchi: "students",
    total: "groups",
    empty: {
      title: "No groups yet",
      desc: "Create your first IELTS group to get started.",
      btn: "Create Group",
    },
  },
  ru: {
    heading: "Группы IELTS",
    sub: "Симуляции, цели и списки учеников",
    newBtn: "Новая Группа",
    back: "IELTS",
    oquvchi: "учеников",
    total: "групп",
    empty: {
      title: "Нет групп",
      desc: "Создайте первую группу IELTS.",
      btn: "Создать Группу",
    },
  },
};

export default function IeltsGroupsPage() {
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const [groups, setGroups]         = useState<IeltsGroup[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'ielts_groups'),
      where('teacherId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as IeltsGroup)));
      setIsLoading(false);
    });
  }, [user]);

  return (
    <div className="min-h-[100dvh] bg-[#F5F5F7] font-sans pb-28">
      <CreateIeltsGroupModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* ── Premium top bar ── */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header Row */}
          <div className="flex items-center justify-between gap-4 py-4 md:py-5">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              {/* Back Button */}
              <Link
                href="/teacher/ielts"
                className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm transition-all shrink-0"
              >
                <ChevronLeft size={18} strokeWidth={2.5} />
              </Link>
              
              <div className="w-px h-6 bg-slate-200 hidden sm:block shrink-0" />
              
              {/* Icon & Title */}
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-rose-600/20">
                <Target size={20} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <h1 className="text-[17px] md:text-[20px] font-black text-slate-900 tracking-tight leading-tight truncate">
                  {t.heading}
                </h1>
                <p className="text-[12px] font-medium text-slate-400 hidden sm:block truncate">{t.sub}</p>
              </div>
            </div>

            {/* Create Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 md:px-5 py-2.5 md:py-3 rounded-xl font-black text-[13px] transition-all active:scale-95 shadow-sm shadow-rose-600/20 shrink-0"
            >
              <Plus size={16} strokeWidth={3} />
              <span className="hidden sm:inline">{t.newBtn}</span>
            </button>
          </div>

          {/* Stats bar */}
          {!isLoading && groups.length > 0 && (
            <div className="flex items-center gap-4 pb-4 md:pl-[124px]">
              <div className="flex items-center gap-1.5 bg-rose-50/50 px-2.5 py-1 rounded-lg border border-rose-100/50">
                <Sparkles size={13} className="text-rose-500" strokeWidth={2.5} />
                <span className="text-[12px] font-black text-rose-700">{groups.length}</span>
                <span className="text-[12px] font-bold text-rose-600/80">{t.total}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                <Users size={13} className="text-slate-500" strokeWidth={2.5} />
                <span className="text-[12px] font-black text-slate-700">
                  {groups.reduce((acc, g) => acc + (g.studentIds?.length ?? 0), 0)}
                </span>
                <span className="text-[12px] font-bold text-slate-500">{t.oquvchi}</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-slate-200/60 rounded-2xl animate-pulse" />
            ))}
          </div>

        ) : groups.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((grp, i) => (
              <motion.div
                key={grp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
              >
                <Link
                  href={`/teacher/ielts/groups/${grp.id}`}
                  className="group flex flex-col bg-white rounded-2xl border border-slate-200/80 hover:border-rose-300 hover:shadow-md transition-all duration-200 overflow-hidden h-full"
                >
                  {/* ── Card body with SVG Pattern ── */}
                  <div className="relative px-5 pt-5 pb-5 flex-1 flex flex-col gap-2 z-10 bg-white">
                    
                    {/* Decorative SVG Mesh Background */}
                    <svg className="absolute inset-0 w-full h-full text-slate-200/40 z-0 pointer-events-none" fill="currentColor">
                      <pattern id={`dots-${grp.id}`} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1.5" />
                      </pattern>
                      <rect x="0" y="0" width="100%" height="100%" fill={`url(#dots-${grp.id})`} />
                    </svg>

                    <div className="relative z-10 flex-1 flex flex-col gap-2">
                      {/* Title — hero element */}
                      <h3 className="text-[17px] font-black text-slate-900 leading-snug tracking-tight group-hover:text-rose-600 transition-colors line-clamp-2 drop-shadow-sm">
                        {grp.title}
                      </h3>

                      {/* Description */}
                      {grp.description ? (
                        <p className="text-[12px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
                          {grp.description}
                        </p>
                      ) : (
                        <div className="h-px" />
                      )}
                    </div>
                  </div>

                  {/* ── Footer: band + code + students ── */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 group-hover:bg-rose-50/30 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Band badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black shrink-0 ${bandPill(Number(grp.targetBand))}`}>
                        <Target size={10} strokeWidth={3} />
                        Band {Number(grp.targetBand).toFixed(1)}
                      </span>
                      {/* Code */}
                      <span className="inline-flex items-center gap-0.5 font-mono text-[11px] font-black text-slate-500 bg-white border border-slate-200/60 px-1.5 py-0.5 rounded-md shrink-0">
                        <Hash size={10} className="text-rose-400" />{grp.joinCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1 text-[12px] font-bold text-slate-400">
                        <Users size={12} strokeWidth={2.5} />{grp.studentIds?.length ?? 0}
                      </span>
                      <span className="text-[13px] font-black text-rose-400 group-hover:translate-x-0.5 transition-transform">→</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

        ) : (
          <div className="flex flex-col items-center justify-center text-center py-28 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center rotate-6 hover:rotate-0 transition-transform">
              <BookOpen size={26} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-[16px] font-black text-slate-800 tracking-tight mb-1">{t.empty.title}</h3>
              <p className="text-[13px] font-medium text-slate-400 max-w-xs leading-relaxed">{t.empty.desc}</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-black rounded-xl active:scale-95 transition-all shadow-sm"
            >
              <Plus size={15} strokeWidth={3} /> {t.empty.btn}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}