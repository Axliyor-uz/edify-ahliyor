"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Save, Loader2, User, Check, CheckCheck, Clock, X, Plus, CalendarX2, Search } from "lucide-react";
import toast from "react-hot-toast";
import { ScheduleEntry } from "../page";

type AttendanceStatus = "present" | "absent" | "late";

interface StudentRecord {
  id: string;
  displayName: string;
  username?: string;
}

interface Props {
  classId: string;
  centerId: string;
  studentIds: string[];
  managerId: string;
  schedule: ScheduleEntry[];
}

// Window of lesson-days: a full month of past lessons + a full month upcoming.
const PAST_DAYS = 31;
const FUTURE_DAYS = 31;

// Frozen (sticky) left area = number column + student column.
const NUM_COL = 44;   // px
const NAME_COL = 208; // px
const FROZEN_WIDTH = NUM_COL + NAME_COL;

const WEEKDAY_SHORT = ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"];
const MONTH_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "Kamronbek Toshpulatov" -> "KT", "Madina" -> "MA"
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Build every lesson-date in the window from the group's scheduled weekdays.
function buildLessonDates(schedule: ScheduleEntry[], todayStr: string): string[] {
  const weekdays = new Set(schedule.map((s) => s.dayOfWeek));
  if (weekdays.size === 0) return [];

  const today = parseDate(todayStr);
  const start = new Date(today);
  start.setDate(start.getDate() - PAST_DAYS);
  const end = new Date(today);
  end.setDate(end.getDate() + FUTURE_DAYS);

  const dates: string[] = [];
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 400) {
    if (weekdays.has(cur.getDay())) dates.push(formatDate(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return dates; // chronological
}

// Fully saturated status colors for cells; matching soft chips for the menu.
const STATUS: Record<AttendanceStatus, { label: string; solid: string; chip: string; dot: string; Icon: React.ElementType }> = {
  present: { label: "Keldi", solid: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/30", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", Icon: Check },
  late: { label: "Kech qoldi", solid: "bg-amber-400 hover:bg-amber-500 text-white shadow-sm shadow-amber-400/30", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400", Icon: Clock },
  absent: { label: "Kelmadi", solid: "bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-500/30", chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500", Icon: X },
};

const SCROLLBAR_CLASSES =
  "[&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent " +
  "[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 " +
  "[scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]";

export default function AttendanceTab({ classId, centerId, studentIds, managerId, schedule }: Props) {
  const today = useMemo(() => formatDate(new Date()), []);
  const lessonDates = useMemo(() => buildLessonDates(schedule, today), [schedule, today]);

  // Default view = last 2 lessons + today/next. Anchor is the column that should
  // sit first (just right of the frozen area): two lessons before today/next.
  const anchorDate = useMemo(() => {
    if (lessonDates.length === 0) return undefined;
    let idx = lessonDates.findIndex((d) => d >= today);
    if (idx === -1) idx = lessonDates.length - 1; // everything is in the past
    return lessonDates[Math.max(0, idx - 2)];
  }, [lessonDates, today]);

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [search, setSearch] = useState("");

  // Row number stays tied to the full A→Z list even while searching.
  const numberById = useMemo(() => {
    const m = new Map<string, number>();
    students.forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [students]);

  // Students shown in the grid (filtered by the search box).
  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.displayName.toLowerCase().includes(q) || (s.username || "").toLowerCase().includes(q)
    );
  }, [students, search]);

  // sessions[dateStr][studentId] = status
  const [sessions, setSessions] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [dirtyDates, setDirtyDates] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Dropdown popover state (fixed-positioned so it escapes the scroll container).
  const [menu, setMenu] = useState<{ date: string; studentId: string; x: number; y: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const anchorThRef = useRef<HTMLTableCellElement | null>(null);

  // Fetch student profiles
  useEffect(() => {
    if (studentIds.length === 0) {
      setStudents([]);
      setLoadingStudents(false);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingStudents(true);
      try {
        const snaps = await Promise.all(studentIds.map((id) => getDoc(doc(db, "users", id))));
        const data: StudentRecord[] = snaps
          .filter((s) => s.exists())
          .map((s) => ({ id: s.id, displayName: s.data()?.displayName || "Noma'lum", username: s.data()?.username }));
        // A→Z by name
        data.sort((a, b) => a.displayName.localeCompare(b.displayName, "uz", { sensitivity: "base" }));
        if (mounted) setStudents(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoadingStudents(false);
      }
    })();
    return () => { mounted = false; };
  }, [studentIds]);

  // Fetch attendance sessions for every visible lesson date
  useEffect(() => {
    if (lessonDates.length === 0) {
      setSessions({});
      setLoadingSessions(false);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingSessions(true);
      try {
        const snaps = await Promise.all(
          lessonDates.map((d) => getDoc(doc(db, "center_attendance", `${classId}_${d}`)))
        );
        const map: Record<string, Record<string, AttendanceStatus>> = {};
        snaps.forEach((snap, i) => {
          map[lessonDates[i]] = snap.exists() ? (snap.data().records || {}) : {};
        });
        if (mounted) {
          setSessions(map);
          setDirtyDates(new Set());
        }
      } catch (err) {
        console.error(err);
        toast.error("Davomatni yuklashda xatolik.");
      } finally {
        if (mounted) setLoadingSessions(false);
      }
    })();
    return () => { mounted = false; };
  }, [classId, lessonDates]);

  // Default scroll: bring the anchor column flush against the frozen area so the
  // default view is [last-2 lessons][today/next][upcoming...]. Uses rect math
  // (not offsetLeft, which is relative to the page-positioned ancestor).
  useEffect(() => {
    if (loadingSessions) return;
    const th = anchorThRef.current;
    const container = scrollRef.current;
    if (!th || !container) return;
    const thLeft = th.getBoundingClientRect().left;
    const containerLeft = container.getBoundingClientRect().left;
    container.scrollLeft += thLeft - containerLeft - FROZEN_WIDTH;
  }, [loadingSessions]);

  // Close the popover on any scroll or resize
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  const markDirty = useCallback((date: string) => {
    setDirtyDates((prev) => {
      const next = new Set(prev);
      next.add(date);
      return next;
    });
  }, []);

  const setStatus = (date: string, studentId: string, status: AttendanceStatus) => {
    setSessions((prev) => ({ ...prev, [date]: { ...(prev[date] || {}), [studentId]: status } }));
    markDirty(date);
  };

  const clearStatus = (date: string, studentId: string) => {
    setSessions((prev) => {
      const col = { ...(prev[date] || {}) };
      delete col[studentId];
      return { ...prev, [date]: col };
    });
    markDirty(date);
  };

  const markColumnAll = (date: string, status: AttendanceStatus) => {
    setSessions((prev) => {
      const col = { ...(prev[date] || {}) };
      students.forEach((s) => { col[s.id] = status; });
      return { ...prev, [date]: col };
    });
    markDirty(date);
  };

  const openMenu = (e: React.MouseEvent, date: string, studentId: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 196);
    setMenu({ date, studentId, x: Math.max(8, x), y: rect.bottom + 6 });
  };

  // Empty cell -> 1-click "present". Marked cell -> open the status dropdown.
  const handleCellClick = (e: React.MouseEvent, date: string, studentId: string) => {
    const current = sessions[date]?.[studentId];
    if (!current) {
      setStatus(date, studentId, "present");
    } else {
      openMenu(e, date, studentId);
    }
  };

  const handleSave = async () => {
    if (dirtyDates.size === 0) return;
    setIsSaving(true);
    const dates = Array.from(dirtyDates);
    try {
      await Promise.all(
        dates.map((d) =>
          setDoc(doc(db, "center_attendance", `${classId}_${d}`), {
            id: `${classId}_${d}`,
            classId,
            centerId,
            date: d,
            recordedBy: managerId,
            records: sessions[d] || {},
          })
        )
      );
      setDirtyDates(new Set());
      toast.success("Davomat saqlandi!");
    } catch (err) {
      console.error(err);
      toast.error("Saqlashda xatolik yuz berdi.");
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Empty / loading states ----------
  if (schedule.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-6">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
          <CalendarX2 size={26} />
        </div>
        <h3 className="text-sm font-semibold text-slate-700">Dars jadvali kiritilmagan</h3>
        <p className="text-[13px] text-slate-500 mt-1.5 max-w-[300px]">
          Davomat belgilash uchun avval &laquo;Dars Jadvali&raquo; bo&apos;limidan guruhning dars kunlarini kiriting.
        </p>
      </div>
    );
  }

  if (loadingStudents || loadingSessions) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-6">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
          <User size={24} />
        </div>
        <h3 className="text-sm font-semibold text-slate-700">O&apos;quvchilar yo&apos;q</h3>
        <p className="text-[13px] text-slate-400 mt-1">Bu guruhga hali o&apos;quvchi qo&apos;shilmagan.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Ultra-compact top bar: legend + search + save */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {(Object.keys(STATUS) as AttendanceStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
              <span className={`w-2 h-2 rounded-full ${STATUS[s].dot}`} />
              {STATUS[s].label}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Search students */}
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="O'quvchi qidirish..."
              className="w-40 sm:w-56 pl-8 pr-7 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:bg-white transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Tozalash"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || dirtyDates.size === 0}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-[14px] transition-all active:scale-[0.98] disabled:cursor-not-allowed shadow-sm ${
              dirtyDates.size > 0
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30"
                : "bg-slate-900 text-white disabled:opacity-40"
            }`}
          >
            {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            Saqlash{dirtyDates.size > 0 ? ` (${dirtyDates.size})` : ""}
          </button>
        </div>
      </div>

      {/* Colorful spreadsheet grid */}
      <div ref={scrollRef} className={`overflow-auto max-h-[80vh] ${SCROLLBAR_CLASSES}`}>
        <table className="border-separate border-spacing-0 w-full">
          <thead>
            <tr>
              {/* Corner: number */}
              <th
                className="sticky top-0 left-0 z-40 bg-slate-800 text-slate-300 text-[11px] font-bold text-center px-0 py-3 w-[44px] min-w-[44px]"
              >
                #
              </th>
              {/* Corner: student */}
              <th
                className="sticky top-0 z-40 bg-slate-800 text-slate-100 text-[11px] font-semibold uppercase tracking-wide text-left px-3 py-3 w-[208px] min-w-[208px] border-r border-slate-700 shadow-[6px_0_12px_-6px_rgba(0,0,0,0.15)]"
                style={{ left: NUM_COL }}
              >
                O&apos;quvchi
              </th>
              {/* Day columns */}
              {lessonDates.map((d) => {
                const dt = parseDate(d);
                const isToday = d === today;
                const isFuture = d > today;
                const isAnchor = d === anchorDate;
                const headBg = isToday ? "bg-indigo-600" : isFuture ? "bg-slate-400" : "bg-slate-800";
                return (
                  <th
                    key={d}
                    ref={isAnchor ? anchorThRef : undefined}
                    className={`sticky top-0 z-30 ${headBg} px-1 py-3 w-[80px] min-w-[80px] align-top border-l border-white/10`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                        {WEEKDAY_SHORT[dt.getDay()]}
                      </span>
                      <span className="text-[13.5px] font-bold tabular-nums text-white leading-tight">
                        {dt.getDate()} {MONTH_SHORT[dt.getMonth()]}
                      </span>

                      {isFuture ? (
                        <span className="text-[9px] text-white/60 mt-0.5">kutilmoqda</span>
                      ) : (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <button
                            type="button"
                            onClick={() => markColumnAll(d, "present")}
                            title="Barchasi keldi"
                            className="p-1 rounded-md text-white/70 hover:bg-emerald-500 hover:text-white transition-colors"
                          >
                            <CheckCheck size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => markColumnAll(d, "absent")}
                            title="Barchasi kelmadi"
                            className="p-1 rounded-md text-white/70 hover:bg-rose-500 hover:text-white transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleStudents.length === 0 && (
              <tr>
                <td colSpan={2 + lessonDates.length} className="py-10 text-center text-[13px] text-slate-400">
                  &laquo;{search}&raquo; bo&apos;yicha o&apos;quvchi topilmadi
                </td>
              </tr>
            )}
            {visibleStudents.map((student) => (
              <tr key={student.id} className="group">
                {/* Sticky number cell */}
                <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 border-b border-slate-100 text-center w-[44px] min-w-[44px] transition-colors">
                  <span className="text-[12px] font-semibold text-slate-400 tabular-nums">{numberById.get(student.id)}</span>
                </td>
                {/* Sticky student cell */}
                <td
                  className="sticky z-20 bg-white group-hover:bg-slate-50 border-b border-r border-slate-200 px-3 py-2 w-[208px] min-w-[208px] transition-colors shadow-[6px_0_12px_-6px_rgba(0,0,0,0.08)]"
                  style={{ left: NUM_COL }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-bold text-[11px] flex items-center justify-center">
                      {getInitials(student.displayName)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-900 truncate">{student.displayName}</p>
                      {student.username && (
                        <p className="text-[11px] text-slate-400 truncate">@{student.username}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Status cells */}
                {lessonDates.map((d) => {
                  const status = sessions[d]?.[student.id];
                  const isFuture = d > today;
                  const isToday = d === today;

                  return (
                    <td
                      key={d}
                      className={`border-b border-l border-slate-100 text-center px-1 py-1.5 ${isToday ? "bg-indigo-50/40" : ""}`}
                    >
                      {isFuture ? (
                        <div className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center text-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        </div>
                      ) : status ? (
                        <button
                          type="button"
                          onClick={(e) => handleCellClick(e, d, student.id)}
                          title={`${student.displayName} — ${STATUS[status].label} (o'zgartirish uchun bosing)`}
                          className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center transition-all active:scale-90 ${STATUS[status].solid}`}
                        >
                          {(() => { const Ico = STATUS[status].Icon; return <Ico size={16} strokeWidth={2.75} />; })()}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleCellClick(e, d, student.id)}
                          title="Bosing — 'Keldi' deb belgilanadi"
                          className="w-9 h-9 mx-auto rounded-lg border border-dashed border-slate-200 text-slate-300 flex items-center justify-center transition-colors hover:border-emerald-300 hover:text-emerald-400 hover:bg-emerald-50/50"
                        >
                          <Plus size={15} />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dropdown popover: change or clear an already-marked status */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-44 bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-900/10 p-1.5"
            style={{ left: menu.x, top: menu.y }}
          >
            {(Object.keys(STATUS) as AttendanceStatus[]).map((s) => {
              const cfg = STATUS[s];
              const active = sessions[menu.date]?.[menu.studentId] === s;
              const Ico = cfg.Icon;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setStatus(menu.date, menu.studentId, s); setMenu(null); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    active ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center ${cfg.chip}`}>
                    <Ico size={13} strokeWidth={2.5} />
                  </span>
                  <span className="flex-1 text-left">{cfg.label}</span>
                  {active && <Check size={15} className="text-slate-400" />}
                </button>
              );
            })}
            {sessions[menu.date]?.[menu.studentId] && (
              <>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  type="button"
                  onClick={() => { clearStatus(menu.date, menu.studentId); setMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <span className="w-6 h-6 rounded-md flex items-center justify-center border border-dashed border-slate-200 text-slate-400">
                    <X size={13} />
                  </span>
                  Belgilanmagan
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
