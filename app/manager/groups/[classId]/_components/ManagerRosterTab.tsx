"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import { Loader2, Users, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import ManagerAddStudentModal from "./ManagerAddStudentModal";

interface RosterProps {
  classId: string;
  studentIds: string[];
  onRefresh: () => void;
}

interface StudentProfile {
  uid: string;
  displayName: string;
  username: string;
  totalXP: number;
}

export default function ManagerRosterTab({ classId, studentIds, onRefresh }: RosterProps) {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [removingUid, setRemovingUid] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchStudents() {
      if (!studentIds || studentIds.length === 0) {
        if (isMounted) {
          setStudents([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const studentPromises = studentIds.map(async (uid) => {
          const sRef = doc(db, "users", uid);
          const sSnap = await getDoc(sRef);
          if (sSnap.exists()) {
            const data = sSnap.data();
            return {
              uid,
              displayName: data.displayName || "Noma'lum",
              username: data.username || "noma'lum",
              totalXP: data.totalXP || 0,
            } as StudentProfile;
          }
          return null;
        });

        const results = (await Promise.all(studentPromises)).filter(Boolean) as StudentProfile[];
        
        // Sort by XP descending
        results.sort((a, b) => b.totalXP - a.totalXP);

        if (isMounted) setStudents(results);
      } catch (err) {
        console.error("Error fetching roster:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchStudents();

    return () => {
      isMounted = false;
    };
  }, [studentIds]);

  const handleRemoveStudent = async (uid: string, displayName: string) => {
    if (!confirm(`Siz rostdan ham ${displayName} ismli o'quvchini guruhdan o'chirmoqchimisiz?`)) return;
    
    setRemovingUid(uid);
    try {
      const classRef = doc(db, "classes", classId);
      await updateDoc(classRef, { studentIds: arrayRemove(uid) });
      toast.success(`${displayName} guruhdan o'chirildi.`);
      onRefresh();
    } catch (err) {
      console.error("Error removing student:", err);
      toast.error("O'quvchini o'chirishda xatolik yuz berdi.");
    } finally {
      setRemovingUid(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="w-20 h-20 bg-amber-50 rounded-[2rem] flex items-center justify-center text-amber-500 mb-6 shadow-sm shadow-amber-500/10">
          <Users size={36} strokeWidth={2.5} />
        </div>
        <h3 className="text-[18px] font-black text-slate-900 tracking-tight">Guruh bo'sh</h3>
        <p className="text-[14px] text-slate-500 mt-2 mb-8 max-w-sm leading-relaxed">
          Ushbu guruhga hali o'quvchilar qo'shilmagan. O'quvchilarni qo'shish uchun quyidagi tugmani bosing.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[14px] rounded-full transition-all duration-300 shadow-md shadow-amber-500/20 active:scale-95"
        >
          <Plus size={18} strokeWidth={2.5} />
          O'quvchi qo'shish
        </button>
        <ManagerAddStudentModal 
          classId={classId} 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            onRefresh();
          }} 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-50/50">
      <div className="p-5 flex justify-end">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[13px] rounded-full transition-all duration-300 shadow-md shadow-amber-500/20 active:scale-95"
        >
          <Plus size={16} strokeWidth={2.5} />
          Yangi o'quvchi
        </button>
      </div>

      <div className="px-5 pb-6">
        <div className="flex flex-col gap-3">
          {students.map((student) => (
            <div 
              key={student.uid} 
              className="flex items-center justify-between p-4 bg-white border border-slate-200/60 rounded-[1.25rem] hover:shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:border-slate-300 transition-all duration-300 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-black text-[16px] shadow-sm shadow-indigo-500/20 shrink-0">
                  {student.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-[15px] font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {student.displayName}
                  </h4>
                  <p className="text-[13px] font-medium text-slate-500 mt-0.5">
                    @{student.username}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg">
                  <span className="text-[13px] font-black">{student.totalXP}</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest opacity-80">XP</span>
                </div>
                
                <button
                  onClick={() => handleRemoveStudent(student.uid, student.displayName)}
                  disabled={removingUid === student.uid}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors duration-300 disabled:opacity-50"
                  title="Guruhdan o'chirish"
                >
                  {removingUid === student.uid ? (
                    <Loader2 size={18} className="animate-spin text-red-500" />
                  ) : (
                    <Trash2 size={18} strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ManagerAddStudentModal 
        classId={classId} 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          setIsModalOpen(false);
          onRefresh();
        }} 
      />
    </div>
  );
}
