"use client";

import { useState, useEffect } from "react";
import { Layers, Plus, Users, Hash, Copy, CalendarX2, Lock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses, ClassData } from "@/hooks/useCenterClasses";
import toast from "react-hot-toast";
import CreateGroupModal from "./_components/CreateGroupModal";
import { useRouter } from "next/navigation";

// MD3-ish tonal themes; each card gets one deterministically so the grid feels alive.
const THEMES = [
  { avatar: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500", hoverBorder: "hover:border-indigo-200" },
  { avatar: "bg-violet-100 text-violet-700", bar: "bg-violet-500", hoverBorder: "hover:border-violet-200" },
  { avatar: "bg-teal-100 text-teal-700", bar: "bg-teal-500", hoverBorder: "hover:border-teal-200" },
  { avatar: "bg-amber-100 text-amber-700", bar: "bg-amber-500", hoverBorder: "hover:border-amber-200" },
  { avatar: "bg-rose-100 text-rose-700", bar: "bg-rose-500", hoverBorder: "hover:border-rose-200" },
  { avatar: "bg-sky-100 text-sky-700", bar: "bg-sky-500", hoverBorder: "hover:border-sky-200" },
  { avatar: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", hoverBorder: "hover:border-emerald-200" },
];

function themeFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return THEMES[h % THEMES.length];
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function GroupsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [centerId, setCenterId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((profile) => {
      if (profile?.centerId) setCenterId(profile.centerId);
    }).catch((err) => console.error("Profile error:", err));
  }, [user]);

  const { classes, teachers, isLoading, error, refetch } = useCenterClasses(centerId);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Kod nusxalandi!");
  };

  const totalStudents = classes.reduce((sum, c) => sum + (c.studentIds?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Guruhlar</h1>
          <p className="text-sm text-slate-500 mt-0.5">Markazdagi barcha sinflar va guruhlar</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm shadow-indigo-600/25 active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={2.5} /> Yangi guruh
        </button>
      </div>

      {/* Stats */}
      {!isLoading && classes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600">
            <Layers size={14} className="text-slate-400" /> {classes.length} ta guruh
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600">
            <Users size={14} className="text-slate-400" /> {totalStudents} ta o&apos;quvchi
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-3xl overflow-hidden animate-pulse">
              <div className="h-1.5 bg-slate-200" />
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-200 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-px bg-slate-100 my-4" />
                <div className="flex justify-between">
                  <div className="h-3 bg-slate-100 rounded w-20" />
                  <div className="h-6 bg-slate-100 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && classes.length === 0 && !error && (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-4">
            <CalendarX2 size={28} />
          </div>
          <h3 className="text-[15px] font-semibold text-slate-800">Guruhlar topilmadi</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-[280px]">
            Markazingizda hali guruh yaratilmagan. O&apos;qituvchi qo&apos;shib, yangi guruh yarating.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[13px] rounded-xl transition-colors active:scale-[0.98]"
          >
            <Plus size={16} /> Yangi guruh
          </button>
        </div>
      )}

      {/* Grid */}
      {!isLoading && classes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {classes.map((cls) => (
            <GroupCard key={cls.id} cls={cls} onOpen={() => router.push(`/manager/groups/${cls.id}`)} onCopy={handleCopyCode} />
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {isModalOpen && centerId && (
        <CreateGroupModal
          centerId={centerId}
          teachers={teachers}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); refetch(); }}
        />
      )}
    </div>
  );
}

function GroupCard({ cls, onOpen, onCopy }: { cls: ClassData; onOpen: () => void; onCopy: (code: string) => void }) {
  const theme = themeFor(cls.id);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className={`group relative bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${theme.hoverBorder}`}
    >
      {/* Accent bar */}
      <div className={`h-1.5 ${theme.bar}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[18px] font-black shrink-0 ${theme.avatar}`}>
            {(cls.title || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-bold text-slate-900 tracking-tight truncate">{cls.title}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold flex items-center justify-center shrink-0">
                {getInitials(cls.teacherName)}
              </span>
              <span className="text-[12.5px] font-medium text-slate-600 truncate">{cls.teacherName || "O'qituvchi yo'q"}</span>
            </div>
          </div>

          {/* Status */}
          {cls.isLocked ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 shrink-0">
              <Lock size={11} /> Qulf
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Faol
            </span>
          )}
        </div>

        {/* Description */}
        {cls.description && (
          <p className="text-[12.5px] text-slate-500 mt-3 line-clamp-2">{cls.description}</p>
        )}

        {/* Footer: students + join code */}
        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Users size={15} className="text-slate-400" />
            <span className="text-[13px] font-semibold tabular-nums">{cls.studentIds?.length || 0}</span>
            <span className="text-[12px] text-slate-400">o&apos;quvchi</span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onCopy(cls.joinCode); }}
            title="Nusxalash uchun bosing"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors group/code"
          >
            <Hash size={12} className="text-slate-400" />
            <span className="text-[12px] font-mono font-bold text-slate-700 tracking-widest">{cls.joinCode}</span>
            <Copy size={12} className="text-slate-300 group-hover/code:text-slate-500 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
