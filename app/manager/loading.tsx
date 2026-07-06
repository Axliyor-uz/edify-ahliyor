import { BookOpen } from "lucide-react";

// Route-level loading boundary for every /manager page (App Router convention).
// Shows inside the layout's content area while a segment loads, so the sidebar
// stays put and only the content softly "breathes".
export default function ManagerLoading() {
  return (
    <div className="min-h-[65vh] flex flex-col items-center justify-center">
      {/* Brand spinner: static ring + spinning amber arc + pulsing logo */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-11 h-11 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30 animate-pulse">
            <BookOpen size={22} strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* Label with staggered bouncing dots */}
      <div className="flex items-end gap-1 mt-6">
        <span className="text-[14px] font-bold text-slate-500 tracking-wide">Yuklanmoqda</span>
        <span className="flex gap-0.5 pb-[3px]">
          <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" />
        </span>
      </div>

      {/* Ghost content hint — keeps the page feeling "about to arrive" */}
      <div className="w-full max-w-md mt-10 space-y-3 px-6">
        <div className="h-3.5 bg-slate-100 rounded-full animate-pulse w-3/4 mx-auto" />
        <div className="h-3.5 bg-slate-100 rounded-full animate-pulse w-1/2 mx-auto [animation-delay:0.15s]" />
      </div>
    </div>
  );
}
