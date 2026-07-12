# AUTH — Authentication, Roles & SSO

> **Agent workflow:** read this BEFORE touching auth, signup, login, role guards, SSO, or `firestore.rules` helper functions. Update this doc in the same change whenever you alter behavior described here. Index of all docs: [README.md](README.md).

**Last verified:** 2026-07-12 (commit `7c31a96`).

## Purpose & scope

How users sign up, log in, get a role, and get authorized — client-side (layout guards, security rules) and server-side (API-route verifiers) — plus the SSO hand-off to partner apps.

## Key files

| File | Responsibility |
|---|---|
| `lib/firebase.ts` | Client SDK singleton (`auth`, `db`, …) |
| `lib/firebaseAdmin.ts` | Admin SDK (`adminAuth`, `adminDb`, `adminStorage`); env `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` (`\n` un-escaped at load) |
| `lib/AuthContext.tsx` | `AuthProvider` + `useAuth()` → `{user, loading}`. Renders children only after first auth resolution (`{!loading && children}`) |
| `app/(public)/auth/login/page.tsx` | Login, role-based redirect, forgot-password, SSO auto-redirect |
| `app/(public)/auth/signup/_components/{Student,Teacher,Manager}SignupFlow.tsx` | Per-role signup wizards |
| `lib/sso.ts` + `app/api/sso/token/route.ts` | SSO custom-token mint for partner apps (e.g. tez-yozish typing trainer) |
| `lib/server/verifySuperAdmin.ts` | `requireSuperAdmin(request)` — gates every `/api/admin/*` route |
| `lib/server/verifyCenterManager.ts` | `requireActiveCenterManager(request)` — gates every `/api/manager/*` route; returns `{uid, centerId}` |
| `lib/adminApi.ts` / `lib/managerApi.ts` | Client fetch wrappers attaching `Authorization: Bearer <idToken>`. **`managerApiFetch` is a re-export alias of `adminApiFetch`** — same client code; only the server-side verifier differs |
| `firestore.rules` (top) | Role helper functions (see below) |

**Not auth despite the name:** `lib/api.ts` is a syllabus-name→ID lookup. **Stale notes, do not trust:** `lib/aouth.txt`, `lib/fireba.md` (old "WASPAI" design docs — predate manager/admin roles, wrong redirect paths).

## The two authorization mechanisms (never confuse them)

1. **`super_admin`** — Firebase **custom claim**. Read via `getIdTokenResult()` client-side, `decoded.super_admin === true` server-side, `request.auth.token.super_admin` in rules. **No code in this repo sets it** — it is provisioned out-of-band (gcloud/admin script). God-mode rule: `match /{document=**} { allow read, write: if isSuperAdmin(); }` (firestore.rules:58-60).
2. **student / teacher / manager** — plain **`role` field on `users/{uid}`** (no claim). Checked by layouts via `getUserProfile()`.

## Flows

### Signup (all client-side, per-role wizard)
Common: `createUserWithEmailAndPassword` → `updateProfile(displayName)` → one atomic `writeBatch` (`users/{uid}` + `usernames/{lowerUsername}`, manager also `centers/{autoId}`) → commit → SSO check (`getSsoReturnTo` → `completeSsoRedirect`) **before** the normal dashboard redirect. On any error: `deleteUser(auth.currentUser)` rolls back the orphaned Auth account.

- Password ≥ 8 chars. Username ≥ 5 chars, starts with a letter, `[a-zA-Z0-9_]`.
- Username availability: debounced 800ms `checkUsernameUnique` with in-memory cache — **fails open** (network error → treated as available); the batch create against immutable `usernames/{name}` is the real uniqueness guarantee.
- **Student** → `/dashboard`. Writes gamification zeros: `totalXP:0, currentStreak:0, level:1, dailyHistory:{}, progress:{...}`, `location:{country:'Uzbekistan',...}`, `createdAt` ISO string.
- **Teacher** → `/teacher/dashboard`. Writes `subject`, `grade:'Teacher'`, `verifiedTeacher:false`, `experience:0`.
- **Manager** → `/manager/dashboard`. 3 steps; phone regex `+998 XX XXX XX XX`; auto-slugified center name (**slug format is NOT validated in the public flow** — only the admin API route validates it). Writes `users` doc (`role:'manager'`, `centerId`) + `centers` doc: `{id, name, slug, ownerUid, size, status:'pending', subscription:{plan:'free_trial', validUntil:+14d ISO}, createdAt}`.

### Login (`app/(public)/auth/login/page.tsx` ~460-495)
`signInWithEmailAndPassword`, then precedence:
1. SSO `returnTo` pending → `completeSsoRedirect` and stop.
2. `getIdTokenResult(true)` → `super_admin` claim → `/admin`.
3. `users/{uid}` doc; missing → "Profile not found" error.
4. `role`: teacher → `/teacher/dashboard`, manager → `/manager/dashboard`, else `/dashboard`.

Already-signed-in users landing on the login page with `?returnTo=` are auto-SSO-redirected (one-shot `onAuthStateChanged`).

### Password reset
Login page "forgot password" → `sendPasswordResetEmail` (needs email typed in the field; no separate page). Admin can mint a reset link for a center owner via `POST /api/admin/centers/[id]/manager` action `reset-password`.

### SSO (partner hand-off)
Partner sends the user to login/signup with `?returnTo=<callbackURL>`:
1. `getSsoReturnTo()` validates the `returnTo` **origin** against `NEXT_PUBLIC_SSO_ALLOWED_ORIGINS` (comma-separated). Default when unset: `["http://localhost:3000"]` → **production SSO is dead unless this env var is set**.
2. `completeSsoRedirect()`: client's ID token → `POST /api/sso/token` (Bearer) → server `verifyIdToken` then `createCustomToken(uid)`.
3. Redirect `returnTo + '#sso_token=' + token` — token in the **URL fragment** so it never hits server logs. Partner signs in with `signInWithCustomToken`.

Security invariant: the caller proves identity with its own ID token, so SSO can never sign someone into a different account.

## Layout guards (all `'use client'`, useEffect + redirect)

| Layout | Check | Failure behavior |
|---|---|---|
| `app/admin/layout.tsx` | `super_admin` claim via `getIdTokenResult(true)` | not admin / error → `/`; renders `null` until resolved |
| `app/(student)/layout.tsx` | `role` from profile | manager/teacher → their dashboards. ⚠️ **Fails OPEN**: profile-read error → `setIsAuthorized(true)` |
| `app/teacher/layout.tsx` | `role === 'teacher'` | manager → `/manager/dashboard`, other → `/dashboard`; no explicit error catch |
| `app/manager/layout.tsx` | `role === 'manager'` + resolves center name & `status` for `ApprovalGate` | **Fails CLOSED**: error → `/auth/login` |

## firestore.rules helpers

- `isAuth()`, `isOwner(userId)`, `isParentOf(studentId)` (checks `parents/{uid}.children`).
- `isCenterManager(centerId)` — ownerUid match only. **READ-level checks only.**
- `isActiveCenterManager(centerId)` — ownerUid **AND** `status == 'active'`. **All manager WRITE privileges go through this.** Missing `status` = pending = blocked.
- `isTeacherInMyCenter(teacherUid)` / `isTeacherOfCenter(centerId)` — via `center_teachers/{teacherUid}` link docs.
- `isSuperAdmin()` + god-mode wildcard match.
- `centers`: create requires `ownerUid == uid` AND `status == 'pending'` (no self-approval); owner update `hasOnly(['name','slug','size'])`. Activation happens only via god-mode client write from `/admin/centers` or Admin SDK.
- `usernames`: public read; create-if-absent with own uid; owner delete; **update: false** (immutable).
- `users`: read if authed; owner create/delete/update, plus a carve-out allowing any authed user a ±1 delta on `followersCount`/`followingCount` only (social follow, `lib/social.ts`).

## Invariants & traps

- **Usernames are always lowercased** — in `users.username`, in the `usernames/{id}` doc ID, and in the availability check.
- **Pending-center gate is triple-enforced**: rules (`isActiveCenterManager`), server (`requireActiveCenterManager`), UX (`ApprovalGate.tsx` overlay). The rules are the security boundary; the component is UX only.
- Rules changes require `firebase deploy --only firestore:rules`.
- Center approval by admin is a **raw client `updateDoc`** on `centers.status`, legal only because of god-mode — there is no approve API route.
- Manager ownership transfer (`/api/admin/centers/[id]/manager` action transfer) mutates `role`/`centerId` on both users; `oldOwnerAction` ∈ demote-teacher | demote-student | keep.

## Known issues / dead code (verified 2026-07-12 — don't "fix" without deciding deliberately)

- Student layout fails open vs manager fails closed (inconsistent security posture).
- `users.level` is written at signup but never updated afterwards (`updateUserStats` touches only `totalXP`/`currentStreak`).
- `getUserProfile(uid, email?, displayName?)` — trailing params unused.
- `lib/api.ts` has leftover `console.log` debug spam.
- Public manager signup does not validate slug format (admin route does).

## How to verify changes

No test suite. `npm run dev`, then exercise: signup per role (check `users` + `usernames` docs), login redirect per role, a pending manager hitting `ApprovalGate`, SSO round-trip with `NEXT_PUBLIC_SSO_ALLOWED_ORIGINS=http://localhost:3001` and a fake `?returnTo=`. Rules edits: deploy to a test project or use the emulator before production deploy.
