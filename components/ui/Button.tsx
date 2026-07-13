import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export type ButtonVariant =
  | "filled" // the ONE main action of a screen
  | "tonal" // secondary actions
  | "elevated"
  | "outlined"
  | "text"
  | "danger" // destructive main action
  | "danger-text";

export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  filled: "bg-primary text-on-primary hover:shadow-elev-1",
  tonal: "bg-secondary-container text-on-secondary-container",
  elevated: "bg-surface-container-low text-primary shadow-elev-1 hover:shadow-elev-2",
  outlined: "text-primary ring-1 ring-inset ring-outline",
  text: "text-primary",
  danger: "bg-error text-on-error",
  "danger-text": "text-error",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-4 text-xs [&_svg]:h-4 [&_svg]:w-4",
  md: "h-10 gap-2 px-6 text-sm [&_svg]:h-[18px] [&_svg]:w-[18px]",
  lg: "h-12 gap-2 px-7 text-[15px] [&_svg]:h-5 [&_svg]:w-5",
};

/* text-style buttons get tighter padding */
const TEXT_PAD: Record<ButtonSize, string> = { sm: "px-2.5", md: "px-3.5", lg: "px-4" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon, e.g. <Plus /> (lucide) — sized automatically. */
  icon?: ReactNode;
  /** Shows a spinner in place of the icon and disables the button. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "filled", size = "md", icon, loading = false, className, children, disabled, type, ...rest },
  ref,
) {
  const isTextLike = variant === "text" || variant === "danger-text" || variant === "outlined";
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={isDisabled}
      className={cn(
        "m3-interactive inline-flex flex-none select-none items-center justify-center whitespace-nowrap rounded-m3-btn font-semibold tracking-[0.1px] transition-shadow",
        VARIANT[variant],
        SIZE[size],
        (variant === "text" || variant === "danger-text") && TEXT_PAD[size],
        isDisabled &&
          (isTextLike
            ? "text-disabled-fg ring-outline-variant"
            : "bg-disabled-bg text-disabled-fg shadow-none hover:shadow-none"),
        isDisabled && "cursor-not-allowed",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "standard" | "tonal" | "filled";
  size?: "sm" | "md";
  /** Required — icon-only buttons must announce what they do. */
  "aria-label": string;
}

const ICON_VARIANT: Record<NonNullable<IconButtonProps["variant"]>, string> = {
  standard: "text-on-surface-variant",
  tonal: "bg-secondary-container text-on-secondary-container",
  filled: "bg-primary text-on-primary",
};

const ICON_SIZE: Record<NonNullable<IconButtonProps["size"]>, string> = {
  sm: "h-8 w-8 [&_svg]:h-4 [&_svg]:w-4",
  md: "h-10 w-10 [&_svg]:h-5 [&_svg]:w-5",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = "standard", size = "md", className, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled}
      className={cn(
        "m3-interactive inline-grid flex-none select-none place-items-center rounded-full",
        ICON_VARIANT[variant],
        ICON_SIZE[size],
        disabled && "cursor-not-allowed text-disabled-fg",
        disabled && variant !== "standard" && "bg-disabled-bg",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
