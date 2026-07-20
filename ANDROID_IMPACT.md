# Android impact ledger

One line per change that the Android manager app (`/home/matimatik/AndroidStudioProjects/EdifyManager`)
must mirror. Consumed (and pruned back to this header) by the Android repo's `/sync-web` command.

Format: `- YYYY-MM-DD | <files> | <what the Android app must mirror>`

<!-- Synced through web commit 03a2093 PLUS the uncommitted working tree of 2026-07-19
     (centerId-anchored membership, manager-created teacher/student accounts,
     center_students roster, manager-only center groups) — consumed 2026-07-19. -->
- 2026-07-20 — student-logic overhaul (lib/xp.ts, app/(student)/*, AssignTestModal, lib/server/directory.ts, app/api/account/delete, app/api/student/finance, firestore.indexes.json) — shapes/contracts the Android manager app must mirror: `classes/*/assignments` docs now carry denormalized `duration|null` + `resultsVisibility` (absent on legacy docs; `after_due` requires dueAt); `users` gains `gamesDaily{date,xp}` + `dailyGoalRewardedOn`; `active_games` gains `moveCount`; exam `attempts` with no open_ended questions arrive pre-graded (`manualScores`/`teacherScore`/`status:'graded'`) from the student runner; `POST /api/directory/contact` now also authorizes student→their-teacher; new `POST /api/account/delete` deletes the caller's `center_students` links + `center_student_credentials` (finance docs kept) — manager roster/credential panels must tolerate those docs disappearing; new read-only `GET /api/student/finance`; `firestore.indexes.json` adds a COLLECTION_GROUP fieldOverride on `requests.studentId` (deploy indexes).
