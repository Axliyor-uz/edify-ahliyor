import type { ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Optional trailing element (e.g. a <Badge>). */
  badge?: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Controlled: id of the active tab. */
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-outline-variant", className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex flex-none items-center gap-2 whitespace-nowrap px-4 pb-2.5 pt-3 text-sm font-semibold transition-colors",
              active ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {t.label}
            {t.badge}
            {active && <span aria-hidden className="absolute inset-x-3 -bottom-px h-[3px] rounded-t-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}
