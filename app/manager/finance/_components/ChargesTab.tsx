"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { ChevronLeft, ChevronRight, HandCoins, Loader2, Pencil, XCircle } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import type { Charge, ChargeStatus } from "@/types/finance";
import { CHARGE_STATUS_LABELS } from "@/types/finance";
import { adjustChargeApi, cancelChargeApi, openAmountOf, waiveChargeApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { periodLabelOf } from "./financeFormat";
import ReasonDialog from "./ReasonDialog";
import SearchInput from "./SearchInput";

interface Props {
  charges: Charge[];
  monthLabel: string;
  onShiftMonth: (delta: number) => void;
  /** Titles of groups that have students but no monthlyFee — they are silently unbilled. */
  unbilledClassTitles: string[];
  onChanged: () => void;
}

const STATUS_CLS: Record<ChargeStatus, string> = {
  pending: "bg-rose-50 text-rose-600",
  partial: "bg-amber-50 text-amber-600",
  paid: "bg-emerald-50 text-emerald-600",
  waived: "bg-violet-50 text-violet-500",
  cancelled: "bg-slate-100 text-slate-400",
};

/** Month's charge register: totals, per-charge status, waive/cancel/adjust actions. */
export default function ChargesTab({ charges, monthLabel, onShiftMonth, unbilledClassTitles, onChanged }: Props) {
  const [waiveTarget, setWaiveTarget] = useState<Charge | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Charge | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Charge | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return charges;
    return charges.filter(
      (c) => c.studentName.toLowerCase().includes(q) || c.classTitle.toLowerCase().includes(q)
    );
  }, [charges, search]);

  const totals = useMemo(() => {
    const active = filtered.filter((c) => c.status !== "cancelled");
    return {
      charged: active.reduce((s, c) => s + c.amount, 0),
      paid: active.reduce((s, c) => s + (c.paidAmount || 0), 0),
      open: filtered.reduce((s, c) => s + (c.status === "pending" || c.status === "partial" ? openAmountOf(c) : 0), 0),
    };
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onShiftMonth(-1)}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <ChevronLeft size={17} />
          </button>
          <p className="text-sm font-bold text-slate-800 min-w-[120px] text-center">{monthLabel}</p>
          <button
            onClick={() => onShiftMonth(1)}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <p className="text-[12.5px] text-slate-500 tabular-nums">
          Hisoblangan <span className="font-bold text-slate-700">{formatUZS(totals.charged)}</span> · To&apos;langan{" "}
          <span className="font-bold text-emerald-600">{formatUZS(totals.paid)}</span> · Qoldiq{" "}
          <span className="font-bold text-rose-600">{formatUZS(totals.open)}</span>
        </p>
      </div>

      {charges.length > 5 && (
        <SearchInput value={search} onChange={setSearch} placeholder="O'quvchi yoki guruhni qidiring..." />
      )}

      {unbilledClassTitles.length > 0 && (
        <div className="bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3 text-[12.5px] text-sky-700">
          {unbilledClassTitles.length} ta guruhda oylik narx belgilanmagan ({unbilledClassTitles.slice(0, 3).join(", ")}
          {unbilledClassTitles.length > 3 && "..."}) — ular hisob-kitobga kirmaydi.{" "}
          <Link href="/manager/groups" className="font-bold underline">
            Guruh sozlamalarida narx qo&apos;ying
          </Link>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            {search ? "Hech narsa topilmadi" : "Bu davr uchun hisoblar yo'q"}
          </p>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${c.status === "cancelled" ? "text-slate-400 line-through" : "text-slate-800"}`}>
                  {c.studentName}
                </p>
                <p className="text-[12px] text-slate-400 mt-0.5 truncate">
                  {c.classTitle} · {periodLabelOf(c)}
                  {c.discountAmount > 0 && ` · chegirma ${formatUZS(c.discountAmount)}`}
                  {c.proratedFrom && " · qisman oy"}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${STATUS_CLS[c.status]}`}>
                {CHARGE_STATUS_LABELS[c.status]}
              </span>
              <div className="text-right shrink-0 w-[110px]">
                <p className="text-sm font-bold text-slate-800 tabular-nums">{formatUZS(c.amount)}</p>
                {c.paidAmount > 0 && c.status !== "paid" && (
                  <p className="text-[11px] text-emerald-600 tabular-nums">to&apos;landi {formatUZS(c.paidAmount)}</p>
                )}
              </div>
              <div className="flex gap-0.5 shrink-0">
                {c.status === "pending" && (c.paidAmount || 0) === 0 && (
                  <>
                    <button
                      onClick={() => setAdjustTarget(c)}
                      title="Summani o'zgartirish"
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-slate-600 flex items-center justify-center"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setCancelTarget(c)}
                      title="Bekor qilish"
                      className="w-8 h-8 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 flex items-center justify-center"
                    >
                      <XCircle size={14} />
                    </button>
                  </>
                )}
                {(c.status === "pending" || c.status === "partial") && (
                  <button
                    onClick={() => setWaiveTarget(c)}
                    title="Qoldiqni kechirish"
                    className="w-8 h-8 rounded-lg hover:bg-violet-50 text-slate-300 hover:text-violet-500 flex items-center justify-center"
                  >
                    <HandCoins size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {waiveTarget && (
        <ReasonDialog
          title="Qoldiqni kechirish"
          message={`${waiveTarget.studentName} — ${periodLabelOf(waiveTarget)} uchun ${formatUZS(openAmountOf(waiveTarget))} kechiriladi. To'langan qism saqlanadi.`}
          confirmLabel="Kechirish"
          onClose={() => setWaiveTarget(null)}
          onConfirm={async (reason) => {
            try {
              await waiveChargeApi(waiveTarget.id, reason);
              toast.success("Qoldiq kechirildi.");
              setWaiveTarget(null);
              onChanged();
            } catch (e: any) {
              toast.error(e.message || "Xatolik yuz berdi.");
            }
          }}
        />
      )}
      {cancelTarget && (
        <ReasonDialog
          title="Hisobni bekor qilish"
          message={`${cancelTarget.studentName} — ${periodLabelOf(cancelTarget)} uchun ${formatUZS(cancelTarget.amount)} hisob bekor qilinadi.`}
          confirmLabel="Bekor qilish"
          onClose={() => setCancelTarget(null)}
          onConfirm={async (reason) => {
            try {
              await cancelChargeApi(cancelTarget.id, reason);
              toast.success("Hisob bekor qilindi.");
              setCancelTarget(null);
              onChanged();
            } catch (e: any) {
              toast.error(e.message || "Xatolik yuz berdi.");
            }
          }}
        />
      )}
      {adjustTarget && (
        <AdjustDialog
          charge={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onDone={() => {
            setAdjustTarget(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function AdjustDialog({ charge, onClose, onDone }: { charge: Charge; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(charge.amount));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const parsed = parseInt(amount, 10);
  const valid = Number.isInteger(parsed) && parsed > 0;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await adjustChargeApi(charge.id, parsed, note.trim() || undefined);
      toast.success("Summa o'zgartirildi.");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Xatolik yuz berdi.");
      setSubmitting(false);
    }
  };

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-6 sm:p-7">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">Summani o&apos;zgartirish</h3>
        <p className="text-sm text-slate-500 mt-1.5">
          {charge.studentName} · {periodLabelOf(charge)} · hozirgi: {formatUZS(charge.amount)}
        </p>
        <input
          type="number"
          inputMode="numeric"
          min={1000}
          step={1000}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-4 w-full px-3.5 py-3 border border-slate-200 rounded-xl text-[16px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Izoh (ixtiyoriy)"
          className="mt-2.5 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
          >
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={!valid || submitting}
            className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Saqlash
          </button>
        </div>
      </div>
    </ManagerSheet>
  );
}
