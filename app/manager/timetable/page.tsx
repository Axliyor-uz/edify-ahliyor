"use client";

import { useState, useEffect, useMemo } from "react";
import { CalendarDays, Loader2, DoorOpen, AlertTriangle, User, Clock, X, Plus, Pencil, Search, Users2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { useCenterRooms } from "@/hooks/useCenterRooms";
import { overlaps } from "@/services/roomService";
import { roomTheme } from "@/lib/roomColors";
import type { ScheduleEntry } from "@/types/attendance";
import ScheduleTab from "@/app/manager/groups/[classId]/_components/ScheduleTab";

const DAYS = [
  { dayOfWeek: 1, label: "Dushanba", short: "Du" },
  { dayOfWeek: 2, label: "Seshanba", short: "Se" },
  { dayOfWeek: 3, label: "Chorshanba", short: "Ch" },
  { dayOfWeek: 4, label: "Payshanba", short: "Pa" },
  { dayOfWeek: 5, label: "Juma", short: "Ju" },
  { dayOfWeek: 6, label: "Shanba", short: "Sh" },
  { dayOfWeek: 0, label: "Yakshanba", short: "Ya" },
];

interface Booking {
  classId: string; title: string; teacherId: string; teacherName: string;
  dayOfWeek: number; startTime: string; endTime: string; roomId?: string; roomName?: string;
}
const bookingKey = (b: Booking) => `${b.classId}|${b.dayOfWeek}|${b.startTime}|${b.endTime}`;

// One color per GROUP (not per room) — the same group reads as the same color
// in every cell, so managers can spot a group across the whole week at a glance.
const GROUP_THEMES = [
  { cell: "bg-indigo-50 border-indigo-200 text-indigo-900", dot: "bg-indigo-500" },
  { cell: "bg-violet-50 border-violet-200 text-violet-900", dot: "bg-violet-500" },
  { cell: "bg-teal-50 border-teal-200 text-teal-900", dot: "bg-teal-500" },
  { cell: "bg-amber-50 border-amber-200 text-amber-900", dot: "bg-amber-500" },
  { cell: "bg-rose-50 border-rose-200 text-rose-900", dot: "bg-rose-500" },
  { cell: "bg-sky-50 border-sky-200 text-sky-900", dot: "bg-sky-500" },
  { cell: "bg-emerald-50 border-emerald-200 text-emerald-900", dot: "bg-emerald-500" },
  { cell: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900", dot: "bg-fuchsia-500" },
];
function groupTheme(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GROUP_THEMES[h % GROUP_THEMES.length];
}

// Uniform column sizing — every day column is identical, cells share a min height.
const DAY_COL = "w-[170px] min-w-[170px]";
const ROOM_COL = "w-[180px] min-w-[180px]";
const CELL_MIN_H = "min-h-[76px]";

export default function TimetablePage() {
  const { user } = useAuth();
  const [centerId, setCenterId] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<number | "all">("all");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");

  // Editor drawer state.
  const [editing, setEditing] = useState<string | null>(null);          // classId being edited
  const [prefill, setPrefill] = useState<{ dayOfWeek: number; roomId?: string } | undefined>(undefined);
  const [picking, setPicking] = useState<{ dayOfWeek: number; roomId?: string } | null>(null); // empty-cell → choose group
  const [pickSearch, setPickSearch] = useState("");
  // Optimistic schedule overrides so a saved edit moves on the grid instantly.
  const [overrides, setOverrides] = useState<Record<string, ScheduleEntry[]>>({});

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { classes, teachers, isLoading: loadingClasses, refetch } = useCenterClasses(centerId);
  const { rooms, isLoading: loadingRooms } = useCenterRooms(centerId);
  const loading = loadingClasses || loadingRooms;

  const effectiveClasses = useMemo(
    () => classes.map((c) => (overrides[c.id] ? { ...c, schedule: overrides[c.id] } : c)),
    [classes, overrides]
  );

  const openEditor = (classId: string, pf?: { dayOfWeek: number; roomId?: string }) => {
    setPrefill(pf); setPicking(null); setEditing(classId);
  };
  const openPicker = (roomId: string, dayOfWeek: number) => {
    setEditing(null); setPrefill(undefined); setPickSearch(""); setPicking({ dayOfWeek, roomId });
  };
  const closeDrawer = () => { setEditing(null); setPicking(null); setPrefill(undefined); setPickSearch(""); };

  const handleSaved = (classId: string, newSchedule: ScheduleEntry[]) => {
    setOverrides((o) => ({ ...o, [classId]: newSchedule }));
    closeDrawer();
    refetch().then(() => setOverrides((o) => { const n = { ...o }; delete n[classId]; return n; }));
  };

  // Esc closes the drawer.
  useEffect(() => {
    if (!editing && !picking) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, picking]);

  const allBookings = useMemo<Booking[]>(() =>
    effectiveClasses.flatMap((c) => (c.schedule || []).map((s) => ({
      classId: c.id, title: c.title, teacherId: c.teacherId, teacherName: c.teacherName,
      dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, roomId: s.roomId, roomName: s.roomName,
    }))),
  [effectiveClasses]);

  const bookings = useMemo(
    () => allBookings.filter((b) => teacherFilter === "all" || b.teacherId === teacherFilter),
    [allBookings, teacherFilter]
  );

  // Flag room double-bookings (same room + day + overlapping time).
  const roomClashKeys = useMemo(() => {
    const flagged = new Set<string>();
    const byRoomDay = new Map<string, Booking[]>();
    for (const b of allBookings) {
      if (!b.roomId) continue;
      const k = `${b.roomId}|${b.dayOfWeek}`;
      (byRoomDay.get(k) || byRoomDay.set(k, []).get(k)!).push(b);
    }
    byRoomDay.forEach((list) => {
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++)
          if (overlaps(list[i].startTime, list[i].endTime, list[j].startTime, list[j].endTime)) {
            flagged.add(bookingKey(list[i])); flagged.add(bookingKey(list[j]));
          }
    });
    return flagged;
  }, [allBookings]);

  // Count teacher double-bookings (same teacher + day + overlap, any room).
  const teacherClashCount = useMemo(() => {
    let count = 0;
    const byTeacherDay = new Map<string, Booking[]>();
    for (const b of allBookings) {
      const k = `${b.teacherId}|${b.dayOfWeek}`;
      (byTeacherDay.get(k) || byTeacherDay.set(k, []).get(k)!).push(b);
    }
    byTeacherDay.forEach((list) => {
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++)
          if (overlaps(list[i].startTime, list[i].endTime, list[j].startTime, list[j].endTime)) count++;
    });
    return count;
  }, [allBookings]);

  const days = dayFilter === "all" ? DAYS : DAYS.filter((d) => d.dayOfWeek === dayFilter);
  const hasUnassigned = bookings.some((b) => !b.roomId);
  const todayWeekday = useMemo(() => new Date().getDay(), []);

  const cellBookings = (roomId: string | null, dayOfWeek: number) =>
    bookings
      .filter((b) => (roomId === null ? !b.roomId : b.roomId === roomId) && b.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const renderChip = (b: Booking) => {
    const clash = roomClashKeys.has(bookingKey(b));
    const gt = groupTheme(b.classId);
    return (
      <button key={bookingKey(b)} type="button" onClick={() => openEditor(b.classId)}
        title="Tahrirlash — vaqt va xonani o'zgartirish"
        className={`group/chip w-full rounded-xl px-2 py-1.5 border text-left transition-all hover:shadow-md hover:-translate-y-px cursor-pointer ${
          clash ? "bg-rose-50 border-rose-300 text-rose-900 hover:border-rose-400" : `${gt.cell} hover:brightness-[0.97]`
        }`}>
        <div className="flex items-center gap-1 text-[10.5px] font-bold tabular-nums opacity-80">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${clash ? "bg-rose-500" : gt.dot}`} />
          <Clock size={9} /> {b.startTime}–{b.endTime}
          {clash ? <AlertTriangle size={10} className="text-rose-500 ml-auto" /> : <Pencil size={9} className="ml-auto opacity-0 group-hover/chip:opacity-70 transition-opacity" />}
        </div>
        <p className="text-[12px] font-bold leading-tight truncate mt-0.5">{b.title}</p>
        <p className="text-[10.5px] opacity-70 truncate flex items-center gap-0.5"><User size={9} /> {b.teacherName}</p>
      </button>
    );
  };

  const roomRows = rooms; // ordered by orderIndex

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CalendarDays className="text-amber-500" size={24} /> Haftalik jadval
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Qaysi xonada, qachon, qaysi guruh va o&apos;qituvchi</p>
          </div>
          {teacherClashCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-xl text-[12px] font-semibold">
              <AlertTriangle size={14} /> {teacherClashCount} o&apos;qituvchi ziddiyati
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <button onClick={() => setDayFilter("all")} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${dayFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Hafta</button>
          {DAYS.map((d) => (
            <button key={d.dayOfWeek} onClick={() => setDayFilter(d.dayOfWeek)} className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${dayFilter === d.dayOfWeek ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{d.short}</button>
          ))}
        </div>
        <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:border-amber-400 cursor-pointer">
          <option value="all">Barcha o&apos;qituvchilar</option>
          {teachers.map((t) => <option key={t.teacherId} value={t.teacherId}>{t.teacherName}</option>)}
        </select>
      </div>

      {/* Group color legend — same color everywhere on the grid; click = edit that group */}
      {!loading && effectiveClasses.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {effectiveClasses.map((c) => {
            const gt = groupTheme(c.id);
            return (
              <button key={c.id} type="button" onClick={() => openEditor(c.id)}
                title={`${c.title} — jadvalini tahrirlash`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11.5px] font-bold transition-all hover:shadow-sm ${gt.cell}`}>
                <span className={`w-2 h-2 rounded-full ${gt.dot}`} /> {c.title}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-slate-400" size={30} /></div>
      ) : rooms.length === 0 && !hasUnassigned ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4"><CalendarDays size={28} /></div>
          <h3 className="text-[15px] font-semibold text-slate-800">Jadval bo&apos;sh</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-[300px]">Xonalar yarating va guruh jadvalida ularni biriktiring.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-auto [scrollbar-width:thin]">
          <table className="border-separate border-spacing-0 w-full table-fixed">
            <thead>
              <tr>
                <th className={`sticky left-0 top-0 z-30 bg-slate-900 text-left px-3 py-3 ${ROOM_COL} border-r border-slate-700`}>
                  <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-400">
                    <DoorOpen size={13} /> Xona
                  </span>
                </th>
                {days.map((d) => {
                  const isToday = d.dayOfWeek === todayWeekday;
                  return (
                    <th key={d.dayOfWeek}
                      className={`sticky top-0 z-20 px-2 py-2.5 ${DAY_COL} border-l border-white/10 ${isToday ? "bg-amber-500" : "bg-slate-800"}`}>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-[12.5px] font-bold ${isToday ? "text-white" : "text-slate-100"}`}>{d.label}</span>
                        {isToday
                          ? <span className="text-[9px] font-black uppercase tracking-widest text-amber-100">Bugun</span>
                          : <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">{d.short}</span>}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roomRows.map((room) => {
                const th = roomTheme(room.color);
                return (
                  <tr key={room.id} className="align-top">
                    <td className={`sticky left-0 z-10 bg-white border-b border-r border-slate-200 px-3 py-2.5 ${ROOM_COL}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-1 h-9 rounded-full shrink-0 ${th.bar}`} />
                        <div className="min-w-0">
                          <p className={`text-[13px] font-bold text-slate-900 truncate ${!room.isActive ? "opacity-50" : ""}`}>{room.name}</p>
                          <p className="text-[10.5px] text-slate-400">{room.capacity} o&apos;rin</p>
                        </div>
                      </div>
                    </td>
                    {days.map((d) => {
                      const cell = cellBookings(room.id, d.dayOfWeek);
                      const isToday = d.dayOfWeek === todayWeekday;
                      return (
                        <td key={d.dayOfWeek} className={`group/cell border-b border-l border-slate-100 px-1.5 py-1.5 ${DAY_COL} align-top ${isToday ? "bg-amber-50/50" : ""}`}>
                          <div className={`flex flex-col gap-1 ${CELL_MIN_H}`}>
                            {cell.map(renderChip)}
                            <button type="button" onClick={() => openPicker(room.id, d.dayOfWeek)}
                              title="Bu xona va kunga guruh qo'shish"
                              className={`w-full rounded-xl border border-dashed border-slate-200 text-slate-400 flex items-center justify-center gap-1 text-[11px] font-semibold transition-all hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/40 ${
                                cell.length === 0 ? "flex-1 min-h-[40px] opacity-60" : "py-1 opacity-0 group-hover/cell:opacity-100"
                              }`}>
                              <Plus size={13} /> {cell.length === 0 ? "Qo'shish" : ""}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Unassigned bookings row */}
              {hasUnassigned && (
                <tr className="align-top">
                  <td className={`sticky left-0 z-10 bg-amber-50/70 border-b border-r border-slate-200 px-3 py-2.5 ${ROOM_COL}`}>
                    <div className="flex items-center gap-2">
                      <DoorOpen size={14} className="text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-amber-700">Biriktirilmagan</p>
                        <p className="text-[10px] text-amber-600/70">xona tanlanmagan</p>
                      </div>
                    </div>
                  </td>
                  {days.map((d) => {
                    const cell = cellBookings(null, d.dayOfWeek);
                    return (
                      <td key={d.dayOfWeek} className={`border-b border-l border-slate-100 px-1.5 py-1.5 ${DAY_COL} align-top bg-amber-50/20`}>
                        <div className={`flex flex-col gap-1 ${CELL_MIN_H}`}>
                          {cell.map((b) => {
                            const gt = groupTheme(b.classId);
                            return (
                              <button key={bookingKey(b)} type="button" onClick={() => openEditor(b.classId)}
                                title="Xona biriktirish uchun bosing"
                                className={`group/chip w-full rounded-xl px-2 py-1.5 border border-dashed text-left transition-all hover:shadow-md hover:-translate-y-px cursor-pointer ${gt.cell}`}>
                                <div className="flex items-center gap-1 text-[10.5px] font-bold tabular-nums opacity-80">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${gt.dot}`} />
                                  <Clock size={9} /> {b.startTime}–{b.endTime}
                                  <DoorOpen size={10} className="ml-auto opacity-0 group-hover/chip:opacity-70 transition-opacity" />
                                </div>
                                <p className="text-[12px] font-bold leading-tight truncate mt-0.5">{b.title}</p>
                                <p className="text-[10.5px] opacity-70 truncate flex items-center gap-0.5"><User size={9} /> {b.teacherName}</p>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Editor drawer: reuses the group's ScheduleTab ── */}
      {(editing || picking) && (() => {
        const editingClass = editing ? effectiveClasses.find((c) => c.id === editing) : null;
        const ctx = picking || prefill;
        const ctxRoom = ctx?.roomId ? rooms.find((r) => r.id === ctx.roomId) : undefined;
        const ctxDay = ctx ? DAYS.find((d) => d.dayOfWeek === ctx.dayOfWeek) : undefined;
        const pickList = picking
          ? effectiveClasses.filter((c) => {
              const q = pickSearch.trim().toLowerCase();
              if (!q) return true;
              return c.title.toLowerCase().includes(q) || (c.teacherName || "").toLowerCase().includes(q);
            })
          : [];
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={closeDrawer} />
            <div className={`relative w-full ${picking ? "sm:max-w-md" : "sm:max-w-3xl"} bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-[dialogIn_.18s_ease-out]`}>
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-slate-200 shrink-0">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-[15px] font-bold text-slate-900 truncate">
                    {editingClass && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${groupTheme(editingClass.id).dot}`} />}
                    {picking ? "Guruh tanlang" : editingClass?.title || "Jadval"}
                  </h3>
                  <p className="text-[12px] text-slate-500 truncate">
                    {ctxDay || ctxRoom ? (
                      <span className="inline-flex items-center gap-1.5">
                        {ctxDay && <span className="font-semibold text-slate-600">{ctxDay.label}</span>}
                        {ctxRoom && <span className="inline-flex items-center gap-1 text-indigo-600 font-semibold"><DoorOpen size={12} /> {ctxRoom.name}</span>}
                      </span>
                    ) : (
                      "Vaqt va xonani tahrirlang"
                    )}
                  </p>
                </div>
                <button onClick={closeDrawer} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"><X size={18} /></button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
                {picking ? (
                  <div className="p-4">
                    <div className="relative mb-3">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} autoFocus
                        placeholder="Guruh yoki o'qituvchi..."
                        className="w-full pl-9 pr-3 py-2.5 text-[14px] bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-400" />
                    </div>
                    <div className="space-y-1.5">
                      {pickList.length === 0 ? (
                        <p className="py-8 text-center text-[13px] text-slate-400">Guruh topilmadi</p>
                      ) : pickList.map((c) => (
                        <button key={c.id} onClick={() => openEditor(c.id, picking!)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-left hover:border-amber-300 hover:shadow-sm transition-all">
                          <span className="w-9 h-9 shrink-0 rounded-xl bg-amber-100 text-amber-700 font-bold text-[13px] flex items-center justify-center">
                            {(c.title || "?").charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-bold text-slate-900 truncate">{c.title}</p>
                            <p className="text-[11.5px] text-slate-400 truncate">{c.teacherName || "O'qituvchi yo'q"}</p>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            <Users2 size={12} /> {c.studentIds?.length || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : editingClass ? (
                  <ScheduleTab
                    key={editingClass.id}
                    classId={editingClass.id}
                    centerId={centerId || ""}
                    teacherId={editingClass.teacherId}
                    studentCount={editingClass.studentIds?.length || 0}
                    currentSchedule={editingClass.schedule || []}
                    autoEdit
                    prefill={prefill}
                    onUpdate={(newSchedule) => handleSaved(editingClass.id, newSchedule)}
                  />
                ) : null}
              </div>
            </div>
          </div>
        );
      })()}

      <style jsx global>{`
        @keyframes dialogIn { from { transform: translateY(16px) scale(.98); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
}
