"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Loader2, Settings, Users, Save } from "lucide-react";
import toast from "react-hot-toast";
import { ClassDocument } from "../page";
import { CenterTeacher } from "@/hooks/useCenterClasses";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    feeInvalid: "Oylik narx noto'g'ri kiritildi.",
    saved: "Guruh sozlamalari saqlandi!",
    saveError: "Saqlashda xatolik yuz berdi",
    generalSection: "Umumiy ma'lumotlar",
    nameLabel: "Guruh nomi",
    descriptionLabel: "Tavsif",
    feeLabel: "Oylik narx (so'm)",
    feePlaceholder: "Masalan: 400000",
    feeHint: "Hisob-kitob shu narxdan hisoblanadi. Bo'sh yoki 0 — guruhdan pul olinmaydi. Yangi narx keyingi oydan qo'llanadi.",
    changeTeacherSection: "O'qituvchini almashtirish",
    beCareful: "Ehtiyot bo'ling",
    teacherLabel: "Mas'ul o'qituvchi",
    teacherPlaceholder: "O'qituvchini tanlang...",
    loadingTeachers: "O'qituvchilar yuklanmoqda...",
    changeTeacherHint: "Yangi o'qituvchi tanlansa, guruh unga o'tadi. Eski o'qituvchi guruhni ko'ra olmaydi.",
    saveButton: "Sozlamalarni saqlash",
  },
  en: {
    feeInvalid: "The monthly fee is invalid.",
    saved: "Group settings saved!",
    saveError: "Something went wrong while saving",
    generalSection: "General information",
    nameLabel: "Group name",
    descriptionLabel: "Description",
    feeLabel: "Monthly fee (so'm)",
    feePlaceholder: "e.g. 400000",
    feeHint: "Billing is calculated from this fee. Empty or 0 — the group is not billed. A new fee applies from next month.",
    changeTeacherSection: "Change teacher",
    beCareful: "Be careful",
    teacherLabel: "Assigned teacher",
    teacherPlaceholder: "Select a teacher...",
    loadingTeachers: "Loading teachers...",
    changeTeacherHint: "If you pick a new teacher, the group moves to them. The previous teacher will no longer see the group.",
    saveButton: "Save settings",
  },
  ru: {
    feeInvalid: "Ежемесячная стоимость указана неверно.",
    saved: "Настройки группы сохранены!",
    saveError: "Не удалось сохранить изменения",
    generalSection: "Общие сведения",
    nameLabel: "Название группы",
    descriptionLabel: "Описание",
    feeLabel: "Стоимость в месяц (so'm)",
    feePlaceholder: "Например: 400000",
    feeHint: "Расчёты ведутся по этой стоимости. Пусто или 0 — оплата с группы не взимается. Новая стоимость действует со следующего месяца.",
    changeTeacherSection: "Смена учителя",
    beCareful: "Будьте внимательны",
    teacherLabel: "Ответственный учитель",
    teacherPlaceholder: "Выберите учителя...",
    loadingTeachers: "Загрузка учителей...",
    changeTeacherHint: "Если выбрать нового учителя, группа перейдёт к нему. Прежний учитель потеряет доступ к группе.",
    saveButton: "Сохранить настройки",
  },
};
type T = typeof TRANSLATIONS.uz;

interface SettingsProps {
  classData: ClassDocument;
  centerId: string;
  onUpdate: (data: Partial<ClassDocument>) => void;
}

export default function ManagerSettingsTab({ classData, centerId, onUpdate }: SettingsProps) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [title, setTitle] = useState(classData.title);
  const [description, setDescription] = useState(classData.description || "");
  const [monthlyFee, setMonthlyFee] = useState(classData.monthlyFee ? String(classData.monthlyFee) : "");
  const [selectedTeacherId, setSelectedTeacherId] = useState(classData.teacherId);

  const [centerTeachers, setCenterTeachers] = useState<CenterTeacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchTeachers() {
      try {
        const q = query(
          collection(db, "center_teachers"),
          where("centerId", "==", centerId)
        );
        const snap = await getDocs(q);
        const teachersData = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CenterTeacher[];

        if (isMounted) {
          setCenterTeachers(teachersData);
          setLoadingTeachers(false);
        }
      } catch (err) {
        console.error("Error fetching teachers:", err);
        if (isMounted) setLoadingTeachers(false);
      }
    }
    fetchTeachers();
    return () => { isMounted = false; };
  }, [centerId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedTeacherId) return;

    const feeNum = monthlyFee.trim() === "" ? 0 : parseInt(monthlyFee, 10);
    if (!Number.isInteger(feeNum) || feeNum < 0) {
      toast.error(t.feeInvalid);
      return;
    }

    setIsSaving(true);
    try {
      const selectedTeacher = centerTeachers.find(t => t.teacherId === selectedTeacherId);
      const teacherName = selectedTeacher?.teacherName || classData.teacherName; // fallback to current if not found

      const updates: Partial<ClassDocument> = {
        title: title.trim(),
        description: description.trim(),
        monthlyFee: feeNum,
        teacherId: selectedTeacherId,
        teacherName: teacherName
      };

      await updateDoc(doc(db, "classes", classData.id), updates);

      toast.success(t.saved);
      onUpdate(updates);
    } catch (err: any) {
      console.error("Error updating settings:", err);
      toast.error(t.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 max-w-2xl">
      <form onSubmit={handleSave} className="space-y-6">

        <div className="space-y-4">
          <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <Settings size={14} /> {t.generalSection}
          </h3>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.nameLabel} <span className="text-error">*</span></label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.descriptionLabel}</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.feeLabel}</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              disabled={isSaving}
              placeholder={t.feePlaceholder}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
            />
            <p className="text-[12px] font-medium text-on-surface-variant ml-1 leading-snug">
              {t.feeHint}
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-outline-variant space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
              <Users size={14} /> {t.changeTeacherSection}
            </h3>
            <span className="text-[11px] font-bold text-on-warning-container bg-warning-container px-2.5 py-1 rounded-full">
              {t.beCareful}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.teacherLabel} <span className="text-error">*</span></label>
            <select
              required
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              disabled={isSaving || loadingTeachers}
              className="w-full px-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
            >
              <option value="" disabled>{t.teacherPlaceholder}</option>
              {centerTeachers.map((teacher) => (
                <option key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.teacherName} ({teacher.teacherEmail})
                </option>
              ))}
            </select>
            {loadingTeachers && <p className="text-[12px] text-on-surface-variant mt-1 ml-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> {t.loadingTeachers}</p>}
            <p className="text-[12px] font-medium text-on-surface-variant mt-1.5 ml-1 leading-snug">
              {t.changeTeacherHint}
            </p>
          </div>
        </div>

        <div className="pt-6">
          <button
            type="submit"
            disabled={isSaving || !title.trim() || !selectedTeacherId}
            className="w-full sm:w-auto px-8 h-t-control bg-primary text-on-primary font-bold text-sm rounded-full flex items-center justify-center gap-2 transition-all shadow-elev-1 active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {t.saveButton}
          </button>
        </div>

      </form>
    </div>
  );
}
