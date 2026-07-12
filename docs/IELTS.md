# IELTS — Groups & Reading Tests

> **Agent workflow:** read this BEFORE touching anything under `app/(student)/ielts/`, `app/teacher/ielts/`, `services/ieltsService.ts`, or `types/ielts.ts`. Update this doc in the same change whenever you alter behavior described here. Index: [README.md](README.md).

**Last verified:** 2026-07-12 (commit `7c31a96`).

## Purpose & scope

The IELTS subsystem is **partially built**. What's live: teacher-owned study groups with join codes/requests, and a teacher-side reading-test authoring tool + view simulator. What does NOT exist: student test-taking, scoring/band calculation, assignments, attempts. Both IELTS nav menu items are **commented out** (`app/(student)/layout.tsx` and `app/teacher/layout.tsx`) — pages are reachable only by direct URL and hardcoded links.

## What is BUILT and live

### Groups — `ielts_groups` (fully wired)
- Created in `app/teacher/ielts/groups/_components/CreateIeltsGroupModal.tsx`: `{title, targetBand, joinCode, teacherId, teacherName, description, studentIds:[], createdAt}`. Matches `IeltsGroup` in `types/ielts.ts` — **the only type in that file that is real**.
- `joinCode` = `'I-' + 4 random base36 chars uppercased`. ⚠️ No uniqueness check; student join takes `snap.docs[0]` blindly — duplicate codes → wrong group.
- Teacher list: `where('teacherId','==',uid)` live `onSnapshot`. Student hub (`app/(student)/ielts/page.tsx`): `where('studentIds','array-contains',uid)` — renders group cards only, nothing else.

### Join requests — `ielts_groups/{id}/requests` (fully wired)
- Student: `JoinIeltsModal.tsx` writes `{studentId, displayName, username, photoUrl, requestedAt}` (dup + already-enrolled checks first).
- Teacher approve (`IeltsRequestsTab.tsx`): `arrayUnion(uid)` into `studentIds` + delete request. Reject: delete request. Reader tolerates `studentId || userId || doc.id` (schema-drift fallback).
- Direct add bypassing requests: `AddIeltsStudentModal.tsx` (username lookup → `arrayUnion`). Remove: `IeltsRosterTab.tsx` `arrayRemove`; admin force-remove exists in `app/admin/students/[id]/_components/ClassesTab.tsx`.

### Reading tests — `ielts_reading_tests` (authored & viewable, NOT scored)
- Only service function: `services/ieltsService.ts` → `setDoc(doc('ielts_reading_tests', test_id), {...payload, teacherId, createdAt, updatedAt, status:'published'})`. ⚠️ Uses `auth.currentUser` directly (race risk before auth hydrates).
- Doc shape (built in `app/teacher/ielts/reading/manual/page.tsx`): `{test_id, test_title, module:'reading', total_time_minutes, total_questions, passages[]}`; each passage has `blocks[]` (text) and `questions[]` (question-blocks with `type`, `start_question`/`end_question`, per-question `correct_answer` inline). **13 question types** (matching_headings, TFNG, multiple_choice, summary/sentence/table/flowchart/diagram_completion, matching_paragraph_information/features/sentence_endings, list_selection, short_answer).
- Authoring UX: 2-step builder, localStorage autosave key `ielts_reading_draft`, global auto-numbering, advisory 40-question target (not enforced). **Edit flow is a hack**: `manual/[id]/page.tsx` loads the doc INTO the localStorage draft and redirects to the builder — an in-progress new-test draft gets silently clobbered by opening an edit (and vice versa); draft only clears on successful save.
- Teacher-only simulator: `app/teacher/ielts/reading/view/[id]/page.tsx` — timer (starts paused; expiry only toasts), local-state answer sheet, highlighter, split-pane. **The Submit button has no onClick.** Answers are never persisted or graded.

## What is DECLARED but NOT wired (do not assume data exists)

- `IeltsMasterTest` / collection `ielts_tests` — zero reads/writes anywhere. The real reading tests live in `ielts_reading_tests` with a **different shape and no TypeScript type** (everything is `any`).
- `IeltsAttempt` / collection `ielts_attempts` — zero reads/writes. No attempt is ever persisted.
- `IeltsAssignment` / `ielts_groups/{id}/assignments` — never read/written; the type is imported only to type `MOCK_ASSIGNMENTS` in `IeltsUnifiedFeed.tsx`.
- Mocked UI presenting fake data as real: `IeltsPulseDashboard.tsx` (band 6.4, triage, ticker — all hardcoded), `IeltsRosterTab` `currentBand: 6.5`, the "Baza"/`DATABASE_TESTS` tab (one fake Cambridge row), "Assign Mock" button (no-op), listening/writing/speaking tiles (routes don't exist).

**Bottom line: trust `types/ielts.ts` only for `IeltsGroup`.**

## Student test-taking

**Does not exist.** `app/(student)/ielts/` has only the group list + join modal. Students cannot open or take any IELTS test. Building this is greenfield work — and note the current model ships `correct_answer` to the client (answer-key leak); a student-facing runner needs a server-side grading boundary.

## Invariants & traps

- joinCode `'I-'` prefix is forced in the student join input and validated — keep it if generating codes elsewhere.
- No scoring exists anywhere; any band numbers you see in UI are hardcoded mocks.
- Typo filename that is load-bearing: `manual/_components/passsage.tsx` (triple-s) — imported as such.
- Approval flow and direct-add converge on the same `studentIds` end state via different writes.

## How to verify changes

`npm run dev`; teacher: create group → student joins by code → approve request; author a reading test and check the `ielts_reading_tests` doc + the view simulator; confirm the localStorage draft behavior if touching the builder.
