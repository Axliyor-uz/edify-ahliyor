'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Tiny game sound kit (docs/GAMES.md): every effect is synthesized with the
 * Web Audio API, so there are no audio files. Browsers only allow sound
 * after a user gesture, and every game starts from a click, so the context
 * is created lazily on the first effect. The mute choice is per browser
 * (localStorage, wrapped in try/catch; private mode just starts unmuted).
 */

const MUTE_KEY = 'edify.games.muted';
let ctx: AudioContext | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One enveloped oscillator note; `at` is seconds from now. */
function note(freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.14, slideTo?: number) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  /** Tile picked / card opens. */
  flip: () => { note(520, 0, 0.09, 'triangle', 0.12); note(780, 0.06, 0.12, 'triangle', 0.1); },
  /** Last seconds of the timer. */
  tick: () => note(1100, 0, 0.05, 'square', 0.04),
  correct: () => [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.08, 0.22, 'triangle', 0.12)),
  wrong: () => { note(220, 0, 0.25, 'sawtooth', 0.07, 150); note(165, 0.18, 0.35, 'sawtooth', 0.07, 110); },
  timeout: () => [440, 370, 311].forEach((f, i) => note(f, i * 0.14, 0.2, 'square', 0.05)),
  win: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => note(f, i * 0.12, i === 5 ? 0.6 : 0.16, 'triangle', 0.13)),
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** `[muted, toggle]`, shared by every game on the page. */
export function useGameSound(): [boolean, () => void] {
  const value = useSyncExternalStore(subscribe, () => muted, () => false);
  const toggle = useCallback(() => {
    muted = !muted;
    try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked */ }
    listeners.forEach((l) => l());
  }, []);
  return [value, toggle];
}
