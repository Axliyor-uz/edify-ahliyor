"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { CalendarCheck, Clock, ArrowLeft, Loader2, Users, DoorOpen, Pencil, CalendarX2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import AttendanceTab from "./_components/AttendanceTab";

const DAY_LABEL = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface ScheduleEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId?: string;
  roomName?: string;
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
  const [missing, setMissing] = useState(false); // bad classId → branded 404
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
        if (!snap.exists()) { setMissing(true); return; } // → not-found boundary

        const data = { id: snap.id, ...snap.data() } as AttendanceClassDocument;

        // The class must belong to this center: its teacher has to be a member
        // (same check as the group detail page — URLs must not leak other centers' classes).
        const membershipSnap = await getDoc(doc(db, "center_teachers", data.teacherId));
        if (!membershipSnap.exists() || membershipSnap.data().centerId !== profile.centerId) {
          setMissing(true);
          return;
        }

        setClassData(data);
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

  if (missing) notFound(); // renders app/manager/not-found.tsx
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
          <div className="p-4 sm:p-5">
            {/* Read-only view — editing lives on the group page (single source of truth). */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-[13px] text-slate-500">
                Dars jadvali va xonalar shu yerda ko&apos;rsatiladi. Tahrirlash guruh sahifasida.
              </p>
              <Link
                href={`/manager/groups/${classData.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-[12.5px] font-bold transition-colors shrink-0"
              >
                <Pencil size={14} /> Jadvalni tahrirlash
              </Link>
            </div>

            {(classData.schedule?.length || 0) === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3"><CalendarX2 size={26} /></div>
                <h3 className="text-sm font-semibold text-slate-700">Jadval belgilanmagan</h3>
                <p className="text-[13px] text-slate-500 mt-1.5 max-w-[320px]">Bu guruh uchun hali dars jadvali kiritilmagan. Guruh sahifasida qo&apos;shing.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[...(classData.schedule || [])]
                  .sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek))
                  .map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-bold text-slate-900">{DAY_LABEL[s.dayOfWeek]}</p>
                        <p className="text-[12.5px] text-slate-500 tabular-nums mt-0.5">{s.startTime}–{s.endTime}</p>
                      </div>
                      {s.roomName ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[12px] font-semibold shrink-0">
                          <DoorOpen size={13} /> {s.roomName}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-slate-400 shrink-0">Xona belgilanmagan</span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
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
