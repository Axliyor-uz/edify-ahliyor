'use client';

import { useSyncExternalStore } from 'react';

// Play views need a wide, landscape screen (projector / laptop / tablet).
const BIG_SCREEN = '(min-width: 768px) and (orientation: landscape)';

const subscribe = (cb: () => void) => {
  const m = window.matchMedia(BIG_SCREEN);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};

export const useBigScreen = () =>
  useSyncExternalStore(subscribe, () => window.matchMedia(BIG_SCREEN).matches, () => true);
