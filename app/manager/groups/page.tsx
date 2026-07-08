"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Users, Copy, Lock, ChevronRight, CalendarX2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses, ClassData } from "@/hooks/useCenterClasses";
import toast from "react-hot-toast";
import CreateGroupModal from "./_components/CreateGroupModal";
import SearchInput from "../_components/SearchInput";
import FilterSelect from "../_components/FilterSelect";
import { useRouter } from "next/navigation";

export default function GroupsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [centerId, setCenterId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

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

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) if (c.teacherId && !map.has(c.teacherId)) map.set(c.teacherId, c.teacherName);
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [classes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classes.filter((c) => {
      if (teacherFilter && c.teacherId !== teacherFilter) return false;
      if (q && !(c.title || "").toLowerCase().includes(q) && !(c.teacherName || "").toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [classes, search, teacherFilter]);

  const hasFilters = search.trim() !== "" || teacherFilter !== "";
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
              : "Markazdagi barcha guruhlar"}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-1.5 pl-4 pr-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-full transition-all shadow-sm shadow-brand-600/25 active:scale-[0.98]"
        >
          <Plus size={16} /> Yangi guruh
        </button>
      </div>

      {/* Search + teacher filter */}
      {!isLoading && classes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Guruh yoki o'qituvchini qidiring..." />
          {teacherOptions.length > 1 && (
            <FilterSelect
              value={teacherFilter}
              onChange={setTeacherFilter}
              options={teacherOptions}
              allLabel="Barcha o'qituvchilar"
            />
          )}
          {hasFilters && (
            <p className="text-[12.5px] text-slate-500 ml-auto">{filtered.length} ta guruh</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-3xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <>
          <div className="sm:hidden bg-white border border-brand-line rounded-3xl divide-y divide-slate-100 overflow-hidden animate-pulse">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-10 h-10 bg-slate-200 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-white border border-brand-line rounded-3xl p-5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-slate-200 rounded-full" />
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
        <div className="bg-white border border-brand-line rounded-3xl py-14 px-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
            <CalendarX2 size={22} />
          </div>
          <p className="text-sm font-bold text-slate-800 mt-3">Hali guruhlar yo&apos;q</p>
          <p className="text-[13px] text-slate-400 mt-1 max-w-[280px] mx-auto">
            Birinchi guruhni yarating — o&apos;qituvchi va o&apos;quvchilarni keyin qo&apos;shasiz.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-5 inline-flex items-center gap-1.5 pl-4 pr-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-[13px] rounded-full transition-colors active:scale-[0.98]"
          >
            <Plus size={16} /> Yangi guruh
          </button>
        </div>
      )}

      {/* No search results */}
      {!isLoading && classes.length > 0 && filtered.length === 0 && (
        <div className="bg-white border border-brand-line rounded-3xl py-12 px-6 text-center">
          <p className="text-sm font-bold text-slate-800">Hech narsa topilmadi</p>
          <p className="text-[13px] text-slate-400 mt-1">Filtr yoki qidiruvni o&apos;zgartirib ko&apos;ring</p>
        </div>
      )}

      {/* Mobile: compact rows */}
      {!isLoading && filtered.length > 0 && (
        <div className="sm:hidden bg-white border border-brand-line rounded-3xl divide-y divide-slate-100 overflow-hidden">
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
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-[15px] shrink-0">
      {(title || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function GroupRow({ cls, onOpen }: { cls: ClassData; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-brand-25 active:bg-brand-25 transition-colors"
    >
      <Avatar title={cls.title} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[14.5px] font-semibold text-slate-900 truncate">{cls.title}</h3>
          {cls.isLocked && <Lock size={13} className="text-rose-400 shrink-0" />}
        </div>
        <p className="text-[12.5px] text-slate-500 truncate mt-0.5">
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
      className="group bg-white rounded-3xl border border-brand-line p-5 hover:shadow-md hover:shadow-slate-200/60 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar title={cls.title} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-semibold text-slate-900 tracking-tight truncate group-hover:text-brand-800 transition-colors">
            {cls.title}
          </h3>
          <p className="text-[12.5px] text-slate-500 truncate mt-0.5">{cls.teacherName || "O'qituvchi yo'q"}</p>
        </div>

        {cls.isLocked ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 shrink-0">
            <Lock size={11} /> Qulflangan
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-100 text-brand-800 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-600" /> Faol
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
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-brand-50 border border-brand-line rounded-full transition-colors group/code"
        >
          <span className="text-xs font-mono font-bold text-slate-700 tracking-widest">{cls.joinCode}</span>
          <Copy size={12} className="text-slate-300 group-hover/code:text-brand-700" />
        </button>
      </div>
    </div>
  );
}
