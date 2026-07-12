# MANAGER — Learning-Center Core (Groups, Teachers, Students)

> **Agent workflow:** read this BEFORE touching `app/manager/*` (outside attendance/rooms/finance, which have their own docs), `hooks/useCenterClasses.ts`, `services/checkInService.ts`, or center-related rules. Update this doc in the same change whenever you alter behavior described here. Index: [README.md](README.md).
>
> Subsystem docs: attendance → [ATTENDANCE.md](ATTENDANCE.md) · rooms/timetable → [ROOMS.md](ROOMS.md) · finance → [FINANCE.md](FINANCE.md) + [FINANCE_DATABASE.md](FINANCE_DATABASE.md).

**Last verified:** 2026-07-12 (commit `7c31a96`).

## Purpose & scope

Everything a learning-center manager does outside the attendance/rooms/finance subsystems: center lifecycle & approval, groups (classes), teacher links, student enrollment, walk-in check-in, and the manager API pattern.

## Key files

| File | Responsibility |
|---|---|
| `app/manager/layout.tsx` | Role gate (`role==='manager'`, fail-closed), resolves center name + `status`, wraps pages in `ApprovalGate` |
| `app/manager/_components/ApprovalGate.tsx` | pending/suspended notice + click-blocking overlay (UX only — rules are the boundary) |
| `hooks/useCenterClasses.ts` | **THE center-membership derivation**: `center_teachers where centerId==X` → teacherIds → chunked `classes where teacherId in [...]` (10 per chunk) |
| `app/manager/groups/**` | Group list, create modal, detail tabs (roster / schedule / oversight / settings) |
| `app/manager/teachers/page.tsx` | `center_teachers` link management |
| `app/manager/students/page.tsx` | Center-wide unique-student view (uses attendance `fetchCenterSessions` for today's status) |
| `services/checkInService.ts` | Walk-in / front-desk check-in engine (writes the same `center_attendance` docs as the grid) |
| `lib/managerApi.ts` | `managerApiFetch` = re-export of `adminApiFetch` (Bearer token attach) |
| `lib/server/verifyCenterManager.ts` | `requireActiveCenterManager` — gates all `/api/manager/*` |
| `app/api/manager/user-photo/route.ts` | Manager sets/deletes teacher/student photos (Admin SDK + Storage) |

## Center lifecycle

Signup (see [AUTH.md](AUTH.md)) creates `centers/{id}` with `status:'pending'`. Status mapping in the layout: `active` → normal; `suspended` → gate; anything else/missing → `pending` → gate. What each status can do:
- **All statuses can READ** (rules allow reads via plain `isCenterManager`), so a pending manager sees their (empty) panel.
- **Only `active` can WRITE** — enforced by `isActiveCenterManager()` in rules AND `requireActiveCenterManager` on every `/api/manager/*` route. The `ApprovalGate` overlay (admin contact: phone/telegram in the component) is UX only.
- Owner can self-edit only `name/slug/size` on the center doc; `status`/`subscription`/`ownerUid` are admin-only.

## ⚠️ THE core invariant: center membership is teacher-anchored

**A class belongs to a center iff its `teacherId` is currently linked in `center_teachers`.** The `centerId` field written on class create (`CreateGroupModal.tsx`) is **dead for membership derivation** — `useCenterClasses`, group-detail authz, and the user-photo route all derive membership via `center_teachers`, never via `classes.centerId`. (Exception: the **admin cascade-delete** selects classes by `classes.centerId` — see [ADMIN.md](ADMIN.md); this duality is the live hazard.)

Consequences:
- Removing a teacher from `center_teachers` silently drops all their classes (and those students) from the center — no cascade, no warning, classes stay in Firestore orphaned.
- Reassigning a class to an out-of-center teacher removes it from the center; `centerId` goes stale (reassignment never updates it).
- One center per teacher: `center_teachers` doc ID **must equal teacher uid** (enforced in rules + UI checks).

## Groups (classes)

- **Create** (client `addDoc`): `{title, description, joinCode (6-char random), centerId, teacherId, teacherName, studentIds:[], studentCount:0, isLocked:false, createdAt}`. Teacher must be picked from `center_teachers`. ⚠️ `studentCount` is written 0 and never maintained — all UI uses `studentIds.length`.
- **Detail authz**: re-checks `center_teachers where centerId==mine AND teacherId==class.teacherId`; empty → redirect.
- **Roster tab**: remove = `arrayRemove(uid)` on `studentIds`. ⚠️ No finance cleanup on removal (add DOES stamp `enrollmentDates` — asymmetry).
- **Schedule tab**: edits `classes.schedule` = `[{dayOfWeek, startTime, endTime, roomId?, roomName?}]`. Room/teacher conflict + capacity checks (`roomService.findScheduleConflicts`) are **advisory** — manager can save over them.
- **Settings tab**: title/description, `monthlyFee` (integer so'm; 0/empty = not billed — finance seam), teacher reassignment (sets `teacherId`+`teacherName` only).

## Teachers

- Link doc `center_teachers/{teacherUid}`: `{centerId, teacherId, teacherName, teacherEmail, addedAt}`.
- **Add**: lookup by email (`users where email==`), require `role=='teacher'`; if already linked to a *different* center → blocked with "must be removed first" (manager UI never steals; admin UI can). No teacher account creation — links existing accounts only.
- **Remove**: `deleteDoc` — see the core invariant above for the fallout.
- Center teachers get center-scoped read on rooms/attendance via rules helper `isTeacherOfCenter`.

## Students

- **No student account creation.** Managers enroll existing student accounts: exact email lookup, `usernames/{name}` lookup, or pick from the center's other classes. Enroll = `arrayUnion(uid)` on `classes.studentIds` + fire-and-forget `patchStudentFinanceApi(uid, {enrollmentDates:{[classId]: today}})` (billing proration stamp; best-effort `.catch(()=>{})`).
- ⚠️ Rules allow ANY authed user a `studentIds`-only diff update on ANY class (`diff().hasOnly(['studentIds'])`) — this single broad branch serves both student self-join and manager add.
- `students/page.tsx` builds one row per unique student across center classes; today's status comes from one `fetchCenterSessions(centerId, today, today)` list query (per-doc `get` would be denied for stale-centerId docs — deliberate).

## Walk-in check-in (`services/checkInService.ts`)

Engine-agnostic front-desk capture used by the "Tez davomat" tab (`WalkInCheckIn.tsx`), designed for a future face kiosk:
- `buildCenterRoster(classes)` — dedupe union of studentIds → hydrate from `users`.
- `computeTodayLessons` (pure, uses pre-fetched sessions map — the one actually used) vs `resolveTodayLessons` (async variant).
- `checkInStudent` — **surgical merge** of one student's record into `center_attendance/{classId}_{date}` (update `records.{uid}` if doc exists, else create full day-doc with `lessonStatus:'held'`). Writes the SAME docs the attendance grid reads — see [ATTENDANCE.md](ATTENDANCE.md) for shapes. Omits `confidence` when undefined (Firestore rejects `undefined`).

## API pattern

Client: `managerApiFetch(url, {method, body})` attaches the ID token. Server: every `/api/manager/*` route calls `requireActiveCenterManager(request)` first → `{uid, centerId}`. Example: `user-photo` route (POST base64 ≤3MB → Storage `profile_images/{uid}.jpg` + `users.photoURL`; DELETE reverses) — its `assertTargetInCenter` mirrors the teacher-anchored membership derivation.

## Known issues / dead code (verified 2026-07-12)

- `classes.centerId` — dead for reads (except admin cascade delete), goes stale on reassignment.
- `classes.studentCount` — never maintained.
- Username-uniqueness race at signup (debounced check only; batch has no create-guard on `usernames`).
- `ManagerOversightTab` relies on a `|| true` in the assignments read rule (world-readable to any authed user).
- Social-follow-style negative-counter risks don't apply here, but conflict checks being advisory means double-booked rooms can exist in data — don't assume schedule data is conflict-free.

## How to verify changes

`npm run dev`; log in as a manager; exercise: create group → add teacher → enroll student (check `enrollmentDates` stamp) → edit schedule with a deliberate room clash (warning but saveable) → walk-in check-in (check the `center_attendance` doc) → remove teacher and observe classes drop from the center.
