"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgePercent,
  Banknote,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  Snowflake,
  X,
} from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import ConfirmDialog from "../../_components/ConfirmDialog";
import { getUserProfile, type UserProfile } from "@/services/userService";
import type { ClassData } from "@/hooks/useCenterClasses";
import {
  fetchStudentCharges,
  fetchStudentFinanceProfile,
  fetchStudentPayments,
  openAmountOf,
  patchStudentFinanceApi,
} from "@/services/financeService";
import { PAYMENT_METHOD_LABELS } from "@/types/finance";
import type { Charge, Payment, StudentFinanceProfile } from "@/types/finance";
import { formatUZS } from "@/lib/finance/money";
import { getTodayKey } from "@/lib/dateUtils";
import { initialsOf, periodLabelOf, shortDateLabel } from "./financeFormat";

interface Props {
  centerId: string;
  studentId: string;
  /** Name snapshot from the list row — shown instantly while the profile loads. */
  fallbackName: string;
  classes: ClassData[];
  onClose: () => void;
  /** Close this dialog and open the payment modal preselected on the student. */
  onRecordPayment: (studentId: string) => void;
}

/**
 * Full finance profile of one student: identity, balance/debt summary, groups
 * with effective monthly price, open charges, and recent payment history.
 */
export default function StudentInfoDialog({
  centerId,
  studentId,
  fallbackName,
  classes,
  onClose,
  onRecordPayment,
}: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [finance, setFinance] = useState<StudentFinanceProfile | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Discount / freeze management (same API as the students-menu finance card).
  const [busy, setBusy] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [confirmFreeze, setConfirmFreeze] = useState(false);

  const todayYear = useMemo(() => getTodayKey().slice(0, 4), []);

  // The dialog remounts per student (keyed in page.tsx), so `loading` starts true.
  useEffect(() => {
    let mounted = true;
    Promise.all([
      getUserProfile(studentId),
      fetchStudentFinanceProfile(centerId, studentId),
      fetchStudentCharges(centerId, studentId),
      fetchStudentPayments(centerId, studentId, 30),
    ])
      .then(([prof, fin, ch, pays]) => {
        if (!mounted) return;
        setProfile(prof);
        setFinance(fin);
        setCharges(ch);
        setPayments(pays);
      })
      .catch(() => mounted && toast.error("Ma'lumotlarni yuklashda xatolik."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [centerId, studentId]);

  const groups = useMemo(
    () => classes.filter((c) => (c.studentIds || []).includes(studentId)),
    [classes, studentId]
  );

  /** Override beats monthlyFee AND discountPercent (types/finance.ts). */
  const effectiveFee = (c: ClassData) => {
    const override = finance?.priceOverrides?.[c.id];
    if (typeof override === "number") return override;
    const base = c.monthlyFee || 0;
    const discount = finance?.discountPercent || 0;
    return discount > 0 ? Math.round(base * (1 - discount / 100)) : base;
  };

  const openCharges = useMemo(
    () =>
      charges
        .filter((c) => c.status === "pending" || c.status === "partial")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [charges]
  );
  const totalDebt = openCharges.reduce((s, c) => s + openAmountOf(c), 0);
  const monthlyTotal = groups.reduce((s, c) => s + effectiveFee(c), 0);
  const balance = finance?.balance ?? 0;
  const frozen = finance?.financeStatus === "frozen";
  const lastPayment = payments.find((p) => p.type === "payment" && p.status === "confirmed");

  const refreshFinance = async () => {
    setFinance(await fetchStudentFinanceProfile(centerId, studentId));
  };

  const saveDiscount = async () => {
    const v = discountInput.trim() === "" ? 0 : parseInt(discountInput, 10);
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      toast.error("Chegirma 0–100% oralig'ida bo'lishi kerak.");
      return;
    }
    setBusy(true);
    try {
      await patchStudentFinanceApi(studentId, { discountPercent: v === 0 ? null : v });
      toast.success(v === 0 ? "Chegirma olib tashlandi." : `Chegirma ${v}% saqlandi — keyingi hisoblarga qo'llanadi.`);
      setEditingDiscount(false);
      await refreshFinance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xatolik yuz berdi.");
    } finally {
      setBusy(false);
    }
  };

  const toggleFreeze = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await patchStudentFinanceApi(studentId, { financeStatus: frozen ? "active" : "frozen" });
      toast.success(
        frozen
          ? "O'quvchi aktivlashtirildi — hisob-kitob davom etadi."
          : "O'quvchi muzlatildi — yangi hisoblar yaratilmaydi."
      );
      setConfirmFreeze(false);
      await refreshFinance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xatolik yuz berdi.");
    } finally {
      setBusy(false);
    }
  };

  const dateLabel = (dateKey: string) =>
    dateKey.slice(0, 4) === todayYear ? shortDateLabel(dateKey) : `${shortDateLabel(dateKey)} ${dateKey.slice(0, 4)}`;

  const name = profile?.displayName || fallbackName;

  return (
    <>
    <ManagerSheet onClose={onClose}>
      <div className="p-5 sm:p-6">
        {/* ── Header: identity ── */}
        <div className="flex items-start gap-4">
          {profile?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element -- photos come from arbitrary auth providers (Google etc.); plain <img> like the rest of the manager panel
            <img
              src={profile.photoURL}
              alt=""
              width={64}
              height={64}
              className="w-16 h-16 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-[20px] font-bold shrink-0">
              {initialsOf(name)}
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-[17px] font-bold text-slate-900 tracking-tight truncate">{name}</h3>
            {profile?.email && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-slate-500 mt-1 truncate">
                <Mail size={12} className="shrink-0" /> {profile.email}
              </p>
            )}
            {profile?.phone && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-slate-500 mt-0.5">
                <Phone size={12} className="shrink-0" /> {profile.phone}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {finance?.financeStatus === "frozen" && (
                <span className="px-2.5 py-1 bg-sky-50 text-sky-600 rounded-full text-[11px] font-bold">
                  Muzlatilgan
                </span>
              )}
              {(finance?.discountPercent || 0) > 0 && (
                <span className="px-2.5 py-1 bg-violet-50 text-violet-600 rounded-full text-[11px] font-bold">
                  Chegirma {finance!.discountPercent}%
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="py-14 flex justify-center text-slate-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* ── Summary: balance / debt / monthly ── */}
            <div className="bg-brand-25 border border-brand-line rounded-3xl px-4 py-3">
              <div className="grid grid-cols-3 divide-x divide-brand-line">
                <div className="pr-3">
                  <p className="text-[11.5px] font-semibold text-slate-500">Balans</p>
                  <p
                    className={`text-[13.5px] font-bold tabular-nums mt-0.5 truncate ${
                      balance < 0 ? "text-rose-600" : balance > 0 ? "text-brand-700" : "text-slate-800"
                    }`}
                  >
                    {formatUZS(balance)}
                  </p>
                </div>
                <div className="px-3">
                  <p className="text-[11.5px] font-semibold text-slate-500">Qarz</p>
                  <p
                    className={`text-[13.5px] font-bold tabular-nums mt-0.5 truncate ${
                      totalDebt > 0 ? "text-rose-600" : "text-slate-800"
                    }`}
                  >
                    {formatUZS(totalDebt)}
                  </p>
                </div>
                <div className="pl-3">
                  <p className="text-[11.5px] font-semibold text-slate-500">Oyiga to&apos;lov</p>
                  <p className="text-[13.5px] font-bold text-slate-800 tabular-nums mt-0.5 truncate">
                    {formatUZS(monthlyTotal)}
                  </p>
                </div>
              </div>
              <p className="text-[12px] text-slate-500 mt-2.5 pt-2.5 border-t border-brand-line">
                {lastPayment ? (
                  <>
                    Oxirgi to&apos;lov:{" "}
                    <span className="font-bold text-slate-700">
                      {dateLabel(lastPayment.paidAt)} · {formatUZS(lastPayment.amount)} ·{" "}
                      {PAYMENT_METHOD_LABELS[lastPayment.method] || lastPayment.method}
                    </span>
                  </>
                ) : (
                  "Hali to'lov qilmagan"
                )}
              </p>
            </div>

            {/* ── Discount / freeze management ── */}
            {editingDiscount ? (
              <div className="bg-white border border-brand-line rounded-3xl p-4">
                <p className="text-[13.5px] font-bold text-slate-800 flex items-center gap-1.5">
                  <BadgePercent size={15} className="text-violet-500" /> Chegirma foizi
                </p>
                <p className="text-[12px] text-slate-400 mt-1">
                  Keyingi hisob-kitoblardan boshlab qo&apos;llanadi. 0% — chegirmani olib tashlaydi.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[0, 5, 10, 15, 20, 50].map((v) => (
                    <button
                      key={v}
                      onClick={() => setDiscountInput(String(v))}
                      className={`px-3.5 py-2 rounded-full text-[12.5px] font-bold border transition-colors ${
                        discountInput === String(v)
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-slate-600 border-brand-line hover:border-violet-400"
                      }`}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="%"
                    className="w-20 px-3 py-2.5 border border-brand-line rounded-full text-[14px] font-bold text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                  <button
                    onClick={() => setEditingDiscount(false)}
                    disabled={busy}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[12.5px] font-bold transition-colors disabled:opacity-60"
                  >
                    Bekor qilish
                  </button>
                  <button
                    onClick={saveDiscount}
                    disabled={busy}
                    className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-full text-[12.5px] font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {busy && <Loader2 size={13} className="animate-spin" />}
                    Saqlash
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setDiscountInput(finance?.discountPercent ? String(finance.discountPercent) : "");
                    setEditingDiscount(true);
                  }}
                  disabled={busy}
                  className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full text-[12.5px] font-bold border transition-colors disabled:opacity-50 ${
                    (finance?.discountPercent || 0) > 0
                      ? "bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100"
                      : "bg-white text-slate-600 border-brand-line hover:border-violet-400 hover:text-violet-600"
                  }`}
                >
                  <BadgePercent size={15} />
                  {finance?.discountPercent ? `Chegirma ${finance.discountPercent}%` : "Chegirma qo'shish"}
                </button>
                <button
                  onClick={() => (frozen ? toggleFreeze() : setConfirmFreeze(true))}
                  disabled={busy}
                  className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full text-[12.5px] font-bold border transition-colors disabled:opacity-50 ${
                    frozen
                      ? "bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100"
                      : "bg-white text-slate-600 border-brand-line hover:border-sky-400 hover:text-sky-600"
                  }`}
                >
                  {busy && !editingDiscount ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Snowflake size={15} />
                  )}
                  {frozen ? "Aktivlashtirish" : "Muzlatish"}
                </button>
              </div>
            )}

            {/* ── Groups ── */}
            <section>
              <h4 className="text-[12.5px] font-bold text-slate-500 px-1.5 mb-1.5">
                Guruhlari · {groups.length} ta
              </h4>
              <div className="bg-white border border-brand-line rounded-3xl divide-y divide-slate-100 overflow-hidden">
                {groups.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-slate-400">Guruhlarga qo&apos;shilmagan</p>
                ) : (
                  groups.map((g) => {
                    const fee = effectiveFee(g);
                    const base = g.monthlyFee || 0;
                    return (
                      <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                          <GraduationCap size={18} strokeWidth={2.1} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-slate-900 truncate">{g.title}</p>
                          <p className="text-[12.5px] text-slate-500 mt-0.5 truncate">{g.teacherName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {base === 0 && fee === 0 ? (
                            <p className="text-[12px] font-bold text-amber-600">Narx belgilanmagan</p>
                          ) : (
                            <>
                              <p className="text-[13.5px] font-bold text-slate-900 tabular-nums">{formatUZS(fee)}</p>
                              {fee !== base && base > 0 && (
                                <p className="text-[11.5px] text-slate-400 tabular-nums line-through">
                                  {formatUZS(base)}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* ── Open charges ── */}
            <section>
              <h4 className="text-[12.5px] font-bold text-slate-500 px-1.5 mb-1.5">To&apos;lanmagan hisoblar</h4>
              {openCharges.length === 0 ? (
                <div className="bg-white border border-brand-line rounded-3xl py-5 px-4 flex items-center justify-center gap-2 text-brand-700">
                  <CheckCircle2 size={16} />
                  <p className="text-[13px] font-bold">Qarzi yo&apos;q — barcha hisoblar to&apos;langan</p>
                </div>
              ) : (
                <div className="bg-white border border-brand-line rounded-3xl divide-y divide-slate-100 overflow-hidden">
                  {openCharges.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-slate-900 truncate">
                          {periodLabelOf(c)} · {c.classTitle}
                        </p>
                        <p className="text-[12px] text-slate-500 mt-0.5">
                          Muddat: {dateLabel(c.dueDate)}
                          {c.status === "partial" && ` · to'landi ${formatUZS(c.paidAmount || 0)}`}
                        </p>
                      </div>
                      <p className="text-[13.5px] font-bold text-rose-600 tabular-nums shrink-0">
                        {formatUZS(openAmountOf(c))}
                      </p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 bg-rose-50/50">
                    <p className="text-[13px] font-bold text-slate-700">Jami qarz</p>
                    <p className="text-[14px] font-bold text-rose-600 tabular-nums">{formatUZS(totalDebt)}</p>
                  </div>
                </div>
              )}
            </section>

            {/* ── Payment history ── */}
            <section>
              <h4 className="text-[12.5px] font-bold text-slate-500 px-1.5 mb-1.5">So&apos;nggi to&apos;lovlar</h4>
              <div className="bg-white border border-brand-line rounded-3xl divide-y divide-slate-100 overflow-hidden">
                {payments.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-slate-400">Hali to&apos;lovlar yo&apos;q</p>
                ) : (
                  payments.slice(0, 8).map((p) => {
                    const cancelled = p.status === "cancelled";
                    const isRefund = p.type === "refund";
                    const DirIcon = isRefund ? ArrowUpRight : ArrowDownLeft;
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            cancelled
                              ? "bg-slate-100 text-slate-400"
                              : isRefund
                              ? "bg-rose-50 text-rose-600"
                              : "bg-brand-100 text-brand-700"
                          }`}
                        >
                          <DirIcon size={15} strokeWidth={2.2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] font-semibold truncate ${
                              cancelled ? "text-slate-400 line-through" : "text-slate-800"
                            }`}
                          >
                            {dateLabel(p.paidAt)} · {PAYMENT_METHOD_LABELS[p.method] || p.method}
                          </p>
                          {(p.note || cancelled) && (
                            <p className="text-[11.5px] text-slate-400 mt-0.5 truncate">
                              {cancelled ? "Bekor qilingan" : p.note}
                            </p>
                          )}
                        </div>
                        <p
                          className={`text-[13px] font-bold tabular-nums shrink-0 ${
                            cancelled ? "text-slate-300 line-through" : isRefund ? "text-rose-600" : "text-brand-700"
                          }`}
                        >
                          {isRefund ? "−" : "+"}
                          {formatUZS(p.amount)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <button
              onClick={() => onRecordPayment(studentId)}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white font-bold text-sm rounded-full transition-all flex items-center justify-center gap-2"
            >
              <Banknote size={16} /> To&apos;lov qabul qilish
            </button>
          </div>
        )}
      </div>
    </ManagerSheet>

    {confirmFreeze && (
      <ConfirmDialog
        title="O'quvchini muzlatish"
        message={`${name} muzlatiladi: keyingi hisob-kitoblarda unga yangi oylik hisob YARATILMAYDI. Mavjud qarzlari saqlanadi va to'lov qabul qilish mumkin bo'lib qoladi. Qaytib kelganda "Aktivlashtirish" bosiladi.`}
        confirmLabel="Muzlatish"
        isLoading={busy}
        onConfirm={toggleFreeze}
        onClose={() => setConfirmFreeze(false)}
      />
    )}
    </>
  );
}
