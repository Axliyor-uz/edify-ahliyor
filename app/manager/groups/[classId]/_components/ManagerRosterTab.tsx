"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import { Users, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import ManagerAddStudentModal from "./ManagerAddStudentModal";
import ConfirmDialog from "@/app/manager/_components/ConfirmDialog";
import SearchInput from "@/app/manager/_components/SearchInput";

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
          <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
            <div className="w-10 h-10 bg-slate-200 rounded-full shrink-0" />
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
      <div className="py-14 px-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
          <Users size={22} />
        </div>
        <p className="text-sm font-bold text-slate-800 mt-3">Guruh bo&apos;sh</p>
        <p className="text-[13px] text-slate-400 mt-1">Birinchi o&apos;quvchini qo&apos;shing</p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-5 inline-flex items-center gap-1.5 pl-4 pr-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-full transition-all shadow-sm shadow-brand-600/25 active:scale-[0.98]"
        >
          <Plus size={16} />
          O&apos;quvchi qo&apos;shish
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
      <div className="p-4 sm:p-5 flex flex-wrap gap-3 items-center justify-between border-b border-slate-100">
        {students.length > 8 ? (
          <SearchInput value={search} onChange={setSearch} placeholder="O'quvchini qidiring..." />
        ) : (
          <p className="text-[13px] text-slate-500">{students.length} ta o&apos;quvchi</p>
        )}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-1.5 pl-4 pr-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-[13px] rounded-full transition-all shadow-sm shadow-brand-600/25 active:scale-[0.98] shrink-0"
        >
          <Plus size={16} />
          O&apos;quvchi qo&apos;shish
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <p className="text-sm font-bold text-slate-800">Hech narsa topilmadi</p>
          <p className="text-[13px] text-slate-400 mt-1">Qidiruvni o&apos;zgartirib ko&apos;ring</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map((student) => (
            <div
              key={student.uid}
              className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-brand-25 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-[14px] shrink-0">
                {student.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[14.5px] font-semibold text-slate-900 truncate">
                  {student.displayName}
                </h4>
                <p className="text-[12.5px] text-slate-500 truncate mt-0.5">
                  @{student.username}
                </p>
              </div>

              <span className="px-2.5 py-1 bg-brand-50 text-brand-800 rounded-full text-[11px] font-bold tabular-nums shrink-0">
                {student.totalXP} XP
              </span>

              <button
                onClick={() => setStudentToRemove(student)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
                title="Guruhdan o'chirish"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

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
