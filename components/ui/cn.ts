import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with correct conflict resolution (later wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
