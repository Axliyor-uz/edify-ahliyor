"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowDownLeft, ArrowUpRight, Plus, ReceiptText, Undo2 } from "lucide-react";
import type { Payment } from "@/types/finance";
import { PAYMENT_METHOD_LABELS } from "@/types/finance";
import { cancelPaymentApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { getTodayKey } from "@/lib/dateUtils";
import { dayLabelOf } from "./financeFormat";
import ReasonDialog from "./ReasonDialog";
import SearchInput from "../../_components/SearchInput";

interface Props {
  payments: Payment[];
  onOpenModal: () => void;
  onChanged: () => void;
}

/** Recent payments feed (grouped by day, MD3 list items) + entry point for recording a new one. */
export default function PaymentsTab({ payments, onOpenModal, onChanged }: Props) {
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");
  const todayKey = useMemo(() => getTodayKey(), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) => p.studentName.toLowerCase().includes(q) || (p.note || "").toLowerCase().includes(q)
    );
  }, [payments, search]);

  /** Day groups (newest first); each keeps the feed's original in-day order. */
  const dayGroups = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of filtered) {
      const arr = map.get(p.paidAt);
      if (arr) arr.push(p);
      else map.set(p.paidAt, [p]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const dayTotal = (items: Payment[]) =>
    items
      .filter((p) => p.status !== "cancelled")
      .reduce((s, p) => s + (p.type === "refund" ? -p.amount : p.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {payments.length > 5 ? (
          <SearchInput value={search} onChange={setSearch} placeholder="O'quvchini qidiring..." />
        ) : (
          <p className="text-[13px] text-slate-500">
            {payments.length > 0 ? `So'nggi amaliyotlar · ${payments.length} ta` : "Amaliyotlar tarixi"}
          </p>
        )}
        <button
          onClick={onOpenModal}
          className="flex items-center gap-1.5 pl-4 pr-5 py-3 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-sm rounded-full transition-all shadow-sm shadow-brand-600/25"
        >
          <Plus size={16} /> To&apos;lov qabul qilish
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-brand-line rounded-3xl py-14 px-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
            <ReceiptText size={22} />
          </div>
          <p className="text-sm font-bold text-slate-800 mt-3">
            {search ? "Hech narsa topilmadi" : "Hali to'lovlar yo'q"}
          </p>
          <p className="text-[13px] text-slate-400 mt-1">
            {search
              ? "Qidiruvni o'zgartirib ko'ring"
              : "O'quvchi pul olib kelganda «To'lov qabul qilish» tugmasini bosing"}
          </p>
        </div>
      ) : (
        dayGroups.map(([dateKey, items]) => {
          const total = dayTotal(items);
          return (
            <section key={dateKey}>
              <div className="flex items-baseline justify-between px-1.5 mb-1.5">
                <h3 className="text-[12.5px] font-bold text-slate-500">{dayLabelOf(dateKey, todayKey)}</h3>
                <p
                  className={`text-[12px] font-bold tabular-nums ${
                    total >= 0 ? "text-brand-700" : "text-rose-600"
                  }`}
                >
                  {total >= 0 ? "+" : "−"}
                  {formatUZS(Math.abs(total))}
                </p>
              </div>
              <div className="bg-white border border-brand-line rounded-3xl divide-y divide-slate-100 overflow-hidden">
                {items.map((p) => {
                  const cancelled = p.status === "cancelled";
                  const isRefund = p.type === "refund";
                  const DirIcon = isRefund ? ArrowUpRight : ArrowDownLeft;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-25 transition-colors">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          cancelled
                            ? "bg-slate-100 text-slate-400"
                            : isRefund
                            ? "bg-rose-50 text-rose-600"
                            : "bg-brand-100 text-brand-700"
                        }`}
                      >
                        <DirIcon size={18} strokeWidth={2.2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[14.5px] font-semibold truncate ${
                            cancelled ? "text-slate-400 line-through" : "text-slate-900"
                          }`}
                        >
                          {p.studentName}
                        </p>
                        <p className="text-[12.5px] text-slate-500 mt-0.5 truncate">
                          {PAYMENT_METHOD_LABELS[p.method] || p.method}
                          {isRefund && " · qaytarim"}
                          {p.note && ` · ${p.note}`}
                        </p>
                      </div>
                      {cancelled && (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-400 rounded-full text-[11px] font-bold shrink-0">
                          Bekor qilingan
                        </span>
                      )}
                      <p
                        className={`text-[14.5px] font-bold tabular-nums shrink-0 ${
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
                          className="w-9 h-9 rounded-full hover:bg-rose-50 text-slate-300 hover:text-rose-500 flex items-center justify-center transition-colors shrink-0"
                        >
                          <Undo2 size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

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
