"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search, Loader2, X, Check, Clock, UserRound, CalendarX2, CalendarPlus,
  Phone, Users2, CheckCircle2, CircleDashed,
} from "lucide-react";
import toast from "react-hot-toast";
import type { AttendanceStatus } from "@/types/attendance";
import type { ClassData } from "@/hooks/useCenterClasses";
import { getTodayKey, parseDateKey } from "@/lib/dateUtils";
import { fetchCenterSessions, type CenterSession } from "@/services/attendanceService";
import {
  buildCenterRoster, computeTodayLessons, boardStatusOf, checkInStudent,
  type RosterStudent, type TodayLesson, type TodayBoardStatus,
} from "@/services/checkInService";

interface Props {
  centerId: string;
  classes: ClassData[];
  /** uid of the manager doing the marking. */
  markedBy: string;
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const STATUS_UI: Record<"present" | "late", { label: string; chip: string; Icon: React.ElementType }> = {
  present: { label: "Keldi", chip: "bg-emerald-100 text-emerald-700", Icon: Check },
  late: { label: "Kech qoldi", chip: "bg-amber-100 text-amber-700", Icon: Clock },
};

type Filter = "all" | "pending" | "done";

// Sort order on the board: students still needing marks float to the top.
const STATUS_RANK: Record<TodayBoardStatus, number> = { pending: 0, done: 1, none: 2 };

// Deterministic avatar tint so rows feel distinct at a glance.
const AVATAR_TINTS = [
  "from-indigo-100 to-indigo-200 text-indigo-700",
  "from-violet-100 to-violet-200 text-violet-700",
  "from-teal-100 to-teal-200 text-teal-700",
  "from-amber-100 to-amber-200 text-amber-700",
  "from-rose-100 to-rose-200 text-rose-700",
  "from-sky-100 to-sky-200 text-sky-700",
  "from-emerald-100 to-emerald-200 text-emerald-700",
];
function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

interface Enriched {
  student: RosterStudent;
  lessons: TodayLesson[];
  status: TodayBoardStatus;
}

function Avatar({ student, size = 40 }: { student: RosterStudent; size?: number }) {
  const cls = `shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold bg-gradient-to-br ${tintFor(student.uid)}`;
  const style = { width: size, height: size, fontSize: size * 0.34 };
  if (student.photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={student.photoURL} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
    );
  }
  return <span className={cls} style={style}>{getInitials(student.displayName)}</span>;
}

export default function WalkInCheckIn({ centerId, classes, markedBy }: Props) {
  const today = useMemo(() => getTodayKey(), []);
  const todayWeekday = useMemo(() => parseDateKey(today).getDay(), [today]);

  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [sessionByClass, setSessionByClass] = useState<Map<string, CenterSession>>(new Map());
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Dialog state
  const [dialog, setDialog] = useState<RosterStudent | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [markStatus, setMarkStatus] = useState<"present" | "late">("present");
  const [saving, setSaving] = useState(false);

  // ── Load roster + today's sessions in parallel (one query for sessions). ─────
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [r, sessions] = await Promise.all([
          buildCenterRoster(classes),
          fetchCenterSessions(centerId, today, today),
        ]);
        if (!mounted) return;
        setRoster(r);
        setSessionByClass(new Map(sessions.map((s) => [s.classId, s])));
      } catch (err) {
        console.error(err);
        if (mounted) toast.error("Ma'lumotlarni yuklashda xatolik.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [classes, centerId, today]);

  useEffect(() => { if (!loading) searchRef.current?.focus(); }, [loading]);

  // Enrich every student with today's lessons + a board status (all in-memory).
  const enriched = useMemo<Enriched[]>(() => {
    return roster.map((student) => {
      const lessons = computeTodayLessons(student, classes, sessionByClass, todayWeekday);
      return { student, lessons, status: boardStatusOf(lessons) };
    });
  }, [roster, classes, sessionByClass, todayWeekday]);

  const counts = useMemo(() => {
    let pending = 0, done = 0, none = 0;
    for (const e of enriched) {
      if (e.status === "pending") pending++;
      else if (e.status === "done") done++;
      else none++;
    }
    return { pending, done, none, withLesson: pending + done, total: enriched.length };
  }, [enriched]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((e) => {
        if (filter === "pending" && e.status !== "pending") return false;
        if (filter === "done" && e.status !== "done") return false;
        if (!q) return true;
        return e.student.displayName.toLowerCase().includes(q) || (e.student.username || "").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (r !== 0) return r;
        return a.student.displayName.localeCompare(b.student.displayName, "uz", { sensitivity: "base" });
      });
  }, [enriched, search, filter]);

  const dialogLessons = useMemo(
    () => (dialog ? computeTodayLessons(dialog, classes, sessionByClass, todayWeekday) : []),
    [dialog, classes, sessionByClass, todayWeekday]
  );

  const openDialog = useCallback((student: RosterStudent) => {
    const lessons = computeTodayLessons(student, classes, sessionByClass, todayWeekday);
    const init: Record<string, boolean> = {};
    lessons.forEach((l) => { init[l.classId] = l.currentStatus === null; });
    setChecked(init);
    setMarkStatus("present");
    setDialog(student);
  }, [classes, sessionByClass, todayWeekday]);

  const closeDialog = useCallback(() => setDialog(null), []);

  const selectedLessons = useMemo(
    () => dialogLessons.filter((l) => checked[l.classId]),
    [dialogLessons, checked]
  );

  const submit = useCallback(async () => {
    if (!dialog || selectedLessons.length === 0) return;
    const student = dialog;
    setSaving(true);
    try {
      await Promise.all(
        selectedLessons.map((l) =>
          checkInStudent({
            classId: l.classId, centerId, uid: student.uid,
            status: markStatus as AttendanceStatus, markedBy, date: today, weekday: todayWeekday,
          })
        )
      );
      // Update local session map so the board reflects the marks instantly.
      setSessionByClass((prev) => {
        const next = new Map(prev);
        for (const l of selectedLessons) {
          const existing = next.get(l.classId);
          const records = { ...(existing?.records || {}), [student.uid]: { status: markStatus as AttendanceStatus } };
          next.set(l.classId, existing
            ? { ...existing, records }
            : { id: `${l.classId}_${today}`, classId: l.classId, centerId, date: today, weekday: todayWeekday, lessonStatus: "held", records });
        }
        return next;
      });
      toast.success(`${student.displayName} — ${selectedLessons.length} ta dars belgilandi`);
      setDialog(null);
      searchRef.current?.focus();
    } catch (err) {
      console.error(err);
      toast.error("Saqlashda xatolik. Qayta urinib ko'ring.");
    } finally {
      setSaving(false);
    }
  }, [dialog, selectedLessons, centerId, markStatus, markedBy, today, todayWeekday]);

  // Esc closes the dialog.
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDialog(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-slate-400" size={30} /></div>;
  }

  if (roster.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-14 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3"><UserRound size={26} /></div>
        <h3 className="text-[15px] font-semibold text-slate-800">O&apos;quvchilar yo&apos;q</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-[260px]">Markazingiz guruhlariga hali o&apos;quvchi qo&apos;shilmagan.</p>
      </div>
    );
  }

  const pct = counts.withLesson > 0 ? Math.round((counts.done / counts.withLesson) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Progress summary */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 flex items-center gap-4">
        <div className="relative w-14 h-14 shrink-0">
          <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="4" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[12px] font-black text-slate-700 tabular-nums">{pct}%</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-slate-900">Bugungi davomat</p>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            Bugun darsi bor <b className="text-slate-700 tabular-nums">{counts.withLesson}</b> o&apos;quvchidan{" "}
            <b className="text-emerald-600 tabular-nums">{counts.done}</b> tasi belgilandi
          </p>
        </div>
        {counts.pending > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[12px] font-bold">
            <CircleDashed size={14} /> {counts.pending} ta qoldi
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="O'quvchi ismini yozing..."
          className="w-full pl-11 pr-10 py-3.5 text-[15px] bg-white border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all shadow-sm"
        />
        {search && (
          <button onClick={() => setSearch("")} aria-label="Tozalash"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5">
        {([
          { id: "all" as Filter, label: "Hammasi", n: counts.total },
          { id: "pending" as Filter, label: "Kutilmoqda", n: counts.pending },
          { id: "done" as Filter, label: "Belgilangan", n: counts.done },
        ]).map((f) => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold transition-colors ${
                active ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
              }`}>
              {f.label}
              <span className={`tabular-nums ${active ? "text-white/70" : "text-slate-400"}`}>{f.n}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden divide-y divide-slate-100">
        {visible.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-slate-400">
            {search ? <>&laquo;{search}&raquo; bo&apos;yicha o&apos;quvchi topilmadi</> : "Bu ro'yxat bo'sh"}
          </p>
        ) : (
          visible.map((e, i) => <StudentRow key={e.student.uid} n={i + 1} e={e} onOpen={() => openDialog(e.student)} />)
        )}
      </div>

      {/* ── Check-in dialog ── */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={closeDialog} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col animate-[slideUp_.18s_ease-out]">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
              <Avatar student={dialog} size={48} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-slate-900 truncate">{dialog.displayName}</p>
                <div className="flex items-center gap-3 mt-0.5 text-[12px] text-slate-400">
                  {dialog.username && <span className="truncate">@{dialog.username}</span>}
                  {dialog.phone && <span className="inline-flex items-center gap-1 shrink-0"><Phone size={11} /> {dialog.phone}</span>}
                  <span className="inline-flex items-center gap-1 shrink-0"><Users2 size={11} /> {dialog.classIds.length} guruh</span>
                </div>
              </div>
              <button onClick={closeDialog} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"><X size={18} /></button>
            </div>

            {dialogLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-6">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3"><CalendarX2 size={26} /></div>
                <h4 className="text-[15px] font-semibold text-slate-700">Bugun dars yo&apos;q</h4>
                <p className="text-[13px] text-slate-500 mt-1 max-w-[280px]">Bu o&apos;quvchida bugun uchun rejalashtirilgan dars mavjud emas.</p>
                <button onClick={closeDialog} className="mt-4 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-bold hover:bg-slate-200 transition-colors">Yopish</button>
              </div>
            ) : (
              <>
                {/* Status toggle */}
                <div className="flex items-center gap-2 px-5 pt-4">
                  <span className="text-[12px] font-semibold text-slate-500">Holat:</span>
                  {(["present", "late"] as const).map((s) => {
                    const cfg = STATUS_UI[s]; const active = markStatus === s; const Ico = cfg.Icon;
                    return (
                      <button key={s} onClick={() => setMarkStatus(s)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold transition-all ${
                          active ? cfg.chip + " ring-1 ring-inset ring-black/5" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                        }`}>
                        <Ico size={14} strokeWidth={2.5} /> {cfg.label}
                      </button>
                    );
                  })}
                </div>

                {/* Lessons */}
                <div className="px-3 py-3 space-y-1.5 overflow-y-auto">
                  {dialogLessons.map((l) => {
                    const on = !!checked[l.classId];
                    return (
                      <button key={l.classId} onClick={() => setChecked((p) => ({ ...p, [l.classId]: !p[l.classId] }))}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border text-left transition-all ${
                          on ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}>
                        <span className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center transition-colors ${on ? "bg-indigo-600 text-white" : "border border-slate-300 text-transparent"}`}>
                          <Check size={13} strokeWidth={3} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[14px] font-bold text-slate-900 truncate">{l.title}</p>
                            {l.lessonStatus === "makeup" && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full"><CalendarPlus size={10} /> qo&apos;shimcha</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[12px] text-slate-500">
                            {l.time && <span className="tabular-nums font-medium">{l.time}</span>}
                            {l.teacherName && <span className="truncate">· {l.teacherName}</span>}
                          </div>
                        </div>
                        {l.currentStatus && (
                          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold ${l.currentStatus === "late" ? "bg-amber-100 text-amber-700" : l.currentStatus === "absent" ? "bg-rose-100 text-rose-700" : l.currentStatus === "excused" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
                            <CheckCircle2 size={11} /> belgilangan
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Confirm */}
                <div className="px-5 pb-5 pt-1 border-t border-slate-100">
                  <button onClick={submit} disabled={saving || selectedLessons.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[14px] transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-600/30">
                    {saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} strokeWidth={2.75} />}
                    {STATUS_UI[markStatus].label} deb belgilash
                    {selectedLessons.length > 0 && ` (${selectedLessons.length} ta dars)`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────
function StudentRow({ n, e, onOpen }: { n: number; e: Enriched; onOpen: () => void }) {
  const { student, lessons, status } = e;
  const badge =
    status === "done" ? { cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2, label: "Belgilandi" } :
    status === "pending" ? { cls: "bg-amber-100 text-amber-700", Icon: CircleDashed, label: `${lessons.length} dars · kutilmoqda` } :
    { cls: "bg-slate-100 text-slate-400", Icon: CalendarX2, label: "Bugun dars yo'q" };
  const BIcon = badge.Icon;
  const noLesson = status === "none";

  return (
    <button onClick={onOpen} disabled={noLesson}
      className={`w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left transition-colors group ${noLesson ? "opacity-60 cursor-default" : "hover:bg-slate-50"}`}>
      <span className="w-6 shrink-0 text-center text-[12px] font-bold text-slate-300 tabular-nums">{n}</span>
      <Avatar student={student} size={42} />
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] font-semibold text-slate-900 truncate ${noLesson ? "" : "group-hover:text-indigo-600"} transition-colors`}>{student.displayName}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[12px] text-slate-400">
          {student.username && <span className="truncate">@{student.username}</span>}
          <span className="inline-flex items-center gap-1 shrink-0"><Users2 size={11} /> {student.classIds.length}</span>
        </div>
      </div>
      <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${badge.cls}`}>
        <BIcon size={12} /> <span className="hidden sm:inline">{badge.label}</span>
      </span>
    </button>
  );
}
