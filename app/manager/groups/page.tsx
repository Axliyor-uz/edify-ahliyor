"use client";

import { useState, useEffect } from "react";
import { Layers, Plus, Users, Hash, Copy, Loader2, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses, ClassData } from "@/hooks/useCenterClasses";
import toast from "react-hot-toast";
import CreateGroupModal from "./_components/CreateGroupModal";
import { useRouter } from "next/navigation";

export default function GroupsPage() {
  const { user } = useAuth() as any;
  const router = useRouter();
  const [centerId, setCenterId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch manager's centerId
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

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-[28px] font-black text-slate-900 tracking-tight leading-tight">
            Guruhlar
          </h1>
          <p className="text-[14px] font-medium text-slate-500 mt-1">
            Markazdagi barcha sinflar va guruhlar
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 active:scale-95"
        >
          <Plus size={18} strokeWidth={2.5} />
          Yangi guruh
        </button>
      </div>

      {/* Stats Bar */}
      {!isLoading && classes.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
            <Layers size={16} className="text-amber-500" />
            <span className="text-[13px] font-bold text-slate-700">{classes.length} ta guruh</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
            <Users size={16} className="text-indigo-500" />
            <span className="text-[13px] font-bold text-slate-700">
              {classes.reduce((sum, c) => sum + (c.studentIds?.length || 0), 0)} ta o'quvchi
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-[14px] font-medium">
          {error}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Guruh nomi</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">O'qituvchi</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">O'quvchilar</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Kirish kodi</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">

              {isLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-200 rounded-xl shrink-0"></div>
                        <div className="h-4 bg-slate-200 rounded w-36"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                  </tr>
                ))
              ) : classes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                        <BookOpen size={32} />
                      </div>
                      <h3 className="text-[15px] font-bold text-slate-700">Guruhlar topilmadi</h3>
                      <p className="text-[13px] text-slate-500 mt-1 max-w-[280px]">
                        Markazingizda hali guruh yaratilmagan. O'qituvchi qo'shib, yangi guruh yarating.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                classes.map((cls) => (
                  <tr 
                    key={cls.id} 
                    onClick={() => router.push(`/manager/groups/${cls.id}`)}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  >
                    {/* Group Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0 border border-amber-100 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-colors">
                          <Layers size={16} strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[14px] font-bold text-slate-900 group-hover:text-amber-600 transition-colors block truncate max-w-[200px]">
                            {cls.title}
                          </span>
                          {cls.description && (
                            <span className="text-[11px] font-medium text-slate-400 truncate block max-w-[200px]">
                              {cls.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Teacher */}
                    <td className="px-6 py-4">
                      <span className="text-[13px] font-medium text-slate-600">
                        {cls.teacherName || "Noma'lum"}
                      </span>
                    </td>

                    {/* Student Count */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-slate-400" />
                        <span className="text-[13px] font-bold text-slate-700">
                          {cls.studentIds?.length || 0}
                        </span>
                      </div>
                    </td>

                    {/* Join Code */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleCopyCode(cls.joinCode)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-lg transition-colors group/code"
                        title="Nusxalash uchun bosing"
                      >
                        <Hash size={12} className="text-slate-400 group-hover/code:text-amber-500" />
                        <span className="text-[12px] font-mono font-black text-slate-700 tracking-widest group-hover/code:text-amber-600">
                          {cls.joinCode}
                        </span>
                        <Copy size={12} className="text-slate-300 group-hover/code:text-amber-500 ml-0.5" />
                      </button>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {cls.isLocked ? (
                        <span className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[11px] font-black uppercase tracking-widest">
                          Qulflangan
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[11px] font-black uppercase tracking-widest">
                          Faol
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>
      </div>

      {/* Create Group Modal */}
      {isModalOpen && centerId && (
        <CreateGroupModal
          centerId={centerId}
          teachers={teachers}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            refetch();
          }}
        />
      )}

    </div>
  );
}
