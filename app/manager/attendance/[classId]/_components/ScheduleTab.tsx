"use client";

import { useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import {
  Save, Loader2, Clock, CalendarDays, Edit3, CalendarX2, Hourglass,
  Trash2, Sunrise, Sunset, ArrowRight, Check, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { ScheduleEntry } from "../page";

interface Props {
  classId: string;
  currentSchedule: ScheduleEntry[];
  onUpdate: (newSchedule: ScheduleEntry[]) => void;
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

type DayState = { enabled: boolean; startTime: string; endTime: string };

function buildInitialState(schedule: ScheduleEntry[]): Record<number, DayState> {
  const state: Record<number, DayState> = {};
  for (const d of DAYS) {
    const existing = schedule.find((s) => s.dayOfWeek === d.dayOfWeek);
    state[d.dayOfWeek] = {
      enabled: !!existing,
      startTime: existing?.startTime || "14:00",
      endTime: existing?.endTime || "15:30",
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
        invalid ? "border-rose-300" : "border-slate-200 focus-within:border-indigo-400"
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

export default function ScheduleTab({ classId, currentSchedule, onUpdate }: Props) {
  const initUniform = useMemo(() => detectUniform(currentSchedule), [currentSchedule]);

  const [isEditing, setIsEditing] = useState(currentSchedule.length === 0);
  const [dayStates, setDayStates] = useState<Record<number, DayState>>(() => buildInitialState(currentSchedule));
  const [sameTime, setSameTime] = useState(initUniform.sameTime);
  const [uniStart, setUniStart] = useState(initUniform.uniStart);
  const [uniEnd, setUniEnd] = useState(initUniform.uniEnd);
  const [isSaving, setIsSaving] = useState(false);

  const enabledDays = DAYS.filter((d) => dayStates[d.dayOfWeek].enabled);

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
    setDayStates(buildInitialState(currentSchedule));
    setSameTime(u.sameTime);
    setUniStart(u.uniStart);
    setUniEnd(u.uniEnd);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (enabledDays.length === 0) {
      toast.error("Kamida bitta kun tanlang.");
      return;
    }

    const newSchedule: ScheduleEntry[] = [];
    if (sameTime) {
      if (uniStart >= uniEnd) {
        toast.error("Boshlanish vaqti tugash vaqtidan oldin bo'lishi kerak.");
        return;
      }
      enabledDays.forEach((d) => newSchedule.push({ dayOfWeek: d.dayOfWeek, startTime: uniStart, endTime: uniEnd }));
    } else {
      for (const d of enabledDays) {
        const st = dayStates[d.dayOfWeek];
        if (st.startTime >= st.endTime) {
          toast.error(`${d.label}: boshlanish vaqti tugash vaqtidan oldin bo'lishi kerak.`);
          return;
        }
        newSchedule.push({ dayOfWeek: d.dayOfWeek, startTime: st.startTime, endTime: st.endTime });
      }
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, "classes", classId), { schedule: newSchedule });
      onUpdate(newSchedule);
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
          <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
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
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[13px] rounded-xl transition-colors"
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
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[14px] rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-600/25"
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
              className="mt-5 px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-[13px] rounded-xl transition-colors active:scale-[0.98] shadow-sm shadow-indigo-600/25"
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
                  <div key={entry.dayOfWeek} className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-[14px] font-bold shrink-0 ${
                        weekend ? "bg-rose-50 text-rose-500" : "bg-indigo-50 text-indigo-600"
                      }`}>
                        {dayObj?.short}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 truncate">{dayObj?.label}</span>
                        {duration && (
                          <span className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <Hourglass size={11} /> {duration}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded-lg shrink-0">
                      <Clock size={14} className="text-indigo-400" />
                      <span className="text-[13px] font-bold text-slate-700 tabular-nums">
                        {entry.startTime}<span className="text-slate-300 font-normal mx-0.5">–</span>{entry.endTime}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-indigo-700">
                <CalendarDays size={15} /> Haftasiga {sortedSchedule.length} ta dars
              </span>
              {weeklyMinutes > 0 && (
                <span className="flex items-center gap-2 text-[13px] font-semibold text-indigo-700">
                  <Hourglass size={15} /> Jami {weeklyHours > 0 && `${weeklyHours} soat`} {weeklyRemMin > 0 && `${weeklyRemMin} daq`}
                </span>
              )}
            </div>
          </div>
        )
      )}

      {/* ================= EDIT MODE ================= */}
      {isEditing && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT — days */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[12px] font-bold flex items-center justify-center">1</span>
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
                          : "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105"
                        : "bg-slate-50 text-slate-400 border border-slate-200 group-hover:border-indigo-300 group-hover:text-slate-600"
                    }`}>
                      {on ? <Check size={18} strokeWidth={3} /> : d.short}
                    </span>
                    <span className={`text-[10px] font-medium ${on ? (weekend ? "text-rose-600" : "text-indigo-600") : "text-slate-400"}`}>
                      {d.short}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.days)}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[12px] font-semibold rounded-full transition-colors active:scale-95"
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
                    isWeekend(d.dayOfWeek) ? "bg-rose-100 text-rose-600" : "bg-indigo-100 text-indigo-700"
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
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[12px] font-bold flex items-center justify-center">2</span>
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
                <span className={`relative w-9 h-5 rounded-full transition-colors ${sameTime ? "bg-indigo-600" : "bg-slate-300"}`}>
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
                  <TimeSelect icon={Sunrise} tone="bg-amber-100 text-amber-600" label="Boshlanishi" value={uniStart} onChange={setUniStart} invalid={uniInvalid} />
                  <ArrowRight size={18} className="text-slate-300 mb-2.5 shrink-0" />
                  <TimeSelect icon={Sunset} tone="bg-indigo-100 text-indigo-600" label="Tugashi" value={uniEnd} onChange={setUniEnd} invalid={uniInvalid} />
                  <div className="ml-auto mb-1">
                    {uniInvalid ? (
                      <span className="text-[12px] font-medium text-rose-500">Tugash vaqti kechroq bo&apos;lsin</span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[12px] font-semibold rounded-full">
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
                          weekend ? "bg-rose-50 text-rose-500" : "bg-indigo-50 text-indigo-600"
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
                        <TimeSelect icon={Sunrise} tone="bg-amber-100 text-amber-600" label="Boshlanishi" value={st.startTime} onChange={(v) => updateDayTime(d.dayOfWeek, "startTime", v)} invalid={invalid} />
                        <ArrowRight size={16} className="text-slate-300 mb-2.5 shrink-0" />
                        <TimeSelect icon={Sunset} tone="bg-indigo-100 text-indigo-600" label="Tugashi" value={st.endTime} onChange={(v) => updateDayTime(d.dayOfWeek, "endTime", v)} invalid={invalid} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
