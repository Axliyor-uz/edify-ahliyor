"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Plus, Undo2, Wallet } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import type { Expense } from "@/types/finance";
import { cancelExpenseApi, createExpenseApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { getTodayKey } from "@/lib/dateUtils";
import { shortDateLabel } from "./financeFormat";
import MonthNav from "./MonthNav";
import ReasonDialog from "./ReasonDialog";
import SearchInput from "./SearchInput";

interface Props {
  expenses: Expense[];
  categories: string[];
  monthLabel: string;
  onShiftMonth: (delta: number) => void;
  onChanged: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  salary: "Oylik",
  ijara: "Ijara",
  kommunal: "Kommunal",
  marketing: "Marketing",
  jihozlar: "Jihozlar",
  boshqa: "Boshqa",
};
const categoryLabel = (c: string) => CATEGORY_LABELS[c] || c;

/** Month's expenses: per-category totals, add, cancel. Salary rows come from payroll and are protected. */
export default function ExpensesTab({ expenses, categories, monthLabel, onShiftMonth, onChanged }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter(
      (e) => categoryLabel(e.category).toLowerCase().includes(q) || (e.note || "").toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const active = useMemo(() => filtered.filter((e) => e.status === "active"), [filtered]);
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of active) map.set(e.category, (map.get(e.category) || 0) + e.amount);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [active]);
  const total = active.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <MonthNav label={monthLabel} onShift={onShiftMonth} />
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-colors"
        >
          <Plus size={16} /> Xarajat qo&apos;shish
        </button>
      </div>

      {expenses.length > 5 && (
        <SearchInput value={search} onChange={setSearch} placeholder="Kategoriya yoki izohni qidiring..." />
      )}

      {byCategory.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[12px] font-bold">
            Jami: {formatUZS(total)}
          </span>
          {byCategory.map(([cat, sum]) => (
            <span key={cat} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[12px] font-bold">
              {categoryLabel(cat)}: {formatUZS(sum)}
            </span>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            {search ? "Hech narsa topilmadi" : "Bu oy uchun xarajatlar yo'q"}
          </p>
        ) : (
          filtered.map((e) => {
            const cancelled = e.status === "cancelled";
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                  <Wallet size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${cancelled ? "text-slate-400 line-through" : "text-slate-800"}`}>
                    {categoryLabel(e.category)}
                    {e.note && <span className="font-medium text-slate-500"> · {e.note}</span>}
                  </p>
                  <p className="text-[12px] text-slate-400 mt-0.5">{shortDateLabel(e.date)}</p>
                </div>
                {cancelled && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[11px] font-bold shrink-0">
                    Bekor qilingan
                  </span>
                )}
                <p className={`text-sm font-bold tabular-nums shrink-0 ${cancelled ? "text-slate-300 line-through" : "text-slate-800"}`}>
                  {formatUZS(e.amount)}
                </p>
                {!cancelled && !e.payoutId && (
                  <button
                    onClick={() => setCancelTarget(e)}
                    title="Xarajatni bekor qilish"
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

      {showAdd && (
        <AddExpenseModal
          categories={categories}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            onChanged();
          }}
        />
      )}
      {cancelTarget && (
        <ReasonDialog
          title="Xarajatni bekor qilish"
          message={`${categoryLabel(cancelTarget.category)} — ${formatUZS(cancelTarget.amount)}. Xarajat o'chirilmaydi, "bekor qilingan" deb belgilanadi.`}
          confirmLabel="Bekor qilish"
          onClose={() => setCancelTarget(null)}
          onConfirm={async (reason) => {
            try {
              await cancelExpenseApi(cancelTarget.id, reason);
              toast.success("Xarajat bekor qilindi.");
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

function AddExpenseModal({
  categories,
  onClose,
  onDone,
}: {
  categories: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const todayKey = getTodayKey();
  const options = categories.filter((c) => c !== "salary");
  const [category, setCategory] = useState(options[0] || "boshqa");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayKey);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsed = parseInt(amount, 10);
  const valid = Number.isInteger(parsed) && parsed > 0 && !!category;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await createExpenseApi({
        category,
        amount: parsed,
        ...(date !== todayKey ? { date } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success("Xarajat saqlandi.");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Saqlashda xatolik.");
      setSubmitting(false);
    }
  };

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-6 sm:p-7 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">Xarajat qo&apos;shish</h3>

        <div className="flex flex-wrap gap-1.5">
          {options.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3.5 py-2 rounded-xl text-[13px] font-bold border transition-colors ${
                category === c
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {categoryLabel(c)}
            </button>
          ))}
        </div>

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

        <div className="grid grid-cols-2 gap-2.5">
          <input
            type="date"
            value={date}
            max={todayKey}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Izoh (ixtiyoriy)"
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <button
          onClick={submit}
          disabled={!valid || submitting}
          className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Saqlash
        </button>
      </div>
    </ManagerSheet>
  );
}
