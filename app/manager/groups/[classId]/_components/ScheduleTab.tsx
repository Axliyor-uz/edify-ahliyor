"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import {
  Save, Loader2, Clock, CalendarDays, Edit3, CalendarX2, Hourglass,
  Trash2, Sunrise, Sunset, ArrowRight, Check, Sparkles, DoorOpen, AlertTriangle, Wand2, User,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ScheduleEntry } from "@/types/attendance";
import { useCenterRooms } from "@/hooks/useCenterRooms";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { findScheduleConflicts } from "@/services/roomService";
import { roomTheme } from "@/lib/roomColors";

interface Props {
  classId: string;
  centerId: string;
  teacherId: string;
  studentCount: number;
  currentSchedule: ScheduleEntry[];
  onUpdate: (newSchedule: ScheduleEntry[]) => void;
  /** Open straight in edit mode (used when embedded in the timetable drawer). */
  autoEdit?: boolean;
  /** Pre-enable a day (and optionally assign a room) — for scheduling into an empty timetable cell. */
  prefill?: { dayOfWeek: number; roomId?: string };
}

const DAYS = [
  { label: "Dushanba", dayOfWeek: 1, short: "Du" },
  { label: "Seshanba", dayOfWeek: 2, short: "Se" },
  { label: "Chorshanba", dayOfWeek: 3, short: "Ch" },
  { label: "Payshanba", dayOfWeek: 4, short: "Pa" },
  { label: "Juma", dayOfWeek: 5, short: "Ju" },
  { label: "Shanba", dayOfWeek: 6, short: "Sh" },
  { label: "Yakshanba", dayOfWeek: 0, short: "Ya" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const sortSchedule = (schedule: ScheduleEntry[]) => {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return [...schedule].sort((a, b) => order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek));
};

const isWeekend = (dayOfWeek: number) => dayOfWeek === 0 || dayOfWeek === 6;

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Compact Uzbek duration, or null if the range is invalid (end <= start).
const formatDuration = (start: string, end: string) => {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  if (diff <= 0) return null;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h && m) return `${h} soat ${m} daqiqa`;
  if (h) return `${h} soat`;
  return `${m} daqiqa`;
};

type DayState = { enabled: boolean; startTime: string; endTime: string; roomId?: string };

function buildInitialState(
  schedule: ScheduleEntry[],
  prefill?: { dayOfWeek: number; roomId?: string }
): Record<number, DayState> {
  const uniform = detectUniform(schedule);
  const state: Record<number, DayState> = {};
  for (const d of DAYS) {
    const existing = schedule.find((s) => s.dayOfWeek === d.dayOfWeek);
    state[d.dayOfWeek] = {
      enabled: !!existing,
      startTime: existing?.startTime || "14:00",
      endTime: existing?.endTime || "15:30",
      roomId: existing?.roomId,
    };
  }
  // Scheduling into an empty timetable cell: turn on that day (inheriting the
  // group's uniform time when it has one) and assign the clicked room.
  if (prefill && state[prefill.dayOfWeek]) {
    const cur = state[prefill.dayOfWeek];
    state[prefill.dayOfWeek] = {
      enabled: true,
      startTime: cur.enabled ? cur.startTime : uniform.uniStart,
      endTime: cur.enabled ? cur.endTime : uniform.uniEnd,
      roomId: prefill.roomId ?? cur.roomId,
    };
  }
  return state;
}

// Do all saved lessons share one time? Then we can edit them together.
function detectUniform(schedule: ScheduleEntry[]) {
  if (schedule.length === 0) return { sameTime: true, uniStart: "14:00", uniEnd: "15:30" };
  const first = schedule[0];
  const same = schedule.every((s) => s.startTime === first.startTime && s.endTime === first.endTime);
  return { sameTime: same, uniStart: first.startTime, uniEnd: first.endTime };
}

// Do all saved lessons use one room? Then one picker can drive them all.
function detectUniformRoom(schedule: ScheduleEntry[]) {
  if (schedule.length === 0) return { sameRoom: true, uniRoom: "" };
  const first = schedule[0].roomId || "";
  const same = schedule.every((s) => (s.roomId || "") === first);
  return { sameRoom: same, uniRoom: first };
}

const PRESETS = [
  { label: "Toq kunlar", days: [1, 3, 5] },
  { label: "Juft kunlar", days: [2, 4, 6] },
  { label: "Har kuni", days: [1, 2, 3, 4, 5, 6] },
];

// 24-hour time picker (hour + minute dropdowns) — no AM/PM.
function TimeSelect({
  icon: Icon, tone, label, value, onChange, invalid,
}: {
  icon: React.ElementType; tone: string; label: string;
  value: string; onChange: (v: string) => void; invalid?: boolean;
}) {
  const h = (value.split(":")[0] || "00").padStart(2, "0");
  const m = (value.split(":")[1] || "00").padStart(2, "0");
  const minutes = MINUTES.includes(m) ? MINUTES : [m, ...MINUTES];

  const selectCls =
    "appearance-none bg-transparent outline-none cursor-pointer text-center text-[16px] font-bold text-slate-800 tabular-nums";

  return (
    <div className="flex-1 min-w-0">
      <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">{label}</span>
      <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 bg-white transition-colors ${
        invalid ? "border-rose-300" : "border-slate-200 focus-within:border-brand-600"
      }`}>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={16} />
        </span>
        <div className="flex items-center gap-0.5">
          <select value={h} onChange={(e) => onChange(`${e.target.value}:${m}`)} aria-label={`${label} soat`} className={selectCls}>
            {HOURS.map((hh) => <option key={hh} value={hh}>{hh}</option>)}
          </select>
          <span className="text-[16px] font-bold text-slate-300">:</span>
          <select value={m} onChange={(e) => onChange(`${h}:${e.target.value}`)} aria-label={`${label} daqiqa`} className={selectCls}>
            {minutes.map((mm) => <option key={mm} value={mm}>{mm}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

export default function ScheduleTab({ classId, centerId, teacherId, studentCount, currentSchedule, onUpdate, autoEdit, prefill }: Props) {
  const initUniform = useMemo(() => detectUniform(currentSchedule), [currentSchedule]);
  const initRoom = useMemo(() => detectUniformRoom(currentSchedule), [currentSchedule]);

  const { rooms } = useCenterRooms(centerId);
  const { classes } = useCenterClasses(centerId);
  const activeRooms = useMemo(() => rooms.filter((r) => r.isActive), [rooms]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const [isEditing, setIsEditing] = useState(currentSchedule.length === 0 || !!autoEdit);
  const [dayStates, setDayStates] = useState<Record<number, DayState>>(() => buildInitialState(currentSchedule, prefill));
  const [sameTime, setSameTime] = useState(initUniform.sameTime);
  const [uniStart, setUniStart] = useState(initUniform.uniStart);
  const [uniEnd, setUniEnd] = useState(initUniform.uniEnd);
  // When scheduling into a specific room via prefill, keep per-day rooms so we
  // don't overwrite the group's other rooms with one uniform pick.
  const [sameRoom, setSameRoom] = useState(prefill?.roomId ? false : initRoom.sameRoom);
  const [uniRoom, setUniRoom] = useState(initRoom.uniRoom);
  const [isSaving, setIsSaving] = useState(false);

  const enabledDays = DAYS.filter((d) => dayStates[d.dayOfWeek].enabled);

  const setDayRoom = (dayOfWeek: number, roomId: string) => {
    setDayStates((prev) => ({ ...prev, [dayOfWeek]: { ...prev[dayOfWeek], roomId: roomId || undefined } }));
  };

  // The schedule the user is currently building — used for both conflict checks and save.
  const proposed: ScheduleEntry[] = enabledDays.map((d) => {
    const st = dayStates[d.dayOfWeek];
    const startTime = sameTime ? uniStart : st.startTime;
    const endTime = sameTime ? uniEnd : st.endTime;
    const roomId = sameRoom ? uniRoom : st.roomId;
    const entry: ScheduleEntry = { dayOfWeek: d.dayOfWeek, startTime, endTime };
    if (roomId) {
      entry.roomId = roomId;
      const r = roomById.get(roomId);
      if (r) entry.roomName = r.name;
    }
    return entry;
  });

  const conflicts = findScheduleConflicts(classes, classId, teacherId, proposed);
  const capacityWarnings = proposed.filter((s) => {
    if (!s.roomId) return false;
    const r = roomById.get(s.roomId);
    return r ? studentCount > r.capacity : false;
  });
  const hasIssues = conflicts.roomClashes.length > 0 || conflicts.teacherClashes.length > 0 || capacityWarnings.length > 0;

  // Suggest a room with no clashes + enough capacity for the current day/time set (uniform mode).
  const suggestFreeRoom = () => {
    const base = enabledDays.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      startTime: sameTime ? uniStart : dayStates[d.dayOfWeek].startTime,
      endTime: sameTime ? uniEnd : dayStates[d.dayOfWeek].endTime,
    }));
    for (const r of activeRooms) {
      if (r.capacity < studentCount) continue;
      const test: ScheduleEntry[] = base.map((s) => ({ ...s, roomId: r.id, roomName: r.name }));
      if (findScheduleConflicts(classes, classId, teacherId, test).roomClashes.length === 0) {
        setSameRoom(true);
        setUniRoom(r.id);
        toast.success(`Bo'sh xona: ${r.name}`);
        return;
      }
    }
    toast.error("Mos bo'sh xona topilmadi.");
  };

  const toggleDay = (dayOfWeek: number) => {
    setDayStates((prev) => ({ ...prev, [dayOfWeek]: { ...prev[dayOfWeek], enabled: !prev[dayOfWeek].enabled } }));
  };

  const updateDayTime = (dayOfWeek: number, field: "startTime" | "endTime", value: string) => {
    setDayStates((prev) => ({ ...prev, [dayOfWeek]: { ...prev[dayOfWeek], [field]: value } }));
  };

  const applyPreset = (days: number[]) => {
    setDayStates((prev) => {
      const copy = { ...prev };
      DAYS.forEach((d) => { copy[d.dayOfWeek] = { ...copy[d.dayOfWeek], enabled: days.includes(d.dayOfWeek) }; });
      return copy;
    });
  };

  const clearAll = () => {
    setDayStates((prev) => {
      const copy = { ...prev };
      DAYS.forEach((d) => { copy[d.dayOfWeek] = { ...copy[d.dayOfWeek], enabled: false }; });
      return copy;
    });
  };

  // Turning off "same room" seeds each enabled day from the shared room first.
  const toggleSameRoom = () => {
    const next = !sameRoom;
    if (!next) {
      setDayStates((prev) => {
        const copy = { ...prev };
        DAYS.forEach((d) => { if (copy[d.dayOfWeek].enabled) copy[d.dayOfWeek] = { ...copy[d.dayOfWeek], roomId: uniRoom || undefined }; });
        return copy;
      });
    }
    setSameRoom(next);
  };

  // Native room dropdown with a color dot preview. A plain render fn (not a
  // component) so it doesn't trip the static-components lint.
  const renderRoomSelect = (value: string, onChange: (v: string) => void) => {
    const r = value ? roomById.get(value) : undefined;
    const th = r ? roomTheme(r.color) : null;
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`w-3 h-3 rounded-full shrink-0 ${th ? th.bar : "bg-slate-200"}`} />
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 appearance-none px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-[13px] font-medium text-slate-800 outline-none focus:border-brand-600 cursor-pointer">
          <option value="">Xona tanlanmagan</option>
          {activeRooms.map((rm) => <option key={rm.id} value={rm.id}>{rm.name} · {rm.capacity} o&apos;rin</option>)}
        </select>
      </div>
    );
  };

  // When switching to per-day times, seed each day from the shared time first.
  const toggleSameTime = () => {
    const next = !sameTime;
    if (!next) {
      setDayStates((prev) => {
        const copy = { ...prev };
        DAYS.forEach((d) => {
          if (copy[d.dayOfWeek].enabled) copy[d.dayOfWeek] = { ...copy[d.dayOfWeek], startTime: uniStart, endTime: uniEnd };
        });
        return copy;
      });
    }
    setSameTime(next);
  };

  const handleCancel = () => {
    const u = detectUniform(currentSchedule);
    const r = detectUniformRoom(currentSchedule);
    setDayStates(buildInitialState(currentSchedule));
    setSameTime(u.sameTime);
    setUniStart(u.uniStart);
    setUniEnd(u.uniEnd);
    setSameRoom(r.sameRoom);
    setUniRoom(r.uniRoom);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (enabledDays.length === 0) {
      toast.error("Kamida bitta kun tanlang.");
      return;
    }
    // Validate times on the proposed schedule (covers uniform + per-day).
    for (const s of proposed) {
      if (s.startTime >= s.endTime) {
        const label = DAYS.find((d) => d.dayOfWeek === s.dayOfWeek)?.label || "";
        toast.error(`${label}: boshlanish vaqti tugash vaqtidan oldin bo'lishi kerak.`);
        return;
      }
    }
    // Conflicts are a soft warning — the manager can override intentionally.

    setIsSaving(true);
    try {
      await updateDoc(doc(db, "classes", classId), { schedule: proposed });
      onUpdate(proposed);
      setIsEditing(false);
      toast.success("Dars jadvali saqlandi!");
    } catch (err) {
      console.error(err);
      toast.error("Saqlashda xatolik yuz berdi.");
    } finally {
      setIsSaving(false);
    }
  };

  const sortedSchedule = sortSchedule(currentSchedule);

  const weeklyMinutes = currentSchedule.reduce((sum, e) => {
    const diff = timeToMinutes(e.endTime) - timeToMinutes(e.startTime);
    return sum + (diff > 0 ? diff : 0);
  }, 0);
  const weeklyHours = Math.floor(weeklyMinutes / 60);
  const weeklyRemMin = weeklyMinutes % 60;

  const uniDuration = formatDuration(uniStart, uniEnd);
  const uniInvalid = sameTime && !uniDuration;
  const perDayInvalid = !sameTime && enabledDays.some((d) => !formatDuration(dayStates[d.dayOfWeek].startTime, dayStates[d.dayOfWeek].endTime));
  const canSave = enabledDays.length > 0 && !uniInvalid && !perDayInvalid;

  return (
    <div className="p-4 sm:p-6">
      {/* Card header: title (left) + actions (top-right) */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 shrink-0">
            <CalendarDays size={20} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Dars jadvali</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {isEditing ? "Kunlarni tanlang va vaqtni kiriting" : "Guruh qaysi kunlari o'qiydi"}
            </p>
          </div>
        </div>

        {/* Top-right actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing && sortedSchedule.length > 0 && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-line hover:bg-brand-50 text-slate-700 font-medium text-[13px] rounded-full transition-colors"
            >
              <Edit3 size={15} /> O&apos;zgartirish
            </button>
          )}
          {isEditing && (
            <>
              {currentSchedule.length > 0 && (
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-4 py-2.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Bekor qilish
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || !canSave}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-[14px] rounded-full transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-brand-600/25"
              >
                {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                Saqlash
              </button>
            </>
          )}
        </div>
      </div>

      {/* ================= VIEW MODE ================= */}
      {!isEditing && (
        sortedSchedule.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center border border-slate-200 mb-4">
              <CalendarX2 size={26} className="text-slate-300" />
            </div>
            <h4 className="text-sm font-semibold text-slate-700">Hali jadval yo&apos;q</h4>
            <p className="text-[13px] text-slate-500 mt-1.5 max-w-[260px]">
              Guruh qaysi kunlari o&apos;qishini belgilab qo&apos;ying.
            </p>
            <button
              onClick={() => setIsEditing(true)}
              className="mt-5 px-5 py-2.5 bg-brand-600 text-white hover:bg-brand-700 font-semibold text-[13px] rounded-full transition-colors active:scale-[0.98] shadow-sm shadow-brand-600/25"
            >
              Jadval qo&apos;shish
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {sortedSchedule.map((entry) => {
                const dayObj = DAYS.find((d) => d.dayOfWeek === entry.dayOfWeek);
                const weekend = isWeekend(entry.dayOfWeek);
                const duration = formatDuration(entry.startTime, entry.endTime);
                return (
                  <div key={entry.dayOfWeek} className="flex items-center justify-between gap-3 p-3 bg-white border border-brand-line rounded-2xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-[14px] font-bold shrink-0 ${
                        weekend ? "bg-rose-50 text-rose-500" : "bg-brand-50 text-brand-700"
                      }`}>
                        {dayObj?.short}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 truncate">{dayObj?.label}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {duration && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Hourglass size={11} /> {duration}
                            </span>
                          )}
                          {entry.roomName && (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${roomTheme(roomById.get(entry.roomId || "")?.color).soft} ${roomTheme(roomById.get(entry.roomId || "")?.color).text}`}>
                              <DoorOpen size={10} /> {entry.roomName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded-lg shrink-0">
                      <Clock size={14} className="text-brand-600" />
                      <span className="text-[13px] font-bold text-slate-700 tabular-nums">
                        {entry.startTime}<span className="text-slate-300 font-normal mx-0.5">–</span>{entry.endTime}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 bg-brand-50/60 border border-brand-100 rounded-2xl">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-brand-800">
                <CalendarDays size={15} /> Haftasiga {sortedSchedule.length} ta dars
              </span>
              {weeklyMinutes > 0 && (
                <span className="flex items-center gap-2 text-[13px] font-semibold text-brand-800">
                  <Hourglass size={15} /> Jami {weeklyHours > 0 && `${weeklyHours} soat`} {weeklyRemMin > 0 && `${weeklyRemMin} daq`}
                </span>
              )}
            </div>
          </div>
        )
      )}

      {/* ================= EDIT MODE ================= */}
      {isEditing && (
        <div className="space-y-6">

          {/* Conflict warnings (soft — the manager can still save) */}
          {hasIssues && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-[13px] mb-2">
                <AlertTriangle size={15} /> Diqqat: jadval ziddiyatlari
              </div>
              <ul className="space-y-1.5 text-[12.5px] text-amber-800">
                {conflicts.roomClashes.map((c, i) => (
                  <li key={`r${i}`} className="flex items-start gap-1.5">
                    <DoorOpen size={13} className="mt-0.5 shrink-0" />
                    <span><b>{DAYS.find((d) => d.dayOfWeek === c.dayOfWeek)?.label}</b> {c.startTime}–{c.endTime} · «{c.roomName}» band: «{c.otherClassTitle}» ({c.otherStart}–{c.otherEnd})</span>
                  </li>
                ))}
                {conflicts.teacherClashes.map((c, i) => (
                  <li key={`t${i}`} className="flex items-start gap-1.5">
                    <User size={13} className="mt-0.5 shrink-0" />
                    <span>O&apos;qituvchi band: <b>{DAYS.find((d) => d.dayOfWeek === c.dayOfWeek)?.label}</b> {c.startTime}–{c.endTime} · «{c.otherClassTitle}»</span>
                  </li>
                ))}
                {capacityWarnings.map((s, i) => {
                  const cap = s.roomId ? roomById.get(s.roomId)?.capacity : undefined;
                  return (
                    <li key={`c${i}`} className="flex items-start gap-1.5">
                      <User size={13} className="mt-0.5 shrink-0" />
                      <span>Sig&apos;im yetarli emas: <b>{DAYS.find((d) => d.dayOfWeek === s.dayOfWeek)?.label}</b> · «{s.roomName}» ({studentCount} o&apos;quvchi &gt; {cap} o&apos;rin)</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT — days */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-[12px] font-bold flex items-center justify-center">1</span>
              <span className="text-[14px] font-semibold text-slate-800">Dars kunlarini tanlang</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((d) => {
                const on = dayStates[d.dayOfWeek].enabled;
                const weekend = isWeekend(d.dayOfWeek);
                return (
                  <button
                    key={d.dayOfWeek}
                    type="button"
                    onClick={() => toggleDay(d.dayOfWeek)}
                    aria-pressed={on}
                    title={d.label}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <span className={`w-full aspect-square rounded-2xl flex items-center justify-center text-[14px] font-bold transition-all ${
                      on
                        ? weekend
                          ? "bg-rose-500 text-white shadow-md shadow-rose-500/30 scale-105"
                          : "bg-brand-600 text-white shadow-md shadow-brand-600/30 scale-105"
                        : "bg-slate-50 text-slate-400 border border-slate-200 group-hover:border-brand-200 group-hover:text-slate-600"
                    }`}>
                      {on ? <Check size={18} strokeWidth={3} /> : d.short}
                    </span>
                    <span className={`text-[10px] font-medium ${on ? (weekend ? "text-rose-600" : "text-brand-700") : "text-slate-400"}`}>
                      {d.short}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Sparkles size={14} className="text-brand-600" />
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.days)}
                  className="px-3 py-1.5 bg-brand-50 text-brand-800 hover:bg-brand-100 text-[12px] font-semibold rounded-full transition-colors active:scale-95"
                >
                  {p.label}
                </button>
              ))}
              {enabledDays.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex items-center gap-1 px-3 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-[12px] font-semibold rounded-full transition-colors"
                >
                  <Trash2 size={13} /> Tozalash
                </button>
              )}
            </div>

            {/* Live preview */}
            {enabledDays.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 bg-slate-50 rounded-xl">
                <span className="text-[12px] font-medium text-slate-500 mr-0.5">Tanlandi:</span>
                {enabledDays.map((d) => (
                  <span key={d.dayOfWeek} className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                    isWeekend(d.dayOfWeek) ? "bg-rose-100 text-rose-600" : "bg-brand-100 text-brand-800"
                  }`}>
                    {d.short}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — time */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-[12px] font-bold flex items-center justify-center">2</span>
                <span className="text-[14px] font-semibold text-slate-800">Dars vaqtini kiriting</span>
              </div>
              <button
                type="button"
                onClick={toggleSameTime}
                role="switch"
                aria-checked={sameTime}
                className="flex items-center gap-2 text-[12px] font-medium text-slate-500"
              >
                Har kuni bir xil
                <span className={`relative w-9 h-5 rounded-full transition-colors ${sameTime ? "bg-brand-600" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sameTime ? "translate-x-4" : ""}`} />
                </span>
              </button>
            </div>

            {enabledDays.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-5 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-[13px] text-slate-400">
                <CalendarDays size={16} /> Avval chapdan kunlarni tanlang
              </div>
            ) : sameTime ? (
              <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl">
                <div className="flex flex-wrap items-end gap-3">
                  <TimeSelect icon={Sunrise} tone="bg-brand-100 text-brand-700" label="Boshlanishi" value={uniStart} onChange={setUniStart} invalid={uniInvalid} />
                  <ArrowRight size={18} className="text-slate-300 mb-2.5 shrink-0" />
                  <TimeSelect icon={Sunset} tone="bg-rose-100 text-rose-500" label="Tugashi" value={uniEnd} onChange={setUniEnd} invalid={uniInvalid} />
                  <div className="ml-auto mb-1">
                    {uniInvalid ? (
                      <span className="text-[12px] font-medium text-rose-500">Tugash vaqti kechroq bo&apos;lsin</span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-100 text-brand-800 text-[12px] font-semibold rounded-full">
                        <Hourglass size={12} /> Har dars {uniDuration}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {enabledDays.map((d) => {
                  const st = dayStates[d.dayOfWeek];
                  const dur = formatDuration(st.startTime, st.endTime);
                  const invalid = !dur;
                  const weekend = isWeekend(d.dayOfWeek);
                  return (
                    <div key={d.dayOfWeek} className="p-3 bg-white border-2 border-slate-100 rounded-xl">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                          weekend ? "bg-rose-50 text-rose-500" : "bg-brand-50 text-brand-700"
                        }`}>
                          {d.short}
                        </span>
                        <span className="text-[13px] font-semibold text-slate-800">{d.label}</span>
                        {dur && (
                          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-slate-400">
                            <Hourglass size={11} /> {dur}
                          </span>
                        )}
                      </div>
                      <div className="flex items-end gap-2">
                        <TimeSelect icon={Sunrise} tone="bg-brand-100 text-brand-700" label="Boshlanishi" value={st.startTime} onChange={(v) => updateDayTime(d.dayOfWeek, "startTime", v)} invalid={invalid} />
                        <ArrowRight size={16} className="text-slate-300 mb-2.5 shrink-0" />
                        <TimeSelect icon={Sunset} tone="bg-rose-100 text-rose-500" label="Tugashi" value={st.endTime} onChange={(v) => updateDayTime(d.dayOfWeek, "endTime", v)} invalid={invalid} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>

          {/* STEP 3 — room assignment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-[12px] font-bold flex items-center justify-center">3</span>
                <span className="text-[14px] font-semibold text-slate-800">Xonani biriktiring <span className="text-slate-400 font-normal">(ixtiyoriy)</span></span>
              </div>
              {enabledDays.length > 0 && activeRooms.length > 0 && (
                <button type="button" onClick={toggleSameRoom} role="switch" aria-checked={sameRoom}
                  className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                  Hamma kun bir xona
                  <span className={`relative w-9 h-5 rounded-full transition-colors ${sameRoom ? "bg-brand-600" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sameRoom ? "translate-x-4" : ""}`} />
                  </span>
                </button>
              )}
            </div>

            {activeRooms.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-[13px] text-slate-500">
                <DoorOpen size={16} className="text-slate-400" /> Hali xona qo&apos;shilmagan.
                <Link href="/manager/rooms" className="font-semibold text-brand-700 hover:underline">Xona qo&apos;shish →</Link>
              </div>
            ) : enabledDays.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-[13px] text-slate-400">
                <DoorOpen size={16} /> Avval kunlarni tanlang
              </div>
            ) : sameRoom ? (
              <div className="flex flex-wrap items-center gap-2">
                {renderRoomSelect(uniRoom, setUniRoom)}
                <button type="button" onClick={suggestFreeRoom}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-brand-50 text-brand-800 hover:bg-brand-100 rounded-full text-[12.5px] font-semibold transition-colors shrink-0">
                  <Wand2 size={14} /> Bo&apos;sh xona
                </button>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {enabledDays.map((d) => (
                  <div key={d.dayOfWeek} className="flex items-center gap-2 p-2.5 bg-white border border-brand-line rounded-2xl">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold bg-slate-100 text-slate-600 shrink-0">{d.short}</span>
                    {renderRoomSelect(dayStates[d.dayOfWeek].roomId || "", (v) => setDayRoom(d.dayOfWeek, v))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
