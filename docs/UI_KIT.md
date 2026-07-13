# UI_KIT — Teacher design system (Material 3 tokens + components/ui)

> **Agent workflow:** read this BEFORE touching `components/ui/*`, `tailwind.config.ts`
> token mappings, or restyling any `app/teacher/*` page; update it in the same change
> whenever you alter behavior described here. Index: [README.md](README.md).

**Last verified:** 2026-07-13 (kit introduced; no pages migrated yet).

## Purpose & scope

Single design system for the teacher panel: Material Design 3 tokens (scheme **Ocean Blue**,
**Compact** shape scale, **Elevated** cards, **Shaped** buttons — chosen in the "M3 Theme Lab"
artifact) + a reusable component kit. Goal: pages contain zero raw colors, so the whole UI
re-themes by editing one file. Student/manager/admin trees are NOT migrated and keep their
own styling.

## Key files

| File | Responsibility |
|---|---|
| `components/ui/theme.css` | **Source of truth**: all color tokens (light + `.dark`), shape radii, elevation shadows, state-layer/`m3-*` form-control CSS. Imported once in `app/teacher/layout.tsx`. |
| `tailwind.config.ts` | Maps tokens to utilities (`primary`, `surface-container-*`, `on-surface-variant`, `rounded-m3-*`, `shadow-elev-*`, `state-hover`, `disabled-bg/fg`). References `var(--m3-…)` only — never literal values. |
| `components/ui/*.tsx` | The kit: Button/IconButton, Card/CardHeader, Chip/StatusChip, TextField/TextArea/Select/SearchBar, Switch/Checkbox/Radio, ProgressBar/Spinner/Skeleton, Dialog/ConfirmDialog, Banner, Tabs, Table/Th/TRow/Td/Pagination, ListItem/Avatar/Badge, Menu, EmptyState, StatTile, PageHeader, `uiToast`, `cn`. Barrel: `components/ui/index.ts`. |
| `components/ui/README.md` | Usage guide + class reference for humans. |

## Flows

- Tokens flow: `theme.css` vars → Tailwind utilities (config maps names to `var()`) → components → pages.
- Toasts: `uiToast.success/error/info` wraps `react-hot-toast` with token styles.
- Dark mode: `.dark` token block exists but is **enabled nowhere** (no toggle writes the class yet).

## Invariants & traps

- ⚠️ **Never hard-code colors/radii in teacher pages or kit components** — only token
  utilities or `var(--m3-…)`. Raw hex belongs in `theme.css` exclusively.
- ⚠️ Tailwind mapping adds **new** names only. Do NOT override the default `rounded-*`
  scale or gray palettes — the rest of the app (student/manager/admin, `brand.*` finance
  palette) depends on defaults staying untouched.
- ⚠️ Token colors are plain hex in `var()` → Tailwind **opacity modifiers don't work on
  them** (`bg-primary/50` silently loses the alpha). Use the prebuilt state tokens
  (`state-hover`, `disabled-bg`, `disabled-fg`) or add a `color-mix()` var in `theme.css`.
- ⚠️ `m3-switch`/`m3-checkbox`/`m3-radio`/`m3-spinner`/`m3-skeleton`/`m3-interactive`
  classes live in `theme.css` — kit components break if that file isn't loaded (it's
  imported by the teacher layout; other role trees don't load it).
- ⚠️ One `filled` Button per screen (main action); status colors (success/warning/error)
  are for state only, never decoration.
- TextField/TextArea/Select have an opaque `surface-container-lowest` background so the
  floating-label patch matches on any card — don't make fields transparent.
- `IconButton` requires `aria-label` (typed as mandatory).

## Known issues / dead code (verified 2026-07-13)

- `.dark` theme block is prepared but unreachable (no UI toggles it).
- **Migration status: COMPLETE (2026-07-13).** The ENTIRE `app/teacher/**` tree uses the
  kit — shell/layout, dashboard, create (hub + 11 methods + all _components), classes
  (all tabs/modals/grade), analytics, library (+TestCard), subscription, settings
  (+3 tabs), profile, notifications, students/[id], online-books, print studio, and all
  of IELTS (24 files incl. 9 question builders). Verified: tsc clean; zero raw palette
  classes except the dead `AiLimitCard.tsx` and a commented-out mic block in analytics;
  eslint problem count unchanged (839→838); all routes serve without error.
- **Sweep conventions:** correct answers = success tokens; difficulty =
  success/warning/error (+tertiary/primary for mixed/olympiad) containers; status chips:
  active/graded=success, scheduled=info, pending=warning, closed/archived=muted,
  overdue/destructive=error; deliberately-dark elements = inverse-surface tokens;
  decorative accents rotate primary/secondary/tertiary (hub-card tone per create track);
  band scores: ≥8 success, ≥6.5 warning, else error.
- **Known non-token leftovers (deliberate):** gold/silver/bronze medal inline hex in
  AssignmentsTab submissions; print-output inline styles (`PRINT_CSS`, column rules,
  html-to-image white bg) — they control printed ink, not the theme; Recharts hexes in
  students/[id] pinned to theme values with a comment (SVG attrs can't resolve vars).
  New IconButton aria-labels are hardcoded Uzbek (no dictionary keys existed).
  ⚠️ Printable A4 pages (operations, print studio) use tokens — pin to light values if
  dark mode is ever enabled.

## How to verify changes

`npm run dev` → open any `/teacher/*` page → in DevTools check `document.documentElement`
computed styles expose `--m3-primary: #1364b0`. After migrating a page: confirm it renders
only token utilities (search the file for `#` hex and `bg-slate/indigo` leftovers), check
hover/press state layers on buttons, keyboard focus rings, and a `ConfirmDialog` flow.
Re-theme smoke test: change `--m3-primary` in `theme.css` → every migrated page shifts color.
