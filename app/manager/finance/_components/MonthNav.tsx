"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  label: string;
  onShift: (delta: number) => void;
}

export default function MonthNav({ label, onShift }: Props) {
  return (
    <div className="flex items-center gap-0.5 bg-white border border-brand-line rounded-full p-1">
      <button
        onClick={() => onShift(-1)}
        aria-label="Oldingi oy"
        className="w-9 h-9 rounded-full hover:bg-brand-50 active:scale-95 flex items-center justify-center text-slate-500 transition-all"
      >
        <ChevronLeft size={17} />
      </button>
      <p className="text-sm font-bold text-slate-800 min-w-[112px] text-center">{label}</p>
      <button
        onClick={() => onShift(1)}
        aria-label="Keyingi oy"
        className="w-9 h-9 rounded-full hover:bg-brand-50 active:scale-95 flex items-center justify-center text-slate-500 transition-all"
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
