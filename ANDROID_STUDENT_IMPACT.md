# Android STUDENT impact ledger

One line per change that the Android **student** app (`/home/matimatik/AndroidStudioProjects/EdifyStudent`)
must mirror. Consumed (and pruned back to this header) by that repo's `/sync-web` command.

Format: `- YYYY-MM-DD | <files> | <what the Android student app must mirror>`

<!-- Baseline: the Android student app was ported 1:1 from this repo's working tree
     of 2026-07-20 (every app/(student) page incl. the RASCHmodel suite, lib/xp,
     questionSchema, Exam*/RASCH* libs, checkers). Synced through the commit that
     introduces this file. -->
<!-- synced through 986f880 by EdifyStudent sync (2026-07-21) -->
- 2026-07-29 · `lib/RASCHquiz.ts` (`testTypeFor`/`teacherQuizItem`), `docs/RASCH_QUIZ.md` — an open **ko'p savolli** block (`multi_part` with typed parts) is now filed as test type **`O`** instead of `Y-1`/`Y-2`; blocks are judged by `isClosedQuestion` (a `shared_options` pool, or per-part option lists, stays closed). Mirror it wherever the Android app derives a test type for a teacher-picked item; stored `teacher_rasch_quizzes.items[].testType`/`sectionId` change for NEW papers only (existing papers keep their snapshot), and rendering is unaffected — `examMode` returns `'block'` before reading `testType`.
- 2026-07-29 · `data/rasch-default-paper.json` (new), `lib/RASCHdefaultPaper.ts` (new), `app/teacher/create/rasch/build/page.tsx`, `docs/RASCH_QUIZ.md` — a teacher can now fill a paper from a bundled 45-question **default variant** ("Namunaviy variant"). Teacher-side only, but the items it writes into `teacher_rasch_quizzes.questions[]` are `source: 'teacher'` snapshots with ids `rasch-default-NN` and `qType` `mcq`/`numeric`/`open` — the student runner must keep rendering them off `examMode` (typed input for the ten O items) with no lookup by id, since no `teacher_questions` document backs them.
- 2026-07-29 · `lib/RASCHmarks.ts`, `app/teacher/create/rasch/results/[quizId]/page.tsx`, `docs/RASCH_QUIZ.md` — dynamic marks are no longer a per-section budget: every question is now priced across the WHOLE paper (`weight = exp(0.35·difficulty logit)`, ball clamped to `BALL_MIN 1.3`…`BALL_MAX 6.0` via a water-filling solve, total exactly `PAPER_TOTAL 100`); `SlotMark.sectionBudget` → `sectionTotal` (reported after the split, not reserved), `LOGIT_SLOPE`/`MULT_MIN`/`MULT_MAX` → `BALL_SLOPE`. Reads only `teacher_rasch_results.items` — no document shape change — but any Android port of RASCHmarks must mirror the new allocator or the two clients will show different balls for the same cohort.
