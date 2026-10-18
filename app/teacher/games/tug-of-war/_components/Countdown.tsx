'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STEP_MS = 800;

/** 3 → 2 → 1 → "Boshla!" over the arena, then `onDone`. */
export default function Countdown({ go, animate, onDone }: { go: string; animate: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);

  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      const n = Math.floor((performance.now() - start) / STEP_MS);
      if (n >= 4) {
        window.clearInterval(id);
        done.current();
      } else {
        setStep(n);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  const label = step < 3 ? String(3 - step) : go;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={label}
          initial={animate ? { scale: 0.4, opacity: 0 } : { opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={animate ? { scale: 1.6, opacity: 0 } : { opacity: 0 }}
          transition={animate ? { type: 'spring', stiffness: 320, damping: 18 } : { duration: 0.1 }}
          className="font-t-display text-[88px] font-black leading-none text-on-surface drop-shadow-sm md:text-[120px]"
          style={step >= 3 ? { color: 'var(--m3-primary)', fontSize: 'clamp(48px, 8vw, 96px)' } : undefined}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
