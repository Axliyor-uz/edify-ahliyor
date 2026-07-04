"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  Users, CheckCircle, CalendarDays, Clock, AlertTriangle, TrendingUp,
  Loader2, ArrowRight, GraduationCap, UserPlus,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { getTodayKey, parseDateKey } from "@/lib/dateUtils";
import { fetchCenterSessions, rateOfSessions, tallyStudent, type CenterSession } from "@/services/attendanceService";

function rateColor(rate: number | null): string {
  if (rate === null) return "text-slate-400";
  if (rate >= 90) return "text-emerald-600";
  if (rate >= 75) return "text-amber-600";
  return "text-rose-600";
}
function rateBar(rate: number | null): string {
  if (rate === null) return "bg-slate-200";
  if (rate >= 90) return "bg-emerald-500";
  if (rate >= 75) return "bg-amber-500";
  return "bg-rose-500";
}
function getInitials(name: string): string {
  const p = (name || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [centerId, setCenterId] = useState<string | null>(null);
  const today = useMemo(() => getTodayKey(), []);
  const monthStart = useMemo(() => today.slice(0, 8) + "01", [today]);
  const todayWeekday = useMemo(() => parseDateKey(today).getDay(), [today]);

  const currentDate = useMemo(
    () => new Date().toLocaleDateString("uz-UZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    []
  );

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { classes, isLoading: loadingClasses } = useCenterClasses(centerId);

  const [sessions, setSessions] = useState<CenterSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!centerId) return;
    let mounted = true;
    setLoadingSessions(true);
    fetchCenterSessions(centerId, monthStart, today)
      .then((s) => { if (mounted) setSessions(s); })
      .catch((e) => console.error(e))
      .finally(() => { if (mounted) setLoadingSessions(false); });
    return () => { mounted = false; };
  }, [centerId, monthStart, today]);

  const uniqueStudentIds = useMemo(() => {
    const s = new Set<string>();
    classes.forEach((c) => (c.studentIds || []).forEach((id) => s.add(id)));
    return [...s];
  }, [classes]);

  const todaySessions = useMemo(() => sessions.filter((s) => s.date === today), [sessions, today]);
  const todayRate = useMemo(() => rateOfSessions(todaySessions, today).rate, [todaySessions, today]);
  const monthRate = useMemo(() => rateOfSessions(sessions, today).rate, [sessions, today]);

  // Students under 75% with enough data — the ones to watch.
  const chronic = useMemo(() => {
    return uniqueStudentIds
      .map((uid) => ({ uid, t: tallyStudent(sessions, uid, today) }))
      .filter((x) => x.t.rate !== null && x.t.denom >= 3 && (x.t.rate as number) < 75)
      .sort((a, b) => (a.t.rate as number) - (b.t.rate as number));
  }, [uniqueStudentIds, sessions, today]);

  const chronicTop = useMemo(() => chronic.slice(0, 8), [chronic]);

  // Fetch display names for the flagged students only.
  useEffect(() => {
    const need = chronicTop.map((c) => c.uid).filter((id) => !(id in names));
    if (need.length === 0) return;
    let mounted = true;
    Promise.all(need.map((id) => getDoc(doc(db, "users", id)))).then((snaps) => {
      if (!mounted) return;
      setNames((prev) => {
        const m = { ...prev };
        snaps.forEach((s) => { if (s.exists()) m[s.id] = s.data()?.displayName || "Noma'lum"; });
        return m;
      });
    });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chronicTop]);

  const todayLessons = useMemo(() => {
    return classes
      .filter((c) => c.schedule?.some((s) => s.dayOfWeek === todayWeekday))
      .map((c) => {
        const sess = todaySessions.find((s) => s.classId === c.id);
        const marked = sess ? Object.keys(sess.records).length : 0;
        const total = c.studentIds?.length || 0;
        const slot = c.schedule?.find((s) => s.dayOfWeek === todayWeekday);
        const rate = sess ? rateOfSessions([sess], today).rate : null;
        return { id: c.id, title: c.title, teacherName: c.teacherName, slot, marked, total, rate };
      })
      .sort((a, b) => (a.slot?.startTime || "").localeCompare(b.slot?.startTime || ""));
  }, [classes, todaySessions, todayWeekday, today]);

  const groupRates = useMemo(() => {
    return classes
      .map((c) => ({
        id: c.id, title: c.title, teacherName: c.teacherName,
        count: c.studentIds?.length || 0,
        ...rateOfSessions(sessions.filter((s) => s.classId === c.id), today),
      }))
      .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));
  }, [classes, sessions, today]);

  const loading = loadingClasses || loadingSessions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-[28px] font-black text-slate-900 tracking-tight leading-tight">Boshqaruv paneli</h1>
          <div className="flex items-center gap-2 mt-1">
            <CalendarDays size={14} className="text-amber-500" />
            <p className="text-[14px] font-medium text-slate-500">{currentDate}</p>
          </div>
        </div>
        <Link href="/manager/attendance" className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[13px] shadow-sm shadow-indigo-600/25 transition-colors">
          <CheckCircle size={16} /> Davomat belgilash
        </Link>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <KpiCard icon={<Users size={20} strokeWidth={2.5} />} tint="blue" label="O'quvchilar" value={loading ? null : String(uniqueStudentIds.length)} sub={`${classes.length} guruh`} />
        <KpiCard icon={<CheckCircle size={20} strokeWidth={2.5} />} tint="emerald" label="Bugungi davomat" value={loading ? null : todayRate === null ? "—" : `${todayRate}%`} sub={todaySessions.length > 0 ? "belgilangan darslar asosida" : "hali belgilanmagan"} valueClass={rateColor(todayRate)} />
        <KpiCard icon={<TrendingUp size={20} strokeWidth={2.5} />} tint="violet" label="Oylik davomat" value={loading ? null : monthRate === null ? "—" : `${monthRate}%`} sub="shu oy o'rtacha" valueClass={rateColor(monthRate)} />
        <KpiCard icon={<AlertTriangle size={20} strokeWidth={2.5} />} tint="rose" label="E'tibor talab" value={loading ? null : String(chronic.length)} sub="past davomatli o'quvchi" valueClass={chronic.length > 0 ? "text-rose-600" : "text-slate-900"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's lessons */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-black text-slate-900 tracking-tight">Bugungi darslar</h2>
            <Link href="/manager/attendance" className="text-[13px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline underline-offset-4 transition-colors">Barchasi</Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-slate-400" size={26} /></div>
            ) : todayLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-14 px-6">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3"><CalendarDays size={22} /></div>
                <p className="text-[14px] font-semibold text-slate-700">Bugun dars yo&apos;q</p>
                <p className="text-[12.5px] text-slate-400 mt-1">Jadval bo&apos;yicha bugunga rejalashtirilgan dars topilmadi.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayLessons.map((l) => {
                  const done = l.total > 0 && l.marked >= l.total;
                  return (
                    <Link key={l.id} href={`/manager/attendance/${l.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                      <div className="w-16 shrink-0">
                        <div className="flex items-center gap-1 text-[13px] font-bold text-slate-700"><Clock size={13} className="text-amber-500" />{l.slot?.startTime}</div>
                        <p className="text-[11px] text-slate-400 tabular-nums">{l.slot?.endTime}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{l.title}</p>
                        <p className="text-[12px] text-slate-500 truncate">{l.teacherName || "O'qituvchi yo'q"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {l.rate !== null && <p className={`text-[14px] font-black tabular-nums ${rateColor(l.rate)}`}>{l.rate}%</p>}
                        <p className={`text-[11px] font-semibold ${done ? "text-emerald-600" : "text-slate-400"} tabular-nums`}>{l.marked}/{l.total} belgilandi</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Watch list */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-500" />
            <h2 className="text-[16px] font-black text-slate-900 tracking-tight">E&apos;tibor talab</h2>
          </div>
          <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm p-2">
            {loading ? (
              <div className="flex items-center justify-center py-14"><Loader2 className="animate-spin text-slate-400" size={22} /></div>
            ) : chronicTop.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-2"><CheckCircle size={20} /></div>
                <p className="text-[13px] font-semibold text-slate-700">Hammasi joyida</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Past davomatli o&apos;quvchi yo&apos;q.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {chronicTop.map((c) => (
                  <div key={c.uid} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-rose-100 to-rose-50 text-rose-600 font-bold text-[11px] flex items-center justify-center">{getInitials(names[c.uid] || "?")}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-slate-900 truncate">{names[c.uid] || "Yuklanmoqda..."}</p>
                      <p className="text-[11px] text-slate-400 tabular-nums">{c.t.absent} marta kelmagan</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-black text-rose-600 tabular-nums">{c.t.rate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href="/manager/students" className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-2xl hover:border-indigo-200 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><UserPlus size={18} strokeWidth={2.5} /></div>
              <span className="font-bold text-[13px] text-slate-800">Barcha o&apos;quvchilar</span>
            </div>
            <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>

      {/* Per-group rates */}
      <div className="space-y-4">
        <h2 className="text-[18px] font-black text-slate-900 tracking-tight">Guruhlar bo&apos;yicha davomat</h2>
        <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm p-2">
          {loading ? (
            <div className="flex items-center justify-center py-14"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
          ) : groupRates.length === 0 ? (
            <p className="text-center text-[13px] text-slate-400 py-10">Guruhlar yo&apos;q.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {groupRates.map((g) => (
                <Link key={g.id} href={`/manager/attendance/${g.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group">
                  <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center"><GraduationCap size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{g.title}</p>
                      <span className={`text-[13px] font-black tabular-nums shrink-0 ${rateColor(g.rate)}`}>{g.rate === null ? "—" : `${g.rate}%`}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${rateBar(g.rate)}`} style={{ width: `${g.rate ?? 0}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, tint, label, value, sub, valueClass }: {
  icon: React.ReactNode; tint: "blue" | "emerald" | "violet" | "rose"; label: string;
  value: string | null; sub: string; valueClass?: string;
}) {
  const tints: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 from-blue-50",
    emerald: "bg-emerald-50 text-emerald-600 from-emerald-50",
    violet: "bg-violet-50 text-violet-600 from-violet-50",
    rose: "bg-rose-50 text-rose-600 from-rose-50",
  };
  return (
    <div className="bg-white p-5 rounded-[1.25rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-colors">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${tints[tint].split(" ")[2]} to-transparent rounded-bl-[100px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity`} />
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${tints[tint].split(" ").slice(0, 2).join(" ")}`}>{icon}</div>
        <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">{label}</h3>
      </div>
      {value === null ? (
        <div className="h-9 flex items-center"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
      ) : (
        <p className={`text-3xl font-black tracking-tight ${valueClass || "text-slate-900"}`}>{value}</p>
      )}
      <p className="text-[12px] font-medium text-slate-400 mt-1">{sub}</p>
    </div>
  );
}
