"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Home,
  Loader2,
  Megaphone,
  Package,
  Plus,
  Undo2,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import type { Expense } from "@/types/finance";
import { cancelExpenseApi, createExpenseApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { getTodayKey } from "@/lib/dateUtils";
import { shortDateLabel } from "./financeFormat";
import MonthNav from "./MonthNav";
import ReasonDialog from "./ReasonDialog";
import SearchInput from "../../_components/SearchInput";

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

/** MD3 leading avatar per category: own icon + tonal color, so rows scan at a glance. */
const CATEGORY_META: Record<string, { Icon: LucideIcon; avatar: string }> = {
  salary: { Icon: Users, avatar: "bg-teal-50 text-teal-600" },
  ijara: { Icon: Home, avatar: "bg-sky-50 text-sky-600" },
  kommunal: { Icon: Zap, avatar: "bg-amber-50 text-amber-600" },
  marketing: { Icon: Megaphone, avatar: "bg-violet-50 text-violet-600" },
  jihozlar: { Icon: Package, avatar: "bg-orange-50 text-orange-600" },
  boshqa: { Icon: Wallet, avatar: "bg-slate-100 text-slate-500" },
};
const categoryMeta = (c: string) => CATEGORY_META[c] || CATEGORY_META.boshqa;

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
          className="flex items-center gap-1.5 pl-4 pr-5 py-3 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-sm rounded-full transition-all shadow-sm shadow-brand-600/25"
        >
          <Plus size={16} /> Xarajat qo&apos;shish
        </button>
      </div>

      {expenses.length > 5 && (
        <SearchInput value={search} onChange={setSearch} placeholder="Kategoriya yoki izohni qidiring..." />
      )}

      {byCategory.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="px-3.5 py-1.5 bg-brand-ink text-white rounded-full text-[12px] font-bold tabular-nums">
            Jami: {formatUZS(total)}
          </span>
          {byCategory.map(([cat, sum]) => (
            <span
              key={cat}
              className="px-3.5 py-1.5 bg-white border border-brand-line text-slate-600 rounded-full text-[12px] font-bold tabular-nums"
            >
              {categoryLabel(cat)}: {formatUZS(sum)}
            </span>
          ))}
        </div>
      )}

      <div className="bg-white border border-brand-line rounded-3xl divide-y divide-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
              <Wallet size={22} />
            </div>
            <p className="text-sm font-bold text-slate-800 mt-3">
              {search ? "Hech narsa topilmadi" : "Bu oyda xarajatlar yo'q"}
            </p>
            <p className="text-[13px] text-slate-400 mt-1">
              {search
                ? "Qidiruvni o'zgartirib ko'ring"
                : "Ijara, kommunal va boshqa sarflarni shu yerga yozib boring"}
            </p>
          </div>
        ) : (
          filtered.map((e) => {
            const cancelled = e.status === "cancelled";
            const meta = categoryMeta(e.category);
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-25 transition-colors">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    cancelled ? "bg-slate-100 text-slate-400" : meta.avatar
                  }`}
                >
                  <meta.Icon size={18} strokeWidth={2.1} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[14.5px] font-semibold truncate ${
                      cancelled ? "text-slate-400 line-through" : "text-slate-900"
                    }`}
                  >
                    {categoryLabel(e.category)}
                    {e.note && <span className="font-medium text-slate-500"> · {e.note}</span>}
                  </p>
                  <p className="text-[12.5px] text-slate-500 mt-0.5">{shortDateLabel(e.date)}</p>
                </div>
                {cancelled && (
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-400 rounded-full text-[11px] font-bold shrink-0">
                    Bekor qilingan
                  </span>
                )}
                <p
                  className={`text-[14.5px] font-bold tabular-nums shrink-0 ${
                    cancelled ? "text-slate-300 line-through" : "text-slate-900"
                  }`}
                >
                  −{formatUZS(e.amount)}
                </p>
                {!cancelled && !e.payoutId && (
                  <button
                    onClick={() => setCancelTarget(e)}
                    title="Xarajatni bekor qilish"
                    className="w-9 h-9 rounded-full hover:bg-rose-50 text-slate-300 hover:text-rose-500 flex items-center justify-center transition-colors shrink-0"
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
              className={`px-3.5 py-2.5 rounded-xl text-[13px] font-bold border transition-colors ${
                category === c
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-600 border-brand-line hover:border-brand-600"
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
          className="w-full px-3.5 py-3 border border-slate-200 rounded-xl text-[16px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200"
        />

        <div className="grid grid-cols-2 gap-2.5">
          <input
            type="date"
            value={date}
            max={todayKey}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Izoh (ixtiyoriy)"
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>

        <button
          onClick={submit}
          disabled={!valid || submitting}
          className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Saqlash
        </button>
      </div>
    </ManagerSheet>
  );
}
