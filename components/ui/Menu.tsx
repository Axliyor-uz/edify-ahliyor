"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

export interface MenuItemDef {
  label: ReactNode;
  icon?: ReactNode;
  /** Red styling for destructive entries. */
  danger?: boolean;
  onClick: () => void;
}

export interface MenuProps {
  /** The element that opens the menu (typically an <IconButton>). */
  trigger: ReactNode;
  /** Items; use "divider" to draw a separator. */
  items: (MenuItemDef | "divider")[];
  align?: "left" | "right";
  className?: string;
}

/** Simple dropdown menu (row actions, card overflow menus). */
export function Menu({ trigger, items, align = "right", className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <span className="inline-flex" onClick={() => setOpen((o) => !o)}>
        {trigger}
      </span>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-50 mt-1 w-52 rounded-m3-sm bg-surface-container py-1.5 shadow-elev-2",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) =>
            item === "divider" ? (
              <div key={i} aria-hidden className="my-1.5 h-px bg-outline-variant" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "m3-interactive flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm [&_svg]:h-4 [&_svg]:w-4",
                  item.danger ? "text-error" : "text-on-surface [&_svg]:text-on-surface-variant",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
