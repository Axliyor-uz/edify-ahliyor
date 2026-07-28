# TEACHER — Test Creation, Classes, Analytics, Subscription

> **Agent workflow:** read this BEFORE touching `app/teacher/*`, test/question collections (`teacher_questions`, `custom_tests`, `bsb_chsb_tests`), grading, or subscription/limits display. AI generation routes are covered in [AI.md](AI.md); read both when touching `app/teacher/create/*/api/`. Update this doc in the same change whenever you alter behavior described here. Index: [README.md](README.md).

**Last verified:** 2026-07-28 (Rasch paper creator added; rest unverified since commit `7c31a96`).

## Cross-cutting

- Layout gate: `role==='teacher'` (see [AUTH.md](AUTH.md)).
- `TeacherLanguageContext` (`app/teacher/layout.tsx`): `useTeacherLanguage()` → `lang ∈ uz|en|ru`, **persisted per-device** in localStorage `edify-teacher-lang` (restored post-hydration; SSR shell renders uz). Pattern: every page/modal defines its own inline `TRANSLATIONS` dict and picks `TRANSLATIONS[lang] || TRANSLATIONS['uz']`. Hardcoded Uzbek strings still leak (toasts, grade page).
- AI balance widget: `hooks/useMonthlyLimit.ts` — live `onSnapshot(users/{uid})`, `currentLimits.monthlyAiQuestions` (default 100), `usage.aiQuestionsUsed`, unlimited at ≥5000, danger at 80%.
- ⚠️ Nav entries for **subscription** and **ielts** are commented out in the layout even though both routes are fully built (subscription reachable only via the AI-balance "Buy Credits" button).
- **Design system:** the ENTIRE teacher tree is styled with the M3 UI kit (`components/ui/*`, tokens only — no raw colors). Read [UI_KIT.md](UI_KIT.md) before styling any teacher page.
- **Shell (layout.tsx):** desktop = flush sidebar that collapses to an 84px labeled M3 rail (header toggle, `[` shortcut, state in localStorage `edify-sb-rail`); mobile = slim top bar + **M3 bottom navigation bar** (Boshqaruv/Yaratish/Sinflar/Kutubxona + Menyu→drawer). ⚠️ The bottom bar auto-hides on deep routes with their own bottom action bars (`HIDE_BOTTOM_BAR` regexes: `create/*`, `classes/*`, `print`, IELTS builder/view) — check that list when adding a page with a floating bottom bar. Language switcher uses inline SVG flags inside the profile popover; desktop NotificationBell was replaced by a "Bildirishnomalar" nav item (bell quick-panel remains on the mobile top bar).

## Test creation (`app/teacher/create/*`)

Hub lists 9 methods. Two write targets: per-question docs in **`teacher_questions`** and one aggregate test doc in **`custom_tests`** (or **`bsb_chsb_tests`** for BSB/CHSB).

> ⚠️ **Every creator now writes the canonical v1 question schema** via `toQuestionV1()`, and every reader normalizes via `normalizeQuestion()`. Legacy questions are never migrated and must keep working. **Read [QUESTIONS.md](QUESTIONS.md) before changing any creation or rendering path** — including the trap that `where('difficulty','==','easy')` silently misses every v1 doc.
>
> The embedded copy in `custom_tests.questions[]` is v1 too. ⚠️ `serverTimestamp()` **cannot go inside an array** — publish paths build the doc twice: `serverTimestamp()` for the standalone `teacher_questions` doc, `Timestamp.now()` for the embedded snapshot.
>
> Full v1 field list + the legacy shape it coexists with: [DATA_MODEL.md](DATA_MODEL.md).

| Method | Route | Writes | Notes |
|---|---|---|---|
| Manual "Blank Canvas" | `create/custom/` | both | localStorage draft (1h TTL despite the 24h constant name); MathInput/RichQuestionInput |
| Single question builder | `create/question/` | `teacher_questions` only | images on prompt + every option, 5 question types, required topic path — see below |
| Question block | `create/block/` | `teacher_questions` only | one stem + N sub-questions in **ONE doc** (`multi_part` / `shared_options`); ⚠️ edit blocks HERE (`?edit=`), never in `create/question` — see [QUESTIONS.md](QUESTIONS.md). Bottom of the page reuses `CreatedQuestionsList` with `filter={q => q.isBlock}` — the teacher's own blocks, edit loads back into the builder in place |
| General AI | `create/ai/` + api | both | |
| By image | `create/by_image/` + api | both | the ONLY feature-gated AI route (`IMAGE_AI`) — see [AI.md](AI.md) |
| Free prompt | `create/by_user_input/` + api | both | |
| Maktab / Ixtisoslashtirilgan | `create/maktab/`, `create/ixtisoslashtirilgan_maktab/` + api | both | pick topic via `/api/structure` + `/api/syllabus` (local JSON syllabus) |
| From bank (`questions1`) | `create/database/` | `custom_tests` | the only consumer of `quizService.fetchQuestions`; query traps in [DATA_MODEL.md](DATA_MODEL.md) |
| From own bank | `create/my_questions/` | `custom_tests` | manages `teacher_questions where creatorId==uid` |
| BSB/CHSB | `create/bsb-chsb/` + api | **`bsb_chsb_tests`** only | mixed question types with `points`, `pairs`, `rubric`; ⚠️ NOT feature-gated despite `BSB_GENERATOR` existing in the registry |
| Operations / Abiturient | `create/operations/`, `create/abiturient/` | none | operations = client-side jsPDF worksheets; abiturient = router hub |
| **Rasch paper (45 q + 6-digit code)** | `create/rasch/` (+ `build/`, `results/[quizId]/`) | **`teacher_rasch_quizzes`** only | Two pools: the teacher's own `teacher_questions` (default tab) and `questions1` to top up. Writing a new question links out to `create/question` / `create/block`; ⚠️ the paper is stashed to localStorage first so navigating away can't destroy it. Students open it at `/RASCHmodel/quiz` and it scores into their Rasch levels. Full contract: [RASCH_QUIZ.md](RASCH_QUIZ.md) |

`custom_tests` doc: `{teacherId, teacherName?, title, track, subjectName, topicName..., questions:[full question objects embedded], duration (0 = no limit), shuffle (default true), resultsVisibility ('always'|'after_due'|'never', default 'after_due'), accessCode, status:'active', createdAt, questionCount}`. ⚠️ Shape drifts by creator: `teacherName` absent in ai/my_questions paths; `track` varies (`custom`/`general_ai`/`custom_mix`); `EditTestModal` writes a derived `showResults` bool no creator writes.

`accessCode`: 6 chars from an ambiguity-safe alphabet, generated once per modal mount, **no uniqueness check**. ⚠️ Not the same thing as a Rasch paper's `accessCode`, which is 6 **digits**, minted once on first save and best-effort uniqueness-checked ([RASCH_QUIZ.md](RASCH_QUIZ.md)).

### Single question builder (`create/question/`)

Its own hub section ("Savollar Bazasi"). One question at a time, written to **`teacher_questions`** in the **canonical v1 schema** — the same format every other creation method now writes. **Read [QUESTIONS.md](QUESTIONS.md) before touching this or any other question path.** Firestore/Storage logic: [services/questionBankService.ts](../services/questionBankService.ts); the page only holds form state. Route-local: `_components/ImagePicker.tsx` (pick + preview, no upload) and `_components/CreatedQuestionsList.tsx` (the teacher's own questions, list + delete). ⚠️ `CreatedQuestionsList` is shared with `create/block` — it reads **nothing** on mount (the just-saved question is handed over in memory as `sessionQuestions`), only on "load 10". Its optional `filter` prop narrows what is shown, and because filtering is client-side a press then pulls up to 3 pages of 10 until something matches.

- **Prompt** = rich text (RichQuestionInput → LaTeX inline as `$...$`, math via the ∑ toolbar button) **and/or** an image.
- **Images everywhere**: the prompt and **every answer option** may carry one (≤5 MB). An option is valid with text, an image, or both. Images upload to Storage `teacher_questions/{uid}/{questionId}_{slot}_{ts}{ext}` (`slot` = `prompt`|`correct`|`opt{i}`) **only on save, after validation passes** — an abandoned form uploads nothing. `deleteQuestion()` removes every owned object before the doc, or they'd leak.
- **Topic path is required**: Fan → Mavzu → Ichki mavzu, from **[data/question_topics.json](../data/question_topics.json)** via [lib/questionTopics.ts](../lib/questionTopics.ts) (plain import, *not* `/api/structure` — it's small and needed client-side). Ids **and** names are persisted; ids are referenced by saved docs, so keep them stable when editing the JSON.
- **Question types** (`IMPLEMENTED_QUESTION_TYPES`): `mcq`, `multiple_select`, `true_false`, `open`, `numeric`. Option-based types collect a correct answer + 1–5 other options; on save they are **shuffled** into `options[]` A…F and `correctAnswer.value` records the winning letter(s) — so the answer is never predictably `A` when a test runs with `shuffle: false`. Text types collect a typed answer plus optional `acceptedAnswers[]` and a `caseSensitive` flag. The other 12 types in the enum are declared but **not authorable/renderable** yet.
- 6 difficulty levels (beginner…olympiad — ⚠️ non-monotonic ids, see [QUESTIONS.md](QUESTIONS.md)), `status`, `points`, `estimatedTime`, `hint`, `tags`, `curriculum`.
- Every doc is stamped with `creatorId` + `creatorName` (Auth `displayName`, falling back to `users/{uid}.displayName` — username-flow accounts have no Auth displayName).
- The doc ID is reserved client-side (`newQuestionId()`) before any upload so Storage paths key off it; **doc key === `id` field**.
- ⚠️ **The list under the form does NOT read Firestore on mount, or after a save.** The question you just created is shown from memory; Firestore is touched only when the teacher presses "load 10" (10 docs per press, cursor-paged). Opening the builder costs zero reads — don't reintroduce an auto-fetch.
- **Editing**: the pencil on any row, or `Tahrirlash` on any card in `create/my_questions` → `/teacher/create/question?edit=<id>`. Loads the stored question back into the form (legacy docs included — they're the ones that need fixing) and writes back to the SAME doc: `createdAt` preserved, `metadata.updatedAt` moved, replaced images deleted from Storage, `creationMethod` kept. See [QUESTIONS.md](QUESTIONS.md).
- Per-source defaults (AI → `status: review`, hand-written → `published`, plus `aiModel` and provenance tags) come from `CREATION_METHOD_DEFAULTS` — see [QUESTIONS.md](QUESTIONS.md).

## Classes (`app/teacher/classes`)

Local schema notes: `classes/_components/class_info.txt` (accurate).

- **Create**: `{title, description, joinCode, teacherId, teacherName, studentIds:[], studentCount:0, createdAt}`. `joinCode` = random base36 uppercased, ≤6 chars, no collision check; regenerable in settings; `isLocked` blocks joins. `studentCount` never maintained.
- **Roster**: module-level cache + IntersectionObserver paging; add student by `usernames/{name}` lookup (`arrayUnion`); remove `arrayRemove`. Join requests in `classes/{id}/requests` — accept = `arrayUnion(studentId)` + delete request (also handled from the notifications inbox). ⚠️ Must tolerate both request shapes (see [STUDENT.md](STUDENT.md)).

### 🟢 Center groups are VIEW-ONLY for the teacher (2026-07-19)

A class with `centerId != ''` is a **center group** — its roster, identity and lifecycle belong to the center manager ([MANAGER.md](MANAGER.md)); the teacher keeps teaching features only (assignments, exams, materials, attendance, grading, leaderboard). Everything below is gated on `cls.centerId` in UI **and** enforced by rules (suite "TEACHER — center groups are manager-run" in `tests/rules/manager.rules.test.mjs`):

- **Roster tab is read-only** (`RosterTab readOnly` prop): no remove button; a hint banner explains the manager runs enrollment. The plus-menu's "O'quvchi Qo'shish" and the Settings button are hidden; AddStudentModal/ClassSettingsModal aren't even mounted.
- **No join code**: the card badge and header chip show the **center name** (`centers/{id}.name`, `Building2` icon, tertiary-container) instead of the joinCode. Students entering the code in `JoinClassModal` get a "managed by the center" toast; request creation is also rules-blocked, and the Requests tab disappears (its listener isn't subscribed).
- **Notifications inbox**: accepting a stale join request for a center group cleans the request + notification up and shows the explanation toast instead of `arrayUnion`.
- **Settings → Manage Classes** (`SecurityTab`): center groups show a center badge instead of the delete button, and `confirmDeleteClass` hard-refuses them — ⚠️ essential because `deleteClassAPI` is a Cloud Function (Admin SDK, bypasses rules).
- **Attendance stamps the CLASS's own `centerId`** (`classData.centerId || ''`), not the teacher's center — a center teacher's personal-group attendance no longer leaks into center reports (`fetchCenterSessions` queries `centerId ==`).
- **`hooks/useTeacherCenter.ts`** resolves the teacher's center chip (dashboard header, `getDoc(center_teachers/{uid})` + `centers/{id}`, module-cached). ⚠️ Never `where('teacherId','==',uid)`-query `center_teachers` from the teacher side — the list rule checks the doc-id wildcard, the query is not provable, and it fails with permission-denied (the old class-detail page did exactly this and silently stamped `''`).
- **Assignments** (`AssignTestModal`): `{testId→custom_tests, testTitle, questionCount, duration|null, resultsVisibility, description, openAt, dueAt|null, assignedTo:'all'|uid[], allowedAttempts (0=unlimited), status:'active' (static — UI derives scheduled/active/closed from dates), teacherId, createdAt}`. `duration`/`resultsVisibility` are denormalized from the test at save (in edit mode the modal fetches the template — `selectedTest` is a stub); saving `resultsVisibility:'after_due'` **without a dueAt is refused** (`needDue` toast) — the student side holds results for `after_due`+no-deadline, so it would never reveal. Sends notifications on create; **edit sends none**.
- **Exams** (`AssignExamModal`): `{testId→bsb_chsb_tests, title, assessmentType, examDate, durationMinutes, hideResults (undefined = hidden), submittedStudentIds:[], status:'scheduled', teacherId, createdAt}`.
- **Grading** (`grade/[examId]/[studentId]/`): loads attempt by `classId+assignmentId(examId)+userId`, template from `bsb_chsb_tests`; auto-scores unless `manualScores[qId]` present; save writes `{manualScores, autoScore: 0, teacherScore: finalTotal, status:'graded'}`. ⚠️ **`autoScore` is hard-set to 0 on every save** — the final grade lives only in `teacherScore`/`manualScores`. 🟢 Exams with no `open_ended` questions arrive **already in that graded shape** (student-side auto-release, 2026-07-20) — the grade page pre-fills from `manualScores` and a re-save simply overwrites.
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
- joinCode/accessCode collision risk (no uniqueness checks).
- Language preference not persisted.
- Dashboard's primary usage-derivation block commented out.

## How to verify changes

`npm run dev`; create a test via the touched method → check `teacher_questions` + `custom_tests` docs; assign to a class with a student account, submit, grade (exam path); confirm AI credits deducted by the actual generated count.
