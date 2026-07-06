"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";

// Route-level error boundary for every /manager page (App Router convention).
// Renders inside the layout, so the sidebar survives and recovery is one tap.
export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Manager route error:", error);
  }, [error]);

  return (
    <div className="min-h-[65vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm animate-[errIn_.25s_ease-out]">
        {/* Icon with a soft pulsing halo */}
        <div className="relative w-20 h-20 mx-auto mb-5">
          <span className="absolute inset-0 rounded-full bg-red-100 animate-ping opacity-40" />
          <span className="absolute inset-1.5 rounded-full bg-red-50" />
          <span className="absolute inset-0 flex items-center justify-center text-red-500">
            <AlertTriangle size={32} strokeWidth={2.25} />
          </span>
        </div>

        <h2 className="text-[19px] font-black text-slate-900 tracking-tight">Xatolik yuz berdi</h2>
        <p className="text-[13.5px] text-slate-500 font-medium mt-2 leading-relaxed">
          Sahifani yuklashda kutilmagan muammo chiqdi. Qayta urinib ko&apos;ring —
          odatda bu darhol hal bo&apos;ladi.
        </p>

        {error.digest && (
          <p className="mt-3 inline-block px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10.5px] font-mono text-slate-400">
            Kod: {error.digest}
          </p>
        )}

        <div className="flex gap-2.5 mt-7">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[13.5px] rounded-xl shadow-sm shadow-amber-500/25 transition-all active:scale-[0.98]"
          >
            <RotateCcw size={15} strokeWidth={2.5} /> Qayta urinish
          </button>
          <Link
            href="/manager/dashboard"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13.5px] rounded-xl transition-all active:scale-[0.98]"
          >
            <LayoutDashboard size={15} /> Bosh sahifa
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @keyframes errIn { from { transform: translateY(14px) scale(.97); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
}
