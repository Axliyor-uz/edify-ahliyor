"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BadgeCheck, Loader2, Settings2, Users } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import ConfirmDialog from "../../_components/ConfirmDialog";
import type { CalculatePayrollResult, PayrollRow } from "@/types/finance";
import {
  calculatePayrollApi,
  markPayoutPaidApi,
  savePayoutApi,
  saveTeacherSalaryApi,
} from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { initialsOf } from "./financeFormat";
import MonthNav from "./MonthNav";
import SearchInput from "../../_components/SearchInput";

interface Props {
  monthKey: string;
  monthLabel: string;
  onShiftMonth: (delta: number) => void;
  /** Fired after a payout is marked paid (a salary expense appears). */
  onExpensesChanged: () => void;
}

/**
 * Payroll board: live per-teacher calculation from attendance + payments,
 * approve (persists the payout), then mark paid (creates the salary expense).
 * Amounts are always recomputed server-side — the client never sends them.
 */
export default function PayrollTab({ monthKey, monthLabel, onShiftMonth, onExpensesChanged }: Props) {
  const [result, setResult] = useState<CalculatePayrollResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [configTarget, setConfigTarget] = useState<PayrollRow | null>(null);
  const [approveTarget, setApproveTarget] = useState<PayrollRow | null>(null);
  const [payTarget, setPayTarget] = useState<PayrollRow | null>(null);
  const [paying, setPaying] = useState(false);
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    if (!result) return [];
    const q = search.trim().toLowerCase();
    if (!q) return result.rows;
    return result.rows.filter((r) => r.teacherName.toLowerCase().includes(q));
  }, [result, search]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await calculatePayrollApi(monthKey));
    } catch (e: any) {
      toast.error(e.message || "Oyliklarni hisoblashda xatolik.");
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  const markPaid = async () => {
    if (!payTarget?.payout || paying) return;
    setPaying(true);
    try {
      await markPayoutPaidApi(payTarget.payout.id);
      toast.success("Oylik to'landi deb belgilandi.");
      setPayTarget(null);
      await reload();
      onExpensesChanged();
    } catch (e: any) {
      toast.error(e.message || "Xatolik yuz berdi.");
    } finally {
      setPaying(false);
    }
  };

  const breakdownLine = (r: PayrollRow) => {
    const parts: string[] = [];
    if (r.breakdown.fixed > 0) parts.push(`Fiks ${formatUZS(r.breakdown.fixed)}`);
    if (r.breakdown.percent.rate > 0) {
      const baseLabel = r.breakdown.percent.base === "collected" ? "tushumdan" : "hisoblanganidan";
      parts.push(
        `${r.breakdown.percent.rate}% (${baseLabel} ${formatUZS(r.breakdown.percent.baseAmount)}) = ${formatUZS(r.breakdown.percent.amount)}`
      );
    }
    if (r.breakdown.perLesson.rate > 0) {
      parts.push(
        `${r.breakdown.perLesson.count} dars × ${formatUZS(r.breakdown.perLesson.rate)} = ${formatUZS(r.breakdown.perLesson.amount)}`
      );
    }
    return parts.length ? parts.join(" + ") : "Oylik sozlanmagan";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <MonthNav label={monthLabel} onShift={onShiftMonth} />
        {result && (
          <p className="text-[12.5px] text-slate-500">
            Foiz bazasi:{" "}
            <span className="font-bold text-slate-700">
              {result.percentBase === "collected" ? "yig'ilgan puldan" : "hisoblangan puldan"}
            </span>{" "}
            (Sozlamalarda o&apos;zgartiriladi)
          </p>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : !result || result.rows.length === 0 ? (
        <div className="bg-white border border-brand-line rounded-3xl py-14 px-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
            <Users size={22} />
          </div>
          <p className="text-sm font-bold text-slate-800 mt-3">Markazda o&apos;qituvchilar yo&apos;q</p>
          <p className="text-[13px] text-slate-400 mt-1">O&apos;qituvchi qo&apos;shilganda oyliklar shu yerda hisoblanadi</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {result.rows.length > 5 && (
            <SearchInput value={search} onChange={setSearch} placeholder="O'qituvchini qidiring..." />
          )}
          {filteredRows.length === 0 && (
            <div className="py-12 px-6 text-center bg-white border border-brand-line rounded-3xl">
              <p className="text-sm font-bold text-slate-800">Hech narsa topilmadi</p>
              <p className="text-[13px] text-slate-400 mt-1">Qidiruvni o&apos;zgartirib ko&apos;ring</p>
            </div>
          )}
          {filteredRows.map((r) => {
            const paid = r.payout?.status === "paid";
            const approved = r.payout?.status === "approved";
            return (
              <div key={r.teacherId} className="bg-white border border-brand-line rounded-3xl p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
                      paid ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {initialsOf(r.teacherName)}
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14.5px] font-semibold text-slate-900">{r.teacherName}</p>
                      {paid && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-100 text-brand-800 rounded-full text-[11px] font-bold">
                          <BadgeCheck size={11} /> To&apos;langan
                        </span>
                      )}
                      {approved && (
                        <span className="px-2.5 py-1 bg-sky-50 text-sky-600 rounded-full text-[11px] font-bold">
                          Tasdiqlangan
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-slate-500 mt-1">{breakdownLine(r)}</p>
                    {r.payout && r.payout.adjustment !== 0 && (
                      <p className="text-[12.5px] text-slate-500 mt-0.5">
                        {r.payout.adjustment > 0 ? "Bonus" : "Jarima"}: {formatUZS(Math.abs(r.payout.adjustment))}
                        {r.payout.adjustmentNote && ` (${r.payout.adjustmentNote})`}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">
                      {formatUZS(r.payout ? r.payout.finalAmount : r.calculatedAmount)}
                    </p>
                    <div className="flex gap-1.5 mt-1.5 justify-end">
                      {!paid && (
                        <button
                          onClick={() => setConfigTarget(r)}
                          title="Oylik sozlamalari"
                          className="w-9 h-9 rounded-full border border-brand-line hover:border-brand-600 hover:text-brand-700 text-slate-500 flex items-center justify-center transition-colors"
                        >
                          <Settings2 size={14} />
                        </button>
                      )}
                      {!paid && (
                        <button
                          onClick={() => setApproveTarget(r)}
                          className="px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-800 rounded-full text-[12px] font-bold transition-colors"
                        >
                          {approved ? "Qayta hisoblash" : "Tasdiqlash"}
                        </button>
                      )}
                      {approved && (
                        <button
                          onClick={() => setPayTarget(r)}
                          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-full text-[12px] font-bold transition-all"
                        >
                          To&apos;landi
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {configTarget && (
        <SalaryConfigModal
          row={configTarget}
          onClose={() => setConfigTarget(null)}
          onDone={() => {
            setConfigTarget(null);
            reload();
          }}
        />
      )}
      {approveTarget && (
        <ApprovePayoutModal
          row={approveTarget}
          periodKey={monthKey}
          onClose={() => setApproveTarget(null)}
          onDone={() => {
            setApproveTarget(null);
            reload();
          }}
        />
      )}
      {payTarget?.payout && (
        <ConfirmDialog
          title="Oylikni to'langan deb belgilash"
          message={`${payTarget.teacherName} — ${formatUZS(payTarget.payout.finalAmount)}. Bu summa xarajatlarga ("Oylik") avtomatik qo'shiladi va payout boshqa o'zgartirilmaydi.`}
          confirmLabel="To'landi"
          isLoading={paying}
          onConfirm={markPaid}
          onClose={() => setPayTarget(null)}
        />
      )}
    </div>
  );
}

function SalaryConfigModal({ row, onClose, onDone }: { row: PayrollRow; onClose: () => void; onDone: () => void }) {
  const [fixed, setFixed] = useState(row.config.fixed ? String(row.config.fixed) : "");
  const [percent, setPercent] = useState(row.config.percent ? String(row.config.percent) : "");
  const [perLesson, setPerLesson] = useState(row.config.perLesson ? String(row.config.perLesson) : "");
  const [submitting, setSubmitting] = useState(false);

  const parseOrNull = (s: string) => {
    if (s.trim() === "") return null;
    const n = parseInt(s, 10);
    return Number.isInteger(n) && n >= 0 ? n : NaN;
  };

  const submit = async () => {
    if (submitting) return;
    const f = parseOrNull(fixed);
    const p = parseOrNull(percent);
    const l = parseOrNull(perLesson);
    if (Number.isNaN(f) || Number.isNaN(l) || Number.isNaN(p) || (typeof p === "number" && p > 100)) {
      toast.error("Qiymatlar noto'g'ri kiritildi.");
      return;
    }
    setSubmitting(true);
    try {
      await saveTeacherSalaryApi(row.teacherId, { fixed: f, percent: p, perLesson: l });
      toast.success("Oylik sozlamalari saqlandi.");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Saqlashda xatolik.");
      setSubmitting(false);
    }
  };

  const field = (
    label: string,
    hint: string,
    value: string,
    set: (v: string) => void,
    placeholder: string
  ) => (
    <div>
      <p className="text-[13px] font-bold text-slate-700 mb-1">{label}</p>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
      <p className="text-[11.5px] text-slate-400 mt-1">{hint}</p>
    </div>
  );

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-6 sm:p-7 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Oylik sozlamalari</h3>
          <p className="text-sm text-slate-500 mt-0.5">{row.teacherName} · qismlar yig&apos;indisi to&apos;lanadi</p>
        </div>
        {field("Fiks oylik (so'm)", "Har oy o'zgarmas summa. Bo'sh — yo'q.", fixed, setFixed, "2000000")}
        {field("Guruh daromadidan foiz (%)", "O'z guruhlari pulidan ulush. Bo'sh — yo'q.", percent, setPercent, "0")}
        {field("Har dars uchun (so'm)", "Davomatdagi o'tilgan darslar soniga ko'paytiriladi. Bo'sh — yo'q.", perLesson, setPerLesson, "0")}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
          >
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Saqlash
          </button>
        </div>
      </div>
    </ManagerSheet>
  );
}

function ApprovePayoutModal({
  row,
  periodKey,
  onClose,
  onDone,
}: {
  row: PayrollRow;
  periodKey: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [adjustment, setAdjustment] = useState(row.payout ? String(row.payout.adjustment || "") : "");
  const [note, setNote] = useState(row.payout?.adjustmentNote || "");
  const [submitting, setSubmitting] = useState(false);

  const adj = adjustment.trim() === "" ? 0 : parseInt(adjustment, 10);
  const valid = Number.isInteger(adj) && (adj === 0 || note.trim().length > 0);
  const finalAmount = row.calculatedAmount + (Number.isInteger(adj) ? adj : 0);

  const submit = async () => {
    if (!valid || submitting || finalAmount < 0) return;
    setSubmitting(true);
    try {
      await savePayoutApi({
        teacherId: row.teacherId,
        periodKey,
        adjustment: adj,
        ...(note.trim() ? { adjustmentNote: note.trim() } : {}),
      });
      toast.success("Oylik tasdiqlandi.");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Saqlashda xatolik.");
      setSubmitting(false);
    }
  };

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-6 sm:p-7 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Oylikni tasdiqlash</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {row.teacherName} · hisoblangan: <span className="font-bold">{formatUZS(row.calculatedAmount)}</span>
          </p>
        </div>
        <div>
          <p className="text-[13px] font-bold text-slate-700 mb-1">Bonus (+) / Jarima (−)</p>
          <input
            type="number"
            inputMode="numeric"
            step={1000}
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder="0"
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={adj !== 0 ? "Izoh (majburiy)" : "Izoh (ixtiyoriy)"}
          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <p className="text-sm text-slate-600">
          Yakuniy: <span className={`font-bold ${finalAmount < 0 ? "text-rose-600" : "text-slate-900"}`}>{formatUZS(finalAmount)}</span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
          >
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={!valid || submitting || finalAmount < 0}
            className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Tasdiqlash
          </button>
        </div>
      </div>
    </ManagerSheet>
  );
}
