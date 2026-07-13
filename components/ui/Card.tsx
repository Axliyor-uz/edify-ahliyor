import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardVariant = "elevated" | "tonal" | "outlined";

const VARIANT: Record<CardVariant, string> = {
  elevated: "bg-surface-container-low shadow-elev-1",
  tonal: "bg-surface-container-high",
  outlined: "bg-surface ring-1 ring-inset ring-outline-variant",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** App-wide default is "elevated" (chosen design). Override sparingly. */
  variant?: CardVariant;
  /** Lifts on hover — use for clickable/linked cards. */
  hoverable?: boolean;
}

export function Card({ variant = "elevated", hoverable = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-m3-lg p-5",
        VARIANT[variant],
        hoverable && "transition-shadow hover:shadow-elev-2",
        className,
      )}
      {...rest}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  /** Small muted text next to / under the title. */
  subtitle?: ReactNode;
  /** Right-aligned slot — usually a text Button or IconButton. */
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-baseline gap-2.5", className)}>
      <h3 className="text-[15px] font-bold text-on-surface">{title}</h3>
      {subtitle && <span className="text-xs text-on-surface-variant">{subtitle}</span>}
      {action && <div className="ml-auto flex flex-none items-center gap-1.5">{action}</div>}
    </div>
  );
}
