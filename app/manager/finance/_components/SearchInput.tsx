"use client";

import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

/** Shared list-filter input for the finance tabs. */
export default function SearchInput({ value, onChange, placeholder }: Props) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-3 bg-white border border-brand-line rounded-xl text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
