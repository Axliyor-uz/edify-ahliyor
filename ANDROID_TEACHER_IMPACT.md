# Android TEACHER impact ledger

One line per change that the Android **teacher** app (`/home/matimatik/AndroidStudioProjects/EdifyTeacher`)
must mirror. Consumed (and pruned back to this header) by that repo's `/sync-web` command.

Format: `- YYYY-MM-DD · <files> — <what the Android teacher app must mirror>`

What belongs here: anything touching `app/teacher`, a Firestore document
shape/query/rule the teacher panel reads or writes, or a contract under
`app/api/teacher|ielts|auth|account|directory|analyze|tts` and the
`app/teacher/create/**/api` route handlers. Shared `lib/`/`services/` changes
count too — the teacher panel imports the same question schema, Rasch maths and
IELTS libraries the student runner does.

⚠️ Keep Firestore shapes **additive-only**: APK rollouts lag web deploys by days,
so an old teacher client keeps writing the old shape. If a change is genuinely
breaking, say so in the line — the Android side then raises
`appConfig/androidTeacher.minRequiredVersionCode` after the next Play release.

<!-- Baseline: the Android teacher app was ported 1:1 from this repo at commit
     ae18a08 ("publish", 2026-07-30), working tree clean. Every app/teacher route
     is native. -->
<!-- synced through ae18a08 by EdifyTeacher sync (2026-07-31) -->
- 2026-07-31 — `lib/ielts/types.ts` (`IeltsCatalogControls`), `services/ieltsService.ts` (`fetchPlatformTests(skill, {audience})`, `compareCatalog`, `carryCatalog`, `setPlatformTestVisibility`, `savePlatformTestOrder`), `lib/ielts/importValidation.ts` (new), `app/teacher/ielts/{reading,listening}/page.tsx`, `app/teacher/ielts/groups/[groupId]/_components/AssignTestModal.tsx`, `app/admin/ielts/page.tsx`, `data/ielts practise/*`, `docs/IELTS.md`: **the IELTS platform dataset is now an admin-curated catalog.** The four `ielts_*_tests` docs and `ielts_test_meta/{testId}` gained three **additive, optional** fields — `catalogOrder?: number`, `hiddenFromStudents?: boolean`, `hiddenFromTeachers?: boolean` — written only by `/admin/ielts`. Mirror everywhere the teacher app lists PLATFORM tests (the Reading/Listening "Platform" tab and the assign-test picker): **drop docs with `hiddenFromTeachers == true`, then sort ascending by `catalogOrder`, missing/non-numeric last, tie-break title A→Z** (`compareCatalog`) — and do **not** re-sort platform tests by `createdAt` as the web pages used to. Filter/sort client-side: a `whereNotEqualTo` query drops legacy docs that lack the field. Absent = visible. ⚠️ If the app ever saves a platform test, it must carry these three fields across from the existing doc (`carryCatalog`) — a re-save that omits them wipes the admin's order. The teacher's OWN tests are unaffected. No rules change, no new index, no API change.
