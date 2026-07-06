"use client";

import { useState } from "react";
import { ShieldAlert, ShieldX, Phone, Send, X, Lock } from "lucide-react";

export type CenterApprovalStatus = "pending" | "active" | "suspended";

const ADMIN_PHONE_DISPLAY = "+998 33 860 20 06";
const ADMIN_PHONE_TEL = "+998338602006";
const ADMIN_TELEGRAM = "umidjon0339";

const COPY = {
  pending: {
    title: "Markazingiz tasdiqlanishi kutilmoqda",
    body: "Barcha funksiyalardan to'liq foydalanish uchun markazingiz admin tomonidan tasdiqlanishi kerak. Tasdiqlash uchun admin bilan bog'laning:",
    icon: ShieldAlert,
    tone: {
      card: "bg-amber-50 border-amber-200",
      iconBox: "bg-amber-100 text-amber-600",
      title: "text-amber-900",
      body: "text-amber-800",
    },
  },
  suspended: {
    title: "Markazingiz faoliyati to'xtatilgan",
    body: "Markazingiz admin tomonidan vaqtincha to'xtatilgan. Qayta faollashtirish uchun admin bilan bog'laning:",
    icon: ShieldX,
    tone: {
      card: "bg-rose-50 border-rose-200",
      iconBox: "bg-rose-100 text-rose-600",
      title: "text-rose-900",
      body: "text-rose-800",
    },
  },
} as const;

function ContactButtons({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-2.5 ${compact ? "" : "mt-4"}`}>
      <a
        href={`tel:${ADMIN_PHONE_TEL}`}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-700 transition-colors shadow-sm"
      >
        <Phone size={15} /> {ADMIN_PHONE_DISPLAY}
      </a>
      <a
        href={`https://t.me/${ADMIN_TELEGRAM}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 text-white text-[13px] font-bold hover:bg-sky-600 transition-colors shadow-sm"
      >
        <Send size={15} /> @{ADMIN_TELEGRAM}
      </a>
    </div>
  );
}

/**
 * Wraps the manager pages. When the center is not yet approved (or suspended),
 * everything stays visible and navigable, but:
 *  - a big notice card is pinned above the page content (incl. the dashboard),
 *  - any interaction with the page content opens a "contact admin" dialog.
 * Firestore rules independently reject all writes for non-active centers —
 * this component is UX; the rules are the actual security boundary.
 */
export default function ApprovalGate({
  status,
  children,
}: {
  status: CenterApprovalStatus;
  children: React.ReactNode;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (status === "active") return <>{children}</>;

  const copy = COPY[status];
  const Icon = copy.icon;

  return (
    <>
      {/* BIG NOTICE CARD — always above the page content */}
      <div className={`border rounded-2xl p-5 sm:p-6 mb-4 shadow-sm ${copy.tone.card}`}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${copy.tone.iconBox}`}>
            <Icon size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-[16px] font-black tracking-tight ${copy.tone.title}`}>{copy.title}</h2>
            <p className={`text-[13.5px] font-medium mt-1 leading-relaxed ${copy.tone.body}`}>{copy.body}</p>
            <ContactButtons />
          </div>
        </div>
      </div>

      {/* PAGE CONTENT — visible but not interactive */}
      <div className="relative">
        {children}
        <div
          className="absolute inset-0 z-30 cursor-not-allowed"
          onClick={() => setDialogOpen(true)}
          aria-hidden="true"
        />
      </div>

      {/* CONTACT DIALOG — opens on any attempted interaction */}
      {dialogOpen && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setDialogOpen(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-[dialogIn_.18s_ease-out]">
            <button
              onClick={() => setDialogOpen(false)}
              aria-label="Yopish"
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${copy.tone.iconBox}`}>
              <Lock size={26} />
            </div>
            <h3 className="text-[17px] font-black text-slate-900 tracking-tight">
              Bu funksiya hozircha yopiq
            </h3>
            <p className="text-[13.5px] text-slate-500 font-medium mt-1.5 mb-5 leading-relaxed">
              {copy.body}
            </p>
            <ContactButtons compact />
          </div>
        </div>
      )}
    </>
  );
}
