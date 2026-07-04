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

    setIsSaving(true);
    try {
      const selectedTeacher = centerTeachers.find(t => t.teacherId === selectedTeacherId);
      const teacherName = selectedTeacher?.teacherName || classData.teacherName; // fallback to current if not found

      const updates: Partial<ClassDocument> = {
        title: title.trim(),
        description: description.trim(),
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
    <div className="p-6 max-w-2xl">
      <form onSubmit={handleSave} className="space-y-6">
        
        <div className="space-y-4">
          <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
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
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700 ml-1">Tavsif</label>
            <textarea 
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all resize-none disabled:opacity-60"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Users size={14} /> O'qituvchini almashtirish
            </h3>
            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
              Xavfli amal
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700 ml-1">Mas'ul o'qituvchi <span className="text-red-400">*</span></label>
            <select 
              required
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              disabled={isSaving || loadingTeachers}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all disabled:opacity-60"
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
              Boshqa o'qituvchini tanlasangiz, guruh ustidan to'liq nazorat yangi o'qituvchiga o'tadi va joriy o'qituvchi guruhni ko'ra olmaydi.
            </p>
          </div>
        </div>

        <div className="pt-6">
          <button 
            type="submit"
            disabled={isSaving || !title.trim() || !selectedTeacherId}
            className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Sozlamalarni saqlash
          </button>
        </div>

      </form>
    </div>
  );
}
