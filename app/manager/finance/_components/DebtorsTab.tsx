"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Banknote } from "lucide-react";
import type { Charge } from "@/types/finance";
import { openAmountOf } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { periodLabelOf } from "./financeFormat";
import SearchInput from "./SearchInput";

interface Props {
  openCharges: Charge[];
  /** studentId → current-month attendance rate (%) or null; null map = not loaded. */
  attendanceRates: Record<string, number | null> | null;
  todayKey: string;
  onRecordPayment: (studentId: string) => void;
}

interface DebtorRow {
  studentId: string;
  studentName: string;
  total: number;
  overdue: boolean;
  charges: Charge[];
}

/** Debtor list grouped by student — attendance % beside the debt (FINANCE_PLAN.md §"edge cases"). */
export default function DebtorsTab({ openCharges, attendanceRates, todayKey, onRecordPayment }: Props) {
  const [search, setSearch] = useState("");

  const debtors = useMemo<DebtorRow[]>(() => {
    const byStudent = new Map<string, DebtorRow>();
    for (const c of openCharges) {
      const open = openAmountOf(c);
      if (open <= 0) continue;
      const row = byStudent.get(c.studentId) || {
        studentId: c.studentId,
        studentName: c.studentName,
        total: 0,
        overdue: false,
        charges: [],
      };
      row.total += open;
      row.overdue = row.overdue || c.dueDate < todayKey;
      row.charges.push(c);
      byStudent.set(c.studentId, row);
    }
    return [...byStudent.values()].sort((a, b) => b.total - a.total);
  }, [openCharges, todayKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return debtors;
    return debtors.filter((d) => d.studentName.toLowerCase().includes(q));
  }, [debtors, search]);

  if (debtors.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl py-14 text-center">
        <p className="text-sm font-bold text-slate-700">Qarzdorlar yo&apos;q 🎉</p>
        <p className="text-[13px] text-slate-400 mt-1">Barcha hisoblar to&apos;langan</p>
      </div>
    );
  }

  const grandTotal = filtered.reduce((s, d) => s + d.total, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {debtors.length > 5 && (
          <SearchInput value={search} onChange={setSearch} placeholder="Qarzdorni qidiring..." />
        )}
        <p className="text-[13px] text-slate-500">
          {filtered.length} ta qarzdor · jami <span className="font-bold text-rose-600">{formatUZS(grandTotal)}</span>
        </p>
      </div>

      <div className="space-y-2.5">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400 bg-white border border-slate-200 rounded-2xl">
            Hech narsa topilmadi
          </p>
        )}
        {filtered.map((d) => {
          const rate = attendanceRates?.[d.studentId];
          return (
            <div key={d.studentId} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800 truncate">{d.studentName}</p>
                    {d.overdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-[11px] font-bold">
                        <AlertCircle size={11} /> Muddati o&apos;tgan
                      </span>
                    )}
                    {typeof rate === "number" && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          rate >= 80 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        Davomat {rate}%
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {d.charges.map((c) => (
                      <span
                        key={c.id}
                        className={`px-2 py-1 rounded-lg text-[11.5px] font-semibold ${
                          c.dueDate < todayKey ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {periodLabelOf(c)} · {c.classTitle} · {formatUZS(openAmountOf(c))}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[15px] font-bold text-rose-600 tabular-nums">{formatUZS(d.total)}</p>
                  <button
                    onClick={() => onRecordPayment(d.studentId)}
                    className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[12px] font-bold transition-colors"
                  >
                    <Banknote size={13} /> To&apos;lov
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
