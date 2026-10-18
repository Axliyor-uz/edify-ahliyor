'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Play } from 'lucide-react';

/** Small teacher control in the play footer (pause, mute, fullscreen, exit). */
export function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="m3-interactive flex h-full aspect-square items-center justify-center rounded-[clamp(8px,1vh,12px)] border border-outline-variant bg-surface-container-lowest text-on-surface-variant opacity-70 shadow-elev-1 transition hover:text-on-surface hover:opacity-100"
    >
      {children}
    </button>
  );
}

/** Opaque pause screen: hides the question while the clock is stopped. */
export function PauseOverlay({ open, onResume, t }: {
  open: boolean;
  onResume: () => void;
  t: { resume: string; paused: string; pausedHint: string };
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-surface"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <button
            type="button"
            onClick={onResume}
            aria-label={t.resume}
            className="flex h-[clamp(64px,10vh,96px)] w-[clamp(64px,10vh,96px)] items-center justify-center rounded-full bg-primary text-on-primary shadow-elev-2 transition-transform hover:scale-105"
          >
            <Play className="ml-1 h-[42%] w-[42%]" />
          </button>
          <span className="font-t-display text-[clamp(24px,4vh,40px)] font-black text-on-surface">{t.paused}</span>
          <span className="text-[clamp(13px,1.6vh,16px)] font-medium text-on-surface-variant">{t.pausedHint}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
