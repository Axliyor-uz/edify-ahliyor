"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, getDoc, doc, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { Users, Search, Loader2, Clock, CalendarCheck, CalendarX2, ChevronRight, X } from "lucide-react";

type TodayStatus = "present" | "late" | "absent" | "unmarked" | "nolesson";
type AttendanceStatus = "present" | "late" | "absent";

interface StudentRow {
  id: string;
  displayName: string;
  username?: string;
  groups: { id: string; title: string }[];
  scheduleDays: number[];       // union of weekdays across their groups
  uniformTime: string | null;   // "14:00–15:30" if all lessons share it, else null
  todayStatus: TodayStatus;
}

const WEEKDAY_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
const WEEKDAY_FULL = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const isWeekend = (d: number) => d === 0 || d === 6;

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
  present:  { label: "Keldi",           cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  late:     { label: "Kech qoldi",      cls: "bg-amber-50 text-amber-700",     dot: "bg-amber-500" },
  absent:   { label: "Kelmadi",         cls: "bg-rose-50 text-rose-700",       dot: "bg-rose-500" },
  unmarked: { label: "Belgilanmagan",   cls: "bg-slate-100 text-slate-500",    dot: "bg-slate-300" },
  nolesson: { label: "Bugun dars yo'q", cls: "bg-slate-50 text-slate-400",     dot: "bg-slate-200" },
};

export default function ManagerStudentsPage() {
  const { user } = useAuth();
  const [centerId, setCenterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { classes, isLoading: loadingClasses } = useCenterClasses(centerId);

  const [profiles, setProfiles] = useState<Record<string, { displayName: string; username?: string }>>({});
  // todaySessions[classId][studentId] = status
  const [todaySessions, setTodaySessions] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [loadingExtra, setLoadingExtra] = useState(true);

  const today = useMemo(() => formatDate(new Date()), []);
  const todayWeekday = useMemo(() => new Date().getDay(), []);

  // Fetch student profiles + today's attendance sessions once classes are known.
  useEffect(() => {
    if (loadingClasses) return;
    if (classes.length === 0) {
      setProfiles({});
      setTodaySessions({});
      setLoadingExtra(false);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingExtra(true);
      try {
        const ids = [...new Set(classes.flatMap((c) => c.studentIds || []))];

        // Profiles — chunked `in` queries (max 10 ids each).
        const profileMap: Record<string, { displayName: string; username?: string }> = {};
        await Promise.all(
          chunk(ids, 10).map(async (part) => {
            if (part.length === 0) return;
            const snap = await getDocs(query(collection(db, "users"), where(documentId(), "in", part)));
            snap.docs.forEach((d) => {
              profileMap[d.id] = { displayName: d.data()?.displayName || "Noma'lum", username: d.data()?.username };
            });
          })
        );

        // Today's sessions — only for classes that actually meet today.
        const todayClasses = classes.filter((c) => c.schedule?.some((s) => s.dayOfWeek === todayWeekday));
        const sessMap: Record<string, Record<string, AttendanceStatus>> = {};
        await Promise.all(
          todayClasses.map(async (c) => {
            const s = await getDoc(doc(db, "center_attendance", `${c.id}_${today}`));
            const raw = s.exists() ? (s.data().records || {}) : {};
            // records values are now objects ({ status, ... }); tolerate the legacy string shape.
            const statusMap: Record<string, AttendanceStatus> = {};
            Object.keys(raw).forEach((uid) => {
              const v = raw[uid];
              const st = typeof v === "string" ? v : v?.status;
              if (st) statusMap[uid] = st as AttendanceStatus;
            });
            sessMap[c.id] = statusMap;
          })
        );

        if (mounted) {
          setProfiles(profileMap);
          setTodaySessions(sessMap);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoadingExtra(false);
      }
    })();
    return () => { mounted = false; };
  }, [classes, loadingClasses, today, todayWeekday]);

  // Build one row per student (A→Z), aggregating their groups + today's status.
  const rows = useMemo<StudentRow[]>(() => {
    const byStudent = new Map<string, StudentRow>();

    for (const c of classes) {
      for (const sid of c.studentIds || []) {
        const prof = profiles[sid];
        if (!prof) continue;
        let row = byStudent.get(sid);
        if (!row) {
          row = { id: sid, displayName: prof.displayName, username: prof.username, groups: [], scheduleDays: [], uniformTime: null, todayStatus: "nolesson" };
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

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [quick, setQuick] = useState<"all" | "today" | "absent">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.displayName.toLowerCase().includes(q) && !(r.username || "").toLowerCase().includes(q)) return false;
      if (groupFilter !== "all" && !r.groups.some((g) => g.id === groupFilter)) return false;
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
        <StatCard icon={<Users size={16} />} tone="bg-indigo-50 text-indigo-600" value={rows.length} label="Jami o'quvchi" />
        <StatCard icon={<CalendarCheck size={16} />} tone="bg-slate-100 text-slate-600" value={haveLessonToday} label="Bugun darsi bor" />
        <StatCard icon={<span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />} tone="bg-emerald-50" value={presentToday} label="Bugun keldi" />
        <StatCard icon={<span className="w-2.5 h-2.5 rounded-full bg-rose-500" />} tone="bg-rose-50" value={absentToday} label="Bugun kelmadi" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism yoki @username bo'yicha qidirish..."
            className="w-full pl-9 pr-8 py-2.5 text-[13px] bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Tozalash" className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100">
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="px-3 py-2.5 text-[13px] font-medium bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 transition-colors cursor-pointer"
        >
          <option value="all">Barcha guruhlar</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {([["all", "Hammasi"], ["today", "Bugun darsi bor"], ["absent", "Kelmaganlar"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setQuick(key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                quick === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
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
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 pl-5 pr-2 text-[12px] font-semibold text-slate-400 tabular-nums">{i + 1}</td>

                      {/* Student */}
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-bold text-[11px] flex items-center justify-center">
                            {getInitials(r.displayName)}
                          </span>
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
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-[11px] font-semibold transition-colors max-w-[160px]"
                            >
                              <span className="truncate">{g.title}</span>
                              <ChevronRight size={11} className="shrink-0 opacity-60" />
                            </Link>
                          ))}
                          {r.groups.length > 2 && (
                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-[11px] font-semibold">+{r.groups.length - 2}</span>
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
                                      ? "bg-indigo-600 text-white"
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
    </div>
  );
}

function StatCard({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-2xl">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-lg font-bold text-slate-900 leading-none tabular-nums">{value}</p>
        <p className="text-[12px] text-slate-500 mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
        <CalendarX2 size={24} />
      </div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="text-[13px] text-slate-400 mt-1 max-w-[260px]">{subtitle}</p>
    </div>
  );
}
