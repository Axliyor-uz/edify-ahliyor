"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import { Loader2, Users, Plus, Trash2, Search, SearchX } from "lucide-react";
import toast from "react-hot-toast";
import ManagerAddStudentModal from "./ManagerAddStudentModal";
import ConfirmDialog from "@/app/manager/_components/ConfirmDialog";

interface RosterProps {
  classId: string;
  centerId: string;
  studentIds: string[];
  onRefresh: () => void;
}

interface StudentProfile {
  uid: string;
  displayName: string;
  username: string;
  totalXP: number;
}

export default function ManagerRosterTab({ classId, centerId, studentIds, onRefresh }: RosterProps) {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [studentToRemove, setStudentToRemove] = useState<StudentProfile | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace("@", "");
    if (!q) return students;
    return students.filter(
      (s) => s.displayName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)
    );
  }, [students, search]);

  const handleRemoveStudent = async () => {
    if (!studentToRemove) return;
    setIsRemoving(true);
    try {
      const classRef = doc(db, "classes", classId);
      await updateDoc(classRef, { studentIds: arrayRemove(studentToRemove.uid) });
      toast.success(`${studentToRemove.displayName} guruhdan o'chirildi.`);
      setStudentToRemove(null);
      onRefresh();
    } catch (err) {
      console.error("Error removing student:", err);
      toast.error("O'quvchini o'chirishda xatolik yuz berdi.");
    } finally {
      setIsRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-5 space-y-3 animate-pulse">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
            <div className="w-11 h-11 bg-slate-200 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 sm:p-16 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-5">
          <Users size={30} />
        </div>
        <h3 className="text-[17px] font-bold text-slate-900 tracking-tight">Guruh bo'sh</h3>
        <p className="text-sm text-slate-500 mt-2 mb-6 max-w-sm leading-relaxed">
          Ushbu guruhga hali o'quvchilar qo'shilmagan. O'quvchilarni qo'shish uchun quyidagi tugmani bosing.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all shadow-sm shadow-amber-500/25 active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={2.5} />
          O'quvchi qo'shish
        </button>
        {isModalOpen && (
          <ManagerAddStudentModal
            classId={classId}
            centerId={centerId}
            existingStudentIds={studentIds || []}
            onClose={() => setIsModalOpen(false)}
            onAdded={onRefresh}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-b border-slate-100">
        {students.length > 8 ? (
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="O'quvchi qidirish..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all"
            />
          </div>
        ) : (
          <p className="text-[13px] font-semibold text-slate-500">
            {students.length} ta o'quvchi
          </p>
        )}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[13px] rounded-xl transition-all shadow-sm shadow-amber-500/25 active:scale-[0.98] shrink-0"
        >
          <Plus size={16} strokeWidth={2.5} />
          Yangi o'quvchi
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <SearchX size={22} className="text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-500">&quot;{search}&quot; bo&apos;yicha o&apos;quvchi topilmadi</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((student) => (
              <div
                key={student.uid}
                className="flex items-center gap-3 p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[15px] shrink-0">
                  {student.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {student.displayName}
                  </h4>
                  <p className="text-[13px] text-slate-500 truncate mt-0.5">
                    @{student.username}
                  </p>
                </div>

                <span className="text-[13px] font-bold text-amber-600 tabular-nums shrink-0">
                  {student.totalXP} <span className="text-[10px] font-semibold uppercase">XP</span>
                </span>

                <button
                  onClick={() => setStudentToRemove(student)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors shrink-0"
                  title="Guruhdan o'chirish"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <ManagerAddStudentModal
          classId={classId}
          centerId={centerId}
          existingStudentIds={studentIds || []}
          onClose={() => setIsModalOpen(false)}
          onAdded={onRefresh}
        />
      )}

      {studentToRemove && (
        <ConfirmDialog
          title="O'quvchini o'chirish"
          message={`${studentToRemove.displayName} guruhdan o'chiriladi. Uni keyinchalik qayta qo'shishingiz mumkin.`}
          confirmLabel="O'chirish"
          isLoading={isRemoving}
          onConfirm={handleRemoveStudent}
          onClose={() => setStudentToRemove(null)}
        />
      )}
    </div>
  );
}
