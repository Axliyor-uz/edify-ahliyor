'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import { useStudentLanguage } from '../../layout';

const BACK = { uz: 'Orqaga', en: 'Back', ru: 'Назад' } as const;

// Standalone Vite build served from /public/games/robot-puzzle (see docs/STUDENT.md).
// Rendered as a fixed full-viewport overlay above the student nav; also asks the browser for real fullscreen.
export default function RobotPuzzlePage() {
  const { lang } = useStudentLanguage();
  const back = BACK[(lang as keyof typeof BACK) || 'uz'] ?? BACK.uz;
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    root.current?.requestFullscreen?.().catch(() => { /* needs a user gesture on some browsers */ });
    return () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void root.current?.requestFullscreen?.().catch(() => {});
  };

  return (
    <div ref={root} className="fixed inset-0 z-[200] flex flex-col bg-[#0d1117]">
      <div className="flex h-10 shrink-0 items-center justify-between px-3 text-white/80">
        <Link href="/games" className="inline-flex items-center gap-1.5 text-sm font-bold hover:text-white">
          <ArrowLeft size={16} /> {back}
        </Link>
        <button onClick={toggleFs} aria-label="Fullscreen" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10">
          <Maximize2 size={16} />
        </button>
      </div>
      <iframe
        src="/games/robot-puzzle/index.html"
        title="RoboCoding"
        allow="autoplay; fullscreen"
        allowFullScreen
        className="w-full flex-1 border-0"
      />
    </div>
  );
}
