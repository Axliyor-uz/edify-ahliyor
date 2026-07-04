'use client';

import { useTeacherLanguage } from '../layout';
import { motion } from 'framer-motion';
import { Headphones, BookOpen, PenTool, Mic, ArrowRight, Sparkles, Users, Target } from 'lucide-react';
import Link from 'next/link';

const PAGE_TRANSLATIONS: Record<string, any> = {
  uz: {
    title: "IELTS Moduli",
    subtitle: "O'quvchilarning IELTS ko'nikmalarini AI yordamida tekshiring",
    modules: {
      listening: { title: "Listening", desc: "Audio testlar va avtomatik tekshirish." },
      reading: { title: "Reading", desc: "Matnli testlar va tahlillar." },
      writing: { title: "Writing", desc: "Insholarni AI orqali tekshirish (Task 1 & 2)." },
      speaking: { title: "Speaking", desc: "Ovozli yozuvlarni AI orqali baholash." },
    },
    action: "Boshqarish",
    aiPowered: "AI yordamida",
    groupTeaser: "Guruhlarni Boshqarish"
  },
  en: {
    title: "IELTS Module",
    subtitle: "Manage and evaluate IELTS skills using AI",
    modules: {
      listening: { title: "Listening", desc: "Audio tests and automatic grading." },
      reading: { title: "Reading", desc: "Passages, true/false/not given, analytics." },
      writing: { title: "Writing", desc: "AI-powered essay grading (Task 1 & 2)." },
      speaking: { title: "Speaking", desc: "Evaluate voice recordings using AI." },
    },
    action: "Manage",
    aiPowered: "AI Powered",
    groupTeaser: "Manage Groups"
  },
  ru: {
    title: "Модуль IELTS",
    subtitle: "Оценивайте навыки IELTS с помощью ИИ",
    modules: {
      listening: { title: "Аудирование", desc: "Аудиотесты и автопроверка." },
      reading: { title: "Чтение", desc: "Тексты и аналитика." },
      writing: { title: "Письмо", desc: "Проверка эссе с помощью ИИ (Task 1 & 2)." },
      speaking: { title: "Говорение", desc: "Оценка голосовых записей с ИИ." },
    },
    action: "Управлять",
    aiPowered: "На базе ИИ",
    groupTeaser: "Управление Группами"
  }
};

const IELTS_CARDS = [
  { id: 'listening', icon: Headphones, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100', isAI: false, href: '/teacher/ielts/listening' },
  { id: 'reading', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', isAI: false, href: '/teacher/ielts/reading' },
  { id: 'writing', icon: PenTool, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', isAI: true, href: '/teacher/ielts/writing' },
  { id: 'speaking', icon: Mic, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', isAI: true, href: '/teacher/ielts/speaking' },
];

export default function IELTSDashboard() {
  const { lang } = useTeacherLanguage();
  const t = PAGE_TRANSLATIONS[lang] || PAGE_TRANSLATIONS['uz'];

  return (
    <div className="min-h-[100dvh] bg-[#F5F5F7] font-sans pb-28">
      
      {/* ── Premium top bar ── */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Title row */}
          <div className="flex items-end justify-between gap-4 py-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-md">
                <Target size={22} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-[22px] md:text-[26px] font-black text-slate-900 tracking-tight leading-tight">
                  {t.title}
                </h1>
                <p className="text-[13px] font-medium text-slate-500 hidden sm:block">{t.subtitle}</p>
              </div>
            </div>
            
            <Link 
              href="/teacher/ielts/groups" 
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-black text-[13px] transition-all active:scale-95 shadow-sm shrink-0"
            >
              <Users size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">{t.groupTeaser}</span>
              <span className="sm:hidden">Groups</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {IELTS_CARDS.map((card, index) => {
            const moduleText = t.modules[card.id as keyof typeof t.modules];
            
            return (
              <motion.div 
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
              >
                <Link 
                  href={card.href} 
                  className="group flex flex-col bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition-all duration-200 overflow-hidden h-full p-5"
                >
                  <div className="flex justify-between items-start mb-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${card.bg} ${card.border} ${card.color}`}>
                      <card.icon size={22} strokeWidth={2.5} />
                    </div>
                    {card.isAI && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100/50 rounded-lg">
                        <Sparkles size={11} className="text-indigo-500" strokeWidth={2.5} />
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{t.aiPowered}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="text-[17px] font-black text-slate-900 mb-1.5 group-hover:text-slate-700 transition-colors tracking-tight">
                      {moduleText.title}
                    </h3>
                    <p className="text-[13px] font-medium text-slate-500 leading-relaxed">
                      {moduleText.desc}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                     <span className="text-[12px] font-bold text-slate-400">{t.action}</span>
                     <div className={`w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center ${card.color} group-hover:bg-slate-100 transition-colors`}>
                       <ArrowRight size={14} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                     </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}