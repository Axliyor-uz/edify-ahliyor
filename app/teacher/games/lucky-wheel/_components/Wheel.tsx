'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate as animateValue, motion, useMotionValue } from 'framer-motion';
import { Bomb, Hand, RotateCw } from 'lucide-react';
import { sfx } from '../../_lib/sound';
import { SEGMENTS } from '../_lib/engine';
import { WEDGE_FILLS, WHEEL } from '../_lib/theme';

/**
 * The wheel (docs/GAMES.md). Layers, all in one square box:
 *   static rim + bulbs → rotating disc (wedges, labels, pegs) → static gloss
 *   → pointer (flaps on every peg) → hub button.
 * The landing segment comes from the engine (`target`, chosen at random by
 * the page); the flick only sets how hard and which way it spins, so a
 * drag can never steer the result.
 */

const N = SEGMENTS.length;
const SLICE = 360 / N;
const R = 100;
/** Flick speed (deg/ms) that counts as a spin; slower = "spin harder". */
const MIN_FLICK = 0.25;
const MAX_FLICK = 2;

const mod = (a: number, m: number) => ((a % m) + m) % m;
const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)] as const;
};
const wedge = (i: number) => {
  const [x0, y0] = polar(i * SLICE, R);
  const [x1, y1] = polar((i + 1) * SLICE, R);
  return `M0 0L${x0.toFixed(3)} ${y0.toFixed(3)}A${R} ${R} 0 0 1 ${x1.toFixed(3)} ${y1.toFixed(3)}Z`;
};
const BULBS = Array.from({ length: 24 }, (_, i) => polar(i * 15 + 7.5, 110));
const PEGS = Array.from({ length: N }, (_, i) => polar(i * SLICE, 93));

interface Props {
  spinId: number;
  target: number | null;
  spinning: boolean;
  canSpin: boolean;
  /** Segment to glow (the one it landed on), or null. */
  highlight: number | null;
  /** Hub content after landing (the points…); null = spin button. */
  result: React.ReactNode | null;
  /** Answering team's color, for the hub ring. */
  color: string;
  onSpin: () => void;
  onLanded: () => void;
  spinLabel: string;
  weakLabel: string;
  bankruptLabel: string;
  animate: boolean;
}

export default function Wheel({
  spinId, target, spinning, canSpin, highlight, result, color, onSpin, onLanded, spinLabel, weakLabel, bankruptLabel, animate,
}: Props) {
  const rot = useMotionValue(0);
  const flap = useMotionValue(0);
  const discRef = useRef<HTMLDivElement>(null);
  /** Strength (0–1) and direction of the next spin, set by a flick. */
  const launch = useRef<{ power: number; dir: 1 | -1 } | null>(null);
  const landed = useRef(onLanded);
  const [weak, setWeak] = useState(0);
  useEffect(() => { landed.current = onLanded; });

  // Spin to the engine's target: whole turns + the offset to that wedge.
  useEffect(() => {
    if (!spinning || target === null) return;
    const { power, dir } = launch.current ?? { power: 0.55 + Math.random() * 0.35, dir: 1 as const };
    launch.current = null;
    const cur = rot.get();
    const jitter = (Math.random() - 0.5) * SLICE * 0.7;
    const rest = mod(-(target * SLICE + SLICE / 2 + jitter), 360);
    const turns = animate ? Math.round(4 + power * 4) : 1;
    const delta = dir > 0 ? mod(rest - cur, 360) + turns * 360 : -(mod(cur - rest, 360) + turns * 360);
    const c = animateValue(rot, cur + delta, {
      duration: animate ? 4.2 + power * 2 : 1.2,
      ease: [0.12, 0.62, 0.1, 1],
      onComplete: () => landed.current(),
    });
    return () => c.stop();
  }, [spinId, spinning, target, animate, rot]);

  // Pointer flap + click on every peg it passes.
  useEffect(() => {
    let lastPeg = Math.floor(-rot.get() / SLICE);
    let lastV = rot.get();
    let lastSound = 0;
    return rot.on('change', (v) => {
      const peg = Math.floor(-v / SLICE);
      const dir = Math.sign(v - lastV);
      lastV = v;
      if (peg === lastPeg) return;
      lastPeg = peg;
      const now = performance.now();
      if (now - lastSound > 35) { sfx.peg(); lastSound = now; }
      if (animate) animateValue(flap, [-24 * dir, 0], { duration: 0.16, ease: 'easeOut' });
    });
  }, [rot, flap, animate]);

  useEffect(() => {
    if (!weak) return;
    const id = window.setTimeout(() => setWeak(0), 1600);
    return () => window.clearTimeout(id);
  }, [weak]);

  // ── Drag-flick ──────────────────────────────────────────────────────────
  const drag = useRef<{ prev: number; samples: { t: number; r: number }[] } | null>(null);
  const angleAt = (e: React.PointerEvent) => {
    const b = discRef.current!.getBoundingClientRect();
    return (Math.atan2(e.clientX - (b.left + b.width / 2), -(e.clientY - (b.top + b.height / 2))) * 180) / Math.PI;
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canSpin) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { prev: angleAt(e), samples: [{ t: e.timeStamp, r: rot.get() }] };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const a = angleAt(e);
    let step = a - d.prev;
    if (step > 180) step -= 360;
    if (step < -180) step += 360;
    d.prev = a;
    rot.set(rot.get() + step);
    d.samples.push({ t: e.timeStamp, r: rot.get() });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > 120) d.samples.shift();
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !canSpin) return;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = Math.max(1, e.timeStamp - first.t);
    const v = (last.r - first.r) / dt;
    if (Math.abs(v) < MIN_FLICK) {
      if (Math.abs(last.r - first.r) > 2 || d.samples.length > 2) setWeak((w) => w + 1);
      return;
    }
    launch.current = { power: Math.min(1, (Math.abs(v) - MIN_FLICK) / (MAX_FLICK - MIN_FLICK)), dir: v > 0 ? 1 : -1 };
    onSpin();
  };

  const fast = spinning && animate;

  return (
    <div className="relative aspect-square h-full max-h-full max-w-full select-none">
      {/* Rim + bulbs */}
      <svg viewBox="-120 -120 240 240" className="absolute inset-0 h-full w-full drop-shadow-[0_18px_30px_rgba(30,27,75,0.35)]" aria-hidden>
        <defs>
          <radialGradient id="lw-rim" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={WHEEL.rimOuter} />
            <stop offset="100%" stopColor={WHEEL.rimInner} />
          </radialGradient>
        </defs>
        <circle r={118} fill="url(#lw-rim)" />
        <circle r={117} fill="none" stroke={WHEEL.rimEdge} strokeWidth={1.5} opacity={0.7} />
        <circle r={102.5} fill={WHEEL.rimInner} stroke={WHEEL.rimEdge} strokeWidth={2} />
        {BULBS.map(([x, y], i) => (
          <g key={i} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
            <motion.circle
              r={6} fill={WHEEL.bulbGlow}
              initial={{ opacity: 0.25 }}
              animate={animate ? { opacity: [0.1, 0.45, 0.1] } : { opacity: 0.25 }}
              transition={{ duration: fast ? 0.3 : 1.6, repeat: Infinity, delay: (i % 2) * (fast ? 0.15 : 0.8) }}
            />
            <circle r={3.1} fill={WHEEL.bulb} />
          </g>
        ))}
      </svg>

      {/* Rotating disc — also the flick surface */}
      <motion.div
        ref={discRef}
        className={`absolute inset-[7.5%] touch-none rounded-full ${canSpin ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ rotate: rot }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => { drag.current = null; }}
      >
        <svg viewBox="-100 -100 200 200" className="h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="lw-double" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={WHEEL.double} />
              <stop offset="100%" stopColor={WHEEL.doubleDeep} />
            </linearGradient>
            <linearGradient id="lw-bankrupt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={WHEEL.bankrupt} />
              <stop offset="100%" stopColor={WHEEL.bankruptDeep} />
            </linearGradient>
          </defs>
          {SEGMENTS.map((s, i) => (
            <path key={i} d={wedge(i)} fill={WEDGE_FILLS[i]} stroke="rgba(255,255,255,0.55)" strokeWidth={1.2} />
          ))}
          {highlight !== null && (
            <motion.path
              d={wedge(highlight)}
              fill="#ffffff"
              stroke="#ffffff"
              strokeWidth={3}
              initial={{ fillOpacity: 0 }}
              animate={animate ? { fillOpacity: [0, 0.32, 0] } : { fillOpacity: 0.2 }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          )}
          {SEGMENTS.map((s, i) => {
            const mid = i * SLICE + SLICE / 2;
            return (
              <g key={i} transform={`rotate(${mid})`}>
                {s.kind === 'points' && (
                  <text
                    y={-68} textAnchor="middle" dominantBaseline="middle"
                    className="font-t-display" fontSize={23} fontWeight={900}
                    fill="#ffffff" stroke="rgba(0,0,0,0.22)" strokeWidth={3} paintOrder="stroke"
                  >
                    {s.value}
                  </text>
                )}
                {s.kind === 'double' && (
                  <text
                    y={-68} textAnchor="middle" dominantBaseline="middle"
                    className="font-t-display" fontSize={25} fontWeight={900} fill={WHEEL.doubleInk}
                  >
                    ×2
                  </text>
                )}
                {s.kind === 'bankrupt' && (
                  <>
                    <Bomb x={-10} y={-86} width={20} height={20} color="#ffffff" strokeWidth={2.4} />
                    <text y={-56} textAnchor="middle" dominantBaseline="middle" fontSize={7.5} fontWeight={900} letterSpacing={0.8} fill="#ffffff" opacity={0.9}>
                      {bankruptLabel.replace(/!$/, '').toUpperCase()}
                    </text>
                  </>
                )}
              </g>
            );
          })}
          {PEGS.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.8} fill={WHEEL.peg} stroke={WHEEL.pegEdge} strokeWidth={0.8} />
          ))}
          <circle r={30} fill="rgba(255,255,255,0.12)" />
        </svg>
      </motion.div>

      {/* Gloss + edge shade (static, above the disc) */}
      <svg viewBox="-100 -100 200 200" className="pointer-events-none absolute inset-[7.5%] h-[85%] w-[85%]" aria-hidden>
        <defs>
          <radialGradient id="lw-gloss" cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
            <stop offset="55%" stopColor="#ffffff" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="lw-shade" r="50%">
            <stop offset="82%" stopColor="#000000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.28} />
          </radialGradient>
        </defs>
        <circle r={100} fill="url(#lw-gloss)" />
        <circle r={100} fill="url(#lw-shade)" />
      </svg>

      {/* Pointer, pivoting at its round head (wrapper owns the centering transform) */}
      <div className="pointer-events-none absolute left-1/2 top-[-4%] w-[11%] -translate-x-1/2">
      <motion.svg
        viewBox="0 0 40 54"
        className="block w-full drop-shadow-[0_4px_4px_rgba(0,0,0,0.35)]"
        style={{ rotate: flap, originX: '50%', originY: '26%' }}
        aria-hidden
      >
        <defs>
          <linearGradient id="lw-pointer" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={WHEEL.pointer} />
            <stop offset="100%" stopColor={WHEEL.pointerDeep} />
          </linearGradient>
        </defs>
        <path d="M20 52 L7 20 A14 14 0 1 1 33 20 Z" fill="url(#lw-pointer)" stroke="#ffffff" strokeWidth={2.5} strokeLinejoin="round" />
        <circle cx={20} cy={14} r={4.5} fill="#ffffff" />
      </motion.svg>
      </div>

      {/* Hub: spin button, then the landed value */}
      <div className="absolute left-1/2 top-1/2 h-[23%] w-[23%] -translate-x-1/2 -translate-y-1/2">
        {canSpin && animate && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 4px ${color}` }}
            animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <motion.button
          type="button"
          onClick={canSpin ? onSpin : undefined}
          disabled={!canSpin}
          aria-label={spinLabel}
          className="relative flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-on-surface shadow-[0_6px_16px_rgba(0,0,0,0.35),inset_0_-4px_0_rgba(0,0,0,0.08)]"
          style={{ border: `5px solid ${color}`, cursor: canSpin ? 'pointer' : 'default' }}
          whileHover={canSpin && animate ? { scale: 1.06 } : undefined}
          whileTap={canSpin && animate ? { scale: 0.94 } : undefined}
        >
          <AnimatePresence mode="wait" initial={false}>
            {result !== null ? (
              <motion.span
                key={`r-${spinId}`}
                className="flex flex-col items-center"
                initial={animate ? { scale: 0.3, opacity: 0 } : { opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 14 }}
              >
                {result}
              </motion.span>
            ) : (
              <motion.span
                key="spin"
                className="flex flex-col items-center gap-[0.15em]"
                initial={{ opacity: 0 }} animate={{ opacity: canSpin || spinning ? 1 : 0.5 }} exit={{ opacity: 0 }}
              >
                <motion.span
                  className="inline-flex"
                  animate={spinning && animate ? { rotate: 360 } : { rotate: 0 }}
                  transition={spinning ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
                >
                  <RotateCw className="h-[clamp(18px,4.2vh,40px)] w-[clamp(18px,4.2vh,40px)]" strokeWidth={2.8} style={{ color }} />
                </motion.span>
                <span className="text-[clamp(9px,1.6vh,16px)] font-black uppercase tracking-wider">{spinLabel}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* "Spin harder!" after a too-gentle flick */}
      <div className="pointer-events-none absolute bottom-[2%] left-1/2 -translate-x-1/2">
      <AnimatePresence>
        {weak > 0 && (
          <motion.span
            key={weak}
            className="inline-flex items-center gap-[0.4em] whitespace-nowrap rounded-full bg-surface-container-lowest px-[1em] py-[0.35em] text-[clamp(12px,1.8vh,18px)] font-extrabold text-on-surface shadow-elev-2"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            <Hand className="h-[1.1em] w-[1.1em]" /> {weakLabel}
          </motion.span>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
