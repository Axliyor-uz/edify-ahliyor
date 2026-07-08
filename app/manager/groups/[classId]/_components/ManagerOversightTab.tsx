"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { FileText, Calendar, Clock } from "lucide-react";

interface Assignment {
  id: string;
  testTitle: string;
  createdAt: any;
  dueAt: any;
  status: string;
}

export default function ManagerOversightTab({ classId }: { classId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchAssignments() {
      setLoading(true);
      try {
        const q = query(
          collection(db, `classes/${classId}/assignments`),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Assignment[];

        if (isMounted) setAssignments(data);
      } catch (err) {
        console.error("Error fetching assignments:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAssignments();
    return () => { isMounted = false; };
  }, [classId]);

  if (loading) {
    return (
      <div className="p-4 sm:p-5 space-y-3 animate-pulse">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="p-4 bg-slate-50 rounded-xl space-y-2.5">
            <div className="h-4 bg-slate-200 rounded w-1/2" />
            <div className="h-3 bg-slate-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="py-14 px-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
          <FileText size={22} />
        </div>
        <p className="text-sm font-bold text-slate-800 mt-3">Topshiriqlar yo&apos;q</p>
        <p className="text-[13px] text-slate-400 mt-1 max-w-[280px] mx-auto">
          O&apos;qituvchi test berganda shu yerda ko&apos;rinadi
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {assignments.map((assignment) => {
        const isLate = assignment.dueAt && new Date() > new Date(assignment.dueAt.seconds * 1000);

        return (
          <div key={assignment.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-brand-25 transition-colors">
            <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <FileText size={18} strokeWidth={2.1} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[14.5px] font-semibold text-slate-900 truncate">{assignment.testTitle || "Nomsiz test"}</h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-[12.5px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-slate-400" />
                  {assignment.createdAt?.toDate ? assignment.createdAt.toDate().toLocaleDateString('uz-UZ') : "Noma'lum"}
                </span>
                {assignment.dueAt ? (
                  <span className={`flex items-center gap-1 ${isLate ? "text-rose-500 font-semibold" : ""}`}>
                    <Clock size={12} />
                    Muddat: {assignment.dueAt.toDate().toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> Muddatsiz
                  </span>
                )}
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
              assignment.status === "active"
                ? "bg-brand-100 text-brand-800"
                : "bg-slate-100 text-slate-500"
            }`}>
              {assignment.status === "active" ? "Faol" : assignment.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}
