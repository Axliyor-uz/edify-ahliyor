"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Muted text under the title. */
  description?: ReactNode;
  /** Optional icon shown in a circle above the title (centers the header). */
  icon?: ReactNode;
  /** Buttons row, right-aligned (e.g. text-Button + filled-Button). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, icon, actions, children, className }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden />
      <div className={cn("relative w-full max-w-md rounded-m3-xl bg-surface-container-high p-6 shadow-elev-3", className)}>
        {icon && (
          <div className="mx-auto mb-3.5 grid h-11 w-11 place-items-center rounded-full bg-error-container text-on-error-container [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </div>
        )}
        <h2 className={cn("text-lg font-semibold text-on-surface", icon && "text-center")}>{title}</h2>
        {description && <p className={cn("mt-2 text-sm text-on-surface-variant", icon && "text-center")}>{description}</p>}
        {children}
        {actions && <div className="mt-6 flex justify-end gap-1.5">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Destructive action → red confirm button + warning icon. */
  danger?: boolean;
  /** Spinner on the confirm button while the action runs. */
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Tasdiqlash",
  cancelText = "Bekor qilish",
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={danger ? <AlertTriangle /> : undefined}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={danger ? "danger" : "filled"} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    />
  );
}
