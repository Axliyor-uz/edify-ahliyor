// app/(student)/RASCHmodel/_components/RaschNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, Brain, Dumbbell, KeyRound, Rocket } from 'lucide-react';

import { cn } from '@/components/student-ui';
import type { Lang } from '@/types/Math';

/**
 * The one navigation bar for the whole Rasch suite.
 *
 * Every page used to roll its own row of links, and they disagreed on both
 * membership and order — progress offered Home / Analysis / New test, diagnosis
 * offered My level / Home / Practice, practice offered Analysis / Home. Landing
 * on a page and finding the control you just used has MOVED is the kind of thing
 * that reads as a broken app, so the bar is defined once here and the order is
 * fixed: Home → My level → Analysis → Practice → Code → Quick start.
 *
 * It is sticky, not static: these pages are long (a heptagon, thirty-four skill
 * rows, a question archive), and a nav that scrolls away means scrolling back to
 * the top to leave. `top-[var(--s-topbar-h)]` parks it directly under the shell's
 * own app bar, and z-20 keeps it below that bar (z-40) and below the shell's
 * desktop tab row (z-30) so it can never overlap either.
 */

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    home: 'Bosh sahifa',
    level: 'Darajam',
    analysis: 'Tahlil',
    practice: 'Mashq',
    quiz: 'Kod',
    exam: 'Tezkor test',
  },
  ru: {
    home: 'Главная',
    level: 'Мой уровень',
    analysis: 'Анализ',
    practice: 'Тренировка',
    quiz: 'Код',
    exam: 'Быстрый тест',
  },
  en: {
    home: 'Home',
    level: 'My level',
    analysis: 'Analysis',
    practice: 'Practice',
    quiz: 'Code',
    exam: 'Quick start',
  },
};

interface NavItem {
  href: string;
  key: keyof (typeof UI)['en'];
  icon: React.ElementType;
  /** The last item is the call to action and is filled, not outlined. */
  cta?: boolean;
}

const ITEMS: NavItem[] = [
  { href: '/RASCHmodel', key: 'home', icon: Home },
  { href: '/RASCHmodel/progress', key: 'level', icon: TrendingUp },
  { href: '/RASCHmodel/diagnosis', key: 'analysis', icon: Brain },
  { href: '/RASCHmodel/practice', key: 'practice', icon: Dumbbell },
  // The teacher-quiz entry point. It is a plain item, not the CTA: a student
  // arrives here holding a code somebody gave them, so it must be findable, but
  // the paper they can always start on their own stays the filled call to action.
  { href: '/RASCHmodel/quiz', key: 'quiz', icon: KeyRound },
  { href: '/RASCHmodel/exam', key: 'exam', icon: Rocket, cta: true },
];

export default function RaschNav({ lang, className }: { lang: Lang; className?: string }) {
  const pathname = usePathname();
  const t = UI[lang];

  return (
    <nav
      aria-label="Rasch"
      className={cn(
        'sticky top-[var(--s-topbar-h)] z-20 -mx-s-page-x mb-s-gap-lg px-s-page-x py-2',
        // Translucent via the prebuilt token: M3 colors are plain hex inside
        // var(), so `bg-surface/85` would render fully opaque.
        'bg-surface-blur backdrop-blur-md',
        'border-b border-outline-variant',
        className,
      )}
    >
      {/* Scrolls horizontally rather than wrapping: five items with labels do not
          fit a 360px phone, and a bar that grows to two rows shifts the whole
          page down as you navigate. */}
      <div className="s-no-scrollbar flex items-center gap-2 overflow-x-auto">
        {ITEMS.map(({ href, key, icon: Icon, cta }) => {
          // Exact match only — every route here is a sibling of /RASCHmodel, so
          // a startsWith test would light up "Home" on every page.
          const active = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-m3-btn px-3.5',
                'text-[13px] font-extrabold leading-none s-press',
                'transition-colors duration-m3-fast ease-m3-std',
                cta
                  ? 'ml-auto bg-primary text-on-primary'
                  : active
                    // The current page is a tonal chip, never an outline: the
                    // student should be able to tell where they are without
                    // reading the labels.
                    ? 'bg-primary-container text-on-primary-container'
                    : 'border-[1.5px] border-outline text-on-surface-variant hover:bg-state-hover',
              )}
            >
              <Icon size={14} strokeWidth={3} />
              <span>{t[key]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
