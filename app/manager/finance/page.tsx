"use client";

import { Wallet, Sparkles, CreditCard, TrendingUp, ReceiptText } from "lucide-react";

// Placeholder until the finance module is built — kills the dead nav link and
// signals what's coming. Replace with the real payments UI when ready.
const PLANNED = [
  { Icon: CreditCard, title: "To'lovlar", desc: "O'quvchilar oylik to'lovlarini qabul qilish va kuzatish" },
  { Icon: ReceiptText, title: "Hisob-fakturalar", desc: "Avtomatik hisob-kitob va qarzdorliklar ro'yxati" },
  { Icon: TrendingUp, title: "Moliyaviy hisobotlar", desc: "Daromad, xarajat va markaz bo'yicha tahlillar" },
];

export default function ManagerFinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Moliya</h1>
        <p className="text-sm text-slate-500 mt-0.5">To&apos;lovlar va moliyaviy boshqaruv</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-10 sm:p-14 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4">
          <Wallet size={30} />
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[12px] font-bold mb-3">
          <Sparkles size={13} /> Tez orada
        </span>
        <h2 className="text-[17px] font-bold text-slate-900">Moliya moduli ishlab chiqilmoqda</h2>
        <p className="text-sm text-slate-500 mt-1.5 max-w-[380px]">
          Bu bo&apos;limda o&apos;quvchilar to&apos;lovlari, hisob-fakturalar va moliyaviy hisobotlarni boshqarasiz.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 w-full max-w-2xl">
          {PLANNED.map((p) => (
            <div key={p.title} className="text-left bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 mb-2.5">
                <p.Icon size={17} />
              </div>
              <p className="text-[13.5px] font-bold text-slate-800">{p.title}</p>
              <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
