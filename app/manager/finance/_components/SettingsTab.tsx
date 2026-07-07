"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Save } from "lucide-react";
import type { BillingAnchor, FinanceSettings, PercentBase } from "@/types/finance";
import { saveFinanceSettingsApi } from "@/services/financeService";
import type { ClassData } from "@/hooks/useCenterClasses";
import GroupPricesSection from "./GroupPricesSection";

interface Props {
  settings: FinanceSettings;
  onSaved: (s: FinanceSettings) => void;
  classes: ClassData[];
  /** Refetch classes + finance data after group prices change. */
  onClassesChanged: () => void;
}

const ANCHOR_OPTIONS: { value: BillingAnchor; title: string; desc: string }[] = [
  {
    value: "calendar",
    title: "Kalendar oy",
    desc: "Hamma bir xil: iyul uchun, avgust uchun... Eng oddiy va keng tarqalgan usul.",
  },
  {
    value: "enrollment",
    title: "Qo'shilgan sanadan",
    desc: "Har kim o'z sanasida: 15-sanada qo'shilgan o'quvchi har oyning 15-sanasida to'laydi.",
  },
];

const PERCENT_BASE_OPTIONS: { value: PercentBase; title: string; desc: string }[] = [
  {
    value: "collected",
    title: "Yig'ilgan puldan",
    desc: "Foiz REAL kelib tushgan puldan hisoblanadi. Xavfsiz — yo'q puldan oylik to'lanmaydi.",
  },
  {
    value: "charged",
    title: "Hisoblangan puldan",
    desc: "Foiz o'quvchilar to'lashi KERAK bo'lgan summadan — hali to'lanmagan bo'lsa ham.",
  },
];

function Section({
  n,
  title,
  desc,
  children,
}: {
  n: number;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-brand-line rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">
          {n}
        </div>
        <div>
          <p className="text-[15px] font-bold text-slate-900">{title}</p>
          <p className="text-[12.5px] text-slate-500 mt-0.5 leading-snug">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Three plain-language sections: group prices (the daily need, so it's first),
 * billing cycle, teacher %. Only the fields that apply to the chosen mode are shown.
 */
export default function SettingsTab({ settings, onSaved, classes, onClassesChanged }: Props) {
  const [anchor, setAnchor] = useState<BillingAnchor>(settings.billingAnchor);
  const [percentBase, setPercentBase] = useState<PercentBase>(settings.percentBase);
  const [prorate, setProrate] = useState(settings.prorateFirstMonth);
  const [dueDay, setDueDay] = useState(String(settings.dueDayOfMonth));
  const [dueDays, setDueDays] = useState(String(settings.dueDaysAfterStart));
  const [saving, setSaving] = useState(false);

  const dirty =
    anchor !== settings.billingAnchor ||
    percentBase !== settings.percentBase ||
    prorate !== settings.prorateFirstMonth ||
    dueDay !== String(settings.dueDayOfMonth) ||
    dueDays !== String(settings.dueDaysAfterStart);

  const save = async () => {
    const dueDayNum = parseInt(dueDay, 10);
    const dueDaysNum = parseInt(dueDays, 10);
    if (!Number.isInteger(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
      toast.error("To'lov kuni 1–31 oralig'ida bo'lishi kerak.");
      return;
    }
    if (!Number.isInteger(dueDaysNum) || dueDaysNum < 0 || dueDaysNum > 30) {
      toast.error("Muddat 0–30 kun oralig'ida bo'lishi kerak.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveFinanceSettingsApi({
        billingAnchor: anchor,
        percentBase,
        prorateFirstMonth: prorate,
        dueDayOfMonth: dueDayNum,
        dueDaysAfterStart: dueDaysNum,
      });
      toast.success("Sozlamalar saqlandi.");
      onSaved(saved);
    } catch (e: any) {
      toast.error(e.message || "Saqlashda xatolik.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Section
        n={1}
        title="Guruh narxlari"
        desc="Har bir guruhning oylik narxi. Hisob-kitob shu narxlar asosida yaratiladi."
      >
        <GroupPricesSection classes={classes} onSaved={onClassesChanged} />
      </Section>

      <Section
        n={2}
        title="To'lov davri"
        desc="O'quvchilar qaysi tartibda to'laydi — bittasini tanlang."
      >
        <div className="grid sm:grid-cols-2 gap-2.5">
          {ANCHOR_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setAnchor(o.value)}
              className={`text-left p-4 rounded-2xl border-2 transition-colors ${
                anchor === o.value ? "border-brand-600 bg-brand-50" : "border-brand-line hover:border-brand-200"
              }`}
            >
              <p className="text-[13.5px] font-bold text-slate-800">{o.title}</p>
              <p className="text-[12px] text-slate-500 mt-1 leading-snug">{o.desc}</p>
            </button>
          ))}
        </div>

        {anchor === "calendar" ? (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <p className="text-[13px] font-bold text-slate-700">To&apos;lov oyning nechanchi kunigacha?</p>
            <input
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              className="w-20 px-3 py-2.5 border border-brand-line rounded-xl text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <p className="text-[12px] text-slate-400">Masalan 5 — har oyning 5-sanasigacha. Kechiksa qarzdorlar ro&apos;yxatida ko&apos;rinadi.</p>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <p className="text-[13px] font-bold text-slate-700">Davr boshlangach necha kun ichida to&apos;lanadi?</p>
            <input
              type="number"
              min={0}
              max={30}
              value={dueDays}
              onChange={(e) => setDueDays(e.target.value)}
              className="w-20 px-3 py-2.5 border border-brand-line rounded-xl text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <p className="text-[12px] text-slate-400">Masalan 5 — davr boshidan 5 kun ichida.</p>
          </div>
        )}

        <label className="mt-4 flex items-center justify-between gap-3 cursor-pointer bg-brand-25 border border-brand-line rounded-2xl p-4">
          <div>
            <p className="text-[13.5px] font-bold text-slate-800">Birinchi oy qisman hisoblansin</p>
            <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
              Masalan: guruh 400 000 so&apos;m, o&apos;quvchi oy o&apos;rtasida qo&apos;shildi → birinchi oy ≈ 200 000 so&apos;m.
            </p>
          </div>
          <input
            type="checkbox"
            checked={prorate}
            onChange={(e) => setProrate(e.target.checked)}
            className="w-5 h-5 accent-brand-600 shrink-0"
          />
        </label>
      </Section>

      <Section
        n={3}
        title="O'qituvchi foizi"
        desc="Bu faqat «Oyliklar» bo'limiga ta'sir qiladi — foizli oylik qaysi puldan hisoblanadi."
      >
        <div className="grid sm:grid-cols-2 gap-2.5">
          {PERCENT_BASE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setPercentBase(o.value)}
              className={`text-left p-4 rounded-2xl border-2 transition-colors ${
                percentBase === o.value ? "border-brand-600 bg-brand-50" : "border-brand-line hover:border-brand-200"
              }`}
            >
              <p className="text-[13.5px] font-bold text-slate-800">{o.title}</p>
              <p className="text-[12px] text-slate-500 mt-1 leading-snug">{o.desc}</p>
            </button>
          ))}
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-40 flex items-center gap-2"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Sozlamalarni saqlash
        </button>
        {dirty && <p className="text-[12px] text-amber-600 font-semibold">Saqlanmagan o&apos;zgarishlar bor</p>}
      </div>
      <p className="text-[11.5px] text-slate-400">
        Sozlama o&apos;zgarishi faqat KEYINGI hisob-kitoblarga ta&apos;sir qiladi — yaratilgan hisoblar o&apos;zgarmaydi.
      </p>
    </div>
  );
}
