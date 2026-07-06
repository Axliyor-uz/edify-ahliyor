import Link from "next/link";
import { SearchX, LayoutDashboard, Layers } from "lucide-react";

// Branded 404 for the /manager tree. Triggered by notFound() in manager pages
// (bad group/room ids) and by the [...missing] catch-all for unmatched URLs.
// Renders inside the layout, so the sidebar stays and the user is never lost.
export default function ManagerNotFound() {
  return (
    <div className="min-h-[65vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm animate-[nfIn_.25s_ease-out]">
        {/* Icon with soft halo */}
        <div className="relative w-20 h-20 mx-auto mb-5">
          <span className="absolute inset-0 rounded-full bg-amber-100 animate-ping opacity-40 [animation-duration:2s]" />
          <span className="absolute inset-1.5 rounded-full bg-amber-50" />
          <span className="absolute inset-0 flex items-center justify-center text-amber-500">
            <SearchX size={32} strokeWidth={2.25} />
          </span>
        </div>

        <p className="inline-block px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[11px] font-black tracking-widest text-slate-400 mb-3">
          404
        </p>
        <h2 className="text-[19px] font-black text-slate-900 tracking-tight">Sahifa topilmadi</h2>
        <p className="text-[13.5px] text-slate-500 font-medium mt-2 leading-relaxed">
          Siz izlagan sahifa mavjud emas yoki o&apos;chirilgan bo&apos;lishi mumkin.
          Manzilni tekshiring yoki quyidagi bo&apos;limlardan davom eting.
        </p>

        <div className="flex gap-2.5 mt-7">
          <Link
            href="/manager/dashboard"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[13.5px] rounded-xl shadow-sm shadow-amber-500/25 transition-all active:scale-[0.98]"
          >
            <LayoutDashboard size={15} /> Bosh sahifa
          </Link>
          <Link
            href="/manager/groups"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13.5px] rounded-xl transition-all active:scale-[0.98]"
          >
            <Layers size={15} /> Guruhlar
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes nfIn { from { transform: translateY(14px) scale(.97); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
}
