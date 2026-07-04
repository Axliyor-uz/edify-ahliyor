"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { CalendarCheck, Clock, ArrowLeft, Loader2, Users } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import ScheduleTab from "./_components/ScheduleTab";
import AttendanceTab from "./_components/AttendanceTab";

export interface ScheduleEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface AttendanceClassDocument {
  id: string;
  title: string;
  teacherName: string;
  teacherId: string;
  studentIds: string[];
  schedule?: ScheduleEntry[];
  joinCode: string;
  centerId?: string;
}

export default function AttendanceClassPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const { user } = useAuth();

  const [classData, setClassData] = useState<AttendanceClassDocument | null>(null);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"schedule" | "attendance">("attendance");

  useEffect(() => {
    if (!user || !classId) return;

    const load = async () => {
      try {
        setLoading(true);
        const profile = await getUserProfile(user.uid);
        if (!profile?.centerId) throw new Error("Manager centerId topilmadi.");
        setCenterId(profile.centerId);

        const snap = await getDoc(doc(db, "classes", classId));
        if (!snap.exists()) throw new Error("Guruh topilmadi.");

        setClassData({ id: snap.id, ...snap.data() } as AttendanceClassDocument);
      } catch (err) {
        toast.error((err as Error)?.message || "Xatolik yuz berdi.");
        router.push("/manager/attendance");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, classId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!classData) return null;

  return (
    <div className="space-y-3">
      {/* Back */}
      <Link
        href="/manager/attendance"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft size={14} /> Davomatlarga qaytish
      </Link>

      {/* Compact header row: title + stats */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight truncate">
            {classData.title}
          </h1>
          <p className="text-[12px] text-slate-500 truncate">
            O&apos;qituvchi: <span className="font-medium text-slate-700">{classData.teacherName}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <CalendarCheck size={14} className="text-slate-400" />
            <span className="text-[12px] font-semibold text-slate-700 whitespace-nowrap tabular-nums">
              {classData.schedule?.length || 0} dars
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <Users size={14} className="text-slate-400" />
            <span className="text-[12px] font-semibold text-slate-700 whitespace-nowrap tabular-nums">
              {classData.studentIds?.length || 0} o&apos;quvchi
            </span>
          </div>
        </div>
      </div>

      {/* Tabs — clearly differentiable (filled active pill) */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
        <button
          onClick={() => setActiveTab("attendance")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-semibold text-[13px] transition-all ${
            activeTab === "attendance"
              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
              : "text-slate-500 hover:text-slate-900 hover:bg-white/70"
          }`}
        >
          <CalendarCheck size={15} /> Davomat
        </button>
        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-semibold text-[13px] transition-all ${
            activeTab === "schedule"
              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
              : "text-slate-500 hover:text-slate-900 hover:bg-white/70"
          }`}
        >
          <Clock size={15} /> Dars Jadvali
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm min-h-[400px] overflow-hidden">
        {activeTab === "schedule" && (
          <ScheduleTab
            classId={classData.id}
            currentSchedule={classData.schedule || []}
            onUpdate={(newSchedule) =>
              setClassData((prev) => prev ? { ...prev, schedule: newSchedule } : null)
            }
          />
        )}
        {activeTab === "attendance" && centerId && (
          <AttendanceTab
            classId={classData.id}
            centerId={centerId}
            studentIds={classData.studentIds || []}
            managerId={user?.uid || ""}
            schedule={classData.schedule || []}
          />
        )}
      </div>
    </div>
  );
}
