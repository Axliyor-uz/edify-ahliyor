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
      <div className="flex flex-col items-center justify-center p-10 sm:p-16 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4">
          <FileText size={28} />
        </div>
        <h3 className="text-[15px] font-bold text-slate-800">Topshiriqlar yo'q</h3>
        <p className="text-[13px] text-slate-500 mt-1 max-w-[280px]">
          O'qituvchi guruhga test biriktirganda, ular shu yerda ko'rinadi.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5">
      <div className="space-y-2.5">
        {assignments.map((assignment) => {
          const isLate = assignment.dueAt && new Date() > new Date(assignment.dueAt.seconds * 1000);

          return (
            <div key={assignment.id} className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors">
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 text-sm truncate">{assignment.testTitle || "Nomsiz test"}</h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-slate-400" />
                    Berilgan: {assignment.createdAt?.toDate ? assignment.createdAt.toDate().toLocaleDateString('uz-UZ') : "Noma'lum"}
                  </span>
                  {assignment.dueAt ? (
                    <span className={`flex items-center gap-1 ${isLate ? "text-rose-500" : ""}`}>
                      <Clock size={13} />
                      Muddat: {assignment.dueAt.toDate().toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Clock size={13} /> Muddatsiz
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                  assignment.status === "active"
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  {assignment.status === "active" ? "Faol" : assignment.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
