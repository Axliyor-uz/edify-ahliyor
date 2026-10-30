"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import EcosystemSVG from "./EcosystemSVG";

type Lang = "uz" | "en" | "ru";

const HERO: Record<Lang, { title: string; sub: string }> = {
  uz: { title: "Ta'limni yangi bosqichga olib chiqing", sub: "Edify — zamonaviy ta'lim platformasi. O'qituvchi va o'quvchilar uchun yagona raqamli muhit." },
  en: { title: "Elevate your learning experience", sub: "Edify — a modern education platform. A seamless digital environment for teachers and students." },
  ru: { title: "Поднимите обучение на новый уровень", sub: "Edify — современная образовательная платформа. Единая цифровая среда для учителей и учеников." },
};

/**
 * Shared frame of the login and signup pages: the blue illustration panel on
 * the left (desktop only) and a white column on the right with the logo, the
 * language toggle and the page's form centered below them.
 */
export default function AuthShell({ lang, setLang, children }: { lang: Lang; setLang: (l: Lang) => void; children: ReactNode }) {
  const hero = HERO[lang] || HERO.uz;

  return (
    <div className="min-h-screen flex font-['Inter',sans-serif]">
      {/* LEFT PANEL — 55% */}
      <div className="hidden lg:flex w-[55%] sticky top-0 h-screen bg-gradient-to-br from-[#0A2540] via-[#1E3A8A] to-[#1565C0] overflow-hidden items-center justify-center p-10">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[480px] h-[480px] bg-blue-500/[0.08] rounded-full blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[520px]"
        >
          <EcosystemSVG />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="absolute bottom-10 left-10 right-10 z-10"
        >
          <h2 className="text-white text-[26px] font-black leading-tight tracking-tight mb-2">{hero.title}</h2>
          <p className="text-blue-100/75 text-[14px] font-medium leading-relaxed max-w-md">{hero.sub}</p>
        </motion.div>

        <Link href="/" className="absolute top-8 left-9 z-10 flex items-center gap-2.5 opacity-90 hover:opacity-100 transition-opacity">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white border border-white/15">
            <BookOpen size={17} />
          </div>
          <span className="text-white font-extrabold text-[19px] tracking-tight">
            Edify<span className="text-blue-400">.</span>
          </span>
        </Link>
      </div>

      {/* RIGHT PANEL — 45% */}
      <div className="flex-1 flex flex-col bg-white px-6 sm:px-12">
        {/* In normal flow (not absolute) so a tall form can never slide under it */}
        <header className="flex items-center justify-between lg:justify-end py-6">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 bg-[#1565C0] rounded-lg flex items-center justify-center text-white">
              <BookOpen size={16} />
            </div>
            <span className="font-extrabold text-[18px] text-[#1C1B1F] tracking-tight">
              Edify<span className="text-[#1565C0]">.</span>
            </span>
          </Link>

          <div className="flex items-center bg-[#F1F5F9] p-1 rounded-full border border-[#E2E8F0]">
            {(["uz", "en", "ru"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`px-3 py-1 text-[11px] font-black tracking-wider rounded-full transition-all uppercase ${
                  lang === code ? "bg-[#1565C0] text-white shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </header>

        {/* Top-aligned on phones (no big gap above the heading), centered on desktop */}
        <main className="flex-1 flex items-start lg:items-center justify-center pt-6 sm:pt-12 lg:pt-0 pb-16 lg:pb-24">{children}</main>
      </div>
    </div>
  );
}
