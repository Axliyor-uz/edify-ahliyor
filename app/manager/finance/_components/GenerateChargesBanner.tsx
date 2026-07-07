"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Sparkles } from "lucide-react";
import type { BillingAnchor, GenerateChargesResult } from "@/types/finance";
import { generateChargesApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";

interface Props {
  anchor: BillingAnchor;
  monthKey: string;
  monthLabel: string;
  /** Bumped by the page after any data change (e.g. group prices) so the preview re-runs. */
  refreshToken?: number;
  onGenerated: () => void;
}

/**
 * Detects missing charges (dryRun preview) and offers one-click generation.
 * Generation is idempotent server-side, so a double click can't double-charge
 * (FINANCE_PLAN.md §4.1) — but we still disable the button while running.
 */
export default function GenerateChargesBanner({ anchor, monthKey, monthLabel, refreshToken, onGenerated }: Props) {
  const [preview, setPreview] = useState<GenerateChargesResult | null>(null);
  const [running, setRunning] = useState(false);

  const requestBody = anchor === "calendar" ? { periodKey: monthKey } : {};

  useEffect(() => {
    let mounted = true;
    setPreview(null);
    generateChargesApi({ ...requestBody, dryRun: true })
      .then((r) => mounted && setPreview(r))
      .catch(() => {});
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, monthKey, refreshToken]);

  if (!preview || preview.created === 0) return null;

  const generate = async () => {
    if (running) return;
    setRunning(true);
    try {
      const result = await generateChargesApi(requestBody);
      toast.success(`${result.created} ta hisob yaratildi — jami ${formatUZS(result.totalAmount)}`);
      setPreview(null);
      onGenerated();
    } catch (e: any) {
      toast.error(e.message || "Hisob-kitob yaratishda xatolik.");
    } finally {
      setRunning(false);
    }
  };

  const scopeLabel = anchor === "calendar" ? `${monthLabel} uchun` : "Yangi davrlar uchun";

  return (
    <div className="bg-[#FFF8EC] border border-[#F3E2BD] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-[#FDEDCB] text-amber-600 flex items-center justify-center shrink-0">
        <Sparkles size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-900">
          {scopeLabel} hisob-kitob hali yaratilmagan
        </p>
        <p className="text-[12.5px] text-amber-700 mt-0.5">
          {preview.created} ta hisob · jami {formatUZS(preview.totalAmount)}
          {preview.frozenSkipped > 0 && ` · ${preview.frozenSkipped} ta muzlatilgan o'quvchi o'tkazib yuboriladi`}
        </p>
      </div>
      <button
        onClick={generate}
        disabled={running}
        className="shrink-0 px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-bold text-sm rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {running && <Loader2 size={15} className="animate-spin" />}
        Yaratish
      </button>
    </div>
  );
}
