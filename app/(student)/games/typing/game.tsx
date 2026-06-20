"use client";

import React, { useState, useEffect } from 'react';

// Keeping data independent and self-contained within the file
const TYPING_SEQUENCE = ['f', ' ', 'f', ' ', 'j', ' ', 'j'];

const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
];

export default function TypingPracticePage() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default browser scrolling when hitting the spacebar
      if (e.key === ' ') {
        e.preventDefault();
      }

      if (activeIndex >= TYPING_SEQUENCE.length) {
        // Reset loop for continuous practice
        setActiveIndex(0);
        return;
      }

      const expectedKey = TYPING_SEQUENCE[activeIndex];
      if (e.key.toLowerCase() === expectedKey) {
        setActiveIndex((prev) => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex]);

  const activeChar = TYPING_SEQUENCE[activeIndex] || '';

  return (
    <main className="min-h-screen bg-[#f4f5f6] flex flex-col items-center justify-center font-sans selection:bg-transparent">
      
      {/* Target Character Boxes */}
      <div className="flex gap-4 mb-20">
        {TYPING_SEQUENCE.map((char, i) => {
          const isCurrent = i === activeIndex;
          const isPast = i < activeIndex;

          return (
            <div
              key={i}
              className={`w-16 h-16 flex items-center justify-center text-3xl font-light bg-white rounded-lg transition-all duration-200
                ${isCurrent ? 'border-b-4 border-blue-500 shadow-md text-gray-800' : 'border border-gray-200 shadow-sm'}
                ${isPast ? 'text-gray-300' : 'text-gray-700'}
              `}
            >
              {char === ' ' ? '\u00A0' : char}
            </div>
          );
        })}
      </div>

      {/* Virtual Keyboard */}
      <div className="relative bg-[#f0f2f4] p-6 rounded-2xl border border-gray-200 shadow-sm w-full max-w-3xl">
        <div className="flex flex-col gap-2">
          
          {/* Main Key Rows */}
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <div 
              key={rowIndex} 
              className="flex justify-center gap-2"
              style={{ paddingLeft: `${rowIndex * 1.5}rem`, paddingRight: `${rowIndex * 1.5}rem` }}
            >
              {row.map((key) => {
                const isActiveKey = activeChar === key;
                return (
                  <div
                    key={key}
                    className={`relative w-12 h-12 flex items-center justify-center text-lg rounded-lg border-b-2 transition-colors duration-150
                      ${isActiveKey 
                        ? 'bg-blue-500 text-white border-blue-600 shadow-inner scale-95' 
                        : 'bg-white text-gray-600 border-gray-300 shadow-sm'}
                    `}
                  >
                    {key}
                    
                    {/* Simulated "finger" highlight overlay */}
                    {isActiveKey && (
                      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-4 h-20 bg-blue-500/20 blur-md rounded-full pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Spacebar Row */}
          <div className="flex justify-center gap-2 mt-2">
            <div
              className={`h-12 w-96 rounded-lg border-b-2 transition-colors duration-150
                ${activeChar === ' ' 
                  ? 'bg-blue-500 border-blue-600 shadow-inner scale-95' 
                  : 'bg-white border-gray-300 shadow-sm'}
              `}
            />
          </div>

        </div>

        {/* Hand Outlines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl opacity-40">
          <svg viewBox="0 0 800 400" className="w-full h-full stroke-gray-500 fill-transparent" strokeWidth="2">
            {/* Left Hand Outline */}
            <path d="M 220 400 C 220 300, 240 220, 260 200 C 280 180, 290 190, 290 220 C 290 190, 310 170, 320 170 C 330 170, 340 190, 340 220 C 340 180, 360 160, 370 160 C 380 160, 390 180, 380 230 C 370 290, 320 350, 300 400" />
            {/* Right Hand Outline */}
            <path d="M 580 400 C 580 300, 560 220, 540 200 C 520 180, 510 190, 510 220 C 510 190, 490 170, 480 170 C 470 170, 460 190, 460 220 C 460 180, 440 160, 430 160 C 420 160, 410 180, 420 230 C 430 290, 480 350, 500 400" />
          </svg>
        </div>
      </div>
    </main>
  );
}