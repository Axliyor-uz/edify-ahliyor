"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  label: string;
  onShift: (delta: number) => void;
}

export default function MonthNav({ label, onShift }: Props) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onShift(-1)}
        className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
      >
        <ChevronLeft size={17} />
      </button>
      <p className="text-sm font-bold text-slate-800 min-w-[120px] text-center">{label}</p>
      <button
        onClick={() => onShift(1)}
        className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
