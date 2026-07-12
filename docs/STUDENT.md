# STUDENT — Dashboard, Classes, Gamification, Games, Library

> **Agent workflow:** read this BEFORE touching `app/(student)/*`, XP/streak/leaderboard logic, `services/quizService.ts`, `services/historyService.ts`, or `lib/social.ts`. Update this doc in the same change whenever you alter behavior described here. Index: [README.md](README.md).

**Last verified:** 2026-07-12 (commit `7c31a96`).

## Purpose & scope

The student route tree `app/(student)/` (route group, no URL segment): dashboard, classes (assignments + exams), explore, games, history, leaderboard, library, notifications, profile, settings, IELTS (see [IELTS.md](IELTS.md)). All pages consume `useStudentLanguage()` from the layout (uz/en/ru).

## ⚠️ Headline facts that contradict old assumptions

1. **There is no student self-practice flow.** The syllabus API routes (`/api/structure`, `/api/syllabus`) and `quizService.fetchQuestions` (the `questions1` bank query) are consumed ONLY by the teacher app. Students only take teacher-authored tests inside classes.
2. **`services/historyService.ts` is entirely dead** (`saveAttempt`, `getUserHistory`, `fetchReviewQuestions`, the `questionPath` review mechanism — zero consumers). The "legacy practice attempt shape" exists in code but nothing writes or reads it.
3. **`services/userService.ts::updateUserStats` is dead** (zero consumers) — and with it the `users.progress` field. All live XP/streak writing is inlined in two places (below).

## Classes

- **Join by code**: `JoinClassModal` — `classes where joinCode==` (6-char uppercased) → `addDoc(classes/{id}/requests, {studentId, studentName, studentUsername, photoURL, createdAt})`. ⚠️ The explore page uses a **different** request write: `setDoc(.../requests/{uid}, {..., status:'pending'})` (deterministic ID + `status` field). Teacher approval code must tolerate both shapes.
- Class list: `classes where studentIds array-contains uid`. Leave = `arrayRemove` self.
- **Assignments** (`AssignmentsTab`): reads `classes/{id}/assignments` (SWR `getDocs`, paged 10), client-filters `assignedTo`. `allowedAttempts ?? 1`; `0` = unlimited. Open/expired computed from the **device clock** (known weakness).
- **Exams** (`ExamsTab`): live `onSnapshot` (inconsistent with assignments' SWR — intentional as-is).

### The two test runners (do not confuse)

| | Assignment runner | Exam runner |
|---|---|---|
| Route | `classes/[classId]/test/[assignmentId]/` | `student/exam/[examId]/` (`?classId=` param) |
| Template | `custom_tests/{testId}` | `bsb_chsb_tests/{testId}` |
| Attempt doc ID | `${uid}_${assignmentId}` (merge upsert — retakes overwrite; `attemptsTaken: increment`) | `${uid}_${examId}` |
| Attempt shape | `{userId, userName, classId, assignmentId, type:'assignment', testId, testTitle, score, totalQuestions, answers:{qId:letter}, tabSwitches, submittedAt, attemptsTaken, xpEarned}` | `{userId, userName, classId, assignmentId: examId, type:'exam', testId, answers, autoScore, teacherScore:0, totalPoints, tabSwitches, submittedAt}` |
| Grading | client-side `answers[q.id] === q.answer` | auto by type (mcq/TF exact, short_answer lowercase-trim, matching proportional); open_ended → teacher (`manualScores`, `status:'graded'`) |
| XP | yes (see below) | **none** |
| Anti-cheat | visibilitychange + blur/focus, blocking modal, fullscreen, no contextmenu; any switch kills bonuses | visibilitychange toast + counter only (weaker) |
| Completion marker | `assignments.completedBy: arrayUnion` | `exams.submittedStudentIds: arrayUnion` |

⚠️ **Exam attempts overload `assignmentId` with the examId** and set `type:'exam'` — every `attempts` query must branch on `type`. Results visibility: `resultsVisibility ('always'|'after_due'|'never')` OR legacy `showResults` bool. Exam review requires `status==='graded'` AND `!exam.hideResults`.

## Gamification (XP / streak / levels)

**XP is written inline in exactly two places**, each with its own `runTransaction`:

1. **Assignment submit** (`test/[assignmentId]/page.tsx`): per correct answer by `difficulty` string — hard +4 / medium +3 / else +2. First clean attempt (no tab switches): Perfectionist +5 (>80%), Speed Demon +5 (>80% and under half the time limit). Retake: +5 only if >60%, >5 questions, <2 switches. ≥10 previous attempts → 0 XP. Streak bonuses: 7-day +30, 30-day +200. Writes `users`: `totalXP: increment`, `currentStreak`, `dailyHistory[today] += xp`, `lastActiveDate`, `recentActivity` (last 5).
2. **Checkers win** (`games/checkers/page.tsx`): `XP_REWARDS` by mode/difficulty; same user-doc fields (recentActivity last 10).

Key traps:
- **Live writers use `lastActiveDate`; the `UserProfile` interface (and dead code) says `lastStudyDate`.** Trust `lastActiveDate`.
- **Levels are derived, never stored**: `floor(totalXP/1000)+1` (the stored `level:1` from signup is dead).
- **Displayed streak is recomputed from `dailyHistory` keys** (`calculateTrueStreak` on dashboard/profile) — it can differ from the stored `currentStreak`.
- `dailyHistory` keys are **UTC** dates in writers but the dashboard chart uses local-adjusted dates → possible off-by-one near midnight. `dailyHistory` trimmed to last 30 entries on write.
- `dailyGoal` (50/100/200/500, default 200) written from the dashboard modal.

### Leaderboards
- Global: `leaderboards/{periodId}/users/{uid}` `{uid, displayName, avatar, classId, xp: increment, lastActive}`, read `orderBy xp desc limit 20` (+ a "me" getDoc if outside top 20 → rank "20+").
- Period IDs (`getPeriodIds()`, all UTC): `day_YYYY_MM_DD`, `week_YYYY_WW`, `month_YYYY_MM`, `all_time`. ⚠️ **The function is copy-pasted in 3 places** (leaderboard page, assignment runner, checkers) — keep them identical or leaderboards desync.
- On XP>0 a `writeBatch` mirrors into all 4 global period docs; the assignment path ALSO writes the per-class mirror `classes/{classId}/leaderboard/{uid}` — **checkers does not** (game XP invisible in class leaderboards).
- ⚠️ Two counters: `users.totalXP` vs leaderboard `xp` — mirrored only when XP>0; zero-XP submissions update neither. Expect divergence.

## Games / Library / History / Notifications / Social / Explore

- **Checkers** (`active_games/{4-digit code}`): realtime `onSnapshot`; `board` is a JSON **string**; host=red, guest joins only while `status==='waiting'`; forfeit via `status:'forfeit'`. ⚠️ Finished game docs are never deleted (accumulate). AI = minimax in `_components/CheckersAI.ts`. Typing game has no Firestore/XP hooks.
- **Library** (`online_books`): reads the whole collection once, localStorage SWR cache (1h fresh / 24h max). ⚠️ Counters are lowercase **`viewscount`/`downloadscount`**; every open does optimistic +1 → `increment(1)` → resync getDoc — counts are click-counts, not unique.
- **History**: live `attempts where userId== orderBy submittedAt desc` (paged 5), relies on denormalized fields on the attempt (no N+1). Card click routes to the *assignment* results page — exam-type attempts route oddly (known).
- **Notifications**: `where userId== orderBy createdAt limit 50`, 60s SWR, optimistic batch mark-read/clear. ⚠️ Type mismatch: service emits `alert`/`attendance` (page renders default icon), page handles `general` (never emitted). Class-join deliberately sends no notification.
- **Social** (`lib/social.ts`): atomic batch — edges `users/{a}/following/{b}` + `users/{b}/followers/{a}` (`{followedAt}`), ±1 `followersCount`/`followingCount` (the rules carve-out), follow notification. ⚠️ Unfollow has no existence checks — stale state can drive counters negative.
- **Explore**: top teachers `users where role=='teacher' orderBy totalStudents desc` (⚠️ `totalStudents` is Cloud-Function-generated, may be absent) + the divergent join-request shape noted above.

## Caching convention

Student pages use module-level `globalXxxCache` objects (60s) + sometimes localStorage. **Any mutation must also patch the cache object** or the UI goes stale — the pattern is repeated in dashboard, classes, notifications, library, and tabs.

## How to verify changes

`npm run dev`; join a class with a second account, submit an assignment (check the `attempts/{uid}_{assignmentId}` doc, XP increment, leaderboard mirrors), take an exam and grade it as the teacher, play a checkers round. Watch for stale caches after mutations.
