# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The doc-first workflow (MANDATORY)

This repo maintains verified per-domain docs in [docs/](docs/) so an agent can load exactly the context it needs. **The contract:**

1. **Before touching code**, look up your area in the routing table below (full table + doc template: [docs/README.md](docs/README.md)) and read that doc. For ANY Firestore read/write change, also read [docs/DATA_MODEL.md](docs/DATA_MODEL.md).
2. **Code** the change, respecting the doc's "Invariants & traps". Things marked dead/inconsistent are documented deliberately — don't "fix" them blindly; external writers/rules may depend on them.
3. **After the change, update the doc in the same commit** if you altered any behavior it describes (flows, fields, routes, rules, traps, dead code). New subsystem → new doc from the template in docs/README.md + a row in both routing tables.
4. If a doc contradicts the code, trust the code, then fix the doc.

| Touching… | Read first |
|---|---|
| Auth, signup/login, roles, layout guards, SSO, rules helpers | [docs/AUTH.md](docs/AUTH.md) |
| Any Firestore collection/field/index | [docs/DATA_MODEL.md](docs/DATA_MODEL.md) |
| `app/(student)/*` — runners, XP/leaderboards, games, library, social | [docs/STUDENT.md](docs/STUDENT.md) |
| `app/teacher/*` — test creation, classes, grading, analytics, subscription | [docs/TEACHER.md](docs/TEACHER.md) |
| AI routes, credit limits, `lib/ai/*`, `/api/analyze`, TTS | [docs/AI.md](docs/AI.md) |
| `app/manager/*` core — approval gate, groups, teachers, enrollment, walk-in | [docs/MANAGER.md](docs/MANAGER.md) |
| Attendance (student + staff) | [docs/ATTENDANCE.md](docs/ATTENDANCE.md) |
| Rooms / timetable / schedule conflicts | [docs/ROOMS.md](docs/ROOMS.md) |
| Finance (charges, payments, payroll, expenses) | [docs/FINANCE.md](docs/FINANCE.md) + [docs/FINANCE_DATABASE.md](docs/FINANCE_DATABASE.md) |
| `app/admin/*`, `/api/admin/*`, god-mode | [docs/ADMIN.md](docs/ADMIN.md) |
| IELTS | [docs/IELTS.md](docs/IELTS.md) |
| Teacher UI kit — `components/ui/*`, M3 tokens, restyling `app/teacher/*` | [docs/UI_KIT.md](docs/UI_KIT.md) |

## Commands

```bash
npm run dev      # Start dev server (Next.js, http://localhost:3000)
npm run build    # Production build
npm run start    # Serve the production build
npm run lint     # ESLint (eslint-config-next: core-web-vitals + typescript)

npx firebase-tools deploy --only firestore:rules,firestore:indexes   # after ANY rules/indexes edit
```

There is **no test suite** — verify by running the dev server and exercising the flow (each doc ends with a concrete walkthrough). ⚠️ Never run a bare `firebase deploy`: `firebase.json` has a `functions` block but no `functions/` dir exists — it fails at predeploy. Firebase project: `scanqr-64512`.

## Stack

Next.js 16 (App Router) · React 19 with the **React Compiler enabled** (`reactCompiler: true` in [next.config.ts](next.config.ts)) · TypeScript · Tailwind CSS 3 · Firebase (client + Admin SDK) · Google Gemini (`gemini-2.5-flash`). Path alias `@/*` = repo root.

> [README.md](README.md) describes an early "MathMaster" app and is outdated; `membership_details/`, `lib/aouth.txt`, `lib/fireba.md`, and root scratch files (`all.md`, `xps.md`, `*.txt`) are stale planning notes — trust code + docs/ over all of them.

## Architecture in one screen

Multi-role SaaS ("Edify") with four role trees, each with a `'use client'` role-guarded layout:

- **`app/(student)/`** (no URL segment) — dashboard, classes (assignment/exam runners), games, leaderboard, library, IELTS.
- **`app/(public)/`** — landing, login, signup, pricing.
- **`app/teacher/`** — test creation (8 methods), library, classes, analytics, IELTS, subscription.
- **`app/manager/`** — learning-center management: groups, teachers, students, attendance, rooms/timetable, finance.
- **`app/admin/`** — super-admin: centers, teachers, students, classes, memberships.

**Two authorization mechanisms — never confuse them:** admin = Firebase custom claim `super_admin` (set out-of-band, god-mode rules wildcard); student/teacher/manager = `role` field on `users/{uid}`. Details: [docs/AUTH.md](docs/AUTH.md).

**Firebase:** [lib/firebase.ts](lib/firebase.ts) = client SDK (components/services); [lib/firebaseAdmin.ts](lib/firebaseAdmin.ts) = Admin SDK (**API routes/server only** — bypasses rules). [lib/AuthContext.tsx](lib/AuthContext.tsx) provides `useAuth()`. Server guards: `requireSuperAdmin` (`/api/admin/*`), `requireActiveCenterManager` (`/api/manager/*`).

**Data logic lives in [services/](services/)** (user, quiz, ielts, notification, attendance, room, finance, checkIn, centerAdmin) — add there, not inline in components. Firestore is the source of truth; the syllabus hierarchy is **local JSON** under `data/` served by `/api/structure` + `/api/syllabus` (Node runtime — they read the filesystem).

**Center membership is teacher-anchored:** a class belongs to a center iff its `teacherId` is in `center_teachers` — `classes.centerId` is NOT used for membership (only the admin cascade-delete uses it). See [docs/MANAGER.md](docs/MANAGER.md).

**Finance iron rules:** append-only money, snapshot prices, integer so'm, API-only writes via `/api/manager/finance/*` + [lib/server/financeOps.ts](lib/server/financeOps.ts), every client query filters `centerId ==`. See [docs/FINANCE.md](docs/FINANCE.md).

## Cross-cutting traps (the ones that bite regardless of domain)

- **Never write `undefined` to Firestore** — build optional fields conditionally.
- **Timestamps are inconsistent by collection** (serverTimestamp vs ISO string vs `YYYY-MM-DD` key vs number) — check the writer before comparing/ordering. Table in [docs/DATA_MODEL.md](docs/DATA_MODEL.md).
- **`attempts` is polymorphic** — always branch on `type` ('assignment'|'exam'); exam docs overload `assignmentId` with the examId.
- **Rules `list` queries must not call `get()` per document** — use the split `get`(strict)/`list: if isAuth()` pattern (attendance) or a provable constant-path check (finance).
- Date keys for attendance/finance are Asia/Tashkent via [lib/dateUtils.ts](lib/dateUtils.ts); gamification/`ai_usage` use UTC — don't mix. XP day keys (`users.dailyHistory`) go through [lib/xpDays.ts](lib/xpDays.ts) on both sides; never re-derive one from device-local time.
- Charts go in [components/ChartFrame.tsx](components/ChartFrame.tsx), never `<ResponsiveContainer width="100%" height="100%">` (it mounts at `-1 × -1` and warns on every mount).
- `online_books` counters are lowercase `viewscount`/`downloadscount`.
- Join codes / access codes have **no uniqueness checks** anywhere.
- API routes using `fs`/native modules need `export const dynamic = 'force-dynamic'` (see `/api/tts`).
- Known-dead code is catalogued per doc ("Known issues / dead code") — e.g. `historyService`, `updateUserStats`, daily AI credits, `/api/stt`. Don't build on it; don't delete without a deliberate decision.

## Conventions

- Interactive pages/layouts are Client Components; Admin SDK strictly in API routes/server modules.
- Route-local UI in `_components/` folders. Icons: `lucide-react`. Toasts: `react-hot-toast`. Class merging: `clsx` + `tailwind-merge`. Math: `katex`/`mathlive` via [components/LatexRenderer.tsx](components/LatexRenderer.tsx).
- User-facing content is trilingual `{uz, ru, en}`; Uzbek is the default UI language. Teacher pages use inline `TRANSLATIONS` dicts + `useTeacherLanguage()`; student pages use `useStudentLanguage()`.
- AI flows follow **check permission → generate → deduct actual count** with the monthly gatekeeper ([docs/AI.md](docs/AI.md)).
- Student pages use module-level 60s caches — mutations must patch the cache too.

## Android manager app sync (required)

A native Android port of the **manager panel** lives at `/home/matimatik/AndroidStudioProjects/EdifyManager` and mirrors this repo's manager logic 1:1. Whenever a change touches manager-facing behavior, any Firestore document shape/query, `firestore.rules`, or a `/api/manager|directory|auth` contract: **append one line to [ANDROID_IMPACT.md](ANDROID_IMPACT.md)** in the same change (date, files, one-line summary of what the Android app must mirror). The Android repo's `/sync-web` command consumes that ledger plus the git diff.
