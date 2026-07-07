"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Undo2 } from "lucide-react";
import type { Payment } from "@/types/finance";
import { PAYMENT_METHOD_LABELS } from "@/types/finance";
import { cancelPaymentApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { shortDateLabel } from "./financeFormat";
import ReasonDialog from "./ReasonDialog";
import SearchInput from "./SearchInput";

interface Props {
  payments: Payment[];
  onOpenModal: () => void;
  onChanged: () => void;
}

/** Recent payments feed + entry point for recording a new one. */
export default function PaymentsTab({ payments, onOpenModal, onChanged }: Props) {
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) => p.studentName.toLowerCase().includes(q) || (p.note || "").toLowerCase().includes(q)
    );
  }, [payments, search]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {payments.length > 5 ? (
          <SearchInput value={search} onChange={setSearch} placeholder="O'quvchini qidiring..." />
        ) : (
          <p className="text-[13px] text-slate-500">So&apos;nggi {payments.length} ta amaliyot</p>
        )}
        <button
          onClick={onOpenModal}
          className="flex items-center gap-1.5 px-5 py-3 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-sm rounded-xl transition-all shadow-sm shadow-brand-600/25"
        >
          <Plus size={16} /> To&apos;lov qabul qilish
        </button>
      </div>

      <div className="bg-white border border-brand-line rounded-2xl divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            {search ? "Hech narsa topilmadi" : "Hali to'lovlar yo'q"}
          </p>
        ) : (
          filtered.map((p) => {
            const cancelled = p.status === "cancelled";
            const isRefund = p.type === "refund";
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-brand-25 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${cancelled ? "text-slate-400 line-through" : "text-slate-800"}`}>
                    {p.studentName}
                  </p>
                  <p className="text-[12px] text-slate-400 mt-0.5">
                    {shortDateLabel(p.paidAt)} · {PAYMENT_METHOD_LABELS[p.method] || p.method}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                {cancelled && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[11px] font-bold shrink-0">
                    Bekor qilingan
                  </span>
                )}
                {isRefund && !cancelled && (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded-full text-[11px] font-bold shrink-0">
                    Qaytarim
                  </span>
                )}
                <p
                  className={`text-sm font-bold tabular-nums shrink-0 ${
                    cancelled ? "text-slate-300 line-through" : isRefund ? "text-rose-600" : "text-brand-700"
                  }`}
                >
                  {isRefund ? "−" : "+"}
                  {formatUZS(p.amount)}
                </p>
                {!cancelled && (
                  <button
                    onClick={() => setCancelTarget(p)}
                    title="To'lovni bekor qilish"
                    className="w-8 h-8 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Undo2 size={15} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {cancelTarget && (
        <ReasonDialog
          title="To'lovni bekor qilish"
          message={`${cancelTarget.studentName} — ${formatUZS(cancelTarget.amount)}. To'lov o'chirilmaydi, "bekor qilingan" deb belgilanadi va qarzdorlik qayta hisoblanadi.`}
          confirmLabel="Bekor qilish"
          onClose={() => setCancelTarget(null)}
          onConfirm={async (reason) => {
            try {
              await cancelPaymentApi(cancelTarget.id, reason);
              toast.success("To'lov bekor qilindi.");
              setCancelTarget(null);
              onChanged();
            } catch (e: any) {
              toast.error(e.message || "Xatolik yuz berdi.");
            }
          }}
        />
      )}
    </div>
  );
}
