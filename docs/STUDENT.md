# STUDENT — Dashboard, Classes, Gamification, Games, Library

> **Agent workflow:** read this BEFORE touching `app/(student)/*`, XP/streak/leaderboard logic, `services/quizService.ts`, `services/historyService.ts`, or `lib/social.ts`. Update this doc in the same change whenever you alter behavior described here. Index: [README.md](README.md).

**Last verified:** 2026-07-20 (student logic overhaul: shared XP engine lib/xp.ts, center features, account-deletion API).

## Purpose & scope

The student route tree `app/(student)/` (route group, no URL segment): dashboard, classes (assignments + exams), explore, games, history, leaderboard, library, notifications, profile, settings, IELTS (see [IELTS.md](IELTS.md)). All pages consume `useStudentLanguage()` from the layout (uz/en/ru).

> 🎨 **Styling lives in [STUDENT_UI.md](STUDENT_UI.md), not here.** The whole tree runs on the student design system — pages use `@/components/student-ui` (never the teacher `@/components/ui`) and carry zero raw colors, so the app re-skins by editing one word in [`design.config.ts`](../design.config.ts). This doc covers logic and data only.

## ⚠️ Headline facts that contradict old assumptions

1. **There is no student self-practice flow.** The syllabus API routes (`/api/structure`, `/api/syllabus`) and `quizService.fetchQuestions` (the `questions1` bank query) are consumed ONLY by the teacher app. Students only take teacher-authored tests inside classes.
2. **`services/historyService.ts` is entirely dead** (`saveAttempt`, `getUserHistory`, `fetchReviewQuestions`, the `questionPath` review mechanism — zero consumers). The "legacy practice attempt shape" exists in code but nothing writes or reads it.
3. **`services/userService.ts::updateUserStats` is dead** (zero consumers) — and with it the `users.progress` field. All live XP/streak writing flows through **`lib/xp.ts`** (`applyUserXp` + `mirrorLeaderboards`), called from the two writers below inside their own transactions.
4. `profile/_components/EditProfileModal.tsx` and the typing game were **deleted 2026-07-20** (both were dead: unimported / unlinked).

## Classes

- **Join by code**: `JoinClassModal` — `classes where joinCode==` (6-char uppercased) → `addDoc(classes/{id}/requests, {studentId, studentName, studentUsername, photoURL, createdAt})`. 🟢 **Center groups (`centerId != ''`) refuse the code** — the modal shows a "managed by the center" toast and the rules also deny the request create; only the manager enrolls ([MANAGER.md](MANAGER.md)). **The class page also hides/guards "Leave Class" for center groups** (self-leave would orphan `center_students` + finance docs); self-leave stays possible for ordinary classes and rules-wise for the deletion flow. ⚠️ The explore page uses a **different** request write: `setDoc(.../requests/{uid}, {..., status:'pending'})` (deterministic ID + `status` field) — it now pre-checks BOTH pending shapes, blocks center groups with a toast, and reports errors via toast. Teacher approval code must tolerate both shapes.
- Class list: `classes where studentIds array-contains uid`. Leave = `arrayRemove` self.
- **Assignments** (`AssignmentsTab`): reads `classes/{id}/assignments` (SWR `getDocs`, paged 10), client-filters `assignedTo`. `allowedAttempts ?? 1`; `0` = unlimited. Open/expired computed from the **device clock** (known weakness). New assignments carry denormalized `duration` (null = no limit) + `resultsVisibility` copied from the test by `AssignTestModal`; the card renders the time-limit chip only when the field exists (legacy docs have neither) and the "proctored" shield keys on `duration > 0 || resultsVisibility === 'never'`.
- **Center groups** additionally get: an **Attendance tab** (`AttendanceTab` — `center_attendance where classId== + date range`, aggregated via `services/attendanceService.ts`; rules already allow the list), the **weekly `schedule[]`** (day 0=Sun / time / `roomName`) + a **center badge** (resolved `centers.name`) in the info modal, the **teacher's contact** (via `POST /api/directory/contact`, student-of-teacher relationship), and a link to **`/center`** — the "My Center" hub (see below).
- **Exams** (`ExamsTab`): live `onSnapshot` (inconsistent with assignments' SWR — intentional as-is).

### The two test runners (do not confuse)

| | Assignment runner | Exam runner |
|---|---|---|
| Route | `classes/[classId]/test/[assignmentId]/` | `student/exam/[examId]/` (`?classId=` param) |
| Template | `custom_tests/{testId}` | `bsb_chsb_tests/{testId}` |
| Attempt doc ID | `${uid}_${assignmentId}` (merge upsert — retakes overwrite; `attemptsTaken: increment`). The runner's attempt-limit guard reads THIS doc's `attemptsTaken` (never count docs — there is only ever one) | `${uid}_${examId}` |
| Attempt shape | `{userId, userName, classId, assignmentId, type:'assignment', testId, testTitle, score, totalQuestions, answers:{qId:letter}, tabSwitches, submittedAt, attemptsTaken, xpEarned}` | `{userId, userName, classId, assignmentId: examId, type:'exam', testId, answers, autoScore, teacherScore:0, totalPoints, tabSwitches, submittedAt}` |
| Grading | client-side `isAnswerCorrect(q, answers[q.id])` ⚠️ (lib/questionSchema.ts — answers may be a letter, a letter[] for `multiple_select`, or typed text for `open`/`numeric`; see [QUESTIONS.md](QUESTIONS.md)) | auto by type (mcq/TF exact, short_answer lowercase-trim, matching proportional); open_ended → teacher (`manualScores`, `status:'graded'`). 🟢 **Auto-release**: an exam with NO `open_ended` questions is published at submit time in the teacher-save shape (`manualScores` per-question, `teacherScore`=auto total, `autoScore:0`, `status:'graded'`) — a later teacher re-grade simply overwrites |
| XP | yes (see below) | **none** |
| Anti-cheat | visibilitychange + blur/focus, blocking modal, fullscreen, no contextmenu; any switch kills bonuses | visibilitychange toast + counter only (weaker) |
| Completion marker | `assignments.completedBy: arrayUnion` | `exams.submittedStudentIds: arrayUnion` |

⚠️ **Exam attempts overload `assignmentId` with the examId** and set `type:'exam'` — every `attempts` query must branch on `type` (the History page now does: exams score `(autoScore+teacherScore)/totalPoints`, show "under review" until graded, and route to `/student/exam/{id}/review?classId=`). Results visibility: `resultsVisibility ('always'|'after_due'|'never')` OR legacy `showResults` bool — **`after_due` with a null `dueAt` now HOLDS results** (runner + results page; it used to reveal immediately) and `AssignTestModal` refuses to save an `after_due` assignment without a deadline. Exam review requires `status==='graded'` AND `!exam.hideResults`.

**Runner data-safety invariants (2026-07-20):** the countdown is clamped to `min(duration, dueAt)` at start AND on session restore (rules reject post-`dueAt` writes, so working past it only lost the attempt); `localStorage` session is cleared **only after** the submit transaction commits (a failed submit keeps the answers recoverable); a `permission-denied` on submit surfaces the deadline toast, not a generic failure.

## Gamification (XP / streak / levels)

**XP has exactly two writers** (assignment submit, checkers) and **one engine**: both run their own `runTransaction` but MUST route the user-doc mutation through `lib/xp.ts::applyUserXp` and the leaderboard writes through `mirrorLeaderboards` **inside that same transaction** — user doc and leaderboards commit atomically (the old separate batch could fail after the transaction and desync `totalXP` vs leaderboard `xp` forever).

1. **Assignment submit** (`test/[assignmentId]/page.tsx`): base XP per correct answer by `difficulty` string (see `XP_BY_DIFFICULTY`). First clean attempt (no tab switches): Perfectionist +5 (>80%), Speed Demon +5 (>80% and under half the time limit). Retake: +5 only if >60%, >5 questions, <2 switches. ≥10 previous attempts → 0 XP. `recentActivity` last 5.
2. **Checkers** (`games/checkers/page.tsx`): wins only — `XP_REWARDS` by mode/difficulty, **losses and draws pay 0**; capped by `GAMES_DAILY_XP_CAP` (60/UTC-day, tracked in `users.gamesDaily {date, xp}`); an online game decided by forfeit with `< 10` moves pays 0 (collusion guard, `active_games.moveCount`). `recentActivity` last 10. Mirrors into **every class the student belongs to** (game XP used to be invisible on class leaderboards).

**The engine adds, for BOTH writers** (`lib/xp.ts`): streak advance + 7-day +30 / 30-day +200 bonuses, **daily-goal bonus** (+25 the first time a UTC day's XP crosses `users.dailyGoal`, once per day via `users.dailyGoalRewardedOn`), **level-up bonus** (+50 when `floor(totalXP/1000)+1` increases, plus a `levelup` notification via `notifyLevelUp`), the 30-entry `dailyHistory` trim, and the `recentActivity` slice.

Key traps:
- **Live writers use `lastActiveDate`; the `UserProfile` interface (and dead code) says `lastStudyDate`.** Trust `lastActiveDate`.
- **The stored streak/`lastActiveDate` only move on writes with XP > 0** — zero-XP submissions no longer keep a stored streak alive that the displayed streak (recomputed from `dailyHistory`) would show as broken, which also closes the old zero-XP-submit path to the 7/30-day bonuses.
- **Levels are derived, never stored**: `floor(totalXP/1000)+1` (the stored `level:1` from signup is dead).
- **Displayed streak is recomputed from `dailyHistory` keys**, never read from the stored `currentStreak` (which can differ).
- `dailyHistory` keys are **UTC** dates (`toISOString().slice(0,10)`) — in the writers AND now in every reader. [lib/xpDays.ts](../lib/xpDays.ts) (`xpDayKey`, `calculateStreak`, `last7Days`) is the single source of that convention; the student layout, dashboard, profile and the teacher student-detail page all import it. They each used to re-derive the key from **device-local** time, so east of UTC (Tashkent = UTC+5) every key between 00:00 and 05:00 local named a day the writers never wrote — today's XP read as 0 and the streak broke overnight. Don't reintroduce a local-time day key. `dailyHistory` is trimmed to the last 30 entries on write.
- `dailyGoal` (50/100/200/500, default 200) written from the dashboard modal.

### Leaderboards
- Global: `leaderboards/{periodId}/users/{uid}` `{uid, displayName, avatar, classId, xp: increment, lastActive}`, read `orderBy xp desc limit 20` (+ a "me" getDoc if outside top 20 → rank "20+").
- Period IDs (`getPeriodIds()`, all UTC): `day_YYYY_MM_DD`, `week_YYYY_WW`, `month_YYYY_MM`, `all_time`. 🟢 **ONE implementation in [lib/xpDays.ts](../lib/xpDays.ts)** — the leaderboard page, the XP engine and the account-deletion API all import it. Never re-derive the ISO-week formula locally.
- On XP>0 `mirrorLeaderboards` writes all 4 global period docs + per-class mirrors **in the same transaction as the user doc**: the assignment path mirrors its class, checkers mirrors every class the student is in.
- Two counters: `users.totalXP` vs leaderboard `xp` — mirrored only when XP>0 (zero-XP events touch neither, by design); with the mirrors now transactional the historic drift source is closed.

## Games / Library / History / Notifications / Social / Explore

- **Checkers** (`active_games/{4-digit code}`): realtime `onSnapshot`; `board` is a JSON **string**; host=red; the guest **joins in a transaction** asserting `status==='waiting' && guest==null` (closes the double-join hijack); `moveCount: increment(1)` per move. Exit is unified in `handleExitToMenu`: unstarted room → doc deleted, live game → counts as forfeit (`status:'forfeit'`), finished game → doc deleted best-effort (finished docs used to accumulate forever; tab-close still leaks a ghost room — known). Rules are STRICT Russian shashki, centralized in `_components/rules.ts` (flying kings; mandatory captures and full chain completion; captured pieces stay as dead "ghost" blockers until the chain ends; a king that can continue capturing from some landing square must land there; a man crowned mid-chain continues as king). The online doc field `mustJumpPiece` now stores the whole chain state `{pos, ghosts}` (JSON string, name kept for shape continuity); `winner` may also be `'draw'` (threefold repetition or 30 quiet king moves, detected by the mover). AI = `_components/engine.ts` (full-chain negamax, alpha-beta, iterative deepening, quiescence, transposition table) running in a Web Worker (`_components/aiWorker.ts`) — level 5 thinks ~2.6s and is effectively unbeatable; levels 1–4 inject scored near-best mistakes. Board has 3 switchable themes (wood/green/slate, `localStorage checkers_board_theme`) and synthesized WebAudio sounds (`_components/sounds.ts`, mute in `localStorage checkers_muted`). The typing game was deleted (dead).
- **Library** (2026-07-20): `app/(student)/library/page.tsx` is a **1:1 copy of `app/teacher/online-books/page.tsx`** (only the language hook and a direct `components/ui/theme.css` import differ — the M3 tokens otherwise load only via the teacher layout). Books come from the **local `data/library_books.json`**, filters/drawer/counters are all client-local; the page no longer reads or writes the Firestore `online_books` collection at all. When the teacher page changes, re-copy it. (The old Firestore-backed implementation with `viewscount`/`downloadscount` increments is gone from the student side; `online_books` + its lowercase-counter trap now only matter to whoever still writes that collection.)
- **History**: live `attempts where userId== orderBy submittedAt desc` (paged 5), relies on denormalized fields on the attempt (no N+1). Card click routes to the *assignment* results page — exam-type attempts route oddly (known).
- **Notifications**: `where userId== orderBy createdAt limit 50`, 60s SWR, optimistic batch mark-read/clear. Types are reconciled: the union (service + page, keep in sync) is `'assignment' | 'request' | 'levelup' | 'general'` — exactly the types with real emitters (`AssignTestModal`, follow in lib/social.ts, `lib/xp.ts::notifyLevelUp`) plus the default-icon catch-all. Class-join deliberately sends no notification.
- **Social** (`lib/social.ts`): `toggleFollowUser` + `removeFollower` are **transactions** that read the edge first and NO-OP when the stored state already matches (stale-UI double-follow / phantom-unfollow can no longer drift counters); counters are written as clamped computed values (never < 0, delta stays within the rules ±1 carve-out). The follow notification is sent AFTER the transaction (best-effort, so a retry can't duplicate it).
- **Explore**: top teachers `users where role=='teacher' orderBy totalStudents desc` (⚠️ `totalStudents` is Cloud-Function-generated, may be absent) + the divergent join-request shape noted above (now with center-group refusal, both-shape pending pre-check, and toast feedback).

## Account deletion & settings (2026-07-20)

- **Deletion is server-side**: `settings/page.tsx` reauthenticates, then `POST /api/account/delete` (Bearer token; Admin SDK). The route deletes attempts (students can't — teacher-only rule; the old client flow ABORTED for anyone with ≥1 attempt), notifications, class membership + per-class leaderboard rows + join requests (both shapes, via a `requests` collection-group query — `firestore.indexes.json` has the field override), the 4 current global leaderboard docs, the social graph **both directions with clamped counter decrements**, `private/*`/`bookmarks`/`test_stats`, RASCH docs, checkers rooms, `center_students` links + `center_student_credentials`, `usernames/{name}`, the user doc, the storage photo (best-effort) and finally the Auth user. **Finance docs are intentionally kept** (append-only money, FINANCE.md).
- **Center-managed accounts** (`users.accountType === 'center-managed'`): the password form is replaced with a "managed by your center" note — a self-change would desync the manager's stored recovery credential (`center_student_credentials`) and the synthetic email has no inbox for resets ([AUTH.md](AUTH.md)).

## "My Center" hub (`/center`) + center surfacing

- **Membership is `center_students`-derived, never class-derived** — `services/studentCenterService.ts::fetchMyCenters` queries `center_students where studentId == uid` (the rules explicitly allow own-reads) + resolves `centers.name`, 60s module cache. A student can belong to several centers or to a center with zero groups.
- **`/center`** (`app/(student)/center/page.tsx`) is the ONE center page: per center — identity header, groups + weekly schedule chips (linking to the class page), attendance (last ~92 days across the center's groups via `center_attendance` classId+date queries + `tallyStudent`), and finance (balance/charges/payments from `GET /api/student/finance`; Admin-SDK route keyed strictly to the caller's own uid — finance rules stay manager-only, never query those collections from the client). The old `/payments` page was absorbed into this hub and deleted.
- **Surfacing**: the dashboard shows a center banner (below the hero) and the profile identity card shows a center chip — both work with zero groups and link to `/center`; the class info modal's center badge links there too.

## Explore is hidden (2026-07-20)

`/explore` redirects to `/dashboard` and its nav item is removed; the implementation is preserved (not routable) in `app/(student)/explore/_disabled_page.tsx` — restore by moving it back over `page.tsx` and re-adding the layout nav item. The join-request guard notes above still describe that preserved code.

## Charts

Every recharts chart mounts inside [components/ChartFrame.tsx](../components/ChartFrame.tsx), which measures its own box and passes numeric `width`/`height` to the chart. **Do not go back to `<ResponsiveContainer width="100%" height="100%">`**: its default `initialDimension` is `-1 × -1`, so on the first pass of every mount it renders nothing and logs *"The width(-1) and height(-1) of chart should be greater than 0…"*. The frame also leaves the chart unmounted inside a zero-sized (hidden/collapsed) parent instead of warning. Give the frame its size via `className`; the chart takes `width`/`height` from the render prop.

## The dashboard's two "levels" (they measure different things)

- **Level** (the stat tile) is XP: `floor(totalXP/1000)+1` — how much the student has *done*.
- **Mathematics level** (`MathLevelSummary`, under the stat grid) is Rasch ability θ mapped to 0–3 — how hard a problem the student can *solve*. It is the same card the Rasch hub (`/RASCHmodel`) shows, reading the same `RASCH_levels/{uid}` document through the same 12h localStorage cache in `services/RASCHProgressService.ts`, so mounting it on the dashboard costs no extra read on a warm cache. It renders `null` until that read resolves.

## Caching convention

Student pages use module-level `globalXxxCache` objects (60s) + sometimes localStorage. **Any mutation must also patch the cache object** or the UI goes stale — the pattern is repeated in dashboard, classes, notifications, library, and tabs.

## How to verify changes

`npm run dev`; join a class with a second account, submit an assignment (check the `attempts/{uid}_{assignmentId}` doc, XP increment, leaderboard mirrors in the SAME snapshot), retake past `allowedAttempts` (must block via `attemptsTaken`), take a no-open-ended exam (result must show instantly), play a checkers round (win pays, loss pays 0), open a center group (attendance tab, schedule, payments link), and delete a throwaway account that has attempts (must succeed via the API). Watch for stale caches after mutations.
