"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Save } from "lucide-react";
import type { ClassData } from "@/hooks/useCenterClasses";
import { saveGroupFeesApi } from "@/services/financeService";
import SearchInput from "../../_components/SearchInput";

interface Props {
  classes: ClassData[];
  /** Refetch classes + finance data after prices change (banner/preview must update). */
  onSaved: () => void;
}

/**
 * All group prices in one editable list — same `classes.monthlyFee` field the
 * group settings page writes, so the two places can never disagree.
 */
export default function GroupPricesSection({ classes, onSaved }: Props) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-seed local inputs whenever classes (re)load — after a save the refetch
  // brings the stored values back, so edits are never silently lost.
  useEffect(() => {
    setPrices(Object.fromEntries(classes.map((c) => [c.id, c.monthlyFee ? String(c.monthlyFee) : ""])));
  }, [classes]);

  const parsedOf = (id: string): number | null => {
    const raw = (prices[id] ?? "").trim();
    if (raw === "") return 0;
    const n = parseInt(raw, 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };

  const changedIds = useMemo(
    () => classes.filter((c) => parsedOf(c.id) !== (c.monthlyFee || 0)).map((c) => c.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classes, prices]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.teacherName || "").toLowerCase().includes(q)
    );
  }, [classes, search]);

  const save = async () => {
    if (saving || changedIds.length === 0) return;
    const fees: Record<string, number> = {};
    for (const id of changedIds) {
      const n = parsedOf(id);
      if (n === null) {
        toast.error("Narx noto'g'ri kiritildi — faqat butun son bo'lsin.");
        return;
      }
      fees[id] = n;
    }
    setSaving(true);
    try {
      // One API call — the server validates ownership and writes all fees in a
      // single batch, so there is never a "half saved" state.
      const { updated } = await saveGroupFeesApi(fees);
      toast.success(`${updated} ta guruh narxi saqlandi.`);
      onSaved();
    } catch (err: any) {
      console.error("Group price save error:", err);
      toast.error(err.message || "Saqlashda xatolik yuz berdi.");
    } finally {
      setSaving(false);
    }
  };

  if (classes.length === 0) {
    return <p className="text-[13px] text-slate-400">Markazda hali guruhlar yo&apos;q.</p>;
  }

  return (
    <div className="space-y-3">
      {classes.length > 5 && (
        <SearchInput value={search} onChange={setSearch} placeholder="Guruh yoki o'qituvchini qidiring..." />
      )}

      <div className="divide-y divide-brand-line/60 border border-brand-line rounded-2xl">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Guruh topilmadi</p>
        ) : (
          filtered.map((c) => {
            const hasPrice = (prices[c.id] ?? "").trim() !== "" && parsedOf(c.id) !== 0;
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{c.title}</p>
                  <p className="text-[12px] text-slate-400 mt-0.5 truncate">
                    {c.teacherName} · {c.studentIds?.length || 0} o&apos;quvchi
                  </p>
                </div>
                {!hasPrice && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[11px] font-bold shrink-0">
                    narx yo&apos;q
                  </span>
                )}
                <div className="relative shrink-0">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    value={prices[c.id] ?? ""}
                    onChange={(e) => setPrices((p) => ({ ...p, [c.id]: e.target.value }))}
                    placeholder="0"
                    className="w-36 pl-3 pr-12 py-2.5 border border-brand-line rounded-xl text-sm font-bold text-slate-900 tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">
                    so&apos;m
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11.5px] text-slate-400">
          Narx o&apos;zgarishi faqat KEYINGI hisob-kitoblarga ta&apos;sir qiladi. 0 yoki bo&apos;sh — guruh hisob-kitobga kirmaydi.
        </p>
        <button
          onClick={save}
          disabled={saving || changedIds.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-40"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {changedIds.length > 0 ? `Saqlash (${changedIds.length})` : "Saqlash"}
        </button>
      </div>
    </div>
  );
}
