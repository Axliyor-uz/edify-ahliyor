# DATA MODEL — Firestore Collection Reference

> **Agent workflow:** read this BEFORE adding/changing any Firestore read or write, and update it in the same change when you add a collection, field, or index. Domain docs explain the flows; this file is the collection-by-collection truth. Index of docs: [README.md](README.md).

**Last verified:** 2026-07-12 (commit `7c31a96`) — every entry below was verified against actual reads/writes in code, not inferred.

Conventions: **Writer** says which SDK writes it (client = browser SDK under security rules; admin = Admin SDK in API routes, bypasses rules). ⚠️ marks traps. Timestamps are **inconsistent across the codebase** — see the table at the bottom; always check the specific writer before comparing/ordering.

## Accounts & identity

- **`users/{uid}`** — master doc for all roles; doc ID = Auth uid. Writer: client (signup flows, profile, XP transactions), admin UIs via god-mode, `deductMonthlyAiCredits` (admin SDK). Union of role fields:
  - Identity: `email`, `username` (**always lowercased**), `displayName`, `role` ∈ student|teacher|manager, `phone`, `birthDate`, `gender`, `institution`, `location{country,region,district}`, `photoURL`, `bio`, `createdAt` (ISO string). Moderation: `isActive`.
  - Student gamification: `totalXP`, `currentStreak`, `level` (⚠️ written 1 at signup, never updated — levels are derived `floor(totalXP/1000)+1`), `lastActiveDate` (⚠️ live field; the `lastStudyDate` in `UserProfile` interface is dead), `dailyHistory{YYYY-MM-DD: xp}` (UTC keys, trimmed to 30), `dailyGoal`, `recentActivity[]`, `progress{...}` (⚠️ dead — writer is unwired).
  - Teacher: `subject`, `grade:'Teacher'`, `verifiedTeacher`, `experience`; `activeClassCount`/`totalStudents`/`customTestCount` are ⚠️ Cloud-Function-generated (functions not in repo — may be absent).
  - Teacher SaaS: `subscription{planId,billingCycle,status,expiresAt}`, `currentLimits{maxClasses,maxStudents,monthlyAiQuestions}`, `includedFeatures[]`, `usage{aiQuestionsUsed,aiLimitResetDate}` (see [AI.md](AI.md)). Legacy daily fields `aiDailyQuestionLimit`/`aiQuestionUsedToday`/`aiQuestionLastResetDate` are ⚠️ dead (no enforcement).
  - Manager: `centerId`. Social: `followersCount`/`followingCount` (rules allow any authed user ±1 delta on these two only).
  - Queried by: `role ==`, `email ==`, `orderBy totalStudents desc` (explore).
- **`users/{uid}/following/{targetUid}`**, **`users/{uid}/followers/{followerUid}`** — social edges, `{followedAt}`. Writer: client (`lib/social.ts`, atomic batch with counters + notification).
- **`usernames/{lowercaseUsername}`** — uniqueness reservation, `{uid}`. Immutable (rules: update false). Writer: client signup batches, admin center-create route.

## Question banks (three separate stores — never mix)

- **`questions1/{autoId}`** — global master bank, bulk-imported externally, read-only in app. Only consumer: `quizService.fetchQuestions` (used solely by `app/teacher/create/database/`). Query traps: `topicId` string **NOT padded**; `chapterId`/`subtopicId` strings **zero-padded to 2**; `difficultyId` **number** 1/2/3; `subjectId` param exists but is **ignored**; `orderBy uploadedAt desc` (needs composite index). Content: `question{uz,ru,en}`, `options{A..D}`, `answer`.
- **`teacher_questions/{id}`** — teacher-owned bank. Doc ID normally `tq_${autoId}` (⚠️ AI save-to-bank path writes doc key = raw autoId but `id` field = `tq_...`). Fields: `creatorId`, `creationMethod`, `track`, `difficulty` (lowercase string) + `difficultyId` (number, olympiad=4), `tags[]`, `language[]`, `solutions[]`, trilingual content, `uploadedAt` ISO + `createdAt` serverTimestamp. Queried by `creatorId ==`, `difficulty ==`, `creationMethod ==`.
- **`reported_questions/{questionId}`** — doc ID = reported question id (dedupes). `reasons[]`/`reportedBy[]` (arrayUnion), `reportCount` (increment), `status`.

## Classes & center management

- **`classes/{classId}`** — teacher- or center-created class. Writer: client. `{title, description, joinCode (⚠️ random, no uniqueness check), teacherId, teacherName, studentIds[], studentCount (⚠️ always 0, never maintained — use studentIds.length), isLocked, schedule[{dayOfWeek,startTime,endTime,roomId?,roomName?}], createdAt (Timestamp), monthlyFee? (int so'm, finance), centerId? (manager-created only)}`.
  ⚠️ **`centerId` is NOT how center membership is derived** — membership = teacherId linked in `center_teachers` (see [MANAGER.md](MANAGER.md)). Exception: admin cascade-delete selects by `centerId`. Queried by `teacherId ==`/`in`, `joinCode ==`, `studentIds array-contains`. Rules: any authed user may write a `studentIds`-only diff (broad — serves self-join + manager add).
  - `.../assignments/{autoId}` — `{testId→custom_tests, testTitle, questionCount, openAt, dueAt|null, assignedTo:'all'|uid[], allowedAttempts (0=∞), completedBy[] (arrayUnion), status:'active' (static), teacherId, createdAt}`. ⚠️ Read rule contains `|| true` — world-readable to authed users.
  - `.../exams/{autoId}` — `{testId→bsb_chsb_tests, title, assessmentType, examDate, durationMinutes, hideResults, submittedStudentIds[], status:'scheduled', teacherId, createdAt}`.
  - `.../materials/{autoId}` — `{fileUrl, storagePath|null, isExternal, externalUrl, fileType/Size/Extension, isVisible, isArchived, orderIndex (Date.now()), viewCount/downloadCount, uploaderId, createdAt}`.
  - `.../requests/{autoId | studentUid}` — ⚠️ **two shapes**: JoinClassModal `addDoc {studentId, studentName, studentUsername, photoURL, createdAt}` vs explore `setDoc(/{uid}) {..., status:'pending'}`. Tolerate both.
  - `.../leaderboard/{uid}` — per-class XP mirror `{xp: increment, lastActive, ...}`; written by assignment submits only (⚠️ not by checkers).
- **`centers/{centerId}`** — `{id, name, slug, ownerUid, size, status ('pending'|'active'|'suspended'; missing=pending), subscription{plan,validUntil} (display-only, unenforced), createdAt (ISO), adminStatus? ('active'|'archived'), adminNotes?}`. Writers: client signup (status forced 'pending' by rules), admin god-mode client writes (status/name/notes), admin API (born 'active').
- **`center_teachers/{teacherUid}`** — doc ID **must equal** teacher uid (one center per teacher). `{centerId, teacherId, teacherName, teacherEmail, addedAt (serverTimestamp)}`. Queried by `centerId ==`. This link is the center-membership anchor.
- **`center_attendance/{classId}_{YYYY-MM-DD}`** — see [ATTENDANCE.md](ATTENDANCE.md). `{id, classId, centerId, date, weekday, lessonStatus, records{uid: {status,method,markedBy,markedAt(Timestamp.now()),note?,confidence?}}, recordedBy, createdAt/updatedAt}`. Writers: attendance grid + `checkInService` (client).
- **`center_staff_attendance/{staffUid}_{date}`** — staff/teacher daily attendance; written by `components/attendance/StaffAttendanceGrid.tsx` (client `setDoc`; clearing a cell deletes the doc), read by `attendanceService.fetchStaffSessions`, deleted by admin cascade. See [ATTENDANCE.md](ATTENDANCE.md).
- **`center_attendance_summary`**, **`face_enrollments`** — see [ATTENDANCE.md](ATTENDANCE.md).
- **`rooms/{roomId}`** — see [ROOMS.md](ROOMS.md). `{centerId, name, capacity, color, features, building?, isActive, orderIndex, createdAt/updatedAt}`. Query `centerId == orderBy orderIndex`.
- **`center_finances/{financeId}`** — ⚠️ legacy: exists only in rules, no code reads/writes it. Do not build on it.

## Finance (API-only writes — see [FINANCE.md](FINANCE.md) + [FINANCE_DATABASE.md](FINANCE_DATABASE.md))

All written by **Admin SDK** via `lib/server/financeOps.ts` behind `/api/manager/finance/*`; client reads filter `centerId ==`; rules say `write: if false` for all six.

- **`center_finance_settings/{centerId}`** — doc ID = centerId. Settings + `expenseCategories`.
- **`center_student_finance/{centerId}_{studentId}`** — `{centerId, studentId, balance (increment), financeStatus, enrollmentDates{classId:date}, discounts/overrides/freeze, updatedAt}`.
- **`center_charges/{classId}_{studentId}_{periodKey}`** — deterministic ID. `{centerId, classId, classTitle, studentId, studentName, periodKey, periodStart/End, baseAmount, discountAmount, amount, paidAmount, status, dueDate, createdAt, createdBy, proratedFrom?}` + waive/adjust/cancel audit fields.
- **`center_payments/{autoId}`** — `{centerId, studentId, studentName, type, amount, method, source:'manual', allocations[], unallocatedAmount, paidAt (date-key), receivedBy, createdAt, status:'confirmed', note?}`.
- **`center_expenses/{autoId}`** — `{centerId, category, amount, date (date-key), createdBy, createdAt, status:'active', note?}`; salary variant adds `teacherId, payoutId`.
- **`center_payouts/{teacherId}_{periodKey}`** — `{centerId, teacherId, teacherName, periodKey, breakdown, calculatedAmount, adjustment, finalAmount, status:'approved'→'paid', createdBy, createdAt/updatedAt, paidAt (date-key), expenseId, adjustmentNote?}`. Paid payouts are immutable.
- Related: `center_teachers.salary` (config), `classes.monthlyFee` (client-written price snapshot source).

## Tests & submissions

- **`custom_tests/{autoId}`** — teacher practice tests; `{teacherId, teacherName?, title, track, subjectName..., questions[] (embedded), duration (0=∞), shuffle, resultsVisibility, accessCode, status, createdAt, questionCount}` — shape drifts by creator ([TEACHER.md](TEACHER.md)).
- **`bsb_chsb_tests/{autoId}`** — formal assessments; `{id, teacherId, teacherName, title, schoolType, assessmentType, grade, subject, scopesCovered, totalPoints, questionCount, difficultyTarget, questions[] (typed: mcq/true_false/short_answer/matching/open_ended with points/pairs/rubric), status, createdAt}`. Index teacherId+createdAt desc.
- **`attempts/{uid}_{assignmentId | examId}`** — ⚠️ **polymorphic; always branch on `type`**. Deterministic IDs mean retakes merge-overwrite (`attemptsTaken: increment`). Assignment shape vs exam shape in [STUDENT.md](STUDENT.md); exam docs overload `assignmentId` = examId; grading adds `manualScores`, `teacherScore`, `status:'graded'`, ⚠️ `autoScore` reset to 0 on grade save. The third "legacy practice" shape (`subtopicName`, `results[]`, `questionPath`) is **dead** — `historyService` has no consumers. Heavily queried: `userId ==`, `classId ==`, `assignmentId ==`/`in`, `type ==`, `orderBy submittedAt desc`.

## IELTS (see [IELTS.md](IELTS.md))

- **`ielts_groups/{groupId}`** — `{title, targetBand, joinCode ('I-'+4 chars, ⚠️ no uniqueness check), teacherId, teacherName, description, studentIds[], createdAt}`. Subcollection `requests/{autoId}` `{studentId, displayName, username, photoUrl, requestedAt}`.
- **`ielts_reading_tests/{test_id}`** — provided doc ID; authored payload (passages/blocks/questions with inline `correct_answer`) + `{teacherId, status:'published', createdAt/updatedAt}`. No TypeScript type exists for this shape.
- ⚠️ **`ielts_tests`, `ielts_attempts`, `ielts_groups/*/assignments` do not exist** — types only, zero reads/writes.

## Leaderboards, library, AI, misc

- **`leaderboards/{periodId}/users/{uid}`** — periods `day_YYYY_MM_DD` / `week_YYYY_WW` / `month_YYYY_MM` / `all_time` (UTC). `{uid, displayName, avatar, classId, xp: increment, lastActive}` merge-set. ⚠️ `getPeriodIds()` is copy-pasted in 3 files — keep identical.
- **`online_books/{bookId}`** — bulk-managed catalog. ⚠️ counters are lowercase `viewscount`/`downloadscount`; incremented on every click (non-unique). `description{en,uz,ru}`, `parts[]` with `telegramLink`.
- **`ai_sessions/{sess_${Date.now()}}`** — teacher analytics chats `{teacherId, title, createdAt (ISO), messages[]}`.
- **`ai_usage/{userId}_{YYYY-MM-DD}`** — `{count, userId, date}` (UTC date key). ⚠️ Written by the **client SDK inside a server route** (`app/api/analyze/route.ts` — the only API route not using Admin SDK). Distinct from `users.usage.aiQuestionsUsed`.
- **`notifications/{autoId}`** — `{userId, type (assignment|submission|request|result|alert|attendance), title, message, link|null, read:false, createdAt (serverTimestamp)}`. Index userId+createdAt, userId+read.
- **`active_games/{4-digit code}`** — checkers realtime; `board` is a JSON **string**; `{host, guest, status, turn, winner, mustJumpPiece, forfeitedBy?}`. ⚠️ Never deleted.
- **`parents/{uid}`** — referenced only by the rules helper `isParentOf` (`children[]`); no app code reads/writes it.

## Composite indexes (`firestore.indexes.json` — 13, all collection-scope)

attendance: `center_attendance` classId+date, centerId+date; `center_staff_attendance` centerId+date, staffUid+date. rooms: centerId+orderIndex. finance: `center_charges` centerId+status+dueDate, centerId+studentId+periodStart↓, centerId+periodStart; `center_payments` centerId+createdAt↓, centerId+studentId+createdAt↓, centerId+paidAt; `center_student_finance` centerId+balance; `center_expenses` centerId+date. (Other queries in code — e.g. `questions1`, `bsb_chsb_tests` teacherId+createdAt, notifications — rely on indexes created ad-hoc in the console; if you hit a FAILED_PRECONDITION index error, add it to `firestore.indexes.json` and deploy.)

Deploy: `npx firebase-tools deploy --only firestore:rules,firestore:indexes` (project `scanqr-64512`). ⚠️ `firebase.json` contains a `functions` block but there is **no `functions/` dir** — a bare `firebase deploy` fails at the functions predeploy; always use `--only`.

## Timestamp types by writer (check before comparing/ordering)

| Type | Where |
|---|---|
| `serverTimestamp()` | classes(+subcollections), center_attendance, center_teachers, notifications, rooms, teacher_questions `createdAt`, ielts requests, social edges, all financeOps createdAt/updatedAt |
| ISO 8601 string | `users.createdAt`, `centers.createdAt` + `subscription.validUntil` (admin route), `teacher_questions.uploadedAt`, `ai_sessions.createdAt` |
| Date-key string `YYYY-MM-DD` | finance `date/dueDate/paidAt`, attendance `date`, `users.lastActiveDate`, `dailyHistory` keys, `ai_usage.date` |
| `Timestamp.now()` | attendance record `markedAt` |
| Plain number | counters (`ai_usage.count`), XP/balance increments, materials `orderIndex` |
