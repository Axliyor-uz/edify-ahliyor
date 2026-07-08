"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  Users, CheckCircle, CalendarDays, Clock, AlertTriangle, TrendingUp,
  Loader2, ArrowRight, GraduationCap, UserPlus, DoorOpen, Banknote, Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { useCenterRooms } from "@/hooks/useCenterRooms";
import { getTodayKey, parseDateKey } from "@/lib/dateUtils";
import { fetchCenterSessions, rateOfSessions, tallyStudent, type CenterSession } from "@/services/attendanceService";
import { fetchOpenCharges, fetchPaymentsForMonth, openAmountOf } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";

function rateColor(rate: number | null): string {
  if (rate === null) return "text-slate-400";
  if (rate >= 90) return "text-brand-700";
  if (rate >= 75) return "text-amber-600";
  return "text-rose-600";
}
function rateBar(rate: number | null): string {
  if (rate === null) return "bg-slate-200";
  if (rate >= 90) return "bg-brand-600";
  if (rate >= 75) return "bg-amber-500";
  return "bg-rose-500";
}
function getInitials(name: string): string {
  const p = (name || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
}

interface FinanceSummary {
  collected: number;
  debtTotal: number;
  debtorCount: number;
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
  const { rooms } = useCenterRooms(centerId);

  // Rooms occupied right now (a lesson today whose time window contains the current Tashkent time).
  const nowTime = useMemo(() => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tashkent" }), []);
  const roomsInUse = useMemo(() => {
    const inUse = new Set<string>();
    for (const c of classes)
      for (const s of c.schedule || [])
        if (s.dayOfWeek === todayWeekday && s.roomId && s.startTime <= nowTime && nowTime < s.endTime) inUse.add(s.roomId);
    return inUse;
  }, [classes, todayWeekday, nowTime]);

  const [sessions, setSessions] = useState<CenterSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [names, setNames] = useState<Record<string, string>>({});

  // Month's money snapshot — failure never blocks the attendance widgets.
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [financeLoading, setFinanceLoading] = useState(true);

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

  useEffect(() => {
    if (!centerId) return;
    let mounted = true;
    setFinanceLoading(true);
    Promise.all([fetchPaymentsForMonth(centerId, today.slice(0, 7)), fetchOpenCharges(centerId)])
      .then(([pays, open]) => {
        if (!mounted) return;
        const confirmed = pays.filter((p) => p.status === "confirmed");
        setFinance({
          collected: confirmed.reduce((s, p) => s + (p.type === "refund" ? -p.amount : p.amount), 0),
          debtTotal: open.reduce((s, c) => s + openAmountOf(c), 0),
          debtorCount: new Set(open.map((c) => c.studentId)).size,
        });
      })
      .catch((e) => console.error("Dashboard finance error:", e))
      .finally(() => { if (mounted) setFinanceLoading(false); });
    return () => { mounted = false; };
  }, [centerId, today]);

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
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Boshqaruv paneli</h1>
          <div className="flex items-center gap-2 mt-1">
            <CalendarDays size={14} className="text-brand-600" />
            <p className="text-sm text-slate-500">{currentDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/manager/finance" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-800 rounded-full font-bold text-[13px] transition-colors">
            <Banknote size={15} /> To&apos;lov qabul qilish
          </Link>
          <Link href="/manager/attendance" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-full font-bold text-[13px] shadow-sm shadow-brand-600/25 transition-colors">
            <CheckCircle size={15} /> Davomat belgilash
          </Link>
        </div>
      </header>

      {/* KPI band — one row on desktop, swipeable on mobile (same pattern as FinanceStats) */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 xl:grid-cols-6 md:overflow-visible md:pb-0">
        <KpiCard
          href="/manager/students" Icon={Users} label="O'quvchilar" sub={`${classes.length} guruh`}
          tile="bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30"
          wash="bg-gradient-to-b from-emerald-50/70 to-white"
          value={loading ? null : String(uniqueStudentIds.length)}
        />
        <KpiCard
          href="/manager/finance" Icon={TrendingUp} label="Tushum" sub="shu oy"
          tile="bg-gradient-to-br from-teal-400 to-emerald-600 shadow-emerald-500/30"
          wash="bg-gradient-to-b from-emerald-50/70 to-white"
          value={financeLoading ? null : finance ? formatUZS(finance.collected) : "—"}
          valueClass="text-brand-800"
        />
        <KpiCard
          href="/manager/finance" Icon={Wallet} label="Qarzdorlik" sub={finance ? `${finance.debtorCount} ta qarzdor` : "jami"}
          tile="bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/30"
          wash="bg-gradient-to-b from-rose-50/70 to-white"
          value={financeLoading ? null : finance ? formatUZS(finance.debtTotal) : "—"}
          valueClass={finance && finance.debtTotal > 0 ? "text-rose-600" : "text-slate-900"}
        />
        <KpiCard
          href="/manager/attendance" Icon={CheckCircle} label="Bugungi davomat" sub={todaySessions.length > 0 ? "belgilangan darslar" : "hali belgilanmagan"}
          tile="bg-gradient-to-br from-sky-400 to-sky-600 shadow-sky-500/30"
          wash="bg-gradient-to-b from-sky-50/70 to-white"
          value={loading ? null : todayRate === null ? "—" : `${todayRate}%`}
          valueClass={rateColor(todayRate)}
        />
        <KpiCard
          href="/manager/attendance" Icon={CalendarDays} label="Oylik davomat" sub="shu oy o'rtacha"
          tile="bg-gradient-to-br from-violet-400 to-violet-600 shadow-violet-500/30"
          wash="bg-gradient-to-b from-violet-50/70 to-white"
          value={loading ? null : monthRate === null ? "—" : `${monthRate}%`}
          valueClass={rateColor(monthRate)}
        />
        <KpiCard
          href="/manager/students" Icon={AlertTriangle} label="E'tibor talab" sub="past davomatli o'quvchi"
          tile="bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-400/30"
          wash="bg-gradient-to-b from-amber-50/70 to-white"
          value={loading ? null : String(chronic.length)}
          valueClass={chronic.length > 0 ? "text-rose-600" : "text-slate-900"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's lessons */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-bold text-slate-900 tracking-tight">Bugungi darslar</h2>
              {rooms.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-100 text-brand-800 rounded-full text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-600" /> {roomsInUse.size}/{rooms.length} xona band
                </span>
              )}
            </div>
            <Link href="/manager/attendance" className="text-[13px] font-bold text-brand-700 hover:text-brand-800 hover:underline underline-offset-4 transition-colors">Barchasi</Link>
          </div>

          <div className="bg-white border border-brand-line rounded-3xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-slate-400" size={26} /></div>
            ) : todayLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-14 px-6">
                <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-700 mb-3"><CalendarDays size={22} /></div>
                <p className="text-sm font-bold text-slate-800">Bugun dars yo&apos;q</p>
                <p className="text-[13px] text-slate-400 mt-1">Jadval bo&apos;yicha bugunga dars rejalashtirilmagan</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayLessons.map((l) => {
                  const done = l.total > 0 && l.marked >= l.total;
                  return (
                    <Link key={l.id} href={`/manager/attendance/${l.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-brand-25 transition-colors group">
                      <div className="w-16 shrink-0">
                        <div className="flex items-center gap-1 text-[13px] font-bold text-slate-700"><Clock size={13} className="text-brand-600" />{l.slot?.startTime}</div>
                        <p className="text-[11px] text-slate-400 tabular-nums">{l.slot?.endTime}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-slate-900 truncate group-hover:text-brand-800 transition-colors">{l.title}</p>
                        <p className="text-[12px] text-slate-500 truncate flex items-center gap-1.5">
                          {l.teacherName || "O'qituvchi yo'q"}
                          {l.slot?.roomName && <span className="inline-flex items-center gap-0.5 text-brand-700 font-semibold"><DoorOpen size={11} /> {l.slot.roomName}</span>}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {l.rate !== null && <p className={`text-[14px] font-bold tabular-nums ${rateColor(l.rate)}`}>{l.rate}%</p>}
                        <p className={`text-[11px] font-semibold ${done ? "text-brand-700" : "text-slate-400"} tabular-nums`}>{l.marked}/{l.total} belgilandi</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Watch list */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-500" />
            <h2 className="text-[16px] font-bold text-slate-900 tracking-tight">E&apos;tibor talab</h2>
          </div>
          <div className="bg-white border border-brand-line rounded-3xl p-2">
            {loading ? (
              <div className="flex items-center justify-center py-14"><Loader2 className="animate-spin text-slate-400" size={22} /></div>
            ) : chronicTop.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <div className="w-11 h-11 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 mb-2"><CheckCircle size={20} /></div>
                <p className="text-[13px] font-bold text-slate-800">Hammasi joyida</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Past davomatli o&apos;quvchi yo&apos;q</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {chronicTop.map((c) => (
                  <div key={c.uid} className="flex items-center gap-2.5 px-2.5 py-2 rounded-2xl hover:bg-brand-25 transition-colors">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-rose-50 text-rose-600 font-bold text-[11px] flex items-center justify-center">{getInitials(names[c.uid] || "?")}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{names[c.uid] || "Yuklanmoqda..."}</p>
                      <p className="text-[11px] text-slate-400 tabular-nums">{c.t.absent} marta kelmagan</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-bold text-rose-600 tabular-nums">{c.t.rate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href="/manager/students" className="flex items-center justify-between p-3.5 bg-white border border-brand-line rounded-3xl hover:border-brand-200 hover:shadow-sm transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center text-brand-700"><UserPlus size={17} /></div>
              <span className="font-bold text-[13px] text-slate-800">Barcha o&apos;quvchilar</span>
            </div>
            <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
          </Link>
          <Link href="/manager/finance" className="flex items-center justify-between p-3.5 bg-white border border-brand-line rounded-3xl hover:border-brand-200 hover:shadow-sm transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center text-brand-700"><Wallet size={17} /></div>
              <span className="font-bold text-[13px] text-slate-800">To&apos;lovlar va qarzdorlar</span>
            </div>
            <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>

      {/* Per-group rates */}
      <div className="space-y-3">
        <h2 className="text-[16px] font-bold text-slate-900 tracking-tight">Guruhlar bo&apos;yicha davomat</h2>
        <div className="bg-white border border-brand-line rounded-3xl p-2">
          {loading ? (
            <div className="flex items-center justify-center py-14"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
          ) : groupRates.length === 0 ? (
            <p className="text-center text-[13px] text-slate-400 py-10">Guruhlar yo&apos;q</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {groupRates.map((g) => (
                <Link key={g.id} href={`/manager/attendance/${g.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-brand-25 transition-colors group">
                  <div className="w-9 h-9 shrink-0 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center"><GraduationCap size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-slate-900 truncate group-hover:text-brand-800 transition-colors">{g.title}</p>
                      <span className={`text-[13px] font-bold tabular-nums shrink-0 ${rateColor(g.rate)}`}>{g.rate === null ? "—" : `${g.rate}%`}</span>
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

/** KPI tile — same anatomy as the finance stats cards, but clickable. */
function KpiCard({ href, Icon, tile, wash, label, sub, value, valueClass }: {
  href: string; Icon: LucideIcon; tile: string; wash: string;
  label: string; sub: string; value: string | null; valueClass?: string;
}) {
  return (
    <Link
      href={href}
      className={`snap-start shrink-0 w-[176px] md:w-auto md:shrink border border-brand-line rounded-3xl p-4 transition-all hover:shadow-md hover:shadow-slate-200/60 hover:-translate-y-0.5 ${wash}`}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md ${tile}`}>
          <Icon size={17} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-[11.5px] font-bold text-slate-700">{label}</p>
          <p className="text-[10px] text-slate-400 truncate">{sub}</p>
        </div>
      </div>
      {value === null ? (
        <div className="h-6 flex items-center"><Loader2 size={16} className="animate-spin text-slate-300" /></div>
      ) : (
        <p className={`text-[15px] xl:text-[16px] font-bold tabular-nums leading-tight whitespace-nowrap ${valueClass || "text-slate-900"}`}>
          {value}
        </p>
      )}
    </Link>
  );
}
