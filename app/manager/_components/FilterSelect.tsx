"use client";

import { ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  /** The "no filter" option label, e.g. "Barcha guruhlar". */
  allLabel: string;
}

/** MD3 filter-chip styled <select>: outlined when idle, filled green when a filter is active. */
export default function FilterSelect({ value, onChange, options, allLabel }: Props) {
  const active = value !== "";
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none pl-4 pr-9 py-2.5 rounded-full text-[13px] font-bold cursor-pointer max-w-[190px] border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200 ${
          active
            ? "bg-brand-600 text-white border-brand-600"
            : "bg-white text-slate-600 border-brand-line hover:border-brand-600"
        }`}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className={`absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
          active ? "text-white" : "text-slate-400"
        }`}
      />
    </div>
  );
}
