"use client";

import { AlertCircle, PiggyBank, ReceiptText, TrendingDown, TrendingUp, Wallet } from "lucide-react";
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

/** Headline P&L: this month's collected/charged/expenses/profit + all-time open debt/avans. */
export default function FinanceStats({ monthLabel, collected, charged, debtTotal, avansTotal, expensesTotal, profit }: Props) {
  const cards = [
    {
      Icon: TrendingUp,
      label: `Tushum (${monthLabel})`,
      value: formatUZS(collected),
      iconCls: "bg-emerald-50 text-emerald-600",
      valueCls: "text-slate-900",
    },
    {
      Icon: ReceiptText,
      label: `Hisoblangan (${monthLabel})`,
      value: formatUZS(charged),
      iconCls: "bg-sky-50 text-sky-600",
      valueCls: "text-slate-900",
    },
    {
      Icon: TrendingDown,
      label: `Xarajatlar (${monthLabel})`,
      value: formatUZS(expensesTotal),
      iconCls: "bg-orange-50 text-orange-500",
      valueCls: "text-slate-900",
    },
    {
      Icon: Wallet,
      label: `Foyda (${monthLabel})`,
      value: formatUZS(profit),
      iconCls: profit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500",
      valueCls: profit >= 0 ? "text-emerald-700" : "text-rose-600",
    },
    {
      Icon: AlertCircle,
      label: "Jami qarzdorlik",
      value: formatUZS(debtTotal),
      iconCls: "bg-rose-50 text-rose-500",
      valueCls: "text-slate-900",
    },
    {
      Icon: PiggyBank,
      label: "Avans (oldindan to'lovlar)",
      value: formatUZS(avansTotal),
      iconCls: "bg-violet-50 text-violet-500",
      valueCls: "text-slate-900",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${c.iconCls}`}>
            <c.Icon size={17} />
          </div>
          <p className={`text-[15px] sm:text-[17px] font-bold tabular-nums leading-tight ${c.valueCls}`}>{c.value}</p>
          <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
