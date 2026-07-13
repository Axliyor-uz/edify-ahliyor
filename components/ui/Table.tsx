import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";

/* Usage:
   <Table>
     <thead><tr><Th>O'quvchi</Th><Th>Natija</Th></tr></thead>
     <tbody>
       <TRow><Td>Aziza</Td><Td className="num">18/20</Td></TRow>
     </tbody>
   </Table>
*/

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full min-w-[560px] border-collapse text-sm text-on-surface", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("whitespace-nowrap border-b border-outline-variant px-3.5 py-2.5 text-left text-xs font-bold tracking-wide text-on-surface-variant", className)}
      {...rest}
    />
  );
}

export function TRow({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-state-hover [&:last-child>td]:border-b-0", className)} {...rest} />;
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("whitespace-nowrap border-b border-outline-variant px-3.5 py-3", className)} {...rest} />;
}

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  className?: string;
}

export function Pagination({ page, pageCount, onPage, className }: PaginationProps) {
  if (pageCount <= 1) return null;
  // window of up to 5 page numbers around the current one
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, i) => start + i);
  const btn = "m3-interactive grid h-8 w-8 flex-none place-items-center rounded-full text-[13px] font-semibold";
  return (
    <div className={cn("flex items-center justify-end gap-1 pt-3 text-on-surface-variant", className)}>
      <button type="button" aria-label="Oldingi sahifa" disabled={page === 1} onClick={() => onPage(page - 1)} className={cn(btn, "disabled:text-disabled-fg")}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? "page" : undefined}
          onClick={() => onPage(p)}
          className={cn(btn, p === page && "bg-primary text-on-primary")}
        >
          {p}
        </button>
      ))}
      <button type="button" aria-label="Keyingi sahifa" disabled={page === pageCount} onClick={() => onPage(page + 1)} className={cn(btn, "disabled:text-disabled-fg")}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
