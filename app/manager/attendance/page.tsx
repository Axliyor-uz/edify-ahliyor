"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Users, Clock, Loader2, CalendarCheck, CalendarX2, ArrowRight, GraduationCap, LayoutGrid, UserCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses, ClassData } from "@/hooks/useCenterClasses";
import WalkInCheckIn from "./_components/WalkInCheckIn";

type Schedule = { dayOfWeek: number; startTime: string; endTime: string }[];

const DAY_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"]; // index = getDay()
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun display order

// MD3-ish tonal themes; each card gets one deterministically so the grid feels alive.
const THEMES = [
  { avatar: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500", dayOn: "bg-indigo-100 text-indigo-700", dayToday: "bg-indigo-600 text-white", badge: "bg-indigo-50 text-indigo-700", hoverBorder: "hover:border-indigo-200", arrow: "group-hover:bg-indigo-600" },
  { avatar: "bg-violet-100 text-violet-700", bar: "bg-violet-500", dayOn: "bg-violet-100 text-violet-700", dayToday: "bg-violet-600 text-white", badge: "bg-violet-50 text-violet-700", hoverBorder: "hover:border-violet-200", arrow: "group-hover:bg-violet-600" },
  { avatar: "bg-teal-100 text-teal-700", bar: "bg-teal-500", dayOn: "bg-teal-100 text-teal-700", dayToday: "bg-teal-600 text-white", badge: "bg-teal-50 text-teal-700", hoverBorder: "hover:border-teal-200", arrow: "group-hover:bg-teal-600" },
  { avatar: "bg-amber-100 text-amber-700", bar: "bg-amber-500", dayOn: "bg-amber-100 text-amber-700", dayToday: "bg-amber-500 text-white", badge: "bg-amber-50 text-amber-700", hoverBorder: "hover:border-amber-200", arrow: "group-hover:bg-amber-500" },
  { avatar: "bg-rose-100 text-rose-700", bar: "bg-rose-500", dayOn: "bg-rose-100 text-rose-700", dayToday: "bg-rose-600 text-white", badge: "bg-rose-50 text-rose-700", hoverBorder: "hover:border-rose-200", arrow: "group-hover:bg-rose-600" },
  { avatar: "bg-sky-100 text-sky-700", bar: "bg-sky-500", dayOn: "bg-sky-100 text-sky-700", dayToday: "bg-sky-600 text-white", badge: "bg-sky-50 text-sky-700", hoverBorder: "hover:border-sky-200", arrow: "group-hover:bg-sky-600" },
  { avatar: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", dayOn: "bg-emerald-100 text-emerald-700", dayToday: "bg-emerald-600 text-white", badge: "bg-emerald-50 text-emerald-700", hoverBorder: "hover:border-emerald-200", arrow: "group-hover:bg-emerald-600" },
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

type Tab = "groups" | "walkin";

export default function AttendancePage() {
  const { user } = useAuth();
  const [centerId, setCenterId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("groups");

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((profile) => {
      if (profile?.centerId) setCenterId(profile.centerId);
    });
  }, [user]);

  const { classes, isLoading } = useCenterClasses(centerId);
  const todayWeekday = useMemo(() => new Date().getDay(), []);

  const totalStudents = useMemo(
    () => classes.reduce((sum, c) => sum + (c.studentIds?.length || 0), 0),
    [classes]
  );
  const meetingToday = useMemo(
    () => classes.filter((c) => c.schedule?.some((s) => s.dayOfWeek === todayWeekday)).length,
    [classes, todayWeekday]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Davomat</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tab === "groups" ? "Guruh tanlang va davomatni belgilang" : "O'quvchini toping va bugungi darslarga belgilang"}
          </p>
        </div>
        {!isLoading && classes.length > 0 && tab === "groups" && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600">
              <CalendarCheck size={14} className="text-slate-400" /> {classes.length} guruh
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600">
              <Users size={14} className="text-slate-400" /> {totalStudents} o&apos;quvchi
            </span>
            {meetingToday > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-[12px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Bugun {meetingToday} ta dars
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl">
        {([
          { id: "groups" as Tab, label: "Guruhlar", Icon: LayoutGrid },
          { id: "walkin" as Tab, label: "Tez davomat", Icon: UserCheck },
        ]).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
                active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <t.Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Walk-in (front-desk) check-in ── */}
      {tab === "walkin" && (
        isLoading || !centerId || !user ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-slate-400" size={32} />
          </div>
        ) : (
          <WalkInCheckIn centerId={centerId} classes={classes} markedBy={user.uid} />
        )
      )}

      {/* Loading */}
      {tab === "groups" && isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      )}

      {/* Empty */}
      {tab === "groups" && !isLoading && classes.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-4">
            <CalendarX2 size={28} />
          </div>
          <h3 className="text-[15px] font-semibold text-slate-800">Guruhlar yo&apos;q</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-[260px]">
            Markazingizga hali hech qanday guruh qo&apos;shilmagan.
          </p>
        </div>
      )}

      {/* Class Grid */}
      {tab === "groups" && !isLoading && classes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} todayWeekday={todayWeekday} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls, todayWeekday }: { cls: ClassData & { schedule?: Schedule }; todayWeekday: number }) {
  const schedule = cls.schedule || [];
  const theme = themeFor(cls.id);
  const scheduledDays = new Set(schedule.map((s) => s.dayOfWeek));
  const todayEntry = schedule.find((s) => s.dayOfWeek === todayWeekday);

  return (
    <Link
      href={`/manager/attendance/${cls.id}`}
      className={`group relative block bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden ${theme.hoverBorder}`}
    >
      {/* Accent bar */}
      <div className={`h-1.5 ${theme.bar}`} />

      <div className="p-5">
        {/* Header: avatar + title + teacher */}
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

          {/* Today badge */}
          {todayEntry && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${theme.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${theme.bar}`} /> Bugun
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Users size={15} className="text-slate-400" />
            <span className="text-[13px] font-semibold tabular-nums">{cls.studentIds?.length || 0}</span>
            <span className="text-[12px] text-slate-400">o&apos;quvchi</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <GraduationCap size={15} className="text-slate-400" />
            <span className="text-[13px] font-semibold tabular-nums">{schedule.length}</span>
            <span className="text-[12px] text-slate-400">dars/hafta</span>
          </div>
        </div>

        {/* Week strip */}
        <div className="flex items-center gap-1 mt-4">
          {WEEK_ORDER.map((dow) => {
            const on = scheduledDays.has(dow);
            const isToday = dow === todayWeekday;
            return (
              <span
                key={dow}
                className={`flex-1 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-colors ${
                  on ? (isToday ? theme.dayToday : theme.dayOn) : "bg-slate-50 text-slate-300"
                }`}
              >
                {DAY_SHORT[dow]}
              </span>
            );
          })}
        </div>

        {/* Footer: time + CTA */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
            <Clock size={13} className="text-slate-400" />
            {todayEntry ? (
              <span className="tabular-nums">Bugun {todayEntry.startTime}–{todayEntry.endTime}</span>
            ) : schedule.length > 0 ? (
              <span className="tabular-nums">{schedule[0].startTime}–{schedule[0].endTime}</span>
            ) : (
              <span className="text-slate-400">Jadval yo&apos;q</span>
            )}
          </span>
          <span className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 transition-colors group-hover:text-white ${theme.arrow}`}>
            <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}
