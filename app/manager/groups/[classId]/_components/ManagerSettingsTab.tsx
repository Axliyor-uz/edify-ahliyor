"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Loader2, Settings, Users, Save } from "lucide-react";
import toast from "react-hot-toast";
import { ClassDocument } from "../page";
import { CenterTeacher } from "@/hooks/useCenterClasses";

interface SettingsProps {
  classData: ClassDocument;
  centerId: string;
  onUpdate: (data: Partial<ClassDocument>) => void;
}

export default function ManagerSettingsTab({ classData, centerId, onUpdate }: SettingsProps) {
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
      toast.error("Oylik narx noto'g'ri kiritildi.");
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
      
      toast.success("Guruh sozlamalari saqlandi!");
      onUpdate(updates);
    } catch (err: any) {
      console.error("Error updating settings:", err);
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 max-w-2xl">
      <form onSubmit={handleSave} className="space-y-6">

        <div className="space-y-4">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Settings size={14} /> Umumiy ma'lumotlar
          </h3>
          
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700 ml-1">Guruh nomi <span className="text-red-400">*</span></label>
            <input 
              type="text" 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700 ml-1">Tavsif</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all resize-none disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700 ml-1">Oylik narx (so&apos;m)</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              disabled={isSaving}
              placeholder="Masalan: 400000"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60"
            />
            <p className="text-[12px] font-medium text-slate-500 ml-1 leading-snug">
              Hisob-kitob shu narxdan hisoblanadi. Bo&apos;sh yoki 0 — guruhdan pul olinmaydi.
              Yangi narx keyingi oydan qo&apos;llanadi.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Users size={14} /> O'qituvchini almashtirish
            </h3>
            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
              Ehtiyot bo&apos;ling
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700 ml-1">Mas'ul o'qituvchi <span className="text-red-400">*</span></label>
            <select 
              required
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              disabled={isSaving || loadingTeachers}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60"
            >
              <option value="" disabled>O'qituvchini tanlang...</option>
              {centerTeachers.map((teacher) => (
                <option key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.teacherName} ({teacher.teacherEmail})
                </option>
              ))}
            </select>
            {loadingTeachers && <p className="text-[12px] text-slate-500 mt-1 ml-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> O'qituvchilar yuklanmoqda...</p>}
            <p className="text-[12px] font-medium text-slate-500 mt-1.5 ml-1 leading-snug">
              Yangi o&apos;qituvchi tanlansa, guruh unga o&apos;tadi. Eski o&apos;qituvchi guruhni ko&apos;ra olmaydi.
            </p>
          </div>
        </div>

        <div className="pt-6">
          <button
            type="submit"
            disabled={isSaving || !title.trim() || !selectedTeacherId}
            className="w-full sm:w-auto px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-full flex items-center justify-center gap-2 transition-all shadow-sm shadow-brand-600/25 active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Sozlamalarni saqlash
          </button>
        </div>

      </form>
    </div>
  );
}
