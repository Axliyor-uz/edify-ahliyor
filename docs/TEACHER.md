# TEACHER — Test Creation, Classes, Analytics, Subscription

> **Agent workflow:** read this BEFORE touching `app/teacher/*`, test/question collections (`teacher_questions`, `custom_tests`, `bsb_chsb_tests`), grading, or subscription/limits display. AI generation routes are covered in [AI.md](AI.md); read both when touching `app/teacher/create/*/api/`. Update this doc in the same change whenever you alter behavior described here. Index: [README.md](README.md).

**Last verified:** 2026-07-12 (commit `7c31a96`).

## Cross-cutting

- Layout gate: `role==='teacher'` (see [AUTH.md](AUTH.md)).
- `TeacherLanguageContext` (`app/teacher/layout.tsx`): `useTeacherLanguage()` → `lang ∈ uz|en|ru`, **not persisted** (resets to uz on reload). Pattern: every page/modal defines its own inline `TRANSLATIONS` dict and picks `TRANSLATIONS[lang] || TRANSLATIONS['uz']`. Hardcoded Uzbek strings still leak (toasts, grade page).
- AI balance widget: `hooks/useMonthlyLimit.ts` — live `onSnapshot(users/{uid})`, `currentLimits.monthlyAiQuestions` (default 100), `usage.aiQuestionsUsed`, unlimited at ≥5000, danger at 80%.
- ⚠️ Nav entries for **subscription** and **ielts** are commented out in the layout even though both routes are fully built (subscription reachable only via the AI-balance "Buy Credits" button).

## Test creation (`app/teacher/create/*`)

Hub lists 8 methods. Two write targets: per-question docs in **`teacher_questions`** and one aggregate test doc in **`custom_tests`** (or **`bsb_chsb_tests`** for BSB/CHSB). Question shape: `{id:'tq_...', creatorId, track, subject/topic/chapter/subtopic, creationMethod, difficulty (lowercase string) + difficultyId (1/2/3, olympiad 4), question:{uz,ru,en}, options:{A..D:{uz,ru,en}}, answer:'A'-'D', explanation, tags[], language:['uz'], solutions:[], uploadedAt (ISO), createdAt (serverTimestamp)}`.

| Method | Route | Writes | Notes |
|---|---|---|---|
| Manual "Blank Canvas" | `create/custom/` | both | localStorage draft (1h TTL despite the 24h constant name); MathInput/RichQuestionInput |
| General AI | `create/ai/` + api | both | ⚠️ save-to-bank path: doc key = raw autoId but `id` field = `tq_${autoId}` (mismatch); publish path consistent |
| By image | `create/by_image/` + api | both | the ONLY feature-gated AI route (`IMAGE_AI`) — see [AI.md](AI.md) |
| Free prompt | `create/by_user_input/` + api | both | |
| Maktab / Ixtisoslashtirilgan | `create/maktab/`, `create/ixtisoslashtirilgan_maktab/` + api | both | pick topic via `/api/structure` + `/api/syllabus` (local JSON syllabus) |
| From bank (`questions1`) | `create/database/` | `custom_tests` | the only consumer of `quizService.fetchQuestions`; query traps in [DATA_MODEL.md](DATA_MODEL.md) |
| From own bank | `create/my_questions/` | `custom_tests` | manages `teacher_questions where creatorId==uid` |
| BSB/CHSB | `create/bsb-chsb/` + api | **`bsb_chsb_tests`** only | mixed question types with `points`, `pairs`, `rubric`; ⚠️ NOT feature-gated despite `BSB_GENERATOR` existing in the registry |
| Operations / Abiturient | `create/operations/`, `create/abiturient/` | none | operations = client-side jsPDF worksheets; abiturient = router hub |

`custom_tests` doc: `{teacherId, teacherName?, title, track, subjectName, topicName..., questions:[full question objects embedded], duration (0 = no limit), shuffle (default true), resultsVisibility ('always'|'after_due'|'never', default 'after_due'), accessCode, status:'active', createdAt, questionCount}`. ⚠️ Shape drifts by creator: `teacherName` absent in ai/my_questions paths; `track` varies (`custom`/`general_ai`/`custom_mix`); `EditTestModal` writes a derived `showResults` bool no creator writes.

`accessCode`: 6 chars from an ambiguity-safe alphabet, generated once per modal mount, **no uniqueness check**.

## Classes (`app/teacher/classes`)

Local schema notes: `classes/_components/class_info.txt` (accurate).

- **Create**: `{title, description, joinCode, teacherId, teacherName, studentIds:[], studentCount:0, createdAt}`. `joinCode` = random base36 uppercased, ≤6 chars, no collision check; regenerable in settings; `isLocked` blocks joins. `studentCount` never maintained.
- **Roster**: module-level cache + IntersectionObserver paging; add student by `usernames/{name}` lookup (`arrayUnion`); remove `arrayRemove`. Join requests in `classes/{id}/requests` — accept = `arrayUnion(studentId)` + delete request (also handled from the notifications inbox). ⚠️ Must tolerate both request shapes (see [STUDENT.md](STUDENT.md)).
- **Assignments** (`AssignTestModal`): `{testId→custom_tests, testTitle, questionCount, description, openAt, dueAt|null, assignedTo:'all'|uid[], allowedAttempts (0=unlimited), status:'active' (static — UI derives scheduled/active/closed from dates), teacherId, createdAt}`. Sends notifications on create; **edit sends none**.
- **Exams** (`AssignExamModal`): `{testId→bsb_chsb_tests, title, assessmentType, examDate, durationMinutes, hideResults (undefined = hidden), submittedStudentIds:[], status:'scheduled', teacherId, createdAt}`.
- **Grading** (`grade/[examId]/[studentId]/`): loads attempt by `classId+assignmentId(examId)+userId`, template from `bsb_chsb_tests`; auto-scores unless `manualScores[qId]` present; save writes `{manualScores, autoScore: 0, teacherScore: finalTotal, status:'graded'}`. ⚠️ **`autoScore` is hard-set to 0 on every save** — the final grade lives only in `teacherScore`/`manualScores`.
- **Materials** (`UploadMaterialModal`): Storage path `classes/{classId}/materials/{ts}_{rand}{ext}` or external link (`isExternal`); doc has `isVisible`/`isArchived` toggles, `orderIndex: Date.now()`, `viewCount`/`downloadCount` (initialized, never incremented teacher-side). Delete removes Storage object + doc.
- **Schedule**: `classes.schedule` is read by `AttendanceTab` but **no teacher UI writes it** — schedules are managed by the center manager ([MANAGER.md](MANAGER.md)/[ROOMS.md](ROOMS.md)).

## Analytics & print

- `analytics/page.tsx`: modes assignment/student; aggregates `attempts`, anonymizes, POSTs to `/api/analyze` (see [AI.md](AI.md) — daily limit from Remote Config `ai_daily_limit`, spoofable). Chats persisted to `ai_sessions/{sess_${Date.now()}}` `{teacherId, title, createdAt ISO, messages[]}`; history paged 5 by `teacherId+createdAt desc`. ⚠️ Calls `/api/stt` which **does not exist**.
- Print: `PrintLauncher` → localStorage `print_payload` → `/teacher/print` A4 studio (bubble sheets, answer keys, HTML-based PDF). No Firestore.

## Subscription & limits (`subscription/page.tsx` + `plansData.ts`)

- Plans `free|pro|vip`: limits {maxClasses 1/5/9999, maxStudents 20/200/99999, monthlyAiQuestions 100/1000/5000}, `includedFeatures` from `FEATURE_REGISTRY` (ONLINE_LIBRARY, MATH_WORKSHEETS, PDF_EXPORT, IMAGE_AI, BSB_GENERATOR, ANALYTICS, CLOUD_STORAGE), dual monthly/6-month pricing, `paymentIds` placeholders.
- Reads `users/{uid}` live. Trial → Cloud Function `startFreeTrial` (**not in repo**). Purchase → Telegram contact (`t.me/Umidjon0339`), no in-app payment.
- Who writes the fields: admin panel (both membership editors — see [ADMIN.md](ADMIN.md)) and `deductMonthlyAiCredits`. `usage.activeClassCount`/`totalStudents`/`customTestCount`/`aiLimitResetDate` are **Cloud-Function-generated, and no `functions/` dir exists in the repo** — treat as possibly absent.
- ⚠️ **Enforcement reality: only the monthly AI count is enforced (in AI routes), and only IMAGE_AI is feature-locked.** `maxClasses`/`maxStudents` and all other advertised features (BSB, analytics, materials…) are display-only — free users can use them. Don't assume plan gating exists when adding features.
- `membership_details/` (repo root) describes a **legacy divergent design** (`usePlanLimits`, `aiRequestsToday`, paywall modal…) — none of it exists in code. Historical notes only.

## Known issues / dead code (verified 2026-07-12)

- Feature-locks unenforced except IMAGE_AI; maxClasses/maxStudents never enforced.
- `teacher_questions` doc-key ≠ `id` field in the AI save-to-bank path.
- joinCode/accessCode collision risk (no uniqueness checks).
- Language preference not persisted.
- Dashboard's primary usage-derivation block commented out.

## How to verify changes

`npm run dev`; create a test via the touched method → check `teacher_questions` + `custom_tests` docs; assign to a class with a student account, submit, grade (exam path); confirm AI credits deducted by the actual generated count.
