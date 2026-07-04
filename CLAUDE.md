# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Next.js, http://localhost:3000)
npm run build    # Production build
npm run start    # Serve the production build
npm run lint     # ESLint (eslint-config-next: core-web-vitals + typescript)
```

There is no test suite. Verify changes by running the dev server and exercising the flow.

## Stack

Next.js 16 (App Router) · React 19 with the **React Compiler enabled** (`reactCompiler: true` in [next.config.ts](next.config.ts)) · TypeScript · Tailwind CSS 3 · Firebase (client + Admin SDK). Path alias `@/*` maps to the repo root.

> **Note:** [README.md](README.md) describes an early single-purpose "MathMaster" student app and is largely aspirational/outdated. The codebase has grown into a multi-role SaaS platform ("Edify"). Trust the code over the README.

## Architecture

### Multi-role platform
The app serves four roles, each with its own top-level route tree and role-guarded layout:

- **`app/(student)/`** — student dashboard, practice, IELTS, games, leaderboard, classes. Route group `(student)` (no URL segment).
- **`app/(public)/`** — landing, login, signup (route group).
- **`app/teacher/`** — test creation, library, classes, analytics, IELTS, subscription.
- **`app/manager/`** — learning-center management (groups, teachers, attendance).
- **`app/admin/`** — super-admin (teachers, memberships).

**Two different authorization mechanisms — do not confuse them:**
- **Admin** access is gated by a Firebase **custom claim** `super_admin`, checked via `user.getIdTokenResult()` in [app/admin/layout.tsx](app/admin/layout.tsx).
- **student / teacher / manager** roles come from the `role` field on the Firestore `users/{uid}` document (see `UserProfile` in [services/userService.ts](services/userService.ts)).

Layouts are `'use client'` and enforce auth via `onAuthStateChanged` / `useAuth`, redirecting unauthorized users. The teacher layout also provides a `TeacherLanguageContext` and inline uz/ru/en translation dictionaries.

### Firebase
- [lib/firebase.ts](lib/firebase.ts) — **client** SDK singleton. Exports `auth`, `db`, `storage`, `functions`, `remoteConfig` (client-only). Configured from `NEXT_PUBLIC_FIREBASE_*` env vars.
- [lib/firebaseAdmin.ts](lib/firebaseAdmin.ts) — **Admin** SDK (`adminDb`, `adminAuth`) for use **only in API routes / server code**. Configured from `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` (the private key's `\n` are un-escaped at load). Use the Admin SDK server-side to bypass client security rules.
- [lib/AuthContext.tsx](lib/AuthContext.tsx) — `AuthProvider` (wraps the app in the root layout) + `useAuth()` hook exposing `{ user, loading }`. Children only render after `loading` resolves.

Firestore is the source of truth for users, questions, attempts, classes, IELTS tests, AI usage, etc. Business logic lives in **[services/](services/)** (`userService`, `quizService`, `ieltsService`, `historyService`, `notificationService`) — prefer adding data logic there rather than inline in components.

### Content data (local JSON, not Firestore)
The syllabus/navigation hierarchy is stored as **local JSON files** under `data/<track>/<class>/<subject>/syllabus.json`, where track ∈ `maktab` (school), `ixtisoslashtirilgan_maktab`, `abiturient`. Served to the client through API routes rather than imported directly:
- [app/api/structure/route.ts](app/api/structure/route.ts) — lists classes/subjects for a track (reads the directory tree).
- [app/api/syllabus/route.ts](app/api/syllabus/route.ts) — returns one subject's `syllabus.json`.

Because these read the filesystem, they must run on the Node runtime.

### AI features (Google Gemini) & credit limits
AI question generation and analysis use `@google/generative-ai` (`GEMINI_API_KEY`), primarily through [app/api/analyze/route.ts](app/api/analyze/route.ts). Teacher test-creation flows live under `app/teacher/create/*`.

**There are two overlapping AI-credit systems** — know which one a given flow uses:
1. **Daily** — [lib/ai/aiLimitsHelper.ts](lib/ai/aiLimitsHelper.ts) `consumeAiCredits()`: fields `aiDailyQuestionLimit` / `aiQuestionUsedToday` / `aiQuestionLastResetDate`, lazy daily reset in `Asia/Tashkent` time.
2. **Monthly (plan-based SaaS)** — [lib/ai/featureGatekeeper.ts](lib/ai/featureGatekeeper.ts) `checkUserPermission()` + `deductMonthlyAiCredits()`: fields `includedFeatures`, `currentLimits.monthlyAiQuestions`, `usage.aiQuestionsUsed`; `>= 5000` means unlimited. The `useMonthlyLimit` hook ([hooks/useMonthlyLimit.ts](hooks/useMonthlyLimit.ts)) surfaces this to the UI in real time.

Pattern for the monthly system: **check permission → call the AI → deduct only the actual generated count** (so failed generations don't burn credits).

### Text-to-speech
[app/api/tts/route.ts](app/api/tts/route.ts) uses `msedge-tts` (Azure neural voices) and writes to a temp file, so it sets `export const dynamic = 'force-dynamic'` to force the Node runtime. Any API route using native modules or `fs` must do the same.

### Trilingual content
User-facing content and questions are trilingual (`{ uz, ru, en }`). Uzbek is the default UI language. Question/option shapes carry all three languages (see `Question` in [types/index.ts](types/index.ts)).

## Conventions

- Interactive pages/layouts are Client Components (`'use client'`); keep Firebase **Admin** SDK usage strictly in API routes / server modules.
- Route-local UI lives in `_components/` folders (underscore-prefixed → not routable).
- Icons: `lucide-react`. Toasts: `react-hot-toast` (`<Toaster>` mounted in the root layout). Class merging: `clsx` + `tailwind-merge`.
- Math: `katex` / `react-katex` / `mathlive`; render via [components/LatexRenderer.tsx](components/LatexRenderer.tsx).
- The repo root contains scratch/notes files (`all.md`, `xps.md`, `*.txt`, `membership_details/`) — these are documentation/planning notes, not application code.
