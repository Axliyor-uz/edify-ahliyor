# Android STUDENT impact ledger

One line per change that the Android **student** app (`/home/matimatik/AndroidStudioProjects/EdifyStudent`)
must mirror. Consumed (and pruned back to this header) by that repo's `/sync-web` command.

Format: `- YYYY-MM-DD | <files> | <what the Android student app must mirror>`

<!-- Baseline: the Android student app was ported 1:1 from this repo's working tree
     of 2026-07-20 (every app/(student) page incl. the RASCHmodel suite, lib/xp,
     questionSchema, Exam*/RASCH* libs, checkers). Synced through the commit that
     introduces this file. -->
<!-- synced through 986f880 by EdifyStudent sync (2026-07-21) -->
<!-- 2026-07-24 | app/(student)/layout.tsx, components/student-ui/Shell.tsx + shellStyles.ts (new), design.config.ts, plus translation completion across app/(student)/** (exam review, ielts hub/join, exam runner, checkers, explore). Client-only: many new nav shell/bar variants (App_shell_navigation renamed shell_a/b/c→rail/sidebar/topbar + classic/tonal/inverse/gradient/minimal/floating; Mobile_navigation adds iconic/topline) and finished uz/ru/en coverage. NO Firestore shape or API contract changes — nothing functional to mirror. -->
