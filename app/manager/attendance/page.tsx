"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CalendarCheck, Users, Clock, Loader2, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses, ClassData } from "@/hooks/useCenterClasses";

const DAY_NAMES_SHORT = ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"];

function getScheduleSummary(schedule?: { dayOfWeek: number; startTime: string; endTime: string }[]): string {
  if (!schedule || schedule.length === 0) return "Jadval yo'q";
  const sorted = [...schedule].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return sorted.map((s) => DAY_NAMES_SHORT[s.dayOfWeek]).join(", ");
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [centerId, setCenterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((profile) => {
      if (profile?.centerId) setCenterId(profile.centerId);
    });
  }, [user]);

  const { classes, isLoading } = useCenterClasses(centerId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[22px] md:text-2xl font-semibold text-slate-900 tracking-tight">
          Davomat
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Guruhlar bo&apos;yicha davomat va dars jadvalini boshqaring
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      )}

      {/* Empty */}
      {!isLoading && classes.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
            <CalendarCheck size={26} />
          </div>
          <h3 className="text-[15px] font-semibold text-slate-800">Guruhlar yo&apos;q</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-[260px]">
            Markazingizga hali hech qanday guruh qo&apos;shilmagan.
          </p>
        </div>
      )}

      {/* Class Grid */}
      {!isLoading && classes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls }: { cls: ClassData & { schedule?: { dayOfWeek: number; startTime: string; endTime: string }[] } }) {
  const schedule = cls.schedule;
  const scheduleSummary = getScheduleSummary(schedule);

  return (
    <Link
      href={`/manager/attendance/${cls.id}`}
      className="group block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
    >
      {/* Title + Teacher */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight truncate">
            {cls.title}
          </h3>
          <p className="text-[13px] text-slate-500 mt-0.5 truncate">
            {cls.teacherName}
          </p>
        </div>
        <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-700 transition-colors">
          <ChevronRight size={18} />
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100 my-4" />

      {/* Stats Row */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Users size={15} className="text-slate-400" />
          <span className="text-[13px] font-medium">{cls.studentIds?.length || 0} o&apos;quvchi</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
          <Clock size={15} className="text-slate-400 shrink-0" />
          <span className="text-[13px] font-medium truncate">{scheduleSummary}</span>
        </div>
      </div>

      {/* Schedule Preview Chips */}
      {schedule && schedule.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {[...schedule].sort((a, b) => a.dayOfWeek - b.dayOfWeek).slice(0, 4).map((s, i) => (
            <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-medium tabular-nums">
              {DAY_NAMES_SHORT[s.dayOfWeek]} · {s.startTime}
            </span>
          ))}
          {schedule.length > 4 && (
            <span className="px-2.5 py-1 bg-slate-50 text-slate-400 rounded-md text-[11px] font-medium">
              +{schedule.length - 4}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
