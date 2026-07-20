import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // 🟢 Asosiy shrift oilasini Jakarta ga almashtiramiz
      fontFamily: {
        sans: ['var(--font-jakarta)', 'sans-serif'],
      },
      // 🟢 Moliya brend palitrasi ("Yashil CRM" dizayn yo'nalishi).
      // line = yashil-kulrang card border; ink = to'q yashil matn.
      colors: {
        brand: {
          page: "#f0f7f3",
          25: "#F6FBF8",
          50: "#F0F8F4",
          100: "#E2F5EB",
          200: "#C7E9D8",
          600: "#0BA360",
          700: "#078A50",
          800: "#0A7A4A",
          ink: "#122B1F",
          line: "#DFEAE3",
        },
        // 🔵 Teacher design system (Material 3 "Ocean Blue").
        // Values live in components/ui/theme.css — edit THERE, not here.
        // Usage: bg-primary, text-on-primary, bg-primary-container, bg-surface,
        // bg-surface-container-low, text-on-surface-variant, border-outline-variant…
        primary: {
          DEFAULT: "var(--m3-primary)",
          container: "var(--m3-primary-container)",
        },
        "on-primary": {
          DEFAULT: "var(--m3-on-primary)",
          container: "var(--m3-on-primary-container)",
        },
        secondary: {
          DEFAULT: "var(--m3-secondary)",
          container: "var(--m3-secondary-container)",
        },
        "on-secondary": {
          DEFAULT: "var(--m3-on-secondary)",
          container: "var(--m3-on-secondary-container)",
        },
        tertiary: {
          DEFAULT: "var(--m3-tertiary)",
          container: "var(--m3-tertiary-container)",
        },
        "on-tertiary": {
          DEFAULT: "var(--m3-on-tertiary)",
          container: "var(--m3-on-tertiary-container)",
        },
        error: {
          DEFAULT: "var(--m3-error)",
          container: "var(--m3-error-container)",
        },
        "on-error": {
          DEFAULT: "var(--m3-on-error)",
          container: "var(--m3-on-error-container)",
        },
        success: {
          DEFAULT: "var(--m3-success)",
          container: "var(--m3-success-container)",
        },
        "on-success-container": "var(--m3-on-success-container)",
        warning: {
          DEFAULT: "var(--m3-warning)",
          container: "var(--m3-warning-container)",
        },
        "on-warning-container": "var(--m3-on-warning-container)",
        surface: {
          DEFAULT: "var(--m3-surface)",
          dim: "var(--m3-surface-dim)",
          "container-lowest": "var(--m3-surface-container-lowest)",
          "container-low": "var(--m3-surface-container-low)",
          container: "var(--m3-surface-container)",
          "container-high": "var(--m3-surface-container-high)",
          "container-highest": "var(--m3-surface-container-highest)",
        },
        "on-surface": {
          DEFAULT: "var(--m3-on-surface)",
          variant: "var(--m3-on-surface-variant)",
        },
        outline: {
          DEFAULT: "var(--m3-outline)",
          variant: "var(--m3-outline-variant)",
        },
        "inverse-surface": "var(--m3-inverse-surface)",
        "inverse-on-surface": "var(--m3-inverse-on-surface)",
        "inverse-primary": "var(--m3-inverse-primary)",
        scrim: "var(--m3-scrim)",
        "state-hover": "var(--m3-state-hover)",
        "disabled-bg": "var(--m3-state-disabled-bg)",
        "disabled-fg": "var(--m3-state-disabled-fg)",
        // 🎓 Student design system additions (app/(student)/**).
        // Values live in components/student-ui/theme.css and are switched from
        // design.config.ts. Additive only — nothing above is modified.
        background: "var(--m3-background)",
        "on-background": "var(--m3-on-background)",
        // Translucent variants. Token colors are plain hex in var(), so the
        // `/opacity` modifier does NOT work on them — use these instead of
        // writing bg-surface/85 (which silently renders opaque).
        "surface-blur": "var(--m3-surface-blur)",
        "surface-glass": "var(--m3-surface-glass)",
        "background-blur": "var(--m3-background-blur)",
        "scrim-bg": "var(--m3-scrim-bg)",
        "state-press": "var(--m3-state-press)",
        "surface-variant": "var(--m3-surface-variant)",
        "surface-bright": "var(--m3-surface-bright)",
        gold: {
          DEFAULT: "var(--m3-gold)",
          container: "var(--m3-gold-container)",
        },
        "on-gold": {
          DEFAULT: "var(--m3-on-gold)",
          container: "var(--m3-on-gold-container)",
        },
        "on-success": "var(--m3-on-success)",
        "on-warning": "var(--m3-on-warning)",
        flame: "var(--s-flame)",
        "medal-gold": "var(--s-medal-gold)",
        "medal-silver": "var(--s-medal-silver)",
        "medal-bronze": "var(--s-medal-bronze)",
        "medal-ink": "var(--s-medal-ink)",
      },
      // M3 shape scale (new names only — default rounded-* stays untouched).
      borderRadius: {
        "m3-xs": "var(--m3-shape-xs)",
        "m3-sm": "var(--m3-shape-sm)",
        "m3-md": "var(--m3-shape-md)",
        "m3-lg": "var(--m3-shape-lg)",
        "m3-xl": "var(--m3-shape-xl)",
        "m3-btn": "var(--m3-shape-button)",
        "m3-fab": "var(--m3-shape-fab)",
      },
      // 🎓 Student spacing rhythm — driven by design.config.ts › Density.
      spacing: {
        "s-page-x": "var(--s-page-x)",
        "s-page-y": "var(--s-page-y)",
        "s-gap": "var(--s-gap)",
        "s-gap-lg": "var(--s-gap-lg)",
        "s-card": "var(--s-card-pad)",
        "s-row": "var(--s-row-h)",
        "s-row-x": "var(--s-row-pad-x)",
        "s-section": "var(--s-section-gap)",
      },
      transitionTimingFunction: {
        "m3-std": "var(--s-e-std)",
        "m3-spring": "var(--s-e-spring)",
      },
      transitionDuration: {
        "m3-fast": "var(--s-t-fast)",
        "m3-med": "var(--s-t-med)",
        "m3-slow": "var(--s-t-slow)",
      },
      boxShadow: {
        "elev-1": "var(--m3-elev-1)",
        "elev-2": "var(--m3-elev-2)",
        "elev-3": "var(--m3-elev-3)",
      },
    },
  },
  plugins: [],
};
export default config;