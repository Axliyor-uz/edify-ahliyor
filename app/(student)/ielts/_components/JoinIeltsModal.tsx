// app/(student)/ielts/_components/JoinIeltsModal.tsx
'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  Target, Loader2, ArrowRight, CheckCircle, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function JoinIeltsModal({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const [code, setCode]     = useState('I-');
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState<'idle' | 'success'>('idle');

  // ── Reset + close ──────────────────────────────────────────────────────────
  const handleClose = () => {
    setCode('I-');
    setStatus('idle');
    setLoading(false);
    onClose();
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode.startsWith('I-') || cleanCode.length < 5 || !user) return;

    setLoading(true);
    try {
      // 1. Discover the group
      const q    = query(collection(db, 'ielts_groups'), where('joinCode', '==', cleanCode));
      const snap = await getDocs(q);
      if (snap.empty) { toast.error("Bunday I- kodi topilmadi!"); return; }

      const groupDoc  = snap.docs[0];
      const groupId   = groupDoc.id;
      const groupData = groupDoc.data();

      // 2. Already enrolled?
      if (groupData.studentIds?.includes(user.uid)) {
        toast.error("Siz bu IELTS guruhiga allaqachon a'zosiz!");
        return;
      }

      // 3. Pending request?
      const reqQ    = query(collection(db, 'ielts_groups', groupId, 'requests'), where('studentId', '==', user.uid));
      const reqSnap = await getDocs(reqQ);
      if (!reqSnap.empty) {
        toast.success("So'rovingiz o'qituvchiga yuborilgan, kuting!");
        return;
      }

      // 4. Submit request
      await addDoc(collection(db, 'ielts_groups', groupId, 'requests'), {
        studentId:   user.uid,
        displayName: user?.displayName || "O'quvchi",
        username:    user?.email?.split('@')[0] || 'user',
        photoUrl:    user?.photoURL || null,
        requestedAt: serverTimestamp(),
      });

      setStatus('success');
      toast.success("So'rov muvaffaqiyatli yuborildi!");
    } catch {
      toast.error('Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">

          {/* ── Backdrop ── */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-zinc-900/50"
            onClick={handleClose}
          />

          {/* ── Sheet / Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] border-2 border-zinc-200 border-b-0 sm:border-b-[6px] p-6 md:p-8 flex flex-col z-10"
          >
            {/* Mobile drag handle */}
            <div className="w-10 h-1 bg-zinc-300 rounded-full mx-auto mb-6 sm:hidden" />

            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center bg-zinc-100 border-2 border-zinc-200 rounded-xl text-zinc-400 hover:text-zinc-700 active:scale-95 transition-all"
            >
              <X size={18} strokeWidth={3} />
            </button>

            {/* ── Success state ── */}
            {status === 'success' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center gap-4 py-4"
              >
                <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 border-b-[6px] rounded-[1.5rem] flex items-center justify-center text-emerald-500">
                  <CheckCircle size={30} strokeWidth={3} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-zinc-900 tracking-tight mb-1">So'rov yuborildi!</h3>
                  <p className="text-[14px] font-bold text-zinc-500 leading-relaxed">
                    O'qituvchingiz tasdiqlagach, guruh bu sahifada paydo bo'ladi.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="mt-2 w-full py-3.5 bg-zinc-100 text-zinc-600 font-black text-[14px] rounded-2xl border-2 border-zinc-200 border-b-4 active:border-b-2 active:translate-y-[2px] transition-all uppercase tracking-widest"
                >
                  Yopish
                </button>
              </motion.div>

            ) : (
              /* ── Form state ── */
              <>
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-violet-50 border-2 border-violet-200 border-b-[4px] rounded-[1rem] flex items-center justify-center text-violet-500 shrink-0">
                    <Target size={24} strokeWidth={3} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-zinc-900 tracking-tight leading-tight">
                      Guruh Kodini Kiriting
                    </h2>
                    <p className="text-[12px] font-bold text-zinc-400 mt-0.5">
                      O'qituvchingizdan olingan kod
                    </p>
                  </div>
                </div>

                <form onSubmit={handleJoin} className="flex flex-col gap-4">
                  {/* Code input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">
                      IELTS Guruh Kodi
                    </label>
                    <input
                      type="text"
                      value={code}
                      maxLength={8}
                      autoFocus
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      placeholder="I-XXXX"
                      className="w-full text-center text-3xl font-black tracking-[0.3em] py-5 bg-zinc-50 border-2 border-zinc-200 border-b-[6px] rounded-2xl outline-none focus:border-violet-400 focus:border-b-violet-600 focus:bg-white text-zinc-900 transition-all font-mono uppercase placeholder:text-zinc-300 placeholder:tracking-[0.2em]"
                    />
                    <p className="text-[11px] font-bold text-zinc-400 text-center px-1">
                      Masalan:&nbsp;
                      <span className="font-black text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-lg border border-zinc-200">
                        I-X8K2
                      </span>
                    </p>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || code.length < 5}
                    className="w-full py-3.5 bg-violet-500 text-white font-black text-[15px] rounded-2xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider mt-1"
                  >
                    {loading
                      ? <Loader2 className="animate-spin" size={20} strokeWidth={3} />
                      : <ArrowRight size={20} strokeWidth={3} />
                    }
                    Qo'shilish
                  </button>

                  {/* Cancel */}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full py-3.5 bg-white text-zinc-500 font-black text-[14px] rounded-2xl border-2 border-zinc-200 border-b-4 active:border-b-2 active:translate-y-[2px] transition-all uppercase tracking-wider"
                  >
                    Bekor qilish
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
