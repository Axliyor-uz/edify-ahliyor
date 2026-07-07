"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, ChevronLeft, Loader2, Search } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import { buildCenterRoster, type RosterStudent } from "@/services/checkInService";
import type { ClassData } from "@/hooks/useCenterClasses";
import {
  fetchStudentCharges,
  fetchStudentFinanceProfile,
  openAmountOf,
  recordPaymentApi,
} from "@/services/financeService";
import {
  PAYMENT_METHOD_LABELS,
  type Charge,
  type PaymentMethod,
  type PaymentType,
  type RecordPaymentResult,
  type StudentFinanceProfile,
} from "@/types/finance";
import { formatUZS } from "@/lib/finance/money";
import { getTodayKey } from "@/lib/dateUtils";
import { periodLabelOf } from "./financeFormat";

interface Props {
  centerId: string;
  classes: ClassData[];
  preselectUid?: string | null;
  onClose: () => void;
  onDone: () => void;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Search a student → see their open charges → enter amount+method → done in ~5s. */
export default function RecordPaymentModal({ centerId, classes, preselectUid, onClose, onDone }: Props) {
  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RosterStudent | null>(null);

  const [profile, setProfile] = useState<StudentFinanceProfile | null>(null);
  const [openCharges, setOpenCharges] = useState<Charge[]>([]);
  const [loadingStudent, setLoadingStudent] = useState(false);

  const todayKey = useMemo(() => getTodayKey(), []);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [type, setType] = useState<PaymentType>("payment");
  const [paidAt, setPaidAt] = useState(todayKey);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RecordPaymentResult | null>(null);

  useEffect(() => {
    let mounted = true;
    buildCenterRoster(classes).then((r) => {
      if (!mounted) return;
      setRoster(r);
      if (preselectUid) {
        const hit = r.find((s) => s.uid === preselectUid);
        if (hit) setSelected(hit);
      }
    });
    return () => {
      mounted = false;
    };
  }, [classes, preselectUid]);

  useEffect(() => {
    if (!selected) return;
    let mounted = true;
    setLoadingStudent(true);
    Promise.all([
      fetchStudentFinanceProfile(centerId, selected.uid),
      fetchStudentCharges(centerId, selected.uid),
    ])
      .then(([prof, charges]) => {
        if (!mounted) return;
        setProfile(prof);
        setOpenCharges(
          charges
            .filter((c) => c.status === "pending" || c.status === "partial")
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        );
      })
      .catch(() => mounted && toast.error("Ma'lumotlarni yuklashda xatolik."))
      .finally(() => mounted && setLoadingStudent(false));
    return () => {
      mounted = false;
    };
  }, [centerId, selected]);

  const filteredRoster = useMemo(() => {
    if (!roster) return [];
    const q = search.trim().toLowerCase();
    if (!q) return roster.slice(0, 30);
    return roster
      .filter(
        (s) =>
          s.displayName.toLowerCase().includes(q) ||
          (s.username || "").toLowerCase().includes(q) ||
          (s.phone || "").includes(q)
      )
      .slice(0, 30);
  }, [roster, search]);

  const totalDebt = openCharges.reduce((s, c) => s + openAmountOf(c), 0);
  const parsedAmount = parseInt(amount, 10);
  const amountValid = Number.isInteger(parsedAmount) && parsedAmount > 0;

  const submit = async () => {
    if (!selected || !amountValid || submitting) return;
    if (type === "refund" && !note.trim()) {
      toast.error("Qaytarim uchun izoh majburiy.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await recordPaymentApi({
        studentId: selected.uid,
        amount: parsedAmount,
        type,
        method,
        ...(paidAt !== todayKey ? { paidAt } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setResult(res);
    } catch (e: any) {
      toast.error(e.message || "To'lovni saqlashda xatolik.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success view ──
  if (result && selected) {
    return (
      <ManagerSheet onClose={onDone}>
        <div className="p-6 sm:p-7 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {type === "payment" ? "To'lov qabul qilindi" : "Qaytarim saqlandi"}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {selected.displayName} · {formatUZS(parsedAmount)}
          </p>

          {result.allocations.length > 0 && (
            <div className="mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-1.5">
              {result.allocations.map((a) => {
                const charge = openCharges.find((c) => c.id === a.chargeId);
                return (
                  <div key={a.chargeId} className="flex justify-between text-[13px]">
                    <span className="text-slate-600">
                      {charge ? `${periodLabelOf(charge)} · ${charge.classTitle}` : a.chargeId}
                    </span>
                    <span className="font-bold text-emerald-600 tabular-nums">{formatUZS(a.amount)}</span>
                  </div>
                );
              })}
              {result.unallocatedAmount > 0 && (
                <div className="flex justify-between text-[13px] pt-1.5 border-t border-slate-200">
                  <span className="text-slate-600">Avans (keyingi oylarga)</span>
                  <span className="font-bold text-violet-600 tabular-nums">{formatUZS(result.unallocatedAmount)}</span>
                </div>
              )}
            </div>
          )}

          <p className="text-[13px] text-slate-500 mt-4">
            Yangi balans:{" "}
            <span className={`font-bold ${result.newBalance < 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {formatUZS(result.newBalance)}
            </span>
          </p>
          <button
            onClick={onDone}
            className="mt-5 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-colors"
          >
            Yopish
          </button>
        </div>
      </ManagerSheet>
    );
  }

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-5 sm:p-6">
        {/* ── Step 1: pick a student ── */}
        {!selected ? (
          <>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-3">To&apos;lov qabul qilish</h3>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="O'quvchini qidiring..."
                className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div className="mt-3 max-h-[45dvh] overflow-y-auto space-y-1">
              {roster === null ? (
                <div className="py-10 flex justify-center text-slate-400">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : filteredRoster.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">O&apos;quvchi topilmadi</p>
              ) : (
                filteredRoster.map((s) => (
                  <button
                    key={s.uid}
                    onClick={() => setSelected(s)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                  >
                    {s.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element -- photos come from arbitrary auth providers (Google etc.); plain <img> like the rest of the manager panel
                      <img src={s.photoURL} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[12px] font-bold">
                        {initialsOf(s.displayName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{s.displayName}</p>
                      {s.username && <p className="text-[12px] text-slate-400 truncate">@{s.username}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* ── Step 2: amount + method ── */}
            <div className="flex items-center gap-2 mb-4">
              {!preselectUid && (
                <button
                  onClick={() => setSelected(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <div className="min-w-0">
                <h3 className="text-[16px] font-bold text-slate-900 truncate">{selected.displayName}</h3>
                {profile && (
                  <p className={`text-[12.5px] font-semibold ${profile.balance < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    Balans: {formatUZS(profile.balance)}
                  </p>
                )}
              </div>
            </div>

            {loadingStudent ? (
              <div className="py-10 flex justify-center text-slate-400">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {openCharges.length > 0 && type === "payment" && (
                  <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3.5 space-y-1.5">
                    {openCharges.map((c) => (
                      <div key={c.id} className="flex justify-between text-[13px]">
                        <span className="text-slate-600 truncate mr-2">
                          {periodLabelOf(c)} · {c.classTitle}
                        </span>
                        <span className="font-bold text-rose-600 tabular-nums shrink-0">
                          {formatUZS(openAmountOf(c))}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[13px] pt-1.5 border-t border-rose-100">
                      <span className="font-bold text-slate-700">Jami qarz</span>
                      <span className="font-bold text-rose-700 tabular-nums">{formatUZS(totalDebt)}</span>
                    </div>
                  </div>
                )}

                {/* type toggle */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                  {(
                    [
                      ["payment", "To'lov"],
                      ["refund", "Qaytarim"],
                    ] as [PaymentType, string][]
                  ).map(([t, label]) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-colors ${
                        type === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* amount */}
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1000}
                    step={1000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Summa (so'm)"
                    className="w-full px-3.5 py-3 border border-slate-200 rounded-xl text-[16px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  {type === "payment" && totalDebt > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <button
                        onClick={() => setAmount(String(totalDebt))}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[12px] font-bold text-slate-600"
                      >
                        Jami qarz · {formatUZS(totalDebt)}
                      </button>
                      {openCharges.slice(0, 2).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setAmount(String(openAmountOf(c)))}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[12px] font-bold text-slate-600"
                        >
                          {periodLabelOf(c)} · {formatUZS(openAmountOf(c))}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* method */}
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`px-3.5 py-2 rounded-xl text-[13px] font-bold border transition-colors ${
                        method === m
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* date + note */}
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="date"
                    value={paidAt}
                    max={todayKey}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={type === "refund" ? "Izoh (majburiy)" : "Izoh (ixtiyoriy)"}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <button
                  onClick={submit}
                  disabled={!amountValid || submitting}
                  className={`w-full py-3.5 font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-white ${
                    type === "payment" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {type === "payment" ? "To'lovni qabul qilish" : "Qaytarimni saqlash"}
                  {amountValid && ` · ${formatUZS(parsedAmount)}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </ManagerSheet>
  );
}
