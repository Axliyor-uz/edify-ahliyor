# IELTS — Groups, Tests, Runner, Grading

> **Agent workflow:** read this BEFORE touching anything under `app/(student)/ielts/`, `app/teacher/ielts/`, `app/admin/ielts/`, `app/api/ielts/`, `lib/ielts/`, or `services/ieltsService.ts`. Update this doc in the same change whenever you alter behavior described here. Index: [README.md](README.md). Design/product rationale: [IELTS_UPGRADE_PLAN.md](IELTS_UPGRADE_PLAN.md).

**Last verified:** 2026-07-27 (major upgrade: full teacher→group→student loop).

## Architecture in one paragraph

Teachers (and the admin, for the **platform dataset**) author Reading/Listening tests with 13 question types plus Writing tasks and Speaking cue-card sets. Public test docs are **answer-free** (`answers_split: true`); the key lives in `ielts_answer_keys/{testId}` (teacher-only read) and grading happens **server-side** in `/api/ielts/submit` (Admin SDK), which writes `ielts_attempts` (clients cannot create/forge attempts — rules `create: false`). Teachers assign tests to `ielts_groups` via `ielts_groups/{id}/assignments`; students take them in a CD-IELTS-style runner (split-pane / mobile Passage-Questions tab toggle, 1–40 palette, review flags, red-at-10/5-min timer, play-once listening in simulation mode) and get raw score + **band** (tables in `lib/ielts/bands.ts`; Academic vs GT Reading differ). Students can also self-practice any **platform** test (`source: 'platform'`, unlimited retakes, history kept). Writing/Speaking attempts are teacher-graded (`reviewStatus`/`teacherGrade`). Submissions award XP client-side after the server grade (same applyUserXp/mirrorLeaderboards flow as the regular runner).

## Collections

| Collection | Shape / notes |
|---|---|
| `ielts_reading_tests/{test_id}` | `{test_id, test_title, module:'reading', test_category?:'academic'\|'general', total_time_minutes, total_questions, passages[], teacherId (null = platform), source:'teacher'\|'platform', answers_split:true, status, createdAt (preserved on re-save), updatedAt}`. Passage = `{id, passage_number, title, subtitle, instruction, word_count, difficulty, blocks[{type:'text',label,content}], questions: QuestionBlock[]}`. |
| `ielts_listening_tests/{test_id}` | Same base + `parts: [{part_number 1–4, audio_url (Storage `ielts_audio/{testId}/…`), audio_duration_seconds?, transcript?, questions: QuestionBlock[]}]`. |
| `ielts_writing_tests/{test_id}` | `{module:'writing', task1:{prompt, imageUrl?, modelAnswer?}, task2:{prompt, modelAnswer?}, teacherId, source, …}` |
| `ielts_speaking_tests/{test_id}` | `{module:'speaking', part1Questions[], part2CueCard:{topic, bullets[]}, part3Questions[], …}` |
| `ielts_answer_keys/{testId}` | `{testId, teacherId, skill, keys: {"<qn>": {t: type, a: string\|string[], wl?: wordLimit, span?: listSelectionSpan}}}`. **Never student-readable.** |
| `ielts_groups/{groupId}` | unchanged shape; **read rule is now teacher/member only** (join goes through the API). |
| `ielts_groups/{id}/assignments/{id}` | `{testId, skill, testTitle, questionCount, totalTimeMinutes, mode:'simulation'\|'practice', openAt, dueAt, allowedAttempts, resultsVisibility:'always'\|'after_due'\|'never', assignedTo:'all'\|uid[], teacherId, createdAt, status:'active', completedBy[]}` — `completedBy` is server-written. |
| `ielts_groups/{id}/requests/{id}` | created **only** by `/api/ielts/join`; teacher reads/deletes; student may delete own. |
| `ielts_attempts/{id}` | Assignment attempts: deterministic id `{uid}_{groupId}_{assignmentId}` (attemptsTaken increments). Practice: auto-id, `kind:'practice'`, unlimited history. Fields: see `lib/ielts/types.ts` `IeltsAttempt` (answers, rawScore, bandScore, perQuestion, typeStats, writing/speaking payloads, reviewStatus/teacherGrade, tabSwitches, xpEarned). **Server-written only**; teacher may update only `reviewStatus`+`teacherGrade` (W/S grading). |

QuestionBlock: 13 types (unchanged from the original builder), `start_question`/`end_question` global numbering, gap-token grammar `[0]`/`[_]`/`[]`, `options: null` = free-text vs array = word-bank. New optional: `word_limit` (block), `explanation` (row). ⚠️ `list_selection` span must be derived from `end_question - start_question + 1` in student code (public docs have no `correct_answer`).

## Server boundary — `app/api/ielts/*` (first IELTS API routes)

- `POST /api/ielts/submit` — verifies Bearer token, membership, open/due window (+60s grace), attempt limit; loads key (fallback: extracts inline answers from **legacy** docs); grades via `lib/ielts/grading.ts`; band via `lib/ielts/bands.ts` (extrapolated when total ≠ 40 — indicative); writes attempt + `completedBy` arrayUnion in a transaction; returns result with `perQuestion` withheld unless `resultsVisibility` allows. Returns `xpSuggested` (1/correct + 10; W/S flat 15; practice retakes 0) — client applies XP via `submitIeltsAttempt` in `services/ieltsService.ts`.
- `GET /api/ielts/review?attemptId=` — attempt + correct answers, gated by visibility (owner) or group ownership (teacher).
- `POST /api/ielts/join` — join by code (regex `I-[A-Z0-9]{4,6}`), duplicate-code → 409, creates the request doc server-side. Returns `member|pending|requested`.

Grading rules implemented in `lib/ielts/grading.ts`: UK/US spelling equivalence, digit↔word numbers, `(the) library` optionals, `taxi/cab` alternates, word-limit enforcement (hyphenated = 1 word), strict singular/plural, order-insensitive multi-select, list_selection = 1 mark per correct letter.

## Route map

- **Teacher** `app/teacher/ielts/`: hub; `reading/*` + `listening/*` (list/builder/edit/simulator; builders are reusable components with `asPlatform` prop); `writing/`, `speaking/` (form authoring); `groups/[groupId]` (Pulse/Assignments/Students/Requests tabs — now real data from `ielts_attempts`; AssignTestModal; W/S review grading).
- **Student** `app/(student)/ielts/`: hub (groups + Practice Library of platform tests); `[groupId]` (assignments, my progress, weak types); `[groupId]/test/[assignmentId]` + `practice/[skill]/[testId]` (runner, chrome-suppressed); `review/[attemptId]`.
- **Admin** `app/admin/ielts/`: platform dataset — builders (reused with `asPlatform`), promote teacher tests, **JSON import** validated by `lib/ielts/testSchema.ts` `validateTestJson` before write.

## Invariants & traps

- **Never re-embed `correct_answer` in public test docs.** Save must go through `saveIeltsTest` (renumber → extract key → strip → batch write test+key, preserving `createdAt`).
- Legacy docs (pre-split, no `answers_split`) still contain answers; the student runner refuses them ("not ready") until the teacher re-saves. The grading route grades them via the inline fallback.
- Rules: `ielts_groups` read is member/teacher-provable for the two live list queries — don't add other client group queries (they'll be denied); go through the API instead.
- `ielts_attempts` client create is `false` by design. Don't "fix" a failing client write by opening rules — use the API.
- Join codes are now 6-char via `generateUniqueJoinCode` — keep the `I-` prefix (join API regex + student input depend on it).
- Timestamps: assignment `openAt`/`dueAt` are Firestore Timestamps; attempt `startedAt` comes from a client ms epoch → server Date. XP day keys go through `lib/xpDays.ts` inside `applyUserXp` — never re-derive.
- Storage rules are **console-managed** (no storage.rules in repo): paths `ielts_diagrams/`, `ielts_audio/`, `ielts_writing/`, `ielts_speaking/` must allow authenticated read/write.
- Load-bearing typo filename remains: `reading/manual/_components/passsage.tsx` (triple-s).
- **"Choose TWO letters" questions must be authored as `list_selection`**, not multi-answer
  `multiple_choice`: public docs carry no `correct_answer`, so the student renderer can only
  detect multi-select via the list_selection span (`end_question - start_question + 1`); a
  multi-answer `multiple_choice` renders single-select for students.
- The student runner is a `fixed inset-0` overlay (the student layout has no route-based chrome
  suppression) — review pages keep normal chrome.
- Android: student flows + shapes are mirrored — append to `ANDROID_STUDENT_IMPACT.md` (and `ANDROID_IMPACT.md` for shared contracts) on every change; shapes are additive-only.

## How to verify

`npm run dev` → teacher: author reading test (check `answers_split` + `ielts_answer_keys` doc), author listening test with audio; create group; assign both to the group. Student: join by code (API), take the reading test on a phone-width viewport (tab toggle), submit → band + XP; review with Locate. Practice a platform test twice (second attempt: 0 XP, history kept). Writing: submit essay → teacher grades → student sees band. Rules deploy: `npx firebase-tools deploy --only firestore:rules,firestore:indexes`.
