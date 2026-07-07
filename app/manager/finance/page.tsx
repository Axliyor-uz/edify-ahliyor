"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { fetchCenterSessions, tallyStudent } from "@/services/attendanceService";
import {
  fetchChargesForMonth,
  fetchExpensesForMonth,
  fetchFinanceSettings,
  fetchOpenCharges,
  fetchPaymentsForMonth,
  fetchPositiveBalances,
  fetchRecentPayments,
  openAmountOf,
} from "@/services/financeService";
import type { Charge, Expense, FinanceSettings, Payment } from "@/types/finance";
import { getTodayKey, monthKeyOf } from "@/lib/dateUtils";
import FinanceStats from "./_components/FinanceStats";
import GenerateChargesBanner from "./_components/GenerateChargesBanner";
import PaymentsTab from "./_components/PaymentsTab";
import DebtorsTab from "./_components/DebtorsTab";
import ChargesTab from "./_components/ChargesTab";
import PayrollTab from "./_components/PayrollTab";
import ExpensesTab from "./_components/ExpensesTab";
import SettingsTab from "./_components/SettingsTab";
import RecordPaymentModal from "./_components/RecordPaymentModal";
import StartGuide from "./_components/StartGuide";
import { monthLabelOf, shiftMonthKey } from "./_components/financeFormat";

type Tab = "payments" | "debtors" | "charges" | "payroll" | "expenses" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "payments", label: "To'lovlar" },
  { key: "debtors", label: "Qarzdorlar" },
  { key: "charges", label: "Hisob-kitob" },
  { key: "payroll", label: "Oyliklar" },
  { key: "expenses", label: "Xarajatlar" },
  { key: "settings", label: "Sozlamalar" },
];

export default function ManagerFinancePage() {
  const { user } = useAuth();
  const [centerId, setCenterId] = useState<string | null>(null);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const { classes, refetch: refetchClasses } = useCenterClasses(centerId);

  const todayKey = useMemo(() => getTodayKey(), []);
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(getTodayKey()));
  const [tab, setTab] = useState<Tab>("payments");

  const [charges, setCharges] = useState<Charge[]>([]);
  const [openCharges, setOpenCharges] = useState<Charge[]>([]);
  const [monthPayments, setMonthPayments] = useState<Payment[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [avansTotal, setAvansTotal] = useState(0);
  const [bannerToken, setBannerToken] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [attendanceRates, setAttendanceRates] = useState<Record<string, number | null> | null>(null);
  const [payModal, setPayModal] = useState<{ open: boolean; uid?: string }>({ open: false });

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => {
      if (p?.centerId) setCenterId(p.centerId);
    });
  }, [user]);

  useEffect(() => {
    if (!centerId) return;
    fetchFinanceSettings(centerId)
      .then(setSettings)
      .catch(() => toast.error("Sozlamalarni yuklashda xatolik."));
  }, [centerId]);

  const anchor = settings?.billingAnchor;
  const reload = useCallback(async () => {
    if (!centerId || !anchor) return;
    setLoadingData(true);
    try {
      const [ch, open, mp, rp, positives, exp] = await Promise.all([
        fetchChargesForMonth(centerId, monthKey, anchor),
        fetchOpenCharges(centerId),
        fetchPaymentsForMonth(centerId, monthKey),
        fetchRecentPayments(centerId, 50),
        fetchPositiveBalances(centerId),
        fetchExpensesForMonth(centerId, monthKey),
      ]);
      setCharges(ch);
      setOpenCharges(open);
      setMonthPayments(mp);
      setRecentPayments(rp);
      setAvansTotal(positives.reduce((s, p) => s + p.balance, 0));
      setExpenses(exp);
      setBannerToken((t) => t + 1);
    } catch (err) {
      console.error("Finance load error:", err);
      toast.error("Ma'lumotlarni yuklashda xatolik.");
    } finally {
      setLoadingData(false);
    }
  }, [centerId, anchor, monthKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Current-month attendance % for the debtor list (a "he owes 2 months AND
  // missed 6 lessons" conversation aid). Failure here never blocks the list.
  useEffect(() => {
    if (!centerId || openCharges.length === 0) {
      setAttendanceRates({});
      return;
    }
    let mounted = true;
    fetchCenterSessions(centerId, `${monthKeyOf(todayKey)}-01`, todayKey)
      .then((sessions) => {
        if (!mounted) return;
        const map: Record<string, number | null> = {};
        for (const uid of new Set(openCharges.map((c) => c.studentId))) {
          map[uid] = tallyStudent(sessions, uid, todayKey).rate;
        }
        setAttendanceRates(map);
      })
      .catch(() => mounted && setAttendanceRates(null));
    return () => {
      mounted = false;
    };
  }, [centerId, openCharges, todayKey]);

  const stats = useMemo(() => {
    const confirmed = monthPayments.filter((p) => p.status === "confirmed");
    const collected = confirmed.reduce((s, p) => s + (p.type === "payment" ? p.amount : -p.amount), 0);
    const charged = charges.filter((c) => c.status !== "cancelled").reduce((s, c) => s + c.amount, 0);
    const debtTotal = openCharges.reduce((s, c) => s + openAmountOf(c), 0);
    const expensesTotal = expenses.filter((e) => e.status === "active").reduce((s, e) => s + e.amount, 0);
    return { collected, charged, debtTotal, expensesTotal, profit: collected - expensesTotal };
  }, [monthPayments, charges, openCharges, expenses]);

  const unbilledClassTitles = useMemo(
    () => classes.filter((c) => (c.studentIds?.length || 0) > 0 && !(c.monthlyFee && c.monthlyFee > 0)).map((c) => c.title),
    [classes]
  );

  const debtorCount = useMemo(() => new Set(openCharges.map((c) => c.studentId)).size, [openCharges]);
  const monthLabel = monthLabelOf(monthKey);

  // Onboarding: data-driven checklist, disappears once the center is fully set up.
  const guideSteps = useMemo(() => {
    const step1 = classes.some((c) => (c.monthlyFee || 0) > 0);
    const step2 = charges.length > 0 || openCharges.length > 0;
    const step3 = recentPayments.length > 0;
    return { step1, step2, step3, allDone: step1 && step2 && step3 };
  }, [classes, charges, openCharges, recentPayments]);

  if (!centerId || !settings) {
    return (
      <div className="py-24 flex justify-center text-slate-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Moliya</h1>
        <p className="text-sm text-slate-500 mt-0.5">To&apos;lovlar, qarzdorlar va hisob-kitob</p>
      </div>

      {!loadingData && !guideSteps.allDone && (
        <StartGuide
          steps={[
            {
              done: guideSteps.step1,
              title: "Guruh narxlarini belgilang",
              desc: "Har bir guruhga oylik narx qo'ying — hisob-kitob shu narxdan hisoblanadi.",
              actionLabel: "Narx belgilash",
              onAction: () => setTab("settings"),
            },
            {
              done: guideSteps.step2,
              title: "Hisob-kitob yarating",
              desc: "Oyda bir marta bosiladi — kim qancha to'lashi kerakligi avtomatik hisoblanadi.",
              actionLabel: "Hisob-kitob",
              onAction: () => setTab("charges"),
            },
            {
              done: guideSteps.step3,
              title: "To'lovlarni qabul qiling",
              desc: "O'quvchi pul olib kelganda shu yerga yozasiz — qarz avtomatik kamayadi.",
              actionLabel: "To'lov kiritish",
              onAction: () => setPayModal({ open: true }),
            },
          ]}
        />
      )}

      <GenerateChargesBanner
        anchor={settings.billingAnchor}
        monthKey={monthKey}
        monthLabel={monthLabel}
        refreshToken={bannerToken}
        onGenerated={reload}
      />

      <FinanceStats
        monthLabel={monthLabel}
        collected={stats.collected}
        charged={stats.charged}
        debtTotal={stats.debtTotal}
        avansTotal={avansTotal}
        expensesTotal={stats.expensesTotal}
        profit={stats.profit}
      />

      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-colors ${
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            {t.key === "debtors" && debtorCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded-full text-[10.5px]">
                {debtorCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loadingData && tab !== "settings" ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : tab === "payments" ? (
        <PaymentsTab
          payments={recentPayments}
          onOpenModal={() => setPayModal({ open: true })}
          onChanged={reload}
        />
      ) : tab === "debtors" ? (
        <DebtorsTab
          openCharges={openCharges}
          attendanceRates={attendanceRates}
          todayKey={todayKey}
          onRecordPayment={(uid) => setPayModal({ open: true, uid })}
        />
      ) : tab === "charges" ? (
        <ChargesTab
          charges={charges}
          monthLabel={monthLabel}
          onShiftMonth={(delta) => setMonthKey((k) => shiftMonthKey(k, delta))}
          unbilledClassTitles={unbilledClassTitles}
          onChanged={reload}
        />
      ) : tab === "payroll" ? (
        <PayrollTab
          monthKey={monthKey}
          monthLabel={monthLabel}
          onShiftMonth={(delta) => setMonthKey((k) => shiftMonthKey(k, delta))}
          onExpensesChanged={reload}
        />
      ) : tab === "expenses" ? (
        <ExpensesTab
          expenses={expenses}
          categories={settings.expenseCategories}
          monthLabel={monthLabel}
          onShiftMonth={(delta) => setMonthKey((k) => shiftMonthKey(k, delta))}
          onChanged={reload}
        />
      ) : (
        <SettingsTab
          settings={settings}
          onSaved={setSettings}
          classes={classes}
          onClassesChanged={() => {
            refetchClasses();
            reload();
          }}
        />
      )}

      {payModal.open && (
        <RecordPaymentModal
          centerId={centerId}
          classes={classes}
          preselectUid={payModal.uid || null}
          onClose={() => setPayModal({ open: false })}
          onDone={() => {
            setPayModal({ open: false });
            reload();
          }}
        />
      )}
    </div>
  );
}
