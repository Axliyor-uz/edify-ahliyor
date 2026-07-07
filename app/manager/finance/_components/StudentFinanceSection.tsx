"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BadgePercent, Loader2, Snowflake, Wallet } from "lucide-react";
import type { Charge, Payment, StudentFinanceProfile } from "@/types/finance";
import { CHARGE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/types/finance";
import {
  fetchStudentCharges,
  fetchStudentFinanceProfile,
  fetchStudentPayments,
  patchStudentFinanceApi,
} from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { periodLabelOf, shortDateLabel } from "./financeFormat";

interface Props {
  centerId: string;
  studentUid: string;
}

const STATUS_CLS: Record<string, string> = {
  pending: "bg-rose-50 text-rose-600",
  partial: "bg-amber-50 text-amber-600",
  paid: "bg-brand-100 text-brand-800",
  waived: "bg-violet-50 text-violet-500",
  cancelled: "bg-slate-100 text-slate-400",
};

/**
 * Finance card inside ManagerStudentInfoPanel: balance, freeze, discount,
 * recent charges + payments. Read-mostly; mutations go through the finance API.
 */
export default function StudentFinanceSection({ centerId, studentUid }: Props) {
  const [profile, setProfile] = useState<StudentFinanceProfile | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");

  const reload = useCallback(async () => {
    try {
      const [prof, ch, pay] = await Promise.all([
        fetchStudentFinanceProfile(centerId, studentUid),
        fetchStudentCharges(centerId, studentUid),
        fetchStudentPayments(centerId, studentUid, 5),
      ]);
      setProfile(prof);
      setCharges(ch.slice(0, 8));
      setPayments(pay);
    } catch (err) {
      console.error("Student finance load error:", err);
    } finally {
      setLoading(false);
    }
  }, [centerId, studentUid]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const frozen = profile?.financeStatus === "frozen";
  const balance = profile?.balance ?? 0;

  const toggleFreeze = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await patchStudentFinanceApi(studentUid, { financeStatus: frozen ? "active" : "frozen" });
      toast.success(frozen ? "O'quvchi aktivlashtirildi." : "O'quvchi muzlatildi — yangi hisoblar yaratilmaydi.");
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Xatolik yuz berdi.");
    } finally {
      setBusy(false);
    }
  };

  const saveDiscount = async () => {
    const v = discountInput.trim() === "" ? 0 : parseInt(discountInput, 10);
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      toast.error("Chegirma 0–100% oralig'ida bo'lishi kerak.");
      return;
    }
    setBusy(true);
    try {
      await patchStudentFinanceApi(studentUid, { discountPercent: v === 0 ? null : v });
      toast.success("Chegirma saqlandi. Keyingi hisoblarga qo'llanadi.");
      setEditingDiscount(false);
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Xatolik yuz berdi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60">
      <h3 className="text-[12px] font-black text-brand-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
        <Wallet size={14} /> Moliya
      </h3>

      {loading ? (
        <div className="flex justify-center py-8 text-slate-300">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Balance + actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`px-4 py-3 rounded-xl border ${
                balance < 0 ? "bg-rose-50 border-rose-100" : "bg-brand-50 border-brand-100"
              }`}
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Balans</p>
              <p className={`text-[16px] font-black tabular-nums ${balance < 0 ? "text-rose-600" : "text-brand-700"}`}>
                {formatUZS(balance)}
              </p>
            </div>

            <button
              onClick={toggleFreeze}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[12.5px] font-bold border transition-colors disabled:opacity-50 ${
                frozen
                  ? "bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100"
                  : "bg-white text-slate-600 border-brand-line hover:border-brand-200"
              }`}
            >
              <Snowflake size={14} />
              {frozen ? "Muzlatilgan — aktivlashtirish" : "Muzlatish"}
            </button>

            {editingDiscount ? (
              <div className="inline-flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="%"
                  className="w-16 px-2.5 py-2 border border-brand-line rounded-xl text-[13px] font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                <button
                  onClick={saveDiscount}
                  disabled={busy}
                  className="px-3 py-2 bg-brand-600 text-white rounded-xl text-[12px] font-bold disabled:opacity-50"
                >
                  OK
                </button>
                <button
                  onClick={() => setEditingDiscount(false)}
                  className="px-2 py-2 text-slate-400 text-[12px] font-bold"
                >
                  Bekor
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setDiscountInput(profile?.discountPercent ? String(profile.discountPercent) : "");
                  setEditingDiscount(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[12.5px] font-bold border bg-white text-slate-600 border-brand-line hover:border-brand-200 transition-colors"
              >
                <BadgePercent size={14} />
                {profile?.discountPercent ? `Chegirma ${profile.discountPercent}%` : "Chegirma qo'shish"}
              </button>
            )}
          </div>

          {/* Charges history */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Hisoblar</p>
            {charges.length === 0 ? (
              <p className="text-[13px] text-slate-400">Hisoblar hali yaratilmagan.</p>
            ) : (
              <div className="space-y-1">
                {charges.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-[12.5px] py-1">
                    <span className="text-slate-600 truncate flex-1">
                      {periodLabelOf(c)} · {c.classTitle}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-bold shrink-0 ${STATUS_CLS[c.status]}`}>
                      {CHARGE_STATUS_LABELS[c.status]}
                    </span>
                    <span className="font-bold text-slate-700 tabular-nums shrink-0">{formatUZS(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent payments */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">So&apos;nggi to&apos;lovlar</p>
            {payments.length === 0 ? (
              <p className="text-[13px] text-slate-400">To&apos;lovlar yo&apos;q.</p>
            ) : (
              <div className="space-y-1">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-[12.5px] py-1">
                    <span className={`truncate flex-1 ${p.status === "cancelled" ? "text-slate-300 line-through" : "text-slate-600"}`}>
                      {shortDateLabel(p.paidAt)} · {PAYMENT_METHOD_LABELS[p.method] || p.method}
                      {p.type === "refund" && " · qaytarim"}
                    </span>
                    <span
                      className={`font-bold tabular-nums shrink-0 ${
                        p.status === "cancelled" ? "text-slate-300 line-through" : p.type === "refund" ? "text-rose-600" : "text-brand-700"
                      }`}
                    >
                      {p.type === "refund" ? "−" : "+"}
                      {formatUZS(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
