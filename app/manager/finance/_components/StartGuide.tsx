"use client";

import { CheckCircle2 } from "lucide-react";

interface Step {
  done: boolean;
  title: string;
  desc: string;
  actionLabel: string;
  onAction: () => void;
}

interface Props {
  steps: Step[];
}

/**
 * 3-step onboarding card, shown until the center has prices + charges + a payment.
 * Data-driven: each step checks real state, so it disappears by itself.
 */
export default function StartGuide({ steps }: Props) {
  return (
    <div className="bg-white border border-brand-line rounded-2xl p-5 sm:p-6">
      <p className="text-[15px] font-bold text-slate-900">Moliya bo&apos;limini boshlash — 3 qadam</p>
      <div className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <div key={s.title} className="flex items-center gap-3">
            {s.done ? (
              <CheckCircle2 size={26} className="text-brand-600 shrink-0" />
            ) : (
              <div className="w-[26px] h-[26px] rounded-full bg-brand-600 text-white text-[13px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-[13.5px] font-bold ${s.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                {s.title}
              </p>
              {!s.done && <p className="text-[12px] text-slate-500 leading-snug">{s.desc}</p>}
            </div>
            {!s.done && (
              <button
                onClick={s.onAction}
                className="shrink-0 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[12px] font-bold transition-colors"
              >
                {s.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
