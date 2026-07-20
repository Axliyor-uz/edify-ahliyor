// app/(student)/ielts/_components/JoinIeltsModal.tsx
'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { Target, ArrowRight, CheckCircle } from 'lucide-react';
import { Dialog, Button, TextField, Tile, sToast } from '@/components/student-ui';

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
      if (snap.empty) { sToast.error("Bunday I- kodi topilmadi!"); return; }

      const groupDoc  = snap.docs[0];
      const groupId   = groupDoc.id;
      const groupData = groupDoc.data();

      // 2. Already enrolled?
      if (groupData.studentIds?.includes(user.uid)) {
        sToast.error("Siz bu IELTS guruhiga allaqachon a'zosiz!");
        return;
      }

      // 3. Pending request?
      const reqQ    = query(collection(db, 'ielts_groups', groupId, 'requests'), where('studentId', '==', user.uid));
      const reqSnap = await getDocs(reqQ);
      if (!reqSnap.empty) {
        sToast.success("So'rovingiz o'qituvchiga yuborilgan, kuting!");
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
      sToast.success("So'rov muvaffaqiyatli yuborildi!");
    } catch {
      sToast.error('Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <Dialog
        open={isOpen}
        onClose={handleClose}
        sheetOnMobile
        title="So'rov yuborildi!"
        icon={
          <Tile tone="success" size="lg">
            <CheckCircle size={30} strokeWidth={3} />
          </Tile>
        }
        actions={
          <Button variant="tonal" tone="primary" onClick={handleClose}>
            Yopish
          </Button>
        }
      >
        O'qituvchingiz tasdiqlagach, guruh bu sahifada paydo bo'ladi.
      </Dialog>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      sheetOnMobile
      title={
        <span className="flex items-center gap-3">
          <Tile tone="primary">
            <Target size={22} strokeWidth={3} />
          </Tile>
          <span className="min-w-0">
            <span className="block leading-tight">Guruh Kodini Kiriting</span>
            <span className="block text-[12px] font-bold text-on-surface-variant">
              O'qituvchingizdan olingan kod
            </span>
          </span>
        </span>
      }
    >
      <form onSubmit={handleJoin} className="flex flex-col gap-4">
        <TextField
          label="IELTS Guruh Kodi"
          value={code}
          maxLength={8}
          autoFocus
          onChange={e => setCode(e.target.value.toUpperCase())}
          className="text-center font-mono text-[26px] font-black uppercase tracking-[0.3em]"
          hint="Masalan: I-X8K2"
        />

        <Button
          type="submit"
          fullWidth
          loading={loading}
          disabled={code.length < 5}
          icon={<ArrowRight size={20} strokeWidth={3} />}
        >
          Qo'shilish
        </Button>

        <Button type="button" variant="outlined" fullWidth onClick={handleClose}>
          Bekor qilish
        </Button>
      </form>
    </Dialog>
  );
}
