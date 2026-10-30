// The ecosystem illustration on the blue left panel of the login and signup pages.

export default function EcosystemSVG() {
  return (
    <svg
      viewBox="0 0 560 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full max-h-[600px] select-none pointer-events-none"
    >
      <defs>
        {/* Dot grid */}
        <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="0.75" fill="rgba(255,255,255,0.1)" />
        </pattern>

        {/* Glow filters */}
        <filter id="glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="softGlow" x="-12%" y="-12%" width="124%" height="124%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Monitor screen */}
        <linearGradient id="screen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0C1F4A" />
          <stop offset="100%" stopColor="#060E20" />
        </linearGradient>

        {/* Tablet screen */}
        <linearGradient id="tabScreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#112060" />
          <stop offset="100%" stopColor="#080F28" />
        </linearGradient>

        {/* Monitor bezel */}
        <linearGradient id="bezel" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2A3C52" />
          <stop offset="100%" stopColor="#18273A" />
        </linearGradient>

        {/* Book left page */}
        <linearGradient id="pageL" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#BDC9D7" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>

        {/* Book right page */}
        <linearGradient id="pageR" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#BDC9D7" />
        </linearGradient>

        {/* Book cover gradient */}
        <linearGradient id="cover1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id="cover2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6D28D9" />
          <stop offset="100%" stopColor="#4C1D95" />
        </linearGradient>

        {/* Light beam rising from the open book */}
        <linearGradient id="beamGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#93C5FD" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Background dot grid */}
      <rect width="560" height="600" fill="url(#dots)" />

      {/* Ambient center glow */}
      <ellipse cx="280" cy="300" rx="200" ry="170" fill="#2563EB" opacity="0.07" filter="url(#glow)" />

      {/* ═══════════════════════════════════════════════ */}
      {/*  1. PC MONITOR — center stage                  */}
      {/* ═══════════════════════════════════════════════ */}
      <g transform="translate(255, 210)">

        {/* Stand neck */}
        <rect x="-7" y="108" width="14" height="40" rx="3" fill="#1F2E40" />
        {/* Stand base */}
        <ellipse cx="0" cy="150" rx="48" ry="6" fill="#141E2B" opacity="0.7" />
        <rect x="-44" y="146" width="88" height="9" rx="4" fill="#1F2E40" />

        {/* Monitor outer frame */}
        <rect x="-185" y="-118" width="370" height="238" rx="14" fill="url(#bezel)" stroke="#3A526B" strokeWidth="1.5" filter="url(#softGlow)" />
        {/* Screen */}
        <rect x="-174" y="-108" width="348" height="218" rx="9" fill="url(#screen)" />

        {/* — Browser chrome bar — */}
        <rect x="-174" y="-108" width="348" height="26" rx="9" fill="#091628" />
        <rect x="-174" y="-96" width="348" height="14" fill="#091628" />
        {/* Window dots */}
        <circle cx="-155" cy="-95" r="4" fill="#EF4444" />
        <circle cx="-141" cy="-95" r="4" fill="#F59E0B" />
        <circle cx="-127" cy="-95" r="4" fill="#10B981" />
        {/* URL bar */}
        <rect x="-100" y="-103" width="140" height="14" rx="7" fill="rgba(255,255,255,0.05)" />

        {/* — App layout — */}
        {/* Left sidebar */}
        <rect x="-174" y="-82" width="56" height="192" fill="#080F1E" />
        {/* Sidebar logo */}
        <rect x="-165" y="-74" width="36" height="36" rx="8" fill="#1565C0" opacity="0.8" />
        <circle cx="-147" cy="-56" r="8" fill="rgba(255,255,255,0.15)" />
        {/* Sidebar nav items */}
        <rect x="-168" y="-26" width="42" height="10" rx="5" fill="#1565C0" />
        <rect x="-168" y="-10" width="42" height="10" rx="5" fill="rgba(255,255,255,0.07)" />
        <rect x="-168" y="6" width="42" height="10" rx="5" fill="rgba(255,255,255,0.07)" />
        <rect x="-168" y="22" width="42" height="10" rx="5" fill="rgba(255,255,255,0.07)" />
        <rect x="-168" y="38" width="42" height="10" rx="5" fill="rgba(255,255,255,0.07)" />
        {/* Sidebar bottom avatar */}
        <circle cx="-147" cy="96" r="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {/* Top header area */}
        <rect x="-110" y="-78" width="130" height="10" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="36" y="-78" width="60" height="10" rx="3" fill="#1565C0" opacity="0.7" />
        <rect x="106" y="-78" width="58" height="10" rx="3" fill="rgba(255,255,255,0.06)" />

        {/* Divider */}
        <line x1="-110" y1="-60" x2="164" y2="-60" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        {/* Main chart card */}
        <rect x="-110" y="-54" width="168" height="100" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        {/* Chart label */}
        <rect x="-102" y="-46" width="60" height="7" rx="3" fill="rgba(255,255,255,0.12)" />
        <rect x="-102" y="-35" width="30" height="12" rx="2" fill="rgba(255,255,255,0.06)" />
        {/* Line chart */}
        <polyline
          points="-100,22 -75,6 -50,14 -25,-8 0,4 25,-10 50,2 75,-12 100,8 130,-6 155,10"
          fill="none"
          stroke="#60A5FA"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polygon
          points="-100,22 -75,6 -50,14 -25,-8 0,4 25,-10 50,2 75,-12 100,8 130,-6 155,10 155,38 -100,38"
          fill="rgba(96,165,250,0.08)"
        />
        {/* Chart dots */}
        <circle cx="-25" cy="-8" r="3.5" fill="#60A5FA" filter="url(#softGlow)" />
        <circle cx="25" cy="-10" r="3.5" fill="#60A5FA" filter="url(#softGlow)" />

        {/* Right panel */}
        <rect x="66" y="-54" width="98" height="100" rx="8" fill="#1565C0" opacity="0.15" stroke="#2563EB" strokeWidth="1" strokeOpacity="0.4" />
        <rect x="74" y="-44" width="50" height="8" rx="3" fill="rgba(255,255,255,0.15)" />
        <circle cx="115" cy="-14" r="18" stroke="#60A5FA" strokeWidth="3" fill="none" strokeDasharray="70 42" />
        <circle cx="115" cy="-14" r="10" fill="rgba(96,165,250,0.15)" />
        <rect x="74" y="16" width="80" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="74" y="26" width="55" height="5" rx="2.5" fill="rgba(255,255,255,0.06)" />

        {/* Bottom stat cards */}
        <rect x="-110" y="54" width="78" height="48" rx="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <rect x="-102" y="62" width="38" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="-102" y="73" width="24" height="14" rx="4" fill="#10B981" opacity="0.6" />
        <rect x="-102" y="91" width="48" height="5" rx="2.5" fill="rgba(255,255,255,0.07)" />

        <rect x="-24" y="54" width="78" height="48" rx="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <rect x="-16" y="62" width="38" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="-8" y="72" width="8" height="22" rx="3" fill="#F59E0B" opacity="0.7" />
        <rect x="4" y="78" width="8" height="16" rx="3" fill="#60A5FA" opacity="0.7" />
        <rect x="16" y="74" width="8" height="20" rx="3" fill="#10B981" opacity="0.7" />
        <rect x="-16" y="91" width="48" height="5" rx="2.5" fill="rgba(255,255,255,0.07)" />

        <rect x="62" y="54" width="102" height="48" rx="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <rect x="70" y="62" width="38" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="70" y="73" width="20" height="7" rx="2" fill="#1565C0" opacity="0.8" />
        <rect x="96" y="73" width="14" height="7" rx="2" fill="rgba(255,255,255,0.1)" />
        <rect x="70" y="85" width="60" height="5" rx="2.5" fill="rgba(255,255,255,0.07)" />
        <rect x="70" y="94" width="40" height="4" rx="2" fill="rgba(255,255,255,0.05)" />
      </g>

      {/* ═══════════════════════════════════════════════ */}
      {/*  2. TABLET — right side, floating              */}
      {/* ═══════════════════════════════════════════════ */}
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-9; 0,0" dur="5.5s" repeatCount="indefinite" />
        <g transform="translate(488, 330) rotate(8)">

          {/* Tablet body */}
          <rect x="-48" y="-88" width="96" height="168" rx="12" fill="#162236" stroke="#2B3F58" strokeWidth="1.5" filter="url(#softGlow)" />
          {/* Tablet screen */}
          <rect x="-40" y="-80" width="80" height="152" rx="8" fill="url(#tabScreen)" />
          {/* Home indicator */}
          <rect x="-16" y="74" width="32" height="4" rx="2" fill="rgba(255,255,255,0.18)" />
          {/* Front camera */}
          <circle cx="0" cy="-83" r="2" fill="#0A1020" />

          {/* Tablet UI */}
          {/* Status bar */}
          <rect x="-34" y="-74" width="68" height="10" rx="3" fill="rgba(255,255,255,0.04)" />
          <rect x="-30" y="-71" width="20" height="4" rx="2" fill="rgba(255,255,255,0.12)" />

          {/* Header card */}
          <rect x="-34" y="-58" width="68" height="30" rx="6" fill="#1565C0" opacity="0.25" stroke="#2563EB" strokeWidth="0.8" strokeOpacity="0.5" />
          <circle cx="-18" cy="-43" r="9" fill="#1565C0" opacity="0.6" />
          <rect x="-4" y="-49" width="28" height="5" rx="2.5" fill="rgba(255,255,255,0.25)" />
          <rect x="-4" y="-40" width="18" height="4" rx="2" fill="rgba(255,255,255,0.12)" />

          {/* Progress ring card */}
          <rect x="-34" y="-22" width="68" height="52" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <circle cx="-10" cy="4" r="16" stroke="#10B981" strokeWidth="3" fill="none" strokeDasharray="60 40" strokeLinecap="round" />
          <circle cx="-10" cy="4" r="8" fill="rgba(16,185,129,0.15)" />
          <rect x="12" y="-4" width="22" height="5" rx="2.5" fill="rgba(255,255,255,0.2)" />
          <rect x="12" y="5" width="14" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
          <rect x="12" y="13" width="18" height="4" rx="2" fill="#10B981" opacity="0.4" />

          {/* Quiz list */}
          <rect x="-34" y="36" width="68" height="16" rx="5" fill="rgba(255,255,255,0.07)" />
          <rect x="-28" y="40" width="30" height="4" rx="2" fill="rgba(255,255,255,0.18)" />
          <rect x="16" y="40" width="14" height="4" rx="2" fill="#60A5FA" opacity="0.5" />

          <rect x="-34" y="58" width="68" height="14" rx="5" fill="#1565C0" opacity="0.35" />
          <rect x="-28" y="62" width="36" height="4" rx="2" fill="rgba(255,255,255,0.3)" />

          {/* Animated sync dashed line to monitor */}
          <path d="M-48,-10 C-90,-20 -150,-60 -210,-80" fill="none" stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.4">
            <animate attributeName="stroke-dashoffset" values="20;0" dur="2.5s" repeatCount="indefinite" />
          </path>
        </g>
      </g>

      {/* ═══════════════════════════════════════════════ */}
      {/* ═══════════════════════════════════════════════ */}
      {/*  3. BOOK STACK — bottom center                  */}
      {/* ═══════════════════════════════════════════════ */}
      <g transform="translate(240, 534)">

        {/* Bottom closed book */}
        <path d="M-115,-10 L105,-10 A5,5 0 0 1 110,-5 L110,5 A5,5 0 0 1 105,10 L-115,10 Z" fill="url(#cover2)" />
        <rect x="98" y="-7" width="8" height="14" rx="2" fill="#CBD5E1" opacity="0.5" />
        <rect x="-115" y="-10" width="12" height="20" fill="#2E1065" opacity="0.5" />

        {/* Middle closed book */}
        <g transform="rotate(-1.5 0 -20)">
          <path d="M-105,-28 L110,-28 A5,5 0 0 1 115,-23 L115,-13 A5,5 0 0 1 110,-8 L-105,-8 Z" fill="url(#cover1)" />
          <rect x="103" y="-25" width="8" height="14" rx="2" fill="#CBD5E1" opacity="0.4" />
          <rect x="-105" y="-28" width="10" height="20" fill="#1E3A8A" opacity="0.6" />
        </g>

        {/* Open book on top */}
        <g transform="translate(0, -50)">
          {/* Book shadow */}
          <path d="M-120,20 C-60,0 -20,-10 0,-10 C20,-10 60,0 120,20 L0,30 Z" fill="#000" opacity="0.25" filter="url(#glow)" />

          {/* Book Cover */}
          <path d="M-115,12 L0,22 L115,12 L115,18 L0,30 L-115,18 Z" fill="#1E3A8A" />
          
          {/* Book Pages Block (Thickness) */}
          <path d="M-110,0 C-50,-5 -20,8 0,15 C20,8 50,-5 110,0 L110,12 C50,7 20,18 0,25 C-20,18 -50,7 -110,12 Z" fill="#CBD5E1" />
          
          {/* Left Page Surface */}
          <path d="M-105,-10 C-50,-15 -20,0 0,10 L0,22 C-20,12 -50,-3 -105,2 Z" fill="url(#pageL)" />
          
          {/* Right Page Surface */}
          <path d="M105,-10 C50,-15 20,0 0,10 L0,22 C20,12 50,-3 105,2 Z" fill="url(#pageR)" />

          {/* Left page content lines */}
          <g stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" opacity="0.4">
            <line x1="-85" y1="-2" x2="-25" y2="4" />
            <line x1="-80" y1="2" x2="-25" y2="8" />
            <line x1="-75" y1="6" x2="-25" y2="12" opacity="0.3" />
            <line x1="-70" y1="10" x2="-25" y2="16" opacity="0.2" />
          </g>
          {/* Highlight left */}
          <line x1="-80" y1="2" x2="-40" y2="6" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" filter="url(#softGlow)" />

          {/* Right page content lines */}
          <g stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" opacity="0.4">
            <line x1="85" y1="-2" x2="25" y2="4" />
            <line x1="80" y1="2" x2="25" y2="8" />
            <line x1="75" y1="6" x2="25" y2="12" opacity="0.3" />
            <line x1="70" y1="10" x2="25" y2="16" opacity="0.2" />
          </g>
          {/* Highlight right */}
          <line x1="80" y1="2" x2="40" y2="6" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" filter="url(#softGlow)" />

          {/* Bookmark ribbon */}
          <path d="M-15,10 L-10,40 L-15,35 L-20,40 Z" fill="#F59E0B" />

          {/* Center Glowing Knowledge Orb */}
          <ellipse cx="0" cy="15" rx="16" ry="6" fill="#60A5FA" opacity="0.6" filter="url(#glow)" />
          <circle cx="0" cy="13" r="4" fill="#FFFFFF" filter="url(#softGlow)" />
          
          {/* Light beam from the book */}
          <path d="M-15,15 L15,15 L60,-200 L-60,-200 Z" fill="url(#beamGrad)" opacity="0.4" />

          {/* Floating Data Particles from Book */}
          <g fill="#93C5FD">
            <circle cx="-15" cy="5" r="2.5">
              <animate attributeName="cy" values="5;-250" dur="4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.9;0" dur="4s" repeatCount="indefinite" />
            </circle>
            <circle cx="15" cy="0" r="2">
              <animate attributeName="cy" values="0;-230" dur="3.5s" repeatCount="indefinite" begin="1s" />
              <animate attributeName="opacity" values="0;0.8;0" dur="3.5s" repeatCount="indefinite" begin="1s" />
            </circle>
            <circle cx="0" cy="-5" r="3" fill="#FCD34D">
              <animate attributeName="cy" values="-5;-270" dur="5s" repeatCount="indefinite" begin="0.5s" />
              <animate attributeName="opacity" values="0;1;0" dur="5s" repeatCount="indefinite" begin="0.5s" />
            </circle>
            <circle cx="-30" cy="10" r="1.5" fill="#10B981">
              <animate attributeName="cy" values="10;-200" dur="4.2s" repeatCount="indefinite" begin="2s" />
              <animate attributeName="opacity" values="0;0.7;0" dur="4.2s" repeatCount="indefinite" begin="2s" />
            </circle>
            <circle cx="30" cy="10" r="2">
              <animate attributeName="cy" values="10;-210" dur="4.8s" repeatCount="indefinite" begin="1.5s" />
              <animate attributeName="opacity" values="0;0.6;0" dur="4.8s" repeatCount="indefinite" begin="1.5s" />
            </circle>
          </g>
        </g>
      </g>

    </svg>
  );
}
