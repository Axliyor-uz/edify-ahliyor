import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "./cn";

/* Fields have an opaque background (surface-container-lowest) so the floating
   label patch always matches, on any card. */

const FIELD =
  "m3-field w-full rounded-m3-xs border bg-surface-container-lowest text-sm text-on-surface transition-colors placeholder:text-transparent focus:outline-none";
const FIELD_OK = "border-outline focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary";
const FIELD_ERR = "border-error focus:border-error focus:ring-1 focus:ring-inset focus:ring-error";

const LABEL =
  "pointer-events-none absolute left-3 bg-surface-container-lowest px-1 text-sm text-on-surface-variant transition-all " +
  "peer-focus:text-[11px] peer-focus:font-semibold peer-[:not(:placeholder-shown)]:text-[11px]";

function Supporting({ error, supporting }: { error?: string; supporting?: ReactNode }) {
  if (!error && !supporting) return null;
  return <p className={cn("px-3.5 text-xs", error ? "text-error" : "text-on-surface-variant")}>{error || supporting}</p>;
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Error message — turns the field red and replaces the supporting text. */
  error?: string;
  /** Helper text under the field. */
  supporting?: ReactNode;
}

export function TextField({ label, error, supporting, className, id, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative">
        <input id={fieldId} placeholder=" " className={cn(FIELD, "peer h-12 px-4", error ? FIELD_ERR : FIELD_OK)} {...rest} />
        <label
          htmlFor={fieldId}
          className={cn(
            LABEL,
            "top-1/2 -translate-y-1/2 peer-focus:top-0 peer-[:not(:placeholder-shown)]:top-0",
            error ? "peer-focus:text-error" : "peer-focus:text-primary",
          )}
        >
          {label}
        </label>
      </div>
      <Supporting error={error} supporting={supporting} />
    </div>
  );
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  supporting?: ReactNode;
}

export function TextArea({ label, error, supporting, className, id, ...rest }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative">
        <textarea
          id={fieldId}
          placeholder=" "
          className={cn(FIELD, "peer min-h-24 resize-y px-4 py-3", error ? FIELD_ERR : FIELD_OK)}
          {...rest}
        />
        <label
          htmlFor={fieldId}
          className={cn(
            LABEL,
            "top-6 -translate-y-1/2 peer-focus:top-0 peer-[:not(:placeholder-shown)]:top-0",
            error ? "peer-focus:text-error" : "peer-focus:text-primary",
          )}
        >
          {label}
        </label>
      </div>
      <Supporting error={error} supporting={supporting} />
    </div>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  supporting?: ReactNode;
}

/** Native select (options passed as children). The label sits floated. */
export function Select({ label, error, supporting, className, id, children, ...rest }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative">
        <select id={fieldId} className={cn(FIELD, "h-12 appearance-none px-4 pr-10", error ? FIELD_ERR : FIELD_OK)} {...rest}>
          {children}
        </select>
        {label && (
          <label
            htmlFor={fieldId}
            className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-surface-container-lowest px-1 text-[11px] font-semibold text-on-surface-variant"
          >
            {label}
          </label>
        )}
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
      </div>
      <Supporting error={error} supporting={supporting} />
    </div>
  );
}

export interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Wrapper classes (width etc.); input takes the remaining props. */
  className?: string;
}

export function SearchBar({ className, ...rest }: SearchBarProps) {
  return (
    <div className={cn("flex h-11 items-center gap-2.5 rounded-full bg-surface-container-high px-4 text-on-surface-variant", className)}>
      <Search aria-hidden className="h-[18px] w-[18px] flex-none" />
      <input type="search" className="m3-field h-full w-full min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none" {...rest} />
    </div>
  );
}
