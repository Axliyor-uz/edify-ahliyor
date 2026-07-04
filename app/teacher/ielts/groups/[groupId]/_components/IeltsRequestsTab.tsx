'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, doc, updateDoc, deleteDoc,
  arrayUnion, getDoc, onSnapshot,
} from 'firebase/firestore';
import { Check, X, Inbox, Loader2, UserPlus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { motion, AnimatePresence } from 'framer-motion';

const T: Record<string, any> = {
  uz: {
    emptyTitle: "So'rovlar yo'q",
    emptyDesc: "'I-' kodi orqali bu guruhga qo'shilishni so'ragan o'quvchilar hali yo'q.",
    approve: "Qabul qilish",
    reject: "Rad etish",
    successApprove: "{name} qabul qilindi!",
    successReject: "So'rov rad etildi",
    fail: "Xatolik yuz berdi",
    count: "ta so'rov",
    bannerTitle: "Shoshilinch So'rovlar",
  },
  en: {
    emptyTitle: "No pending requests",
    emptyDesc: "No students have requested access using your 'I-' code yet.",
    approve: "Approve",
    reject: "Reject",
    successApprove: "{name} approved!",
    successReject: "Request rejected",
    fail: "An error occurred",
    count: "requests",
    bannerTitle: "Pending Requests",
  },
  ru: {
    emptyTitle: "Нет запросов",
    emptyDesc: "Пока нет заявок на вступление по коду 'I-'.",
    approve: "Принять",
    reject: "Отклонить",
    successApprove: "{name} принят!",
    successReject: "Запрос отклонён",
    fail: "Произошла ошибка",
    count: "запроса",
    bannerTitle: "Срочные запросы",
  },
};

interface EnrichedRequest {
  requestId: string;
  uid: string;
  displayName: string;
  username: string;
  photoUrl: string | null;
  requestedAt: Date;
}

interface Props { groupId: string; }

export default function IeltsRequestsTab({ groupId }: Props) {
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const [requests, setRequests]       = useState<EnrichedRequest[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    const unsub = onSnapshot(
      collection(db, 'ielts_groups', groupId, 'requests'),
      async (snapshot) => {
        try {
          const resolved = await Promise.all(
            snapshot.docs.map(async (reqDoc) => {
              const raw = reqDoc.data();
              const uid = raw.studentId || raw.userId || reqDoc.id;
              const userSnap = await getDoc(doc(db, 'users', uid));
              const u = userSnap.exists() ? userSnap.data() : {};
              return {
                requestId:   reqDoc.id,
                uid,
                displayName: u.displayName || raw.displayName || "Noma'lum",
                username:    u.username    || raw.username    || 'user',
                photoUrl:    u.photoURL    || raw.photoUrl    || null,
                requestedAt: raw.requestedAt?.toDate() || new Date(),
              };
            })
          );
          resolved.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
          setRequests(resolved);
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoading(false);
        }
      }
    );
    return () => unsub();
  }, [groupId]);

  const handleApprove = async (req: EnrichedRequest) => {
    setProcessingId(req.requestId);
    try {
      await updateDoc(doc(db, 'ielts_groups', groupId), { studentIds: arrayUnion(req.uid) });
      await deleteDoc(doc(db, 'ielts_groups', groupId, 'requests', req.requestId));
      toast.success(t.successApprove.replace('{name}', req.displayName));
    } catch (e) {
      console.error(e); toast.error(t.fail);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: EnrichedRequest) => {
    setProcessingId(req.requestId);
    try {
      await deleteDoc(doc(db, 'ielts_groups', groupId, 'requests', req.requestId));
      toast.success(t.successReject);
    } catch (e) {
      console.error(e); toast.error(t.fail);
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) return (
    <div className="py-16 flex justify-center">
      <Loader2 className="animate-spin text-rose-500" size={28} />
    </div>
  );

  if (requests.length === 0) return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-4 bg-zinc-50 border-2 border-slate-200/80 border-dashed rounded-2xl">
      <div className="w-16 h-16 rounded-3xl bg-white border-2 border-slate-200 text-slate-400 flex items-center justify-center shadow-sm">
        <Inbox size={28} strokeWidth={2.5} />
      </div>
      <div>
        <h3 className="text-[16px] font-black text-slate-800 tracking-tight mb-1">{t.emptyTitle}</h3>
        <p className="text-[13px] font-bold text-slate-500 max-w-sm leading-relaxed">{t.emptyDesc}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">

      <div className="bg-amber-50 rounded-2xl border-2 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)] p-6 overflow-hidden relative max-w-2xl">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400" />
        
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <AlertCircle size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[16px] font-black text-amber-900 tracking-tight">{t.bannerTitle}</h3>
            <p className="text-[13px] font-bold text-amber-700/80">{requests.length} {t.count} kutmoqda</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {requests.map(req => {
              const isBusy = processingId === req.requestId;
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={req.requestId}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border-2 border-amber-200/60 rounded-xl p-4 shadow-sm hover:border-amber-300 transition-all ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 text-white font-black text-[16px] flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                      {req.photoUrl ? <img src={req.photoUrl} alt="" className="w-full h-full object-cover" /> : req.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-black text-slate-900 truncate mb-0.5">{req.displayName}</p>
                      <p className="text-[12px] font-bold text-slate-400 truncate">@{req.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 border-t-2 sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                    <button
                      onClick={() => handleReject(req)}
                      disabled={isBusy}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl font-black text-[13px] transition-colors border-2 border-slate-200 hover:border-rose-200 active:scale-95"
                    >
                      <X size={15} strokeWidth={3} /> {t.reject}
                    </button>
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={isBusy}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[13px] transition-colors shadow-sm active:scale-95 border-2 border-amber-600/20"
                    >
                      {isBusy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} strokeWidth={3} />}
                      {t.approve}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
