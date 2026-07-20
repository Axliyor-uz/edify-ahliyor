'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from './cn';
import { DESIGN, MOTION_ON, springTransition } from './config';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /** Hidden from the phone dock (desktop/drawer only). */
  hideOnMobile?: boolean;
}

export interface ShellProps {
  items: readonly NavItem[];
  /** Returns true when a nav item is the current page. */
  isActive: (href: string) => boolean;
  /** Brand mark shown at the top of the rail/drawer. */
  brand: React.ReactNode;
  /** Top bar content (streak, notifications, profile menu). */
  topbar: React.ReactNode;
  children: React.ReactNode;
  /** Opens the mobile drawer — only used by Mobile_navigation="drawer". */
  onOpenMobileNav?: () => void;
}

/**
 * The app frame.
 *
 * Renders whichever navigation design.config.ts › App_shell_navigation and
 * › Mobile_navigation select. All three desktop shells and all three mobile
 * navigations share this one component so pages never care which is active.
 */
export function Shell({ items, isActive, brand, topbar, children, onOpenMobileNav }: ShellProps) {
  const desktop = DESIGN.App_shell_navigation;
  const mobile = DESIGN.Mobile_navigation;

  return (
    <div className="flex min-h-[100dvh] bg-background text-on-surface">
      {desktop === 'shell_a' && <IconRail items={items} isActive={isActive} brand={brand} />}
      {desktop === 'shell_b' && <LabelledDrawer items={items} isActive={isActive} brand={brand} />}

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          desktop === 'shell_a' && 'md:pl-[var(--s-rail-w)]',
          desktop === 'shell_b' && 'md:pl-[var(--s-drawer-w)]',
        )}
      >
        <header
          className={cn(
            'sticky top-0 z-40 flex h-[var(--s-topbar-h)] shrink-0 items-center justify-between gap-3',
            'border-b border-outline-variant bg-surface-blur px-3 backdrop-blur-xl sm:px-4',
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {mobile === 'drawer' && (
              <button
                type="button"
                onClick={onOpenMobileNav}
                aria-label="Open menu"
                className="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant s-press hover:bg-state-hover md:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </svg>
              </button>
            )}
            <div className={cn(desktop !== 'shell_c' && 'md:hidden')}>{brand}</div>
          </div>
          {topbar}
        </header>

        {desktop === 'shell_c' && <TopTabs items={items} isActive={isActive} />}

        <main
          className={cn(
            'relative flex-1',
            // Clears the phone dock so content is never trapped underneath it.
            mobile !== 'drawer' && 'pb-[calc(var(--s-dock-h)+var(--s-safe-b)+16px)] md:pb-8',
            mobile === 'floating' && 'pb-[calc(var(--s-dock-h)+var(--s-safe-b)+28px)] md:pb-8',
          )}
        >
          {children}
        </main>
      </div>

      {mobile !== 'drawer' && <MobileDock items={items} isActive={isActive} floating={mobile === 'floating'} />}
    </div>
  );
}

/* ── SHELL-A · icon rail ─────────────────────────────────────────────────── */

function IconRail({ items, isActive, brand }: Pick<ShellProps, 'items' | 'isActive' | 'brand'>) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 hidden w-[var(--s-rail-w)] flex-col items-center gap-1 border-r border-outline-variant bg-surface py-3.5 md:flex"
    >
      <div className="mb-2.5">{brand}</div>
      {items.map((item) => {
        const on = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'group relative grid h-11 w-[52px] place-items-center rounded-m3-sm',
              'transition-colors duration-m3-fast ease-m3-std',
              on
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:bg-state-hover hover:text-on-surface',
            )}
          >
            <item.icon size={21} strokeWidth={on ? 2.6 : 2.2} />
            <span
              role="tooltip"
              className={cn(
                'pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap',
                'rounded-m3-xs bg-inverse-surface px-2.5 py-1.5 text-[12.5px] font-bold text-inverse-on-surface',
                'opacity-0 transition-opacity duration-m3-fast ease-m3-std group-hover:opacity-100',
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ── SHELL-B · labelled drawer ───────────────────────────────────────────── */

function LabelledDrawer({ items, isActive, brand }: Pick<ShellProps, 'items' | 'isActive' | 'brand'>) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 hidden w-[var(--s-drawer-w)] flex-col border-r border-outline-variant bg-surface md:flex"
    >
      <div className="flex h-[var(--s-topbar-h)] shrink-0 items-center gap-2.5 border-b border-outline-variant px-4">
        {brand}
      </div>
      <div className="s-scroll flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {items.map((item) => {
          const on = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3.5 rounded-m3-btn px-4 py-3 text-[14.5px] font-extrabold',
                'transition-colors duration-m3-fast ease-m3-std',
                on
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-state-hover hover:text-on-surface',
              )}
            >
              <item.icon size={21} strokeWidth={on ? 2.6 : 2.2} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ── SHELL-C · top tabs ──────────────────────────────────────────────────── */

function TopTabs({ items, isActive }: Pick<ShellProps, 'items' | 'isActive'>) {
  return (
    <nav
      aria-label="Main"
      className="s-no-scrollbar sticky top-[var(--s-topbar-h)] z-30 hidden gap-1 overflow-x-auto border-b border-outline-variant bg-surface px-3 md:flex"
    >
      {items.map((item) => {
        const on = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[14px] font-extrabold',
              'transition-colors duration-m3-fast ease-m3-std',
              on
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface',
            )}
          >
            <item.icon size={18} strokeWidth={on ? 2.6 : 2.2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ── Mobile dock ─────────────────────────────────────────────────────────── */

function MobileDock({
  items,
  isActive,
  floating,
}: Pick<ShellProps, 'items' | 'isActive'> & { floating: boolean }) {
  const visible = items.filter((i) => !i.hideOnMobile);

  return (
    <nav
      aria-label="Main"
      className={cn(
        'fixed z-40 flex items-stretch justify-around md:hidden',
        floating
          ? cn(
              'inset-x-4 bottom-[calc(var(--s-safe-b)+12px)] rounded-full border border-outline-variant',
              'bg-surface-blur px-2 py-1.5 shadow-elev-2 backdrop-blur-xl',
            )
          : cn(
              'inset-x-0 bottom-0 border-t border-outline-variant bg-surface-blur px-2 backdrop-blur-xl',
              'pb-[var(--s-safe-b)] pt-1.5',
            ),
      )}
    >
      {visible.map((item) => {
        const on = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1.5"
          >
            {/* max-w, not a fixed w: the pill has to be able to shrink or the
                row overflows on narrow phones and clips the outer labels. */}
            <span className="relative grid h-8 w-full max-w-[52px] place-items-center">
              {on && (
                <motion.span
                  layoutId="s-dock-pill"
                  transition={MOTION_ON ? springTransition : { duration: 0 }}
                  className="absolute inset-0 rounded-full bg-primary-container"
                />
              )}
              <item.icon
                size={21}
                strokeWidth={on ? 2.7 : 2.2}
                className={cn('relative', on ? 'text-on-primary-container' : 'text-on-surface-variant')}
              />
            </span>
            <span
              className={cn(
                'max-w-full truncate text-[10px] font-black',
                on ? 'text-primary' : 'text-on-surface-variant',
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ── Mobile slide-in drawer (Mobile_navigation="drawer") ─────────────────── */

export function MobileDrawer({
  open,
  onClose,
  items,
  isActive,
  brand,
}: {
  open: boolean;
  onClose: () => void;
  items: readonly NavItem[];
  isActive: (href: string) => boolean;
  brand: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={MOTION_ON ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-scrim-bg backdrop-blur-sm md:hidden"
          />
          <motion.nav
            aria-label="Main"
            initial={MOTION_ON ? { x: '-100%' } : false}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={springTransition}
            className="fixed inset-y-0 left-0 z-[101] flex w-72 flex-col border-r border-outline-variant bg-surface md:hidden"
          >
            <div className="flex h-[var(--s-topbar-h)] shrink-0 items-center justify-between gap-2 border-b border-outline-variant px-4">
              {brand}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-state-hover"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            <div className="s-scroll flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {items.map((item) => {
                const on = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={on ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3.5 rounded-m3-btn px-4 py-3 text-[14.5px] font-extrabold',
                      on
                        ? 'bg-primary-container text-on-primary-container'
                        : 'text-on-surface-variant hover:bg-state-hover',
                    )}
                  >
                    <item.icon size={21} strokeWidth={on ? 2.6 : 2.2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
