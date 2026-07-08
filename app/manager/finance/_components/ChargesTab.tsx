"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  HandCoins,
  Loader2,
  Pencil,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import type { Charge, ChargeStatus } from "@/types/finance";
import { CHARGE_STATUS_LABELS } from "@/types/finance";
import type { ClassData } from "@/hooks/useCenterClasses";
import { adjustChargeApi, cancelChargeApi, openAmountOf, waiveChargeApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { periodLabelOf } from "./financeFormat";
import FilterSelect from "../../_components/FilterSelect";
import MonthNav from "./MonthNav";
import ReasonDialog from "./ReasonDialog";
import SearchInput from "../../_components/SearchInput";

interface Props {
  charges: Charge[];
  monthLabel: string;
  onShiftMonth: (delta: number) => void;
  /** Titles of groups that have students but no monthlyFee — they are silently unbilled. */
  unbilledClassTitles: string[];
  classes: ClassData[];
  onShowStudent: (studentId: string, studentName: string) => void;
  onChanged: () => void;
}

/** MD3 leading-avatar + status-text colors per charge state. */
const STATUS_META: Record<ChargeStatus, { Icon: LucideIcon; avatar: string; text: string }> = {
  pending: { Icon: Clock3, avatar: "bg-rose-50 text-rose-600", text: "text-rose-600" },
  partial: { Icon: CircleDollarSign, avatar: "bg-amber-50 text-amber-600", text: "text-amber-600" },
  paid: { Icon: CheckCircle2, avatar: "bg-brand-100 text-brand-700", text: "text-brand-700" },
  waived: { Icon: HandCoins, avatar: "bg-violet-50 text-violet-500", text: "text-violet-500" },
  cancelled: { Icon: XCircle, avatar: "bg-slate-100 text-slate-400", text: "text-slate-400" },
};

/** Month's charge register: totals, per-charge status, waive/cancel/adjust actions. */
export default function ChargesTab({
  charges,
  monthLabel,
  onShiftMonth,
  unbilledClassTitles,
  classes,
  onShowStudent,
  onChanged,
}: Props) {
  const [waiveTarget, setWaiveTarget] = useState<Charge | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Charge | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Charge | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) if (c.teacherId && !map.has(c.teacherId)) map.set(c.teacherId, c.teacherName);
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [classes]);

  /** Group options narrow to the picked teacher's groups. */
  const classOptions = useMemo(
    () =>
      classes
        .filter((c) => !teacherFilter || c.teacherId === teacherFilter)
        .map((c) => ({ value: c.id, label: c.title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [classes, teacherFilter]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return charges.filter((c) => {
      if (classFilter && c.classId !== classFilter) return false;
      if (teacherFilter && classById.get(c.classId)?.teacherId !== teacherFilter) return false;
      if (q && !c.studentName.toLowerCase().includes(q) && !c.classTitle.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [charges, search, classFilter, teacherFilter, classById]);

  const hasFilters = classFilter !== "" || teacherFilter !== "" || search.trim() !== "";

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <MonthNav label={monthLabel} onShift={onShiftMonth} />
        {charges.length > 5 && (
          <SearchInput value={search} onChange={setSearch} placeholder="O'quvchi yoki guruhni qidiring..." />
        )}
      </div>

      {classes.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect
            value={teacherFilter}
            onChange={(v) => {
              setTeacherFilter(v);
              // A group of another teacher can't stay selected.
              if (v && classFilter && classById.get(classFilter)?.teacherId !== v) setClassFilter("");
            }}
            options={teacherOptions}
            allLabel="Barcha o'qituvchilar"
          />
          <FilterSelect
            value={classFilter}
            onChange={setClassFilter}
            options={classOptions}
            allLabel="Barcha guruhlar"
          />
          {hasFilters && (
            <p className="text-[12.5px] text-slate-500 ml-auto">{filtered.length} ta hisob</p>
          )}
        </div>
      )}

      <div className="bg-white border border-brand-line rounded-3xl px-4 py-3 grid grid-cols-3 divide-x divide-slate-100">
        <div className="pr-3">
          <p className="text-[11.5px] font-semibold text-slate-400">Hisoblangan</p>
          <p className="text-[13.5px] font-bold text-slate-800 tabular-nums mt-0.5 truncate">
            {formatUZS(totals.charged)}
          </p>
        </div>
        <div className="px-3">
          <p className="text-[11.5px] font-semibold text-slate-400">To&apos;langan</p>
          <p className="text-[13.5px] font-bold text-brand-700 tabular-nums mt-0.5 truncate">
            {formatUZS(totals.paid)}
          </p>
        </div>
        <div className="pl-3">
          <p className="text-[11.5px] font-semibold text-slate-400">Qoldiq</p>
          <p className={`text-[13.5px] font-bold tabular-nums mt-0.5 truncate ${totals.open > 0 ? "text-rose-600" : "text-slate-800"}`}>
            {formatUZS(totals.open)}
          </p>
        </div>
      </div>

      {unbilledClassTitles.length > 0 && (
        <div className="bg-sky-50 border border-sky-100 rounded-3xl px-4 py-3 text-[12.5px] text-sky-700">
          {unbilledClassTitles.length} ta guruhda oylik narx belgilanmagan ({unbilledClassTitles.slice(0, 3).join(", ")}
          {unbilledClassTitles.length > 3 && "..."}) — ular hisob-kitobga kirmaydi.{" "}
          <Link href="/manager/groups" className="font-bold underline">
            Guruh sozlamalarida narx qo&apos;ying
          </Link>
        </div>
      )}

      <div className="bg-white border border-brand-line rounded-3xl divide-y divide-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
              <FileText size={22} />
            </div>
            <p className="text-sm font-bold text-slate-800 mt-3">
              {hasFilters ? "Hech narsa topilmadi" : "Bu davr uchun hisoblar yo'q"}
            </p>
            <p className="text-[13px] text-slate-400 mt-1">
              {hasFilters
                ? "Filtr yoki qidiruvni o'zgartirib ko'ring"
                : "Hisob-kitob yaratilganda ro'yxat shu yerda ko'rinadi"}
            </p>
          </div>
        ) : (
          filtered.map((c) => {
            const meta = STATUS_META[c.status];
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-25 transition-colors">
                <button
                  onClick={() => onShowStudent(c.studentId, c.studentName)}
                  title="O'quvchi haqida to'liq ma'lumot"
                  className="flex items-center gap-3 flex-1 min-w-0 text-left group"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${meta.avatar}`}>
                    <meta.Icon size={18} strokeWidth={2.1} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[14.5px] font-semibold truncate group-hover:text-brand-800 transition-colors ${
                        c.status === "cancelled" ? "text-slate-400 line-through" : "text-slate-900"
                      }`}
                    >
                      {c.studentName}
                    </p>
                    <p className="text-[12.5px] text-slate-500 mt-0.5 truncate">
                      {c.classTitle} · {periodLabelOf(c)}
                      {c.discountAmount > 0 && ` · chegirma ${formatUZS(c.discountAmount)}`}
                      {c.proratedFrom && " · qisman oy"}
                    </p>
                  </div>
                </button>
                <div className="text-right shrink-0">
                  <p
                    className={`text-[14.5px] font-bold tabular-nums ${
                      c.status === "cancelled" ? "text-slate-300 line-through" : "text-slate-900"
                    }`}
                  >
                    {formatUZS(c.amount)}
                  </p>
                  <p className={`text-[11.5px] font-bold mt-0.5 ${meta.text}`}>
                    {c.status === "partial"
                      ? `To'landi ${formatUZS(c.paidAmount || 0)}`
                      : CHARGE_STATUS_LABELS[c.status]}
                  </p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {c.status === "pending" && (c.paidAmount || 0) === 0 && (
                    <>
                      <button
                        onClick={() => setAdjustTarget(c)}
                        title="Summani o'zgartirish"
                        className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-300 hover:text-slate-600 flex items-center justify-center transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setCancelTarget(c)}
                        title="Bekor qilish"
                        className="w-9 h-9 rounded-full hover:bg-rose-50 text-slate-300 hover:text-rose-500 flex items-center justify-center transition-colors"
                      >
                        <XCircle size={14} />
                      </button>
                    </>
                  )}
                  {(c.status === "pending" || c.status === "partial") && (
                    <button
                      onClick={() => setWaiveTarget(c)}
                      title="Qoldiqni kechirish"
                      className="w-9 h-9 rounded-full hover:bg-violet-50 text-slate-300 hover:text-violet-500 flex items-center justify-center transition-colors"
                    >
                      <HandCoins size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
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
          className="mt-4 w-full px-3.5 py-3 border border-slate-200 rounded-xl text-[16px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Izoh (ixtiyoriy)"
          className="mt-2.5 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
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
