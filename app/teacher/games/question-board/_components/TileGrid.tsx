'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { Tile } from '../_lib/engine';
import { BOARD_TEAMS, STAGE } from '../_lib/theme';

/** 12 → 4×3, 16 → 4×4, 20 → 5×4, 24 → 6×4; short boards use two rows. */
export function gridShape(n: number): { cols: number; rows: number } {
  const cols = n === 12 || n === 16 ? 4 : n === 20 ? 5 : n === 24 ? 6 : Math.min(6, Math.ceil(n / 2));
  return { cols, rows: Math.ceil(n / cols) };
}

const HOVER = { type: 'spring', stiffness: 500, damping: 26 } as const;

interface Props {
  tiles: Tile[];
  active: number | null;
  disabled: boolean;
  onPick: (index: number) => void;
  /** Shared-layout morph tile ↔ question card (off with reduced motion). */
  morph: boolean;
  animate: boolean;
}

export default function TileGrid({ tiles, active, disabled, onPick, morph, animate }: Props) {
  const { cols, rows } = gridShape(tiles.length);

  return (
    <div
      className="grid min-h-0 flex-1 gap-[clamp(6px,0.9vw,14px)]"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {tiles.map((tile, i) => {
        const row = Math.floor(i / cols);
        const checker = (row + (i % cols)) % 2 === 0;
        const radius = 'rounded-[clamp(12px,1.3vw,22px)]';

        // The open question's slot stays empty while the card is up.
        if (i === active) return <div key={tile.n} className={`${radius} border-2 border-dashed border-outline-variant`} />;

        if (tile.used) {
          const team = BOARD_TEAMS[tile.used.team];
          const won = tile.used.outcome === 'correct';
          return (
            <motion.div
              key={tile.n}
              layoutId={morph ? `tile-${tile.n}` : undefined}
              className={`${radius} relative flex flex-col items-center justify-center gap-[0.3em] border-2 bg-surface-container-lowest`}
              style={{ borderColor: won ? team.solid : 'var(--m3-outline-variant)', background: won ? team.tint : undefined }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            >
              <span className="font-t-display text-[clamp(18px,3.4vh,40px)] font-black leading-none text-on-surface-variant opacity-40">{tile.n}</span>
              <span
                className="flex items-center gap-[0.25em] rounded-full px-[0.6em] py-[0.15em] text-[clamp(10px,1.5vh,15px)] font-extrabold text-white"
                style={{ background: won ? team.solid : 'var(--m3-outline)' }}
              >
                {won ? <Check className="h-[1.1em] w-[1.1em]" strokeWidth={3.5} /> : <X className="h-[1.1em] w-[1.1em]" strokeWidth={3.5} />}
                {won && <span className="tabular-nums">+{tile.points}</span>}
              </span>
            </motion.div>
          );
        }

        return (
          <motion.button
            key={tile.n}
            type="button"
            layoutId={morph ? `tile-${tile.n}` : undefined}
            disabled={disabled}
            onClick={() => onPick(i)}
            className={`${radius} group relative overflow-hidden text-white outline-none focus-visible:ring-4 focus-visible:ring-white/70 disabled:cursor-default`}
            style={{
              background: checker ? STAGE.tileA : STAGE.tileB,
              boxShadow: `inset 0 -6px 0 ${checker ? STAGE.tileEdgeA : STAGE.tileEdgeB}, 0 6px 14px -6px rgba(49, 46, 129, 0.55)`,
            }}
            initial={animate ? { opacity: 0, scale: 0.6, y: 16 } : false}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            whileHover={animate && !disabled ? { y: -4, scale: 1.03, transition: HOVER } : undefined}
            whileTap={animate && !disabled ? { y: 2, scale: 0.98, transition: HOVER } : undefined}
            transition={{ type: 'spring', stiffness: 380, damping: 22, delay: animate ? i * 0.025 : 0 }}
          >
            {/* Gloss */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
            {/* Shine sweep — staggered so it travels across the board like a wave */}
            {animate && (
              <motion.span
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['0%', '520%'] }}
                transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 5, delay: 1 + (row + (i % cols)) * 0.12, ease: 'easeInOut' }}
              />
            )}
            <span className="relative font-t-display text-[clamp(26px,6vh,72px)] font-black leading-none drop-shadow-[0_3px_0_rgba(0,0,0,0.18)]">
              {tile.n}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
