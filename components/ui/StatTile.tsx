import type { ReactNode } from "react";
import { Card } from "./Card";
import { ProgressBar } from "./Progress";
import { cn } from "./cn";

export interface StatTileProps {
  /** Lucide icon shown in a tinted square. */
  icon: ReactNode;
  label: ReactNode;
  /** The number. Use suffix for things like "/100". */
  value: ReactNode;
  suffix?: ReactNode;
  /** Small line under the value — compose with <StatusChip> for deltas. */
  delta?: ReactNode;
  /** 0–100: renders a progress bar instead of the delta line. */
  progress?: number;
  tone?: "primary" | "secondary" | "tertiary";
  className?: string;
}

const ICON_TONE = {
  primary: "bg-primary-container text-on-primary-container",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
} as const;

/** Dashboard KPI tile: icon + label, big tabular number, delta or progress. */
export function StatTile({ icon, label, value, suffix, delta, progress, tone = "primary", className }: StatTileProps) {
  return (
    <Card hoverable className={cn("flex flex-col gap-2 px-4 py-4", className)}>
      <div className="flex items-center gap-2.5">
        <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-m3-md [&_svg]:h-4 [&_svg]:w-4", ICON_TONE[tone])}>
          {icon}
        </span>
        <span className="truncate text-xs font-medium text-on-surface-variant">{label}</span>
      </div>
      <div className="text-[27px] font-extrabold leading-none tracking-tight text-on-surface [font-variant-numeric:tabular-nums]">
        {value}
        {suffix && <span className="text-sm font-semibold tracking-normal text-on-surface-variant">{suffix}</span>}
      </div>
      {progress !== undefined ? (
        <ProgressBar value={progress} tone={progress >= 100 ? "error" : progress >= 80 ? "warning" : "primary"} />
      ) : (
        delta && <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">{delta}</div>
      )}
    </Card>
  );
}
