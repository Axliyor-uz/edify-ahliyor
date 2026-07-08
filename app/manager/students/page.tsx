"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { fetchCenterSessions } from "@/services/attendanceService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { getTodayKey, parseDateKey } from "@/lib/dateUtils";
import { Users, Loader2, Clock, CalendarCheck, CalendarX2, ChevronRight } from "lucide-react";
import ManagerStudentInfoPanel from "./_components/ManagerStudentInfoPanel";
import SearchInput from "../_components/SearchInput";
import FilterSelect from "../_components/FilterSelect";

type TodayStatus = "present" | "late" | "absent" | "unmarked" | "nolesson";
type AttendanceStatus = "present" | "late" | "absent";

interface StudentRow {
  id: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  groups: { id: string; title: string }[];
  scheduleDays: number[];       // union of weekdays across their groups
  uniformTime: string | null;   // "14:00–15:30" if all lessons share it, else null
  todayStatus: TodayStatus;
}

const WEEKDAY_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
const WEEKDAY_FULL = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const isWeekend = (d: number) => d === 0 || d === 6;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const STATUS_UI: Record<TodayStatus, { label: string; cls: string; dot: string }> = {
  present:  { label: "Keldi",           cls: "bg-brand-100 text-brand-800",  dot: "bg-brand-600" },
  late:     { label: "Kech qoldi",      cls: "bg-amber-50 text-amber-700",   dot: "bg-amber-500" },
  absent:   { label: "Kelmadi",         cls: "bg-rose-50 text-rose-700",     dot: "bg-rose-500" },
  unmarked: { label: "Belgilanmagan",   cls: "bg-slate-100 text-slate-500",  dot: "bg-slate-300" },
  nolesson: { label: "Bugun dars yo'q", cls: "bg-slate-50 text-slate-400",   dot: "bg-slate-200" },
};

export default function ManagerStudentsPage() {
  const { user } = useAuth();
  const [centerId, setCenterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { classes, isLoading: loadingClasses } = useCenterClasses(centerId);

  const [profiles, setProfiles] = useState<Record<string, { displayName: string; username?: string; photoURL?: string }>>({});
  // todaySessions[classId][studentId] = status
  const [todaySessions, setTodaySessions] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [loadingExtra, setLoadingExtra] = useState(true);

  // Center time (Asia/Tashkent), not device-local — see ATTENDANCE.md rule #3.
  const today = useMemo(() => getTodayKey(), []);
  const todayWeekday = useMemo(() => parseDateKey(getTodayKey()).getDay(), []);

  // Fetch student profiles + today's attendance sessions once classes are known.
  useEffect(() => {
    if (loadingClasses) return;
    if (classes.length === 0 || !centerId) {
      setProfiles({});
      setTodaySessions({});
      setLoadingExtra(false);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingExtra(true);

      // Profiles — chunked `in` queries (max 10 ids each). Kept in their own
      // try/catch so an attendance failure can never blank the student list.
      const profileMap: Record<string, { displayName: string; username?: string; photoURL?: string }> = {};
      try {
        const ids = [...new Set(classes.flatMap((c) => c.studentIds || []))];
        await Promise.all(
          chunk(ids, 10).map(async (part) => {
            if (part.length === 0) return;
            const snap = await getDocs(query(collection(db, "users"), where(documentId(), "in", part)));
            snap.docs.forEach((d) => {
              profileMap[d.id] = {
                displayName: d.data()?.displayName || "Noma'lum",
                username: d.data()?.username,
                photoURL: d.data()?.photoURL || undefined,
              };
            });
          })
        );
      } catch (err) {
        console.error("Profiles error:", err);
      }
      if (mounted) setProfiles(profileMap);

      // Today's sessions — ONE centerId+date list query instead of per-class
      // getDoc()s: the strict per-document GET rule denies docs with a
      // missing/stale centerId, while `allow list` only needs isAuth().
      try {
        const sessions = await fetchCenterSessions(centerId, today, today);
        const sessMap: Record<string, Record<string, AttendanceStatus>> = {};
        for (const s of sessions) {
          const statusMap: Record<string, AttendanceStatus> = {};
          Object.keys(s.records).forEach((uid) => {
            statusMap[uid] = s.records[uid].status as AttendanceStatus;
          });
          sessMap[s.classId] = statusMap;
        }
        if (mounted) setTodaySessions(sessMap);
      } catch (err) {
        console.error("Attendance error:", err);
      }

      if (mounted) setLoadingExtra(false);
    })();
    return () => { mounted = false; };
  }, [classes, loadingClasses, centerId, today]);

  // Build one row per student (A→Z), aggregating their groups + today's status.
  const rows = useMemo<StudentRow[]>(() => {
    const byStudent = new Map<string, StudentRow>();

    for (const c of classes) {
      for (const sid of c.studentIds || []) {
        const prof = profiles[sid];
        if (!prof) continue;
        let row = byStudent.get(sid);
        if (!row) {
          row = { id: sid, displayName: prof.displayName, username: prof.username, photoURL: prof.photoURL, groups: [], scheduleDays: [], uniformTime: null, todayStatus: "nolesson" };
          byStudent.set(sid, row);
        }
        row.groups.push({ id: c.id, title: c.title });
        for (const s of c.schedule || []) {
          if (!row.scheduleDays.includes(s.dayOfWeek)) row.scheduleDays.push(s.dayOfWeek);
        }
      }
    }

    // Resolve schedule ordering, uniform time, and today's status per student.
    for (const row of byStudent.values()) {
      row.scheduleDays.sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));

      // Uniform time across all this student's group lessons.
      const times = new Set<string>();
      const todayGroups: string[] = [];
      for (const g of row.groups) {
        const cls = classes.find((c) => c.id === g.id);
        cls?.schedule?.forEach((s) => {
          times.add(`${s.startTime}–${s.endTime}`);
          if (s.dayOfWeek === todayWeekday) todayGroups.push(g.id);
        });
      }
      row.uniformTime = times.size === 1 ? [...times][0] : null;

      // Today's status — aggregate across every group meeting today (best status wins).
      if (todayGroups.length === 0) {
        row.todayStatus = "nolesson";
      } else {
        const seen = todayGroups.map((cid) => todaySessions[cid]?.[row.id]);
        if (seen.includes("present")) row.todayStatus = "present";
        else if (seen.includes("late")) row.todayStatus = "late";
        else if (seen.includes("absent")) row.todayStatus = "absent";
        else row.todayStatus = "unmarked";
      }
    }

    return [...byStudent.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "uz", { sensitivity: "base" }));
  }, [classes, profiles, todaySessions, todayWeekday]);

  // Student info slide-over ("dialog card" — same pattern as the teachers page).
  const [viewingStudent, setViewingStudent] = useState<StudentRow | null>(null);

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [quick, setQuick] = useState<"all" | "today" | "absent">("all");

  const groupOptions = useMemo(
    () => classes.map((c) => ({ value: c.id, label: c.title })).sort((a, b) => a.label.localeCompare(b.label)),
    [classes]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.displayName.toLowerCase().includes(q) && !(r.username || "").toLowerCase().includes(q)) return false;
      if (groupFilter && !r.groups.some((g) => g.id === groupFilter)) return false;
      if (quick === "today" && r.todayStatus === "nolesson") return false;
      if (quick === "absent" && r.todayStatus !== "absent") return false;
      return true;
    });
  }, [rows, search, groupFilter, quick]);

  // ── Summary ──
  const haveLessonToday = rows.filter((r) => r.todayStatus !== "nolesson").length;
  const presentToday = rows.filter((r) => r.todayStatus === "present").length;
  const absentToday = rows.filter((r) => r.todayStatus === "absent").length;

  const loading = loadingClasses || loadingExtra;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">O&apos;quvchilar</h1>
          <p className="text-sm text-slate-500 mt-0.5">Markazdagi barcha o&apos;quvchilar, guruhlari va bugungi davomat</p>
        </div>
        <div className="capitalize text-[13px] font-medium text-slate-500">
          {WEEKDAY_FULL[todayWeekday]}, {new Date().getDate()}-kun
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Users size={16} />} tone="bg-brand-100 text-brand-700" value={rows.length} label="Jami o'quvchi" />
        <StatCard icon={<CalendarCheck size={16} />} tone="bg-sky-50 text-sky-600" value={haveLessonToday} label="Bugun darsi bor" />
        <StatCard icon={<span className="w-2.5 h-2.5 rounded-full bg-brand-600" />} tone="bg-brand-50" value={presentToday} label="Bugun keldi" />
        <StatCard icon={<span className="w-2.5 h-2.5 rounded-full bg-rose-500" />} tone="bg-rose-50" value={absentToday} label="Bugun kelmadi" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Ism yoki @username bo'yicha qidiring..." />

        {classes.length > 1 && (
          <FilterSelect
            value={groupFilter}
            onChange={setGroupFilter}
            options={groupOptions}
            allLabel="Barcha guruhlar"
          />
        )}

        <div className="flex items-center gap-0.5 p-1 bg-white border border-brand-line rounded-full">
          {([["all", "Hammasi"], ["today", "Bugun darsi bor"], ["absent", "Kelmaganlar"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setQuick(key)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                quick === key ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:bg-brand-50 hover:text-brand-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-brand-line rounded-3xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-slate-400" size={28} /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="O'quvchilar yo'q" subtitle="Markaz guruhlariga hali o'quvchi qo'shilmagan." />
        ) : filtered.length === 0 ? (
          <EmptyState title="Topilmadi" subtitle="Qidiruv yoki filtrlarga mos o'quvchi yo'q." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold uppercase tracking-wide border-b border-slate-100">
                  <th className="py-3 pl-5 pr-2 w-10">#</th>
                  <th className="py-3 px-2">O&apos;quvchi</th>
                  <th className="py-3 px-2">Guruh</th>
                  <th className="py-3 px-2">Dars kunlari</th>
                  <th className="py-3 px-2 pr-5 text-right">Bugun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, i) => {
                  const st = STATUS_UI[r.todayStatus];
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setViewingStudent(r)}
                      className="hover:bg-brand-25 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pl-5 pr-2 text-[12px] font-semibold text-slate-400 tabular-nums">{i + 1}</td>

                      {/* Student */}
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {r.photoURL ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.photoURL} alt={r.displayName} className="w-8 h-8 shrink-0 rounded-full object-cover border border-slate-100" />
                          ) : (
                            <span className="w-8 h-8 shrink-0 rounded-full bg-brand-100 text-brand-800 font-bold text-[11px] flex items-center justify-center">
                              {getInitials(r.displayName)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-900 truncate">{r.displayName}</p>
                            {r.username && <p className="text-[11px] text-slate-400 truncate">@{r.username}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Groups */}
                      <td className="py-2.5 px-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {r.groups.slice(0, 2).map((g) => (
                            <Link
                              key={g.id}
                              href={`/manager/attendance/${g.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-800 hover:bg-brand-100 rounded-full text-[11px] font-bold transition-colors max-w-[160px]"
                            >
                              <span className="truncate">{g.title}</span>
                              <ChevronRight size={11} className="shrink-0 opacity-60" />
                            </Link>
                          ))}
                          {r.groups.length > 2 && (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-[11px] font-bold">+{r.groups.length - 2}</span>
                          )}
                        </div>
                      </td>

                      {/* Schedule days */}
                      <td className="py-2.5 px-2">
                        {r.scheduleDays.length === 0 ? (
                          <span className="text-[11px] text-slate-300">— jadval yo&apos;q</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {r.scheduleDays.map((d) => (
                                <span
                                  key={d}
                                  title={WEEKDAY_FULL[d]}
                                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                                    d === todayWeekday
                                      ? "bg-brand-600 text-white"
                                      : isWeekend(d)
                                      ? "bg-rose-50 text-rose-500"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {WEEKDAY_SHORT[d]}
                                </span>
                              ))}
                            </div>
                            {r.uniformTime && (
                              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 tabular-nums">
                                <Clock size={11} /> {r.uniformTime}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Today status */}
                      <td className="py-2.5 px-2 pr-5 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${st.cls}`}>
                          <span className={`w-2 h-2 rounded-full ${st.dot}`} /> {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Info Slide-Over */}
      {viewingStudent && (
        <ManagerStudentInfoPanel
          studentUid={viewingStudent.id}
          fallbackName={viewingStudent.displayName}
          centerId={centerId}
          groups={viewingStudent.groups}
          todayBadge={STATUS_UI[viewingStudent.todayStatus]}
          onPhotoChange={(url) =>
            setProfiles((prev) => ({
              ...prev,
              [viewingStudent.id]: { ...prev[viewingStudent.id], photoURL: url || undefined },
            }))
          }
          onClose={() => setViewingStudent(null)}
        />
      )}
    </div>
  );
}

function StatCard({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 p-3.5 bg-white border border-brand-line rounded-3xl">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-lg font-bold text-slate-900 leading-none tabular-nums">{value}</p>
        <p className="text-[12px] text-slate-500 mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-700 mb-3">
        <CalendarX2 size={22} />
      </div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="text-[13px] text-slate-400 mt-1 max-w-[260px]">{subtitle}</p>
    </div>
  );
}
