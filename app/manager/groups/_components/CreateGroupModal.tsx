"use client";

import { useState } from "react";
import { Layers, Loader2, ChevronDown } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CenterTeacher } from "@/hooks/useCenterClasses";
import toast from "react-hot-toast";

interface Props {
  centerId: string;
  teachers: CenterTeacher[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateGroupModal({ centerId, teachers, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateJoinCode = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedTeacherId) return;

    setIsSubmitting(true);

    try {
      // Get the selected teacher's name
      const selectedTeacher = teachers.find((t) => t.teacherId === selectedTeacherId);
      const teacherName = selectedTeacher?.teacherName || "Noma'lum O'qituvchi";
      const joinCode = generateJoinCode();

      await addDoc(collection(db, "classes"), {
        title: title.trim(),
        description: description.trim(),
        joinCode,
        teacherId: selectedTeacherId,
        teacherName,
        studentIds: [],
        studentCount: 0,
        isLocked: false,
        createdAt: serverTimestamp(),
      });

      toast.success("Guruh muvaffaqiyatli yaratildi!");
      onSuccess();
    } catch (error: any) {
      console.error("Create Group Error:", error);
      toast.error("Guruh yaratishda xatolik yuz berdi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => !isSubmitting && onClose()}
      ></div>
      <div className="relative bg-white w-full max-w-md rounded-[2rem] p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-100 shrink-0">
            <Layers size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Yangi guruh yaratish
            </h2>
            <p className="text-[13px] text-slate-500 font-medium">
              O'qituvchini tanlang va guruh nomini kiriting.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700 ml-1">
              Guruh nomi <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              placeholder="Masalan: Algebra 9-B"
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all disabled:opacity-60 placeholder:text-slate-400"
            />
          </div>

          {/* Description Input */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700 ml-1">
              Tavsif (ixtiyoriy)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder="Ertalabki guruh..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all resize-none disabled:opacity-60 placeholder:text-slate-400"
            />
          </div>

          {/* Teacher Selector */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700 ml-1">
              O'qituvchi <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                required
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all disabled:opacity-60 appearance-none cursor-pointer"
              >
                <option value="">O'qituvchini tanlang...</option>
                {teachers.map((t) => (
                  <option key={t.teacherId} value={t.teacherId}>
                    {t.teacherName} ({t.teacherEmail})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                <ChevronDown size={18} />
              </div>
            </div>
            {teachers.length === 0 && (
              <p className="text-[12px] font-bold text-amber-600 mt-1.5 px-1">
                Avval "O'qituvchilar" bo'limidan o'qituvchi qo'shing.
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-60"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !selectedTeacherId}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors disabled:opacity-60 shadow-sm shadow-amber-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Yaratilmoqda...
                </>
              ) : (
                "Yaratish"
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
