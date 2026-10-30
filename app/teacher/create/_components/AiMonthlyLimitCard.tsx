"use client";

import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button, ProgressBar, cn } from "@/components/ui";
import { useTeacherLanguage } from "@/app/teacher/layout";

const TRANSLATIONS = {
  uz: {
    left: (n: number) => `${n} ta qoldi`,
    title: "Oylik AI limit",
    renews: (date: string) => `Yangilanadi: ${date}`,
    usage: (used: number, total: number) => `${used} / ${total} ishlatildi`,
    unlimited: "Cheksiz",
    upgrade: "Limitni oshirish",
  },
  en: {
    left: (n: number) => `${n} left`,
    title: "Monthly AI limit",
    renews: (date: string) => `Renews: ${date}`,
    usage: (used: number, total: number) => `${used} / ${total} used`,
    unlimited: "Unlimited",
    upgrade: "Increase limit",
  },
  ru: {
    left: (n: number) => `осталось ${n}`,
    title: "Месячный лимит ИИ",
    renews: (date: string) => `Обновится: ${date}`,
    usage: (used: number, total: number) => `${used} / ${total} использовано`,
    unlimited: "Без лимита",
    upgrade: "Увеличить лимит",
  },
} as const;

interface AiMonthlyLimitCardProps {
  aiData: {
    limit: number;
    used: number;
    remaining: number;
    usagePercentage: number;
    isUnlimited: boolean;
    isDanger: boolean;
    resetDate: string;
    loading: boolean;
  };
}

/** Small "⚡ 79 left" chip; tap for the monthly balance and an upgrade link. */
export default function AiMonthlyLimitCard({ aiData }: AiMonthlyLimitCardProps) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.uz;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!aiData || aiData.loading) return null;

  const isEmpty = !aiData.isUnlimited && aiData.remaining <= 0;
  const alert = isEmpty || aiData.isDanger;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t.title}
        className={cn(
          "m3-interactive inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium tabular-nums",
          alert ? "border-error bg-error-container text-on-error-container" : "border-outline-variant text-on-surface-variant",
        )}
      >
        <Zap size={13} className={alert ? "text-error" : "text-on-surface-variant"} />
        {aiData.isUnlimited ? "∞" : t.left(aiData.remaining)}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[101] mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-m3-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-elev-3">
          <p className="text-sm font-semibold text-on-surface">{t.title}</p>
          {aiData.isUnlimited ? (
            <p className="mt-1 text-sm text-on-surface-variant">{t.unlimited}</p>
          ) : (
            <>
              <ProgressBar value={aiData.usagePercentage} tone={alert ? "error" : "primary"} className="mt-3" />
              <p className="mt-2 text-xs tabular-nums text-on-surface-variant">{t.usage(aiData.used, aiData.limit)}</p>
            </>
          )}
          {aiData.resetDate && <p className="mt-1 text-xs text-on-surface-variant">{t.renews(aiData.resetDate)}</p>}
          {!aiData.isUnlimited && (
            <Button
              variant={isEmpty ? "filled" : "outlined"}
              size="sm"
              className="mt-4 w-full"
              onClick={() => {
                setOpen(false);
                router.push("/teacher/subscription");
              }}
            >
              {t.upgrade}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
