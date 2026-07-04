"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { Loader2, FileText, Calendar, Clock } from "lucide-react";

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
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
          <FileText size={32} />
        </div>
        <h3 className="text-[15px] font-bold text-slate-700">Topshiriqlar yo'q</h3>
        <p className="text-[13px] text-slate-500 mt-1">Guruhga hali testlar biriktirilmagan.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-3">
        {assignments.map((assignment) => {
          const isLate = assignment.dueAt && new Date() > new Date(assignment.dueAt.seconds * 1000);

          return (
            <div key={assignment.id} className="p-5 bg-white border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-slate-300 transition-colors">
              <div>
                <h4 className="font-black text-slate-800 text-[15px]">{assignment.testTitle}</h4>
                <div className="flex items-center gap-3 mt-1.5 text-[12px] font-bold text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} className="text-slate-400" /> 
                    Berilgan: {assignment.createdAt?.toDate ? assignment.createdAt.toDate().toLocaleDateString('uz-UZ') : "Noma'lum"}
                  </span>
                  {assignment.dueAt ? (
                    <span className={`flex items-center gap-1 ${isLate ? "text-red-500" : ""}`}>
                      <Clock size={14} /> 
                      Muddat: {assignment.dueAt.toDate().toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Clock size={14} /> Muddatsiz
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest ${
                  assignment.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500 border border-slate-200"
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
