"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { Users, Activity, Settings, ArrowLeft, DoorOpen, CalendarDays, Copy } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { ScheduleEntry } from "@/types/attendance";

import ManagerRosterTab from "./_components/ManagerRosterTab";
import ManagerOversightTab from "./_components/ManagerOversightTab";
import ManagerSettingsTab from "./_components/ManagerSettingsTab";
import ScheduleTab from "./_components/ScheduleTab";

const DAY_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface ClassDocument {
  id: string;
  title: string;
  description: string;
  joinCode: string;
  teacherId: string;
  teacherName: string;
  studentIds: string[];
  studentCount: number;
  isLocked: boolean;
  createdAt: any;
  schedule?: ScheduleEntry[];
}

type TabKey = "roster" | "schedule" | "oversight" | "settings";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "roster", label: "O'quvchilar", icon: Users },
  { key: "schedule", label: "Jadval", icon: CalendarDays },
  { key: "oversight", label: "Nazorat", icon: Activity },
  { key: "settings", label: "Sozlamalar", icon: Settings },
];

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const { user } = useAuth() as any;

  const [managerCenterId, setManagerCenterId] = useState<string | null>(null);
  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false); // bad classId → branded 404
  const [activeTab, setActiveTab] = useState<TabKey>("roster");

  // silent: refresh data without tearing the page down (keeps modals/tabs mounted)
  const loadData = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const profile = await getUserProfile(user.uid);
      if (!profile?.centerId) throw new Error("Manager centerId topilmadi.");
      setManagerCenterId(profile.centerId);

      const classRef = doc(db, "classes", classId);
      const classSnap = await getDoc(classRef);
      if (!classSnap.exists()) { setMissing(true); return; } // → not-found boundary

      const data = { id: classSnap.id, ...classSnap.data() } as ClassDocument;

      const ctQuery = query(
        collection(db, "center_teachers"),
        where("centerId", "==", profile.centerId),
        where("teacherId", "==", data.teacherId)
      );
      const ctSnap = await getDocs(ctQuery);
      if (ctSnap.empty) throw new Error("Sizda bu guruhni ko'rish huquqi yo'q.");

      setClassData(data);
    } catch (err: any) {
      console.error("Error loading group details:", err);
      toast.error(err.message || "Xatolik yuz berdi");
      router.push("/manager/groups");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !classId) return;
    loadData();
  }, [user, classId, router]);

  const handleCopyCode = () => {
    if (!classData) return;
    navigator.clipboard.writeText(classData.joinCode);
    toast.success("Kod nusxalandi!");
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-4 w-40 bg-slate-200 rounded" />
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="h-6 w-1/2 bg-slate-200 rounded" />
          <div className="h-4 w-1/3 bg-slate-100 rounded" />
          <div className="h-4 w-2/3 bg-slate-100 rounded" />
        </div>
        <div className="h-14 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-white border border-slate-200 rounded-2xl" />
      </div>
    );
  }

  if (missing) notFound(); // renders app/manager/not-found.tsx
  if (!classData) return null;

  return (
    <div className="space-y-5">
      {/* Back Button & Header */}
      <div>
        <Link
          href="/manager/groups"
          className="inline-flex items-center gap-2 text-[13px] font-bold text-slate-500 hover:text-amber-600 mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> Guruhlar ro'yxatiga qaytish
        </Link>
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                {classData.title}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                O'qituvchi: <span className="font-semibold text-slate-700">{classData.teacherName}</span>
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              title="Kirish kodini nusxalash"
              className="self-start flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shrink-0"
            >
              <span className="text-[11px] font-semibold text-slate-400">Kod:</span>
              <span className="text-[13px] font-mono font-bold text-slate-800 tracking-widest">{classData.joinCode}</span>
              <Copy size={13} className="text-slate-400 ml-0.5" />
            </button>
          </div>

          {/* Schedule + room summary */}
          {classData.schedule && classData.schedule.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {[...classData.schedule]
                .sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek))
                .map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <span className="font-bold text-slate-700">{DAY_SHORT[s.dayOfWeek]}</span>
                    <span className="text-slate-400 tabular-nums">{s.startTime}</span>
                    {s.roomName && (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold border-l border-slate-200 pl-1.5">
                        <DoorOpen size={11} /> {s.roomName}
                      </span>
                    )}
                  </span>
                ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-slate-400 mt-3 flex items-center gap-1.5"><CalendarDays size={13} /> Jadval belgilanmagan</p>
          )}
        </div>
      </div>

      {/* Segmented tabs — all 4 always visible, no horizontal scroll */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-2xl">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1 rounded-xl text-[11px] sm:text-[13px] font-bold transition-all ${
                isActive
                  ? "bg-white text-amber-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate max-w-full">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm min-h-[400px] overflow-hidden">
        {activeTab === "roster" && managerCenterId && (
          <ManagerRosterTab
            classId={classData.id}
            centerId={managerCenterId}
            studentIds={classData.studentIds}
            onRefresh={() => loadData({ silent: true })}
          />
        )}
        {activeTab === "schedule" && managerCenterId && (
          <ScheduleTab
            classId={classData.id}
            centerId={managerCenterId}
            teacherId={classData.teacherId}
            studentCount={classData.studentIds?.length || 0}
            currentSchedule={classData.schedule || []}
            onUpdate={(newSchedule) => setClassData((prev) => prev ? { ...prev, schedule: newSchedule } : null)}
          />
        )}
        {activeTab === "oversight" && <ManagerOversightTab classId={classData.id} />}
        {activeTab === "settings" && managerCenterId && (
          <ManagerSettingsTab
            classData={classData}
            centerId={managerCenterId}
            onUpdate={(updatedFields) => setClassData(prev => prev ? { ...prev, ...updatedFields } : null)}
          />
        )}
      </div>
    </div>
  );
}
