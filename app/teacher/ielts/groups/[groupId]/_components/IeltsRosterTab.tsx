'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { UserMinus, Loader2, Award, UserCheck, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  groupId: string;
  studentIds: string[];
}

export default function IeltsRosterTab({ groupId, studentIds }: Props) {
  const [students, setStudents]     = useState<any[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [search, setSearch]         = useState('');

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
              return { uid, displayName: d.displayName || "Noma'lum", username: d.username || 'user', photoUrl: d.photoURL, currentBand: 6.5 };
            }
            return { uid, displayName: "O'chirilgan profil", username: 'unknown', currentBand: 0 };
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
    if (!confirm(`${student.displayName}ni guruhdan chiqarasizmi?`)) return;
    setRemovingUid(student.uid);
    try {
      await updateDoc(doc(db, 'ielts_groups', groupId), { studentIds: arrayRemove(student.uid) });
      toast.success(`${student.displayName} chiqarildi`);
    } catch {
      toast.error("Xatolik yuz berdi");
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
      <Loader2 className="animate-spin text-rose-500" size={24} />
    </div>
  );

  if (students.length === 0) return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-4 bg-zinc-50 border-2 border-slate-200/80 border-dashed rounded-2xl">
      <div className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-200 text-slate-400 flex items-center justify-center">
        <UserCheck size={24} strokeWidth={2.5} />
      </div>
      <div>
        <h3 className="text-[15px] font-black text-slate-800 tracking-tight mb-1">O'quvchilar yo'q</h3>
        <p className="text-[13px] font-medium text-slate-500 max-w-xs leading-relaxed">
          Guruhga o'quvchilarni qo'shish uchun yuqoridagi <strong>+</strong> tugmasini bosing.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">

      {/* Search + count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 bg-white border-2 border-slate-200/80 hover:border-slate-300 transition-colors rounded-xl px-4 py-3 max-w-md">
          <Search size={16} className="text-slate-400 shrink-0" strokeWidth={2.5} />
          <input
            type="text"
            placeholder="O'quvchini qidirish..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-[14px] font-black text-slate-900 placeholder:text-slate-400 placeholder:font-medium outline-none w-full bg-transparent"
          />
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 bg-slate-50 text-slate-700 border-slate-200/80 self-start sm:self-auto">
          <UserCheck size={14} strokeWidth={3} />
          <span className="text-[13px] font-black">{students.length} o'quvchi</span>
        </div>
      </div>

      {/* Student list grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map(std => {
            const isRemoving = removingUid === std.uid;
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={std.uid}
                className={`relative overflow-hidden bg-white border-2 border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 transition-all hover:border-slate-300 hover:shadow-sm ${isRemoving ? 'opacity-40 pointer-events-none' : ''}`}
              >
                {/* SVG pattern overlay */}
                <svg className="absolute inset-0 w-full h-full text-slate-100/50 z-0 pointer-events-none" fill="currentColor">
                  <pattern id={`dots-${std.uid}`} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.5" />
                  </pattern>
                  <rect x="0" y="0" width="100%" height="100%" fill={`url(#dots-${std.uid})`} />
                </svg>

                {/* Avatar */}
                <div className="relative z-10 w-12 h-12 rounded-xl bg-slate-800 text-white font-black text-[15px] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                  {std.photoUrl
                    ? <img src={std.photoUrl} alt="" className="w-full h-full object-cover" />
                    : std.displayName[0]?.toUpperCase()
                  }
                </div>

                {/* Name */}
                <div className="relative z-10 flex-1 min-w-0">
                  <p className="text-[15px] font-black text-slate-900 truncate mb-0.5">{std.displayName}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-bold text-slate-400 truncate">@{std.username}</p>
                    <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md">
                      <Award size={10} className="text-amber-600" strokeWidth={2.5} />
                      <span className="text-[10px] font-black text-amber-700">{std.currentBand.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => handleRemove(std)}
                  title="Guruhdan chiqarish"
                  className="relative z-10 w-9 h-9 rounded-xl bg-slate-50 border-2 border-slate-200/80 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-colors shrink-0 active:scale-95"
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
