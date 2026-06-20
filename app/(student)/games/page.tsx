'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Gamepad2, ChevronRight, Crown, Sparkles, Brain } from 'lucide-react';
import { useStudentLanguage } from '../layout'; // Assuming your context is exported from the layout

// --- TRANSLATIONS ---
const PAGE_TRANSLATIONS = {
  uz: {
    title: "O'yinlar",
    subtitle: "Aql-idrokingizni va mantiqiy fikrlashni charxlang",
    games: {
      checkers: {
        title: "Shashka",
        desc: "Klassik mantiqiy stol o'yini. Kompyuterga qarshi yoki do'stingiz bilan o'ynang.",
        play: "O'ynash"
      }
    }
  },
  en: {
    title: "Games",
    subtitle: "Sharpen your mind and logical thinking",
    games: {
      checkers: {
        title: "Checkers",
        desc: "The classic strategic board game. Play against the computer or a friend.",
        play: "Play Now"
      }
    }
  },
  ru: {
    title: "Игры",
    subtitle: "Тренируйте свой ум и логическое мышление",
    games: {
      checkers: {
        title: "Шашки",
        desc: "Классическая стратегическая настольная игра. Играйте против компьютера или друга.",
        play: "Играть"
      }
    }
  }
};

type LangType = 'uz' | 'en' | 'ru';

export default function GamesPage() {
  const { lang } = useStudentLanguage();
  const currentLang = (lang as LangType) || 'en';
  const t = PAGE_TRANSLATIONS[currentLang];

  return (
    <div className="min-h-screen bg-zinc-100 p-4 md:p-8">
      <div className="max-w-[1200px] mx-auto">
        
        {/* Header Section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center text-violet-600 border-2 border-violet-200">
              <Gamepad2 size={24} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight">
              {t.title}
            </h1>
          </div>
          <p className="text-zinc-500 font-medium text-[15px] flex items-center gap-2">
            <Brain size={16} />
            {t.subtitle}
          </p>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Checkers Card */}
          <Link href="/games/checkers">
            <motion.div 
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-[2rem] p-6 border-2 border-zinc-200 shadow-sm hover:border-violet-300 hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden"
            >
              {/* Background Decoration */}
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-violet-50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl flex items-center justify-center text-white shadow-md border-b-4 border-violet-700">
                  <Crown size={28} strokeWidth={2.5} />
                </div>
                <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">
                  <Sparkles size={12} />
                  Top
                </div>
              </div>

              <div className="relative z-10 flex-1">
                <h3 className="text-xl font-black text-zinc-900 mb-2">
                  {t.games.checkers.title}
                </h3>
                <p className="text-zinc-500 text-sm font-medium leading-relaxed mb-6">
                  {t.games.checkers.desc}
                </p>
              </div>

              <div className="relative z-10 flex items-center justify-between mt-auto pt-4 border-t-2 border-zinc-100">
                <span className="text-violet-600 font-bold text-[15px] group-hover:text-violet-700">
                  {t.games.checkers.play}
                </span>
                <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 group-hover:bg-violet-100 group-hover:text-violet-600 transition-colors">
                  <ChevronRight size={18} strokeWidth={3} />
                </div>
              </div>
            </motion.div>
          </Link>

          {/* You can add more game cards here in the future (e.g., Chess, Sudoku, Math Games) */}

        </div>
      </div>
    </div>
  );
}