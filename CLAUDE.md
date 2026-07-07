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

> **Attendance work:** read [docs/ATTENDANCE.md](docs/ATTENDANCE.md) first — it's the source of truth
> for the student + staff attendance system (data model, security rules, deploy, and the non-obvious
> traps). It supersedes the one-line `center_attendance` note in the data model below.
>
> **Room / timetable work:** read [docs/ROOMS.md](docs/ROOMS.md) first — the `rooms` collection,
> per-slot room assignment on `classes.schedule`, the conflict engine (`services/roomService.ts`), and
> the weekly timetable. Center-only; standalone teachers are unaffected.
>
> **Finance work:** read [docs/FINANCE_PLAN.md](docs/FINANCE_PLAN.md) first — charges/payments
> ledger (`center_charges`, `center_payments`, `center_student_finance`, `center_finance_settings`),
> the iron rules (append-only money, snapshot prices, integer so'm, API-only writes via
> `/api/manager/finance/*` + [lib/server/financeOps.ts](lib/server/financeOps.ts), every client query
> filters `centerId ==`), and the pure billing engine in [lib/finance/billingEngine.ts](lib/finance/billingEngine.ts).
> Collection-by-collection map + which docs change per UI action: [docs/FINANCE_DATABASE.md](docs/FINANCE_DATABASE.md).

### Multi-role platform
The app serves four roles, each with its own top-level route tree and role-guarded layout:

- **`app/(student)/`** — student dashboard, practice, IELTS, games, leaderboard, classes. Route group `(student)` (no URL segment).
- **`app/(public)/`** — landing, login, signup (route group).
- **`app/teacher/`** — test creation, library, classes, analytics, IELTS, subscription.
- **`app/manager/`** — learning-center management (groups, teachers, attendance).
- **`app/admin/`** — super-admin (teachers, memberships, learning centers).

> **Admin center management:** `app/admin/centers/` (directory, detail tabs, creation) is built on
> [services/centerAdminService.ts](services/centerAdminService.ts) (client reads via god-mode rules) and
> `app/api/admin/centers/*` API routes (Admin SDK) for privileged ops: create center+manager, password
> reset link, transfer ownership, cascade delete. Every `/api/admin/*` route must call `requireSuperAdmin()`
> from [lib/server/verifySuperAdmin.ts](lib/server/verifySuperAdmin.ts); the client calls them through
> [lib/adminApi.ts](lib/adminApi.ts) (attaches the ID token). Plan/decisions: [docs/ADMIN_CENTERS_PLAN.md](docs/ADMIN_CENTERS_PLAN.md).
> `centers.adminStatus` ('active'|'archived') and `centers.adminNotes` are admin-only bookkeeping fields.
>
> **Center approval gate:** `centers.status` ∈ 'pending'|'active'|'suspended' (missing = pending).
> Public manager signup writes 'pending'; rules REQUIRE 'pending' on create and only let owners edit
> name/slug/size. All manager WRITE privileges in [firestore.rules](firestore.rules) go through
> `isActiveCenterManager()` (status must be 'active'); reads use plain `isCenterManager()` so a pending
> manager still sees their (empty) panel. The manager layout wraps pages in
> [app/manager/_components/ApprovalGate.tsx](app/manager/_components/ApprovalGate.tsx) — a notice card +
> click-blocking overlay with the admin's contact info. Admin approves/suspends via `/admin/centers`
> (quick Approve on pending rows) or the detail Overview tab. Teacher attendance writes are NOT gated
> (deliberate: lessons continue during disputes). Rules changes need `firebase deploy --only firestore:rules`.

**Two different authorization mechanisms — do not confuse them:**
- **Admin** access is gated by a Firebase **custom claim** `super_admin`, checked via `user.getIdTokenResult()` in [app/admin/layout.tsx](app/admin/layout.tsx).
- **student / teacher / manager** roles come from the `role` field on the Firestore `users/{uid}` document (see `UserProfile` in [services/userService.ts](services/userService.ts)).

Layouts are `'use client'` and enforce auth via `onAuthStateChanged` / `useAuth`, redirecting unauthorized users. The teacher layout also provides a `TeacherLanguageContext` and inline uz/ru/en translation dictionaries.

### Firebase
- [lib/firebase.ts](lib/firebase.ts) — **client** SDK singleton. Exports `auth`, `db`, `storage`, `functions`, `remoteConfig` (client-only). Configured from `NEXT_PUBLIC_FIREBASE_*` env vars.
- [lib/firebaseAdmin.ts](lib/firebaseAdmin.ts) — **Admin** SDK (`adminDb`, `adminAuth`) for use **only in API routes / server code**. Configured from `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` (the private key's `\n` are un-escaped at load). Use the Admin SDK server-side to bypass client security rules.
- [lib/AuthContext.tsx](lib/AuthContext.tsx) — `AuthProvider` (wraps the app in the root layout) + `useAuth()` hook exposing `{ user, loading }`. Children only render after `loading` resolves.

Firestore is the source of truth for users, questions, attempts, classes, IELTS tests, AI usage, etc. Business logic lives in **[services/](services/)** (`userService`, `quizService`, `ieltsService`, `historyService`, `notificationService`) — prefer adding data logic there rather than inline in components.

### Firestore data model
Reconstructed from actual reads/writes across services + route `_components`. Field types are inferred; **timestamps are inconsistent** across the codebase — some writers use `serverTimestamp()` (Timestamp), some `new Date()` (Timestamp), some `new Date().toISOString()` (string), some `Date.now()` (number). Check the specific writer before comparing/ordering. Doc IDs noted per collection.

**Accounts & identity**
- `users/{uid}` — master account doc for **all roles**; doc ID = Auth uid. Union of role-specific fields: identity (`email`, `username` (lowercased), `displayName`, `role` ∈ student|teacher|manager|admin, `phone`, `birthDate`, `gender`, `institution`, `location{country,region,district}`, `photoURL`, `bio`, `createdAt` ISO). Student gamification: `totalXP`, `currentStreak`, `level`, `lastStudyDate`/`lastActiveDate`, `dailyHistory{dateStr:number}`, `progress{completedTopicIndex,completedChapterIndex,completedSubtopicIndex}`, `dailyGoal`, `recentActivity[]`. Teacher: `subject`, `grade`, `verifiedTeacher`, `experience`, `createdTests[]`, cloud-generated `activeClassCount`/`totalStudents`. Manager: `centerId`. **Legacy daily AI limits**: `aiDailyQuestionLimit`/`aiQuestionUsedToday`/`aiQuestionLastResetDate`. **SaaS monthly engine**: `subscription{planId,billingCycle,status,expiresAt}`, `currentLimits{maxClasses,maxStudents,monthlyAiQuestions}`, `includedFeatures`, `usage{aiQuestionsUsed,aiLimitResetDate}`. Social: `followersCount`/`followingCount`. Moderation: `isActive`. Queried by `role ==`, `email ==`.
- `users/{uid}/following/{targetUid}` & `users/{uid}/followers/{followerUid}` — social graph edges (doc ID = other user's uid), field `followedAt`. See [lib/social.ts](lib/social.ts).
- `usernames/{lowercaseUsername}` — uniqueness reservation; doc ID = lowercased username, field `uid`. `checkUsernameUnique()` checks existence.

**Question banks** (note: **three separate** question stores)
- `questions1/{autoId}` — global master bank, **bulk-imported externally, read-only in app**. Query fields are **strings, zero-padded**: `topicId`, `chapterId`/`subtopicId` (`"05"`), `difficultyId` **number** 1/2/3, `orderBy uploadedAt desc`. Content shape (`question{uz,ru,en}`, `options{A,B,C,D}`, `answer`) per [types/index.ts](types/index.ts). Needs composite index topicId+chapterId+subtopicId+difficultyId+uploadedAt.
- `teacher_questions/{autoId}` — teacher-owned bank (AI/image/manual). `creatorId`, `creationMethod`, `track`, `difficulty` (lowercase string) + `difficultyId` (number), `tags[]`, `language[]`, `solutions[]`, spread question content. Queried by `creatorId ==`, `difficulty ==`, `creationMethod ==`.
- `reported_questions/{questionId}` — moderation reports (doc ID = reported question id, dedupes). `reasons[]`/`reportedBy[]` (arrayUnion), `reportCount` (increment), `status`.

**Classes & center management**
- `classes/{classId}` — teacher- or center-owned class. `title`, `joinCode`, `teacherId`, `teacherName`, `studentIds[]`, `studentCount`, `isLocked`, `schedule[{dayOfWeek,startTime,endTime}]`. Queried by `teacherId ==`/`in`, `joinCode ==`, `studentIds array-contains`.
  - `.../assignments/{autoId}` — practice test assigned to class; `testId`→`custom_tests`, `openAt`/`dueAt`, `assignedTo` ('all'|uid[]), `allowedAttempts`, `completedBy[]` (arrayUnion on submit).
  - `.../exams/{autoId}` — scheduled graded exam; `testId`→`bsb_chsb_tests`, `examDate`, `hideResults`, `submittedStudentIds[]`.
  - `.../materials/{autoId}` — files/links; `fileUrl`, `storagePath`, `isVisible`/`isArchived`, `viewCount`/`downloadCount`, `orderIndex`.
  - `.../requests/{autoId | studentUid}` — join requests (doc ID varies by entry point). `studentId`, `studentName`, `status`.
  - `.../leaderboard/{uid}` — per-class XP mirror; `xp` (increment), `lastActive`.
- `centers/{centerId}` — learning center (created at manager signup). `name`, `slug`, `ownerUid`, `subscription{plan,validUntil}`.
- `center_teachers/{teacherUid}` — center↔teacher link (doc ID = teacher uid). `centerId`, `teacherName`, `teacherEmail`, `addedAt`. Queried by `centerId ==`.
- `center_attendance/{classId}_{YYYY-MM-DD}` — daily attendance; doc ID = `${classId}_${date}`. `records` is now `{ studentUid: { status, method, markedBy, markedAt, note?, confidence? } }` plus `lessonStatus`/`weekday`; also `center_staff_attendance/{staffUid}_{date}` for teacher attendance. **See [docs/ATTENDANCE.md](docs/ATTENDANCE.md) for full shapes — the old flat `records{uid:status}` is legacy-tolerated but no longer written.**

**Tests & submissions**
- `custom_tests/{autoId}` — teacher practice tests; `teacherId`, `accessCode`, `duration`, `shuffle`, `resultsVisibility`, `questions[]`, `questionCount`.
- `bsb_chsb_tests/{autoId}` — formal graded assessments; `teacherId`, `assessmentType`, `grade`, `subject`, `totalPoints`, `questions[]`. Index teacherId+createdAt desc.
- `attempts/{autoId}` — **polymorphic** submission doc (shape depends on `type`). Common: `userId`, `userName`, `classId`, `assignmentId`, `type` ('assignment'|'exam'), `testId`, `answers`, `tabSwitches`, `submittedAt`. Assignment adds `score`/`xpEarned`; exam adds `autoScore`/`teacherScore`/`totalPoints`, then on grading `manualScores`/`status:'graded'`. **Legacy practice shape** (`historyService.QuizAttempt`): `subtopicName`, `date`, `results[{questionId,isCorrect,questionPath,...}]` where `questionPath` is a full doc path used for review lookups. Heavily queried: `userId ==`, `classId ==`, `assignmentId ==`/`in`, `type ==`, `orderBy submittedAt desc`.

**IELTS** (partly unbuilt — see warning below)
- `ielts_groups/{groupId}` — study group; `targetBand`, `joinCode` (starts `"I-"`), `teacherId`, `studentIds[]`. Type `IeltsGroup` in [types/ielts.ts](types/ielts.ts).
  - `.../requests/{autoId}` — join requests; `studentId`, `requestedAt`.
- `ielts_reading_tests/{test_id}` — reading test content (doc ID = provided `test_id`); spreads arbitrary payload + `teacherId`, `status:'published'`. Written by [services/ieltsService.ts](services/ieltsService.ts).
- ⚠️ **`types/ielts.ts` also declares `IeltsMasterTest` (`ielts_tests`), `IeltsAssignment` (`ielts_groups/{id}/assignments`), `IeltsAttempt` (`ielts_attempts`) — but no live reads/writes exist for these. They are planned/not-yet-wired; don't assume they hold data.**

**Leaderboards, library, AI, games**
- `leaderboards/{periodId}/users/{uid}` — global leaderboards bucketed by period (`getPeriodIds()`); `xp` (increment), `lastActive`.
- `online_books/{bookId}` — library catalog (bulk-managed). ⚠️ counters are **`viewscount`/`downloadscount`** (not camelCase); `description{en,uz,ru}`, `parts[]`.
- `ai_sessions/{sessionId}` — saved teacher AI-analytics chats; `teacherId`, `messages[]`.
- `ai_usage/{userId}_{YYYY-MM-DD}` — server-side daily AI counter (rate limiting, doc ID = `${userId}_${date}`), `count`. **Distinct from** the `usage.aiQuestionsUsed` field on `users`.
- `notifications/{autoId}` — recipient in `userId`, `type` ∈ assignment|submission|request|result|alert, `read`, `link`, `createdAt`. Index userId+createdAt desc and userId+read.
- `active_games/{code}` — realtime checkers state (doc ID = 4-digit room code); `host`/`guest`, `status`, `board` (JSON string), `turn`, `winner`.

**Known schema inconsistencies to watch** (don't "fix" blindly — external writers/rules may depend on them):
- Question content differs between `questions1` (`difficultyId` number) and `teacher_questions`/`attempts` (`difficulty` lowercase string).
- `online_books` counters are `viewscount`/`downloadscount`, not camelCase.
- `attempts` is polymorphic across three shapes (assignment / exam / legacy practice) — always branch on `type` (or presence of `results`).
- Timestamp field types are not uniform (see intro above).

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
