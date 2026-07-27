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

// --- TRANSLATION DICTIONARY ---
const JOIN_TRANSLATIONS: any = {
  uz: {
    title: "Guruh Kodini Kiriting", subtitle: "O'qituvchingizdan olingan kod",
    fieldLabel: "IELTS Guruh Kodi", hint: "Masalan: I-X8K2",
    join: "Qo'shilish", cancel: "Bekor qilish", close: "Yopish",
    successTitle: "So'rov yuborildi!", successDesc: "O'qituvchingiz tasdiqlagach, guruh bu sahifada paydo bo'ladi.",
    toasts: { notFound: "Bunday I- kodi topilmadi!", joined: "Siz bu IELTS guruhiga allaqachon a'zosiz!", pending: "So'rovingiz o'qituvchiga yuborilgan, kuting!", success: "So'rov muvaffaqiyatli yuborildi!", error: "Xatolik yuz berdi" }
  },
  en: {
    title: "Enter the Group Code", subtitle: "The code you got from your teacher",
    fieldLabel: "IELTS Group Code", hint: "Ex: I-X8K2",
    join: "Join", cancel: "Cancel", close: "Close",
    successTitle: "Request sent!", successDesc: "Once your teacher approves, the group will appear on this page.",
    toasts: { notFound: "No group found with this I- code!", joined: "You are already a member of this IELTS group!", pending: "Your request was sent to the teacher, please wait!", success: "Request sent successfully!", error: "Something went wrong" }
  },
  ru: {
    title: "Введите Код Группы", subtitle: "Код, полученный от учителя",
    fieldLabel: "Код IELTS Группы", hint: "Например: I-X8K2",
    join: "Присоединиться", cancel: "Отмена", close: "Закрыть",
    successTitle: "Запрос отправлен!", successDesc: "Как только учитель подтвердит, группа появится на этой странице.",
    toasts: { notFound: "Группа с таким I- кодом не найдена!", joined: "Вы уже состоите в этой IELTS группе!", pending: "Запрос уже отправлен учителю, ожидайте!", success: "Запрос успешно отправлен!", error: "Произошла ошибка" }
  }
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
}

export default function JoinIeltsModal({ isOpen, onClose, lang }: Props) {
  const { user } = useAuth();
  const t = JOIN_TRANSLATIONS[lang] || JOIN_TRANSLATIONS['en'];
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
      if (snap.empty) { sToast.error(t.toasts.notFound); return; }

      const groupDoc  = snap.docs[0];
      const groupId   = groupDoc.id;
      const groupData = groupDoc.data();

      // 2. Already enrolled?
      if (groupData.studentIds?.includes(user.uid)) {
        sToast.error(t.toasts.joined);
        return;
      }

      // 3. Pending request?
      const reqQ    = query(collection(db, 'ielts_groups', groupId, 'requests'), where('studentId', '==', user.uid));
      const reqSnap = await getDocs(reqQ);
      if (!reqSnap.empty) {
        sToast.success(t.toasts.pending);
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
      sToast.success(t.toasts.success);
    } catch {
      sToast.error(t.toasts.error);
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
        title={t.successTitle}
        icon={
          <Tile tone="success" size="lg">
            <CheckCircle size={30} strokeWidth={3} />
          </Tile>
        }
        actions={
          <Button variant="tonal" tone="primary" onClick={handleClose}>
            {t.close}
          </Button>
        }
      >
        {t.successDesc}
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
            <span className="block leading-tight">{t.title}</span>
            <span className="block text-[12px] font-bold text-on-surface-variant">
              {t.subtitle}
            </span>
          </span>
        </span>
      }
    >
      <form onSubmit={handleJoin} className="flex flex-col gap-4">
        <TextField
          label={t.fieldLabel}
          value={code}
          maxLength={8}
          autoFocus
          onChange={e => setCode(e.target.value.toUpperCase())}
          className="text-center font-mono text-[26px] font-black uppercase tracking-[0.3em]"
          hint={t.hint}
        />

        <Button
          type="submit"
          fullWidth
          loading={loading}
          disabled={code.length < 5}
          icon={<ArrowRight size={20} strokeWidth={3} />}
        >
          {t.join}
        </Button>

        <Button type="button" variant="outlined" fullWidth onClick={handleClose}>
          {t.cancel}
        </Button>
      </form>
    </Dialog>
  );
}
