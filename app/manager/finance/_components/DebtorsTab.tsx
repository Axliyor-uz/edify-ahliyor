"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Banknote, PartyPopper, UserRound } from "lucide-react";
import type { Charge } from "@/types/finance";
import type { ClassData } from "@/hooks/useCenterClasses";
import { openAmountOf } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { initialsOf, periodLabelOf } from "./financeFormat";
import FilterSelect from "../../_components/FilterSelect";
import SearchInput from "../../_components/SearchInput";

interface Props {
  openCharges: Charge[];
  /** studentId → current-month attendance rate (%) or null; null map = not loaded. */
  attendanceRates: Record<string, number | null> | null;
  todayKey: string;
  classes: ClassData[];
  onRecordPayment: (studentId: string) => void;
  onShowStudent: (studentId: string, studentName: string) => void;
}

interface DebtorRow {
  studentId: string;
  studentName: string;
  total: number;
  overdue: boolean;
  charges: Charge[];
}

/** Debtor list grouped by student — attendance % beside the debt (FINANCE_PLAN.md §"edge cases"). */
export default function DebtorsTab({
  openCharges,
  attendanceRates,
  todayKey,
  classes,
  onRecordPayment,
  onShowStudent,
}: Props) {
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

  // Filters apply at the charge level, so a debtor's total reflects only the
  // selected group/teacher — "how much does he owe THIS teacher".
  const debtors = useMemo<DebtorRow[]>(() => {
    const chargeMatches = (c: Charge) => {
      if (classFilter && c.classId !== classFilter) return false;
      if (teacherFilter && classById.get(c.classId)?.teacherId !== teacherFilter) return false;
      return true;
    };
    const byStudent = new Map<string, DebtorRow>();
    for (const c of openCharges) {
      if (!chargeMatches(c)) continue;
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
  }, [openCharges, todayKey, classFilter, teacherFilter, classById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return debtors;
    return debtors.filter((d) => d.studentName.toLowerCase().includes(q));
  }, [debtors, search]);

  const hasFilters = classFilter !== "" || teacherFilter !== "" || search.trim() !== "";

  if (openCharges.length === 0) {
    return (
      <div className="bg-white border border-brand-line rounded-3xl py-14 px-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
          <PartyPopper size={22} />
        </div>
        <p className="text-sm font-bold text-slate-800 mt-3">Qarzdorlar yo&apos;q</p>
        <p className="text-[13px] text-slate-400 mt-1">Barcha hisoblar to&apos;langan</p>
      </div>
    );
  }

  const grandTotal = filtered.reduce((s, d) => s + d.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {debtors.length > 5 && (
          <SearchInput value={search} onChange={setSearch} placeholder="Qarzdorni qidiring..." />
        )}
        {classes.length > 1 && (
          <>
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
          </>
        )}
        <p className="text-[13px] text-slate-500 ml-auto">
          {filtered.length} ta qarzdor · jami{" "}
          <span className="font-bold text-rose-600 tabular-nums">{formatUZS(grandTotal)}</span>
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-brand-line rounded-3xl py-12 px-6 text-center">
          <p className="text-sm font-bold text-slate-800">Hech narsa topilmadi</p>
          <p className="text-[13px] text-slate-400 mt-1">
            {hasFilters ? "Filtr yoki qidiruvni o'zgartirib ko'ring" : "Qidiruvni o'zgartirib ko'ring"}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-brand-line rounded-3xl divide-y divide-slate-100 overflow-hidden">
          {filtered.map((d) => {
            const rate = attendanceRates?.[d.studentId];
            return (
              <div key={d.studentId} className="px-4 py-3.5 hover:bg-brand-25 transition-colors">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => onShowStudent(d.studentId, d.studentName)}
                    className="flex items-start gap-3 flex-1 min-w-0 text-left group"
                    title="O'quvchi haqida to'liq ma'lumot"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
                        d.overdue ? "bg-rose-50 text-rose-600" : "bg-brand-100 text-brand-800"
                      }`}
                    >
                      {initialsOf(d.studentName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14.5px] font-semibold text-slate-900 truncate group-hover:text-brand-800 transition-colors">
                          {d.studentName}
                        </p>
                        {d.overdue && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full text-[11px] font-bold">
                            <AlertCircle size={11} /> Muddati o&apos;tgan
                          </span>
                        )}
                        {typeof rate === "number" && (
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              rate >= 80 ? "bg-brand-100 text-brand-800" : "bg-amber-50 text-amber-600"
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
                            className={`px-2.5 py-1 rounded-lg text-[11.5px] font-semibold ${
                              c.dueDate < todayKey ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {periodLabelOf(c)} · {c.classTitle} · {formatUZS(openAmountOf(c))}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-bold text-rose-600 tabular-nums">{formatUZS(d.total)}</p>
                    <div className="flex items-center gap-1.5 mt-2 justify-end">
                      <button
                        onClick={() => onShowStudent(d.studentId, d.studentName)}
                        title="O'quvchi haqida to'liq ma'lumot"
                        className="w-8 h-8 rounded-full border border-brand-line hover:border-brand-600 text-slate-400 hover:text-brand-700 flex items-center justify-center transition-colors"
                      >
                        <UserRound size={14} />
                      </button>
                      <button
                        onClick={() => onRecordPayment(d.studentId)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-full text-[12px] font-bold transition-all"
                      >
                        <Banknote size={13} /> To&apos;lov
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
