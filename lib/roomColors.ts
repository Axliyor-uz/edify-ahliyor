import type { RoomColor } from "@/types/rooms";

// Tailwind class bundles per room color. One source of truth so the rooms list,
// modal picker, timetable, and chips all render a room identically.
export interface RoomTheme {
  bar: string;   // solid accent (card top bar / swatch)
  dot: string;   // small solid dot
  soft: string;  // soft tinted background
  text: string;  // readable text on soft bg
  ring: string;  // selected ring (color picker)
  cell: string;  // timetable cell (soft bg + border + text)
}

export const ROOM_THEME: Record<RoomColor, RoomTheme> = {
  indigo:  { bar: "bg-indigo-500",  dot: "bg-indigo-500",  soft: "bg-indigo-50",  text: "text-indigo-700",  ring: "ring-indigo-500",  cell: "bg-indigo-50 border-indigo-200 text-indigo-800" },
  violet:  { bar: "bg-violet-500",  dot: "bg-violet-500",  soft: "bg-violet-50",  text: "text-violet-700",  ring: "ring-violet-500",  cell: "bg-violet-50 border-violet-200 text-violet-800" },
  teal:    { bar: "bg-teal-500",    dot: "bg-teal-500",    soft: "bg-teal-50",    text: "text-teal-700",    ring: "ring-teal-500",    cell: "bg-teal-50 border-teal-200 text-teal-800" },
  amber:   { bar: "bg-amber-500",   dot: "bg-amber-500",   soft: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-500",   cell: "bg-amber-50 border-amber-200 text-amber-800" },
  rose:    { bar: "bg-rose-500",    dot: "bg-rose-500",    soft: "bg-rose-50",    text: "text-rose-700",    ring: "ring-rose-500",    cell: "bg-rose-50 border-rose-200 text-rose-800" },
  sky:     { bar: "bg-sky-500",     dot: "bg-sky-500",     soft: "bg-sky-50",     text: "text-sky-700",     ring: "ring-sky-500",     cell: "bg-sky-50 border-sky-200 text-sky-800" },
  emerald: { bar: "bg-emerald-500", dot: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-500", cell: "bg-emerald-50 border-emerald-200 text-emerald-800" },
};

export function roomTheme(color?: string): RoomTheme {
  return ROOM_THEME[(color as RoomColor)] || ROOM_THEME.indigo;
}
