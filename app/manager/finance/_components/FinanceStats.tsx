"use client";

import { AlertCircle, HandCoins, PiggyBank, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { formatUZS } from "@/lib/finance/money";

interface Props {
  monthLabel: string;
  collected: number;
  charged: number;
  debtTotal: number;
  avansTotal: number;
  expensesTotal: number;
  profit: number;
}

/**
 * Headline P&L as ONE row on desktop (xl: 6 columns), a swipeable snap
 * carousel on mobile. Gradient icon tiles + tinted card washes give each
 * metric its own identity at a glance.
 */
export default function FinanceStats({ monthLabel, collected, charged, debtTotal, avansTotal, expensesTotal, profit }: Props) {
  const cards = [
    {
      Icon: TrendingUp,
      label: "Tushum",
      sub: monthLabel,
      value: formatUZS(collected),
      tile: "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30",
      wash: "bg-gradient-to-b from-emerald-50/70 to-white",
      valueCls: "text-brand-800",
    },
    {
      Icon: ReceiptText,
      label: "Hisoblangan",
      sub: monthLabel,
      value: formatUZS(charged),
      tile: "bg-gradient-to-br from-sky-400 to-sky-600 shadow-sky-500/30",
      wash: "bg-gradient-to-b from-sky-50/70 to-white",
      valueCls: "text-slate-900",
    },
    {
      Icon: HandCoins,
      label: "Xarajatlar",
      sub: monthLabel,
      value: formatUZS(expensesTotal),
      tile: "bg-gradient-to-br from-orange-400 to-orange-500 shadow-orange-400/30",
      wash: "bg-gradient-to-b from-orange-50/70 to-white",
      valueCls: "text-slate-900",
    },
    {
      Icon: Wallet,
      label: "Foyda",
      sub: monthLabel,
      value: formatUZS(profit),
      tile:
        profit >= 0
          ? "bg-gradient-to-br from-teal-400 to-emerald-600 shadow-emerald-500/30"
          : "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/30",
      wash: profit >= 0 ? "bg-gradient-to-b from-emerald-50/70 to-white" : "bg-gradient-to-b from-rose-50/70 to-white",
      valueCls: profit >= 0 ? "text-brand-700" : "text-rose-600",
    },
    {
      Icon: AlertCircle,
      label: "Qarzdorlik",
      sub: "jami",
      value: formatUZS(debtTotal),
      tile: "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/30",
      wash: "bg-gradient-to-b from-rose-50/70 to-white",
      valueCls: debtTotal > 0 ? "text-rose-600" : "text-slate-900",
    },
    {
      Icon: PiggyBank,
      label: "Avans",
      sub: "oldindan to'lovlar",
      value: formatUZS(avansTotal),
      tile: "bg-gradient-to-br from-violet-400 to-violet-600 shadow-violet-500/30",
      wash: "bg-gradient-to-b from-violet-50/70 to-white",
      valueCls: "text-slate-900",
    },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 xl:grid-cols-6 md:overflow-visible md:pb-0">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`snap-start shrink-0 w-[172px] md:w-auto md:shrink border border-brand-line rounded-2xl p-4 transition-shadow hover:shadow-md hover:shadow-slate-200/60 ${c.wash}`}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md ${c.tile}`}>
              <c.Icon size={17} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-[11.5px] font-bold text-slate-700">{c.label}</p>
              <p className="text-[10px] text-slate-400 truncate">{c.sub}</p>
            </div>
          </div>
          <p className={`text-[15px] xl:text-[16px] font-bold tabular-nums leading-tight whitespace-nowrap ${c.valueCls}`}>
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
