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
