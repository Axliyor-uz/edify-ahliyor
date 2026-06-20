'use client';

import { useTeacherLanguage } from '../layout';
import { motion } from 'framer-motion';
import { Headphones, BookOpen, PenTool, Mic, ArrowRight, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';

const PAGE_TRANSLATIONS = {
  uz: {
    title: "IELTS Moduli",
    subtitle: "O'quvchilarning IELTS ko'nikmalarini AI yordamida tekshiring va boshqaring.",
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
    subtitle: "Manage and evaluate your students' IELTS skills using AI.",
    modules: {
      listening: { title: "Listening", desc: "Audio tests and automatic grading." },
      reading: { title: "Reading", desc: "Passages, true/false/not given, and analytics." },
      writing: { title: "Writing", desc: "AI-powered essay grading (Task 1 & 2)." },
      speaking: { title: "Speaking", desc: "Evaluate voice recordings using AI." },
    },
    action: "Manage",
    aiPowered: "AI Powered",
    groupTeaser: "Manage Groups"
  },
  ru: {
    title: "Модуль IELTS",
    subtitle: "Управляйте и оценивайте навыки IELTS ваших учеников с помощью ИИ.",
    modules: {
      listening: { title: "Аудирование", desc: "Аудиотесты и автоматическая проверка." },
      reading: { title: "Чтение", desc: "Тексты и аналитика." },
      writing: { title: "Письмо", desc: "Проверка эссе с помощью ИИ (Task 1 & 2)." },
      speaking: { title: "Говорение", desc: "Оценка голосовых записей с помощью ИИ." },
    },
    action: "Управлять",
    aiPowered: "На базе ИИ",
    groupTeaser: "Управление Группами"
  }
};

const IELTS_CARDS = [
  { id: 'listening', icon: Headphones, color: 'text-blue-500', bg: 'bg-blue-50', isAI: false, href: '/teacher/ielts/listening' },
  { id: 'reading', icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-50', isAI: false, href: '/teacher/ielts/reading' },
  { id: 'writing', icon: PenTool, color: 'text-indigo-500', bg: 'bg-indigo-50', isAI: true, href: '/teacher/ielts/writing' },
  { id: 'speaking', icon: Mic, color: 'text-violet-500', bg: 'bg-violet-50', isAI: true, href: '/teacher/ielts/speaking' },
];

export default function IELTSDashboard() {
  const { lang } = useTeacherLanguage();
  const t = PAGE_TRANSLATIONS[lang] || PAGE_TRANSLATIONS['uz'];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{t.title}</h1>
          <p className="text-[14px] md:text-[15px] font-medium text-slate-500 mt-2">{t.subtitle}</p>
        </div>
        
        {/* Placeholder for Group Management Button */}
        <Link href="/teacher/classes" className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-slate-800 transition-all active:scale-95">
          <Users size={16} /> {t.groupTeaser}
        </Link>
      </div>

      {/* Grid for 4 Parts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {IELTS_CARDS.map((card, index) => {
          const moduleText = t.modules[card.id as keyof typeof t.modules];
          
          return (
            <motion.div 
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={card.href} className="group flex flex-col justify-between p-6 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all h-full min-h-[160px]">
                
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.bg} ${card.color}`}>
                    <card.icon size={24} strokeWidth={2.5} />
                  </div>
                  {card.isAI && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-md">
                      <Sparkles size={12} className="text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{t.aiPowered}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-[18px] font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                    {moduleText.title}
                  </h3>
                  <p className="text-[13px] font-medium text-slate-500 leading-relaxed mb-4">
                    {moduleText.desc}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[13px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors mt-auto">
                  {t.action} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}