"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTeacherLanguage } from "@/app/teacher/layout";

const TEXT = {
  uz: { title: (n?: number) => (n ? `${n} ta savol yaratilmoqda` : "Yaratilmoqda"), steps: ["Mavzu o'rganilmoqda", "Savollar yozilmoqda", "Javoblar tekshirilmoqda"], hint: "Odatda 10–30 soniya" },
  en: { title: (n?: number) => (n ? `Generating ${n} questions` : "Generating"), steps: ["Reading the topic", "Writing questions", "Checking answers"], hint: "Usually 10–30 seconds" },
  ru: { title: (n?: number) => (n ? `Создаём вопросы: ${n}` : "Создаём"), steps: ["Изучаем тему", "Пишем вопросы", "Проверяем ответы"], hint: "Обычно 10–30 секунд" },
} as const;

/**
 * Full-screen "AI is working" layer shared by every AI creator.
 *
 * ⚠️ Portaled to <body> on purpose: the teacher layout animates each page in a
 * transformed wrapper, which turns `position: fixed` into "fixed to the content
 * column" — the sidebar stayed sharp and clickable. From <body> it covers it all.
 */
export default function GeneratingOverlay({ open, count }: { open: boolean; count?: number }) {
  // Only ever opened by a click, so `document` exists whenever this renders the portal.
  if (!open) return null;
  return createPortal(<OverlayCard count={count} />, document.body);
}

/** Mounted fresh on every open, so the step text always starts at the first line. */
function OverlayCard({ count }: { count?: number }) {
  const { lang } = useTeacherLanguage();
  const t = TEXT[lang] ?? TEXT.uz;
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, t.steps.length - 1)), 4000);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearInterval(timer);
      document.body.style.overflow = prevOverflow;
    };
  }, [t.steps.length]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={t.title(count)}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-scrim p-4 backdrop-blur-sm font-t-body"
    >
      <div className="w-full max-w-xs rounded-m3-lg border border-outline-variant bg-surface-container-lowest p-5 shadow-elev-3">
        <p className="text-[15px] font-semibold text-on-surface">{t.title(count)}…</p>
        <p aria-live="polite" className="mt-1 text-sm text-on-surface-variant">{t.steps[step]}</p>
        <div className="t-indeterminate mt-4"><span /></div>
        <p className="mt-3 text-xs text-on-surface-variant">{t.hint}</p>
      </div>
    </div>
  );
}
