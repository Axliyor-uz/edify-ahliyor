"use client";

import { useEffect } from "react";

interface Props {
  onClose: () => void;
  /** Allow closing via backdrop / Escape (disable while submitting). */
  dismissible?: boolean;
  children: React.ReactNode;
}

/**
 * Responsive modal container: slides up as a bottom sheet on phones,
 * renders as a centered dialog from `sm` up.
 */
export default function ManagerSheet({ onClose, dismissible = true, children }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [dismissible, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => dismissible && onClose()}
      />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain animate-in fade-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
        <div className="sm:hidden pt-3 flex justify-center" aria-hidden>
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        {children}
      </div>
    </div>
  );
}
