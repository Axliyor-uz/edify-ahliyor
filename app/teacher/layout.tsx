'use client';

import { useEffect, useState, useRef, createContext, useContext } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'firebase/auth';

import '@/components/ui/theme.css';
import { Button, ConfirmDialog, ProgressBar, cn } from '@/components/ui';

import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile } from '@/services/userService';
import { useMonthlyLimit } from '@/hooks/useMonthlyLimit';
import NotificationBell from '@/components/NotificationBell';

import {
  LayoutDashboard, Users, FilePlus, FolderOpen, Library,
  Sparkles, Settings, LogOut, Menu, X, Bell,
  Zap, BookOpen, UserIcon, CreditCard, PanelLeft, MoreVertical,
} from 'lucide-react';

// ============================================================================
// 1. CONTEXT & TYPES
// ============================================================================
export type LangType = 'uz' | 'en' | 'ru';

interface TeacherLangContextType {
  lang: LangType;
  setLang: (lang: LangType) => void;
}

export const TeacherLanguageContext = createContext<TeacherLangContextType | undefined>(undefined);

export function useTeacherLanguage() {
  const context = useContext(TeacherLanguageContext);
  if (!context) throw new Error("useTeacherLanguage must be used within TeacherLayout");
  return context;
}

// ============================================================================
// 2. TRANSLATION DICTIONARY
// ============================================================================
const LAYOUT_TRANSLATIONS = {
  uz: {
    brandSubtitle: "O'QITUVCHI PORTALI",
    menu: { overview: "Boshqaruv", library: "Mening kutubxonam", classes: "Sinflar", onlineLibrary: "Onlayn Kitoblar", analytics: "Tahlillar", notifications: "Bildirishnomalar", subscription: "Obuna", profile: "Profil", ielts: "IELTS Moduli" },
    menuShort: { library: "Kutubxonam", onlineLibrary: "Kitoblar", notifications: "Xabarlar" },
    bottom: { home: "Boshqaruv", create: "Yaratish", classes: "Sinflar", library: "Kutubxona", menu: "Menyu" },
    create: "Yangi Test", signOut: "Chiqish", settings: "Sozlamalar",
    aiLimit: { title: "Oylik AI Balans", upgrade: "Kredit Olish", used: "ishlatildi", unlimited: "Cheksiz", renews: "Yangilanadi" },
    logoutConfirm: { title: "Tizimdan chiqish", desc: "Haqiqatan ham hisobingizdan chiqmoqchimisiz?", cancel: "Bekor qilish", confirm: "Chiqish" }
  },
  en: {
    brandSubtitle: "INSTRUCTOR PORTAL",
    menu: { overview: "Dashboard", library: "Library", classes: "Classes", onlineLibrary: "Online Books", analytics: "Analytics", notifications: "Notifications", subscription: "Subscription", profile: "Profile", ielts: "IELTS Module" },
    menuShort: { library: "Library", onlineLibrary: "Books", notifications: "Alerts" },
    bottom: { home: "Home", create: "Create", classes: "Classes", library: "Library", menu: "Menu" },
    create: "New Test", signOut: "Sign Out", settings: "Settings",
    aiLimit: { title: "Monthly AI Balance", upgrade: "Buy Credits", used: "used", unlimited: "Unlimited", renews: "Renews" },
    logoutConfirm: { title: "Sign Out", desc: "Are you sure you want to sign out of your account?", cancel: "Cancel", confirm: "Sign Out" }
  },
  ru: {
    brandSubtitle: "ПОРТАЛ УЧИТЕЛЯ",
    menu: { overview: "Обзор", library: "Библиотека", classes: "Классы", onlineLibrary: "Онлайн Книги", analytics: "Аналитика", notifications: "Уведомления", subscription: "Подписка", profile: "Профиль", ielts: "Модуль IELTS" },
    menuShort: { library: "Библиотека", onlineLibrary: "Книги", notifications: "Инбокс" },
    bottom: { home: "Обзор", create: "Создать", classes: "Классы", library: "Книги", menu: "Меню" },
    create: "Новый Тест", signOut: "Выйти", settings: "Настройки",
    aiLimit: { title: "Месячный баланс ИИ", upgrade: "Купить кредиты", used: "использовано", unlimited: "Безлимит", renews: "Обновится" },
    logoutConfirm: { title: "Выход", desc: "Вы уверены, что хотите выйти из аккаунта?", cancel: "Отмена", confirm: "Выйти" }
  }
};

const LANGUAGE_OPTIONS: { code: LangType; label: string }[] = [
  { code: 'uz', label: "O'zbek" },
  { code: 'en', label: "English" },
  { code: 'ru', label: "Русский" },
];

// Deep routes with their own bottom action bars — the mobile nav bar hides there.
const HIDE_BOTTOM_BAR = [
  /^\/teacher\/create\/.+/,
  /^\/teacher\/classes\/.+/,
  /^\/teacher\/print/,
  /^\/teacher\/ielts\/reading\/(manual|view)/,
];

// Shared popover panel styling (M3 menu surface)
const PANEL = "bg-surface-container rounded-m3-lg shadow-elev-3 border border-outline-variant z-[60]";

// ============================================================================
// 3. SVG FLAGS (emoji flags render inconsistently across devices)
// ============================================================================
function FlagSvg({ code }: { code: LangType }) {
  if (code === 'uz') return (
    <svg viewBox="0 0 20 14" className="w-5 h-3.5 rounded-[3px] shrink-0" aria-hidden>
      <rect width="20" height="14" fill="#0099B5" /><rect y="4.9" width="20" height="4.2" fill="#fff" />
      <rect y="4.55" width="20" height="0.5" fill="#CE1126" /><rect y="8.95" width="20" height="0.5" fill="#CE1126" />
      <rect y="9.45" width="20" height="4.55" fill="#1EB53A" />
      <circle cx="3.4" cy="2.5" r="1.5" fill="#fff" /><circle cx="4" cy="2.3" r="1.35" fill="#0099B5" />
    </svg>
  );
  if (code === 'ru') return (
    <svg viewBox="0 0 20 14" className="w-5 h-3.5 rounded-[3px] shrink-0" aria-hidden>
      <rect width="20" height="4.67" fill="#fff" /><rect y="4.67" width="20" height="4.67" fill="#0039A6" /><rect y="9.33" width="20" height="4.67" fill="#D52B1E" />
    </svg>
  );
  return (
    <svg viewBox="0 0 20 14" className="w-5 h-3.5 rounded-[3px] shrink-0" aria-hidden>
      <rect width="20" height="14" fill="#012169" />
      <path d="M0 0l20 14M20 0L0 14" stroke="#fff" strokeWidth="2.6" />
      <path d="M0 0l20 14M20 0L0 14" stroke="#C8102E" strokeWidth="1.1" />
      <path d="M10 0v14M0 7h20" stroke="#fff" strokeWidth="4.4" />
      <path d="M10 0v14M0 7h20" stroke="#C8102E" strokeWidth="2.4" />
    </svg>
  );
}

// ============================================================================
// 4. MAIN LAYOUT COMPONENT
// ============================================================================
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth() as any;
  const router = useRouter();
  const pathname = usePathname();
  const aiData = useMonthlyLimit();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);

  const [lang, setLang] = useState<LangType>('uz');
  const t = LAYOUT_TRANSLATIONS[lang as keyof typeof LAYOUT_TRANSLATIONS] || LAYOUT_TRANSLATIONS['uz'];

  const headerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const showBottomBar = !HIDE_BOTTOM_BAR.some((r) => r.test(pathname));

  // Restore persisted rail state
  useEffect(() => {
    try { setIsCollapsed(localStorage.getItem('edify-sb-rail') === '1'); } catch { /* private mode */ }
  }, []);
  const toggleCollapsed = () => setIsCollapsed((v) => {
    try { localStorage.setItem('edify-sb-rail', v ? '0' : '1'); } catch { /* private mode */ }
    return !v;
  });

  // Keyboard shortcut: [ toggles the rail
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[') return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement as HTMLElement)?.isContentEditable) return;
      toggleCollapsed();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Click outside listener for popovers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isOutsideHeader = headerRef.current && !headerRef.current.contains(event.target as Node);
      const isOutsideSidebar = sidebarRef.current && !sidebarRef.current.contains(event.target as Node);
      if (isOutsideHeader && isOutsideSidebar) {
        setIsProfileMenuOpen(false);
        setIsAiMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auth & Role Check
  useEffect(() => {
    async function checkRole() {
      if (!loading) {
        if (!user) router.push('/auth/login');
        else {
          const profile = await getUserProfile(user.uid);
          if (profile?.role === 'manager') router.push('/manager/dashboard');
          else if (profile?.role !== 'teacher') router.push('/dashboard');
          else setIsAuthorized(true);
        }
      }
    }
    checkRole();
  }, [user, loading, router]);

  useEffect(() => { setMobileMenuOpen(false); setIsProfileMenuOpen(false); setIsAiMenuOpen(false); }, [pathname]);

  // Handle tour step changes for mobile sidebar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleTourStepChange = (e: any) => {
      const stepId = e.detail;
      if (window.innerWidth < 768) {
        if (stepId && stepId.startsWith('tour-sidebar-')) setMobileMenuOpen(true);
        else setMobileMenuOpen(false);
      }
    };
    window.addEventListener('tour-step-change', handleTourStepChange);
    return () => window.removeEventListener('tour-step-change', handleTourStepChange);
  }, []);

  if (loading || !isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface">
        <div className="w-12 h-12 bg-surface-container-low rounded-m3-lg shadow-elev-1 flex items-center justify-center">
          <BookOpen size={24} className="text-primary animate-pulse" />
        </div>
      </div>
    );
  }

  const navItems: { name: string; href: string; icon: typeof LayoutDashboard; isAI?: boolean; tourId?: string; short?: string }[] = [
    { name: t.menu.overview, href: '/teacher/dashboard', icon: LayoutDashboard },
    { name: t.create, href: '/teacher/create', icon: FilePlus, isAI: true },
    { name: t.menu.classes, href: '/teacher/classes', icon: Users, tourId: 'tour-sidebar-classes' },
    // { name: t.menu.ielts, href: '/teacher/ielts', icon: Globe, isAI: true }, // deliberately hidden — see docs/TEACHER.md
    { name: t.menu.library, href: '/teacher/library', icon: FolderOpen, short: t.menuShort.library },
    { name: t.menu.onlineLibrary, href: '/teacher/online-books', icon: Library, tourId: 'tour-sidebar-online-books', short: t.menuShort.onlineLibrary },
    { name: t.menu.analytics, href: '/teacher/analytics', icon: Sparkles, isAI: true },
    { name: t.menu.notifications, href: '/teacher/notifications', icon: Bell, short: t.menuShort.notifications },
    // { name: t.menu.subscription, href: '/teacher/subscription', icon: CreditCard }, // deliberately hidden — reachable via AI-balance widget
    { name: t.settings, href: '/teacher/settings', icon: Settings },
  ];

  const isActive = (href: string) => pathname === href || (href !== '/teacher/dashboard' && pathname.startsWith(href));

  // --- AI balance panel body (shared: desktop popover + mobile popover) ---
  const aiPanelBody = (
    <>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-bold text-on-surface text-[14px] flex items-center gap-1.5"><Zap size={14} className="text-warning fill-warning" /> {t.aiLimit.title}</h4>
          <p className="text-[10px] text-on-surface-variant font-medium mt-1">{t.aiLimit.renews}: {aiData.resetDate}</p>
        </div>
        <span className={cn("text-xl font-bold leading-none tracking-tight tabular-nums", aiData.isDanger ? "text-error" : "text-on-surface")}>
          {aiData.isUnlimited ? '∞' : aiData.remaining}
        </span>
      </div>
      {!aiData.isUnlimited && (
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-[10px] font-semibold text-on-surface-variant"><span>{t.aiLimit.used}</span> <span className="text-on-surface tabular-nums">{aiData.used} / {aiData.limit}</span></div>
          <ProgressBar value={aiData.usagePercentage} tone={aiData.isDanger ? 'error' : 'primary'} />
        </div>
      )}
      <Button size="sm" icon={<CreditCard />} className="w-full" onClick={() => { setIsAiMenuOpen(false); setMobileMenuOpen(false); router.push('/teacher/subscription'); }}>
        {t.aiLimit.upgrade}
      </Button>
    </>
  );

  // --- Profile popover body (shared: sidebar + mobile top bar) ---
  const profilePanelBody = (
    <>
      <div className="px-3 py-3 bg-surface-container-high rounded-m3-md mb-2">
        <p className="text-[13px] font-semibold text-on-surface truncate">{user?.displayName}</p>
        <p className="text-[10px] font-medium text-on-surface-variant truncate">{user?.email}</p>
      </div>
      {/* SVG-flag language switcher */}
      <div className="flex items-center bg-surface-container-high p-1 rounded-m3-sm gap-1 mb-2" role="group" aria-label="Til">
        {LANGUAGE_OPTIONS.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            aria-pressed={lang === l.code}
            title={l.label}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-m3-xs text-[11px] font-bold uppercase transition-all",
              lang === l.code ? "bg-surface-container-lowest text-primary shadow-elev-1" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <FlagSvg code={l.code} />
            {l.code}
          </button>
        ))}
      </div>
      <Link href="/teacher/profile" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-m3-sm text-[13px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-state-hover transition-colors"><UserIcon size={16} /> {t.menu.profile}</Link>
      <Link href="/teacher/settings" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-m3-sm text-[13px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-state-hover transition-colors"><Settings size={16} /> {t.settings}</Link>
      <div className="h-px bg-outline-variant my-1.5 mx-2"></div>
      <button onClick={() => { setIsProfileMenuOpen(false); setShowLogoutModal(true); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-m3-sm text-[13px] font-medium text-error hover:bg-error-container transition-colors"><LogOut size={16} /> {t.logoutConfirm.title}</button>
    </>
  );

  // --- SIDEBAR (desktop rail/drawer + mobile slide-out drawer) ---
  const renderSidebarContent = (collapsed: boolean, isMobile: boolean = false) => (
    <div className="flex flex-col h-full bg-surface-container-lowest relative">

      {/* Header: brand + rail toggle */}
      <div className={cn("flex items-center gap-2.5 px-3.5 pt-4 pb-2 shrink-0 min-h-[64px]", collapsed && "flex-col gap-2 px-0 justify-center")}>
        <div className="flex items-center gap-2.5 overflow-hidden cursor-pointer min-w-0" onClick={() => router.push('/teacher/dashboard')}>
          <div className="w-9 h-9 bg-primary rounded-m3-md flex items-center justify-center text-on-primary shrink-0 shadow-elev-1"><BookOpen size={19} /></div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-[15px] text-on-surface leading-none tracking-tight truncate">Edify<span className="text-primary">Teacher</span></h1>
              <p className="text-[8.5px] text-on-surface-variant font-semibold uppercase tracking-[0.14em] mt-1 truncate">{t.brandSubtitle}</p>
            </div>
          )}
        </div>
        {isMobile ? (
          <button onClick={() => setMobileMenuOpen(false)} aria-label="Yopish" className="m3-interactive ml-auto p-2 text-on-surface-variant rounded-full">
            <X size={19} />
          </button>
        ) : (
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Yoyish  [" : "Yig'ish  ["}
            aria-label={collapsed ? "Yoyish" : "Yig'ish"}
            className={cn("m3-interactive p-2 text-on-surface-variant rounded-full", !collapsed && "ml-auto")}
          >
            <PanelLeft size={18} className={cn("transition-transform duration-300", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tourId}
              title={collapsed ? item.name : undefined}
              onClick={() => isMobile && setMobileMenuOpen(false)}
              className={cn(
                "group relative flex items-center transition-colors",
                collapsed
                  ? "flex-col justify-center gap-[3px] h-[56px] rounded-m3-md px-1"
                  : "gap-3 h-[46px] rounded-full px-3.5",
                active ? "text-on-secondary-container" : "text-on-surface-variant hover:text-on-surface",
                !active && !collapsed && "hover:bg-state-hover",
              )}
            >
              {/* Animated active pill */}
              {active && (
                <motion.span
                  layoutId={isMobile ? 'sb-pill-m' : 'sb-pill'}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  // centered with inset-x + mx-auto: framer's layout animation owns
                  // `transform`, so translate-based centering breaks the pill position
                  className={cn(
                    "absolute bg-secondary-container",
                    collapsed ? "top-1.5 inset-x-0 mx-auto w-[52px] h-[30px] rounded-full" : "inset-0 rounded-full",
                  )}
                />
              )}
              <item.icon size={collapsed ? 20 : 19} strokeWidth={active ? 2.4 : 2} className={cn("shrink-0 relative z-10", active && "text-primary")} />
              <span className={cn(
                "relative z-10 truncate",
                collapsed ? "text-[9.5px] font-semibold max-w-full px-0.5" : "flex-1 text-[13.5px] font-medium",
                active && "font-bold",
              )}>
                {collapsed ? (item.short || item.name) : item.name}
              </span>
              {item.isAI && !collapsed && (
                <span className="relative z-10 bg-primary-container text-on-primary-container text-[8.5px] px-1.5 py-[2px] rounded-m3-xs uppercase font-bold tracking-wider shrink-0">AI</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer: AI meter + profile row */}
      <div className="shrink-0 px-2.5 pb-3 pt-2 border-t border-outline-variant relative">

        {/* AI popover */}
        <AnimatePresence>
          {isAiMenuOpen && !isMobile && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className={cn("absolute w-64 p-4", PANEL, collapsed ? "left-full ml-2 bottom-2" : "bottom-full mb-2 left-2.5 origin-bottom-left")}
            >
              {aiPanelBody}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile popover */}
        <AnimatePresence>
          {isProfileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className={cn("absolute w-60 p-2", PANEL, collapsed && !isMobile ? "left-full ml-2 bottom-2" : "bottom-full mb-2 left-2.5 origin-bottom-left")}
            >
              {profilePanelBody}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Slim AI meter */}
        <button
          onClick={() => {
            if (isMobile) { setMobileMenuOpen(false); router.push('/teacher/subscription'); return; }
            setIsAiMenuOpen(!isAiMenuOpen); setIsProfileMenuOpen(false);
          }}
          title={t.aiLimit.title}
          className={cn(
            "m3-interactive w-full flex items-center rounded-m3-md transition-colors",
            collapsed ? "flex-col gap-1.5 px-1.5 py-2" : "gap-2.5 px-3 py-2.5",
            aiData.isDanger ? "bg-error-container" : "bg-surface-container-low hover:bg-surface-container",
          )}
        >
          <Zap size={15} className={cn("shrink-0", aiData.isDanger ? "text-error fill-error" : "text-warning")} />
          <span className={cn("flex-1 h-[5px] rounded-full overflow-hidden", collapsed ? "w-full flex-none" : "min-w-[30px]", aiData.isDanger ? "bg-[color-mix(in_oklab,var(--m3-on-error-container)_15%,transparent)]" : "bg-surface-container-highest")}>
            <i className={cn("block h-full rounded-full", aiData.isDanger ? "bg-error" : "bg-primary")} style={{ width: `${aiData.isUnlimited ? 100 : Math.min(100, aiData.usagePercentage)}%` }} />
          </span>
          <b className={cn("text-[10.5px] tabular-nums shrink-0", aiData.isDanger ? "text-on-error-container" : "text-on-surface-variant")}>
            {aiData.isUnlimited ? '∞' : `${aiData.used}/${aiData.limit}`}
          </b>
        </button>

        {/* Profile row */}
        <button
          onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); setIsAiMenuOpen(false); }}
          title={user?.displayName || t.menu.profile}
          className={cn("m3-interactive w-full flex items-center rounded-m3-md mt-1.5 transition-colors hover:bg-state-hover", collapsed ? "justify-center p-1.5" : "gap-2.5 p-1.5 text-left")}
        >
          <span className="w-9 h-9 rounded-m3-sm bg-primary text-on-primary flex items-center justify-center font-bold text-[13px] overflow-hidden shrink-0 shadow-elev-1">
            {user?.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : user?.displayName?.[0]}
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 min-w-0">
                <b className="block text-[12.5px] font-semibold text-on-surface truncate">{user?.displayName?.split(' ')[0]}</b>
                <small className="block text-[10px] text-on-surface-variant truncate">{user?.email}</small>
              </span>
              <MoreVertical size={15} className="text-on-surface-variant shrink-0" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <TeacherLanguageContext.Provider value={{ lang, setLang }}>
      <div className="min-h-[100dvh] bg-surface font-sans selection:bg-primary-container selection:text-on-primary-container flex overflow-hidden relative">

        {/* --- LOGOUT CONFIRM --- */}
        <ConfirmDialog
          open={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={() => { signOut(auth); setShowLogoutModal(false); }}
          title={t.logoutConfirm.title}
          description={t.logoutConfirm.desc}
          confirmText={t.logoutConfirm.confirm}
          cancelText={t.logoutConfirm.cancel}
          danger
        />

        {/* --- MOBILE SLIDE-OUT DRAWER (full nav list, opened from "Menyu") --- */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
              <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="relative w-[280px] bg-surface-container-lowest h-full shadow-elev-3 border-r border-outline-variant">
                {renderSidebarContent(false, true)}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* --- DESKTOP SIDEBAR: flush full-height, drawer ↔ rail --- */}
        <aside
          ref={sidebarRef}
          className={cn(
            "hidden md:flex shrink-0 h-[100dvh] border-r border-outline-variant bg-surface-container-lowest transition-[width] duration-300 ease-[cubic-bezier(.2,0,0,1)] relative z-[50]",
            isCollapsed ? "w-[84px]" : "w-[264px]",
          )}
        >
          {renderSidebarContent(isCollapsed, false)}
        </aside>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-1 flex flex-col min-w-0 h-[100dvh] relative z-10">

          {/* MOBILE TOP BAR — slim: brand · AI chip · bell · avatar */}
          <header ref={headerRef} className="md:hidden bg-[color-mix(in_oklab,var(--m3-surface)_85%,transparent)] backdrop-blur-xl border-b border-outline-variant sticky top-0 z-30 px-3 py-2 flex justify-between items-center shrink-0">

            <div className="flex items-center gap-2 min-w-0" onClick={() => router.push('/teacher/dashboard')}>
              <div className="w-8 h-8 bg-primary rounded-m3-sm flex items-center justify-center text-on-primary shrink-0 shadow-elev-1"><BookOpen size={16} /></div>
              <b className="text-[14px] text-on-surface tracking-tight truncate">Edify<span className="text-primary">Teacher</span></b>
            </div>

            <div className="flex items-center gap-1.5">

              {/* AI chip + popover */}
              <div className="relative">
                <button
                  onClick={() => { setIsAiMenuOpen(!isAiMenuOpen); setIsProfileMenuOpen(false); }}
                  className={cn(
                    "m3-interactive flex items-center gap-1.5 px-2.5 h-9 rounded-full transition-colors",
                    aiData.isDanger ? "bg-error-container text-on-error-container" : "bg-surface-container-low text-on-surface",
                  )}
                >
                  <Zap size={13} className={aiData.isDanger ? "fill-current" : "text-warning"} />
                  <span className="text-[11.5px] font-bold tabular-nums">{aiData.isUnlimited ? '∞' : aiData.remaining}</span>
                </button>
                <AnimatePresence>
                  {isAiMenuOpen && (
                    <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} className={cn("absolute top-full right-0 mt-2 w-[260px] p-4 origin-top-right", PANEL)}>
                      {aiPanelBody}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Notification bell (quick panel) */}
              <div className="m3-interactive flex items-center justify-center h-9 w-9 text-on-surface-variant rounded-full shrink-0">
                <NotificationBell />
              </div>

              {/* Avatar + profile popover (language switcher lives inside) */}
              <div className="relative">
                <button onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); setIsAiMenuOpen(false); }} className="w-9 h-9 rounded-m3-sm bg-primary flex items-center justify-center text-on-primary font-bold transition-transform active:scale-95 overflow-hidden text-[12px] shadow-elev-1">
                  {user?.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : user?.displayName?.[0]}
                </button>
                <AnimatePresence>
                  {isProfileMenuOpen && (
                    <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} className={cn("absolute top-full right-0 mt-2 w-60 p-2 origin-top-right", PANEL)}>
                      {profilePanelBody}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </header>

          {/* MAIN SCROLLABLE CONTENT — reserves space for the bottom bar on mobile */}
          <main className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative",
            showBottomBar && "pb-[calc(68px+env(safe-area-inset-bottom))] md:pb-0",
          )}>
            <div className="w-full h-full relative z-10">{children}</div>
          </main>

          {/* MOBILE BOTTOM NAVIGATION BAR (M3) — hidden on deep routes with their own action bars */}
          {showBottomBar && (
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[color-mix(in_oklab,var(--m3-surface-container)_94%,transparent)] backdrop-blur-xl border-t border-outline-variant flex px-1.5 pt-1.5" style={{ paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}>
              {[
                { label: t.bottom.home, href: '/teacher/dashboard', icon: LayoutDashboard },
                { label: t.bottom.create, href: '/teacher/create', icon: FilePlus },
                { label: t.bottom.classes, href: '/teacher/classes', icon: Users },
                { label: t.bottom.library, href: '/teacher/library', icon: FolderOpen },
              ].map((item) => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href} className={cn("flex-1 flex flex-col items-center gap-[3px] py-1 relative", active ? "text-on-secondary-container" : "text-on-surface-variant")}>
                    {active && (
                      <motion.span layoutId="bn-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} className="absolute -top-0.5 inset-x-0 mx-auto w-[52px] h-[28px] bg-secondary-container rounded-full" />
                    )}
                    <item.icon size={21} strokeWidth={active ? 2.4 : 2} className={cn("relative z-10", active && "text-primary")} />
                    <span className={cn("relative z-10 text-[9.5px] font-semibold", active && "font-bold")}>{item.label}</span>
                  </Link>
                );
              })}
              <button onClick={() => setMobileMenuOpen(true)} className="flex-1 flex flex-col items-center gap-[3px] py-1 text-on-surface-variant">
                <Menu size={21} strokeWidth={2} />
                <span className="text-[9.5px] font-semibold">{t.bottom.menu}</span>
              </button>
            </nav>
          )}

        </div>
      </div>
    </TeacherLanguageContext.Provider>
  );
}
