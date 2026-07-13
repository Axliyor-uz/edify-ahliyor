import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100 (clamped). */
  value: number;
  /** warning ≈ near a limit, error ≈ limit exceeded. */
  tone?: "primary" | "warning" | "error";
}

const FILL = { primary: "bg-primary", warning: "bg-warning", error: "bg-error" } as const;

export function ProgressBar({ value, tone = "primary", className, ...rest }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary-container", className)}
      {...rest}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-300", FILL[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Spinner({ size = 28, className }: { size?: number; className?: string }) {
  return <div role="status" aria-label="Yuklanmoqda" className={cn("m3-spinner", className)} style={{ width: size, height: size }} />;
}

/** Loading placeholder block — size it with className (h-4 w-40 …). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("m3-skeleton", className)} />;
}
