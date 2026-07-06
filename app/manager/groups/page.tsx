"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Users, Copy, Search, Lock, ChevronRight, CalendarX2, SearchX } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses, ClassData } from "@/hooks/useCenterClasses";
import toast from "react-hot-toast";
import CreateGroupModal from "./_components/CreateGroupModal";
import { useRouter } from "next/navigation";

export default function GroupsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [centerId, setCenterId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(
      (c) =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.teacherName || "").toLowerCase().includes(q)
    );
  }, [classes, search]);

  const openGroup = (id: string) => router.push(`/manager/groups/${id}`);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Guruhlar</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {!isLoading && classes.length > 0
              ? `${classes.length} ta guruh · ${totalStudents} ta o'quvchi`
              : "Markazdagi barcha sinflar va guruhlar"}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all shadow-sm shadow-amber-500/25 active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={2.5} /> Yangi guruh
        </button>
      </div>

      {/* Search */}
      {!isLoading && classes.length > 0 && (
        <div className="relative sm:max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Guruh yoki o'qituvchi qidirish..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition-all"
          />
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
        <>
          <div className="sm:hidden bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden animate-pulse">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-10 h-10 bg-slate-200 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-slate-200 rounded-xl" />
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
            ))}
          </div>
        </>
      )}

      {/* Empty */}
      {!isLoading && classes.length === 0 && !error && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 sm:p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4">
            <CalendarX2 size={28} />
          </div>
          <h3 className="text-[15px] font-bold text-slate-800">Guruhlar topilmadi</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-[280px]">
            Markazingizda hali guruh yaratilmagan. O&apos;qituvchi qo&apos;shib, yangi guruh yarating.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[13px] rounded-xl transition-colors active:scale-[0.98]"
          >
            <Plus size={16} /> Yangi guruh
          </button>
        </div>
      )}

      {/* No search results */}
      {!isLoading && classes.length > 0 && filtered.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <SearchX size={24} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">
            &quot;{search}&quot; bo&apos;yicha guruh topilmadi
          </p>
        </div>
      )}

      {/* Mobile: compact rows */}
      {!isLoading && filtered.length > 0 && (
        <div className="sm:hidden bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {filtered.map((cls) => (
            <GroupRow key={cls.id} cls={cls} onOpen={() => openGroup(cls.id)} />
          ))}
        </div>
      )}

      {/* Desktop: cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="hidden sm:grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((cls) => (
            <GroupCard key={cls.id} cls={cls} onOpen={() => openGroup(cls.id)} onCopy={handleCopyCode} />
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

function Avatar({ title }: { title: string }) {
  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[15px] shrink-0">
      {(title || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function GroupRow({ cls, onOpen }: { cls: ClassData; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 transition-colors"
    >
      <Avatar title={cls.title} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[15px] font-bold text-slate-900 truncate">{cls.title}</h3>
          {cls.isLocked && <Lock size={13} className="text-rose-400 shrink-0" />}
        </div>
        <p className="text-[13px] text-slate-500 truncate mt-0.5">
          {cls.teacherName || "O'qituvchi yo'q"} · {cls.studentIds?.length || 0} o&apos;quvchi
        </p>
      </div>
      <ChevronRight size={18} className="text-slate-300 shrink-0" />
    </button>
  );
}

function GroupCard({ cls, onOpen, onCopy }: { cls: ClassData; onOpen: () => void; onCopy: (code: string) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-amber-200 hover:shadow-md transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar title={cls.title} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold text-slate-900 tracking-tight truncate">{cls.title}</h3>
          <p className="text-[13px] text-slate-500 truncate mt-0.5">{cls.teacherName || "O'qituvchi yo'q"}</p>
        </div>

        {cls.isLocked ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 shrink-0">
            <Lock size={11} /> Qulflangan
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Faol
          </span>
        )}
      </div>

      {/* Footer: students + join code */}
      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Users size={15} className="text-slate-400" />
          <span className="text-[13px] font-semibold tabular-nums">{cls.studentIds?.length || 0}</span>
          <span className="text-xs text-slate-400">o&apos;quvchi</span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onCopy(cls.joinCode); }}
          title="Kirish kodini nusxalash"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors group/code"
        >
          <span className="text-[11px] font-semibold text-slate-400">Kod:</span>
          <span className="text-xs font-mono font-bold text-slate-700 tracking-widest">{cls.joinCode}</span>
          <Copy size={12} className="text-slate-300 group-hover/code:text-slate-500 ml-0.5" />
        </button>
      </div>
    </div>
  );
}
