'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserMinus, Loader2, Award, UserCheck, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Spinner, EmptyState } from '@/components/ui';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { removeStudentFromGroup } from '@/services/ieltsService';
import { GroupAttempt, effectiveBand, submittedMillis } from './groupData';

const TRANSLATIONS: Record<string, any> = {
  uz: {
    unknown: "Noma'lum",
    deletedProfile: "O'chirilgan profil",
    confirmRemove: (name: string) => `${name}ni guruhdan chiqarasizmi?`,
    removed: (name: string) => `${name} chiqarildi`,
    error: "Xatolik yuz berdi",
    noStudents: "O'quvchilar yo'q",
    emptyPre: "Guruhga o'quvchilarni qo'shish uchun yuqoridagi ",
    emptyPost: " tugmasini bosing.",
    searchPlaceholder: "O'quvchini qidirish...",
    studentsCount: (n: number) => `${n} o'quvchi`,
    removeFromGroup: "Guruhdan chiqarish",
  },
  en: {
    unknown: "Unknown",
    deletedProfile: "Deleted profile",
    confirmRemove: (name: string) => `Remove ${name} from the group?`,
    removed: (name: string) => `${name} removed`,
    error: "An error occurred",
    noStudents: "No students",
    emptyPre: "To add students to the group, click the ",
    emptyPost: " button above.",
    searchPlaceholder: "Search students...",
    studentsCount: (n: number) => `${n} students`,
    removeFromGroup: "Remove from group",
  },
  ru: {
    unknown: "Неизвестно",
    deletedProfile: "Удалённый профиль",
    confirmRemove: (name: string) => `Удалить ${name} из группы?`,
    removed: (name: string) => `${name} удалён`,
    error: "Произошла ошибка",
    noStudents: "Нет учеников",
    emptyPre: "Чтобы добавить учеников в группу, нажмите кнопку ",
    emptyPost: " выше.",
    searchPlaceholder: "Поиск ученика...",
    studentsCount: (n: number) => `${n} учеников`,
    removeFromGroup: "Удалить из группы",
  },
};

function bandPill(band: number | null) {
  if (band == null)  return 'bg-surface-container-high text-on-surface-variant border-outline-variant';
  if (band >= 8)     return 'bg-success-container text-on-success-container';
  if (band >= 6.5)   return 'bg-warning-container text-on-warning-container';
  return                    'bg-error-container text-on-error-container';
}

/** Tiny inline band trend (last 5 attempts), band 4–9 normalized. */
function Sparkline({ bands }: { bands: number[] }) {
  if (bands.length < 2) return null;
  const w = 56, h = 18, pad = 2;
  const points = bands
    .map((b, i) => {
      const x = pad + (i * (w - 2 * pad)) / (bands.length - 1);
      const y = h - pad - ((Math.min(9, Math.max(4, b)) - 4) / 5) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-primary shrink-0" aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  groupId: string;
  studentIds: string[];
  attempts: GroupAttempt[];
}

export default function IeltsRosterTab({ groupId, studentIds, attempts }: Props) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [students, setStudents]     = useState<any[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [search, setSearch]         = useState('');

  // Per-student band history (chronological), from group attempts passed down by the page
  const bandsByUser = useMemo(() => {
    const m: Record<string, number[]> = {};
    const sorted = [...attempts].sort((a, b) => submittedMillis(a) - submittedMillis(b));
    for (const a of sorted) {
      const band = effectiveBand(a);
      if (band == null) continue;
      (m[a.userId] ??= []).push(band);
    }
    return m;
  }, [attempts]);

  useEffect(() => {
    const fetchRoster = async () => {
      if (!studentIds || studentIds.length === 0) {
        setStudents([]); setIsLoading(false); return;
      }
      setIsLoading(true);
      try {
        const resolved = await Promise.all(
          studentIds.map(async uid => {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
              const d = snap.data();
              return { uid, displayName: d.displayName || t.unknown, username: d.username || 'user', photoUrl: d.photoURL };
            }
            return { uid, displayName: t.deletedProfile, username: 'unknown' };
          })
        );
        setStudents(resolved);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoster();
  }, [studentIds]);

  const handleRemove = async (student: any) => {
    if (!confirm(t.confirmRemove(student.displayName))) return;
    setRemovingUid(student.uid);
    try {
      await removeStudentFromGroup(groupId, student.uid);
      toast.success(t.removed(student.displayName));
    } catch {
      toast.error(t.error);
    } finally {
      setRemovingUid(null);
    }
  };

  const filtered = students.filter(s =>
    s.displayName.toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return (
    <div className="py-16 flex justify-center">
      <Spinner size={28} />
    </div>
  );

  if (students.length === 0) return (
    <div className="py-8 bg-surface-container-low border-2 border-outline-variant border-dashed rounded-m3-xl">
      <EmptyState
        icon={<UserCheck strokeWidth={2.5} />}
        title={t.noStudents}
        description={<>{t.emptyPre}<strong>+</strong>{t.emptyPost}</>}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">

      {/* Search + count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 bg-surface-container-lowest border border-outline-variant hover:border-outline transition-colors rounded-m3-md px-4 py-3 max-w-md">
          <Search size={16} className="text-on-surface-variant shrink-0" strokeWidth={2.5} />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-[14px] font-black text-on-surface placeholder:text-on-surface-variant placeholder:font-medium outline-none w-full bg-transparent"
          />
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-m3-sm border bg-surface-container-high text-on-surface border-outline-variant self-start sm:self-auto">
          <UserCheck size={14} strokeWidth={3} />
          <span className="text-[13px] font-black">{t.studentsCount(students.length)}</span>
        </div>
      </div>

      {/* Student list grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map(std => {
            const isRemoving = removingUid === std.uid;
            const bands = bandsByUser[std.uid] || [];
            const latestBand = bands.length ? bands[bands.length - 1] : null;
            const trend = bands.slice(-5);
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={std.uid}
                className={`relative overflow-hidden bg-surface-container-low border border-outline-variant rounded-m3-lg p-4 flex items-center gap-3 transition-all shadow-elev-1 hover:shadow-elev-2 ${isRemoving ? 'opacity-40 pointer-events-none' : ''}`}
              >
                {/* SVG pattern overlay */}
                <svg className="absolute inset-0 w-full h-full text-outline-variant opacity-40 z-0 pointer-events-none" fill="currentColor">
                  <pattern id={`dots-${std.uid}`} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.5" />
                  </pattern>
                  <rect x="0" y="0" width="100%" height="100%" fill={`url(#dots-${std.uid})`} />
                </svg>

                {/* Avatar */}
                <div className="relative z-10 w-12 h-12 rounded-m3-md bg-primary-container text-on-primary-container font-black text-[15px] flex items-center justify-center shrink-0 overflow-hidden shadow-elev-1">
                  {std.photoUrl
                    ? <img src={std.photoUrl} alt="" className="w-full h-full object-cover" />
                    : std.displayName[0]?.toUpperCase()
                  }
                </div>

                {/* Name */}
                <div className="relative z-10 flex-1 min-w-0">
                  <p className="text-[15px] font-black text-on-surface truncate mb-0.5">{std.displayName}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-bold text-on-surface-variant truncate">@{std.username}</p>
                    <div className={`flex items-center gap-1 border border-transparent px-1.5 py-0.5 rounded-m3-xs shrink-0 ${bandPill(latestBand)}`}>
                      <Award size={10} strokeWidth={2.5} />
                      <span className="text-[10px] font-black">{latestBand != null ? latestBand.toFixed(1) : '—'}</span>
                    </div>
                    <Sparkline bands={trend} />
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => handleRemove(std)}
                  title={t.removeFromGroup}
                  className="m3-interactive relative z-10 w-9 h-9 rounded-m3-md bg-surface-container border border-outline-variant hover:bg-error-container hover:border-transparent text-on-surface-variant hover:text-on-error-container flex items-center justify-center transition-colors shrink-0 active:scale-95"
                >
                  {isRemoving
                    ? <Loader2 className="animate-spin" size={14} />
                    : <UserMinus size={15} strokeWidth={2.5} />
                  }
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

    </div>
  );
}
