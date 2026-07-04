"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { Users, Activity, Settings, Hash, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

import ManagerRosterTab from "./_components/ManagerRosterTab";
import ManagerOversightTab from "./_components/ManagerOversightTab";
import ManagerSettingsTab from "./_components/ManagerSettingsTab";

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
  schedule?: { dayOfWeek: number; startTime: string; endTime: string }[];
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const { user } = useAuth() as any;
  
  const [managerCenterId, setManagerCenterId] = useState<string | null>(null);
  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"roster" | "oversight" | "settings">("roster");

  const loadData = async () => {
    try {
      setLoading(true);
      const profile = await getUserProfile(user.uid);
      if (!profile?.centerId) throw new Error("Manager centerId topilmadi.");
      setManagerCenterId(profile.centerId);

      const classRef = doc(db, "classes", classId);
      const classSnap = await getDoc(classRef);
      if (!classSnap.exists()) throw new Error("Guruh topilmadi.");
      
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !classId) return;
    loadData();
  }, [user, classId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!classData) return null;

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div>
        <Link 
          href="/manager/groups"
          className="inline-flex items-center gap-2 text-[13px] font-bold text-slate-500 hover:text-amber-600 mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> Guruhlar ro'yxatiga qaytish
        </Link>
        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-[28px] font-black text-slate-900 tracking-tight leading-tight">
              {classData.title}
            </h1>
            <p className="text-[14px] font-medium text-slate-500 mt-1">
              O'qituvchi: <span className="font-bold text-slate-700">{classData.teacherName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Kirish kodi</span>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg mt-1">
                  <Hash size={14} className="text-slate-400" />
                  <span className="text-[14px] font-mono font-black text-slate-800 tracking-widest">{classData.joinCode}</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
        <button
          onClick={() => setActiveTab("roster")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[13px] transition-all shrink-0 ${
            activeTab === "roster"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Users size={16} /> O'quvchilar
        </button>
        <button
          onClick={() => setActiveTab("oversight")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[13px] transition-all shrink-0 ${
            activeTab === "oversight"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Activity size={16} /> O'zlashtirish
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[13px] transition-all shrink-0 ${
            activeTab === "settings"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Settings size={16} /> Sozlamalar
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm min-h-[400px] overflow-hidden">
        {activeTab === "roster" && <ManagerRosterTab classId={classData.id} studentIds={classData.studentIds} onRefresh={loadData} />}
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
