"use client";

import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";

/*
 * The one input style of the login and signup pages: white outlined field
 * with a label that sits inside while empty and floats onto the border once
 * focused or filled. Pure CSS (`peer` + `placeholder=" "`), no focus state.
 */

export type Tone = "idle" | "error" | "success" | "warn";

const TONES: Record<Tone, string> = {
  idle: "border-[#CBD5E1] hover:border-[#94A3B8] focus:border-[#1565C0]",
  error: "border-rose-300 hover:border-rose-400 focus:border-rose-500",
  success: "border-emerald-300 hover:border-emerald-400 focus:border-emerald-500",
  warn: "border-amber-300 hover:border-amber-400 focus:border-amber-500",
};

const BOX = "peer w-full pt-5 pb-2 rounded-xl border-2 bg-white text-[#0F172A] text-[15px] font-medium leading-[22px] outline-none caret-[#1565C0] transition-colors duration-200";
const LABEL = "absolute left-3 px-1 bg-white pointer-events-none transition-all duration-200";
const FLOATED = "top-0 -translate-y-1/2 text-[12px] font-bold text-[#1565C0]";
const RESTING = "top-1/2 -translate-y-1/2 text-[15px] font-normal text-[#64748B]";

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder" | "prefix"> & {
  id: string;
  label: string;
  ref?: Ref<HTMLInputElement>;
  tone?: Tone;
  /** Icons/buttons pinned to the right edge; they turn blue while the field is focused. */
  right?: ReactNode;
  /** Fixed text before the value (e.g. "+998"); hidden while the label rests inside. */
  prefix?: string;
};

export function FloatField({ id, label, ref, tone = "idle", right, prefix, className = "", ...input }: FieldProps) {
  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        placeholder=" "
        aria-invalid={tone === "error" || undefined}
        {...input}
        className={`${BOX} ${prefix ? "pl-[4.1rem]" : "pl-4"} ${right ? "pr-12" : "pr-4"} ${TONES[tone]} ${className}`}
      />
      {prefix && (
        <span className="absolute left-4 bottom-[10px] text-[15px] leading-[22px] font-medium text-[#64748B] pointer-events-none transition-opacity peer-placeholder-shown:opacity-0 peer-focus:opacity-100">
          {prefix}
        </span>
      )}
      <label
        htmlFor={id}
        className={`${LABEL} ${FLOATED} peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-[15px] peer-placeholder-shown:font-normal peer-placeholder-shown:text-[#64748B] peer-focus:top-0 peer-focus:text-[12px] peer-focus:font-bold peer-focus:text-[#1565C0]`}
      >
        {label}
      </label>
      {right && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[#94A3B8] peer-focus:text-[#1565C0] transition-colors">
          {right}
        </div>
      )}
    </div>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value"> & { id: string; label: string; value: string };

/** Same look as FloatField; the label is the placeholder until an option is picked. */
export function FloatSelect({ id, label, value, children, ...select }: SelectProps) {
  return (
    <div className="relative">
      <select id={id} value={value} {...select} className={`${BOX} appearance-none cursor-pointer pl-4 pr-11 ${TONES.idle}`}>
        <option value="" disabled hidden />
        {children}
      </select>
      <label
        htmlFor={id}
        className={`${LABEL} ${value ? FLOATED : `${RESTING} peer-focus:top-0 peer-focus:text-[12px] peer-focus:font-bold peer-focus:text-[#1565C0]`}`}
      >
        {label}
      </label>
      <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] peer-focus:text-[#1565C0] pointer-events-none transition-colors" />
    </div>
  );
}

export const FieldError = ({ text }: { text?: string | null }) =>
  text ? (
    <p role="alert" className="flex items-center gap-1.5 mt-2 px-1 text-[13px] font-semibold text-rose-600">
      <AlertCircle size={15} className="shrink-0" /> {text}
    </p>
  ) : null;

/** Small grey hint under a field. */
export const FieldHint = ({ children }: { children: ReactNode }) => (
  <p className="mt-2 px-1 text-[12px] font-medium text-[#94A3B8]">{children}</p>
);

/** Small pill on the sign-in option this browser used last time (see lastLogin.ts). */
export const LastUsedBadge = ({ text }: { text: string }) => (
  <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm pointer-events-none">
    {text}
  </span>
);
