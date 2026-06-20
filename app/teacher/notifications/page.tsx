'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, where, orderBy, onSnapshot, doc,
  writeBatch, limit, deleteDoc, updateDoc, arrayUnion, getDocs
} from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  Bell, Check, Trophy, UserPlus, Clock,
  Trash2, AlertTriangle, FileText, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTeacherLanguage } from '@/app/teacher/layout';
import toast from 'react-hot-toast';

// --- 1. TRANSLATION DICTIONARY ---
const NOTIFICATIONS_TRANSLATIONS = {
  uz: {
    title: "Xabarnomalar",
    subtitle: "O'quvchilar va topshiriqlar bo'yicha yangiliklar",
    dismiss: "Yangi xabarlarni o'chirish",
    clear: "Tarixni tozalash",
    emptyTitle: "Yangi xabarlar yo'q",
    emptyDesc: "O'quvchi so'rovlari va test natijalari shu yerda paydo bo'ladi.",
    new: "YANGI",
    loading: "Xabarlar yuklanmoqda...",
    justNow: "Hozirgina",
    view: "Batafsil ko'rish",
    confirmClear: "Barcha xabarnomalarni o'chirasizmi? Bu amalni qaytarib bo'lmaydi.",
    // New Translations for requests
    accept: "{name} qabul qilindi",
    errAccept: "Qabul qilishda xatolik",
    confirmReject: "Bu o'quvchini rad etasizmi?",
    rejected: "So'rov rad etildi",
    errReject: "Rad etishda xatolik",
  },
  en: {
    title: "Notifications",
    subtitle: "Updates on students & submissions",
    dismiss: "Dismiss New",
    clear: "Clear History",
    emptyTitle: "No new alerts",
    emptyDesc: "Student requests and test submissions will appear here.",
    new: "NEW",
    loading: "Loading inbox...",
    justNow: "Just now",
    view: "View Details",
    confirmClear: "Clear all notifications? This cannot be undone.",
    // New Translations for requests
    accept: "Accepted {name}",
    errAccept: "Error accepting student",
    confirmReject: "Reject this student?",
    rejected: "Request rejected",
    errReject: "Error rejecting",
  },
  ru: {
    title: "Уведомления",
    subtitle: "Обновления по ученикам и заданиям",
    dismiss: "Скрыть новые",
    clear: "Очистить историю",
    emptyTitle: "Нет новых оповещений",
    emptyDesc: "Запросы учеников и сданные тесты появятся здесь.",
    new: "НОВОЕ",
    loading: "Загрузка...",
    justNow: "Только что",
    view: "Подробнее",
    confirmClear: "Очистить все уведомления? Это действие нельзя отменить.",
    // New Translations for requests
    accept: "{name} принят(а)",
    errAccept: "Ошибка принятия",
    confirmReject: "Отклонить этого ученика?",
    rejected: "Запрос отклонен",
    errReject: "Ошибка отклонения",
  }
};

export default function TeacherNotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const { lang } = useTeacherLanguage();
  const t = NOTIFICATIONS_TRANSLATIONS[lang] || NOTIFICATIONS_TRANSLATIONS['en'];

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. LISTEN TO NOTIFICATIONS
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. STANDARD ACTIONS
  const handleRead = async (id: string, readStatus: boolean, link?: string) => {
    if (link) router.push(link);
    if (!readStatus) {
      try {
        await updateDoc(doc(db, 'notifications', id), { read: true });
      } catch (e) {
        console.error("Error updating notification:", e);
      }
    }
  };

  const markAllRead = async () => {
    const batch = writeBatch(db);
    let hasUpdates = false;

    notifications.forEach(n => {
      if (!n.read) {
        batch.update(doc(db, 'notifications', n.id), { read: true });
        hasUpdates = true;
      }
    });

    if (hasUpdates) {
      await batch.commit();
    }
  };

  const clearAll = async () => {
    if (!confirm(t.confirmClear)) return;
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  };

  // 🟢 3. REQUEST HANDLING ACTIONS 🟢
  const handleAcceptRequest = async (e: React.MouseEvent, n: any) => {
    e.stopPropagation();
    try {
      if (!n.classId || !n.studentId) throw new Error("Missing request data");

      // 1. Add student to the class roster
      await updateDoc(doc(db, 'classes', n.classId), {
        studentIds: arrayUnion(n.studentId)
      });

      // 2. Remove from the class's request queue
      if (n.requestId) {
        await deleteDoc(doc(db, 'classes', n.classId, 'requests', n.requestId));
      } else {
        // Fallback for older notifications without requestId
        const q = query(collection(db, 'classes', n.classId, 'requests'), where('studentId', '==', n.studentId));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // 3. Delete the notification from inbox
      await deleteDoc(doc(db, 'notifications', n.id));
      
      toast.success(t.accept.replace("{name}", n.studentName || 'Student'));
    } catch (err) { 
      console.error(err);
      toast.error(t.errAccept); 
    }
  };

  const handleRejectRequest = async (e: React.MouseEvent, n: any) => {
    e.stopPropagation();
    if (!confirm(t.confirmReject)) return;
    try {
      // 1. Remove from the class's request queue
      if (n.classId && n.requestId) {
        await deleteDoc(doc(db, 'classes', n.classId, 'requests', n.requestId));
      } else if (n.classId && n.studentId) {
        // Fallback for older notifications without requestId
        const q = query(collection(db, 'classes', n.classId, 'requests'), where('studentId', '==', n.studentId));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      
      // 2. Delete the notification
      await deleteDoc(doc(db, 'notifications', n.id));
      toast.success(t.rejected);
    } catch (err) { 
      console.error(err);
      toast.error(t.errReject); 
    }
  };

  // 4. HELPERS
  const getIcon = (type: string) => {
    switch (type) {
      case 'submission': return <div className="bg-green-100 text-green-600 p-3 rounded-full"><Trophy size={20} /></div>;
      case 'request': return <div className="bg-purple-100 text-purple-600 p-3 rounded-full"><UserPlus size={20} /></div>;
      case 'alert': return <div className="bg-red-100 text-red-600 p-3 rounded-full"><AlertTriangle size={20} /></div>;
      case 'assignment': return <div className="bg-blue-100 text-blue-600 p-3 rounded-full"><FileText size={20} /></div>;
      default: return <div className="bg-slate-100 text-slate-600 p-3 rounded-full"><Bell size={20} /></div>;
    }
  };

  const getTimeString = (timestamp: any) => {
    if (!timestamp) return t.justNow;
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="p-12 text-center text-slate-400 font-medium">{t.loading}</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-in fade-in slide-in-from-top-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">{t.title}</h1>
          <p className="text-slate-500 font-medium mt-1">{t.subtitle}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={markAllRead}
            disabled={!notifications.some(n => !n.read)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
            title="Dismiss all new notifications"
          >
            <Check size={16} /> {t.dismiss}
          </button>
          <button
            onClick={clearAll}
            disabled={notifications.length === 0}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            title="Clear History"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* LIST */}
      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-8 duration-500">
        {notifications.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={40} />
            </div>
            <h3 className="text-slate-900 font-bold text-lg">{t.emptyTitle}</h3>
            <p className="text-slate-500 text-sm mt-1">{t.emptyDesc}</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleRead(n.id, n.read, n.link)}
              className={`relative bg-white p-5 rounded-2xl border transition-all cursor-pointer group hover:shadow-lg hover:border-indigo-200 hover:-translate-y-0.5 ${!n.read ? 'border-indigo-200 shadow-sm bg-indigo-50/10' : 'border-slate-100 opacity-80 hover:opacity-100'}`}
            >
              {/* "New" Badge */}
              {!n.read && (
                <span className="absolute top-4 right-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm shadow-indigo-200">
                  {t.new}
                </span>
              )}

              <div className="flex items-start gap-5">
                {/* Icon */}
                <div className="shrink-0 pt-1">{getIcon(n.type)}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-base leading-tight ${!n.read ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                      {n.title}
                    </h3>
                  </div>
                  <p className={`text-sm leading-relaxed mb-3 ${!n.read ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                    {n.message}
                  </p>

                  {/* 🟢 ACTION BUTTONS FOR JOIN REQUESTS 🟢 */}
                  {n.type === 'request' && n.classId && n.studentId && (
                    <div className="flex items-center gap-2 mb-3 mt-2">
                      <button
                        onClick={(e) => handleRejectRequest(e, n)}
                        className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-[12px] transition-colors border border-red-100/50 active:scale-95"
                        title={t.confirmReject}
                      >
                        <X size={18} strokeWidth={3} />
                      </button>
                      <button
                        onClick={(e) => handleAcceptRequest(e, n)}
                        className="w-10 h-10 flex items-center justify-center bg-emerald-500 text-white hover:bg-emerald-600 rounded-[12px] transition-all shadow-sm shadow-emerald-500/20 active:scale-95"
                        title={t.accept.replace("{name}", "")}
                      >
                        <Check size={18} strokeWidth={3} />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {getTimeString(n.createdAt)}
                    </span>
                    {n.link && n.type !== 'request' && (
                      <span className="text-indigo-500 group-hover:underline flex items-center gap-1">
                        {t.view}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}