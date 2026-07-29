# Android STUDENT impact ledger

One line per change that the Android **student** app (`/home/matimatik/AndroidStudioProjects/EdifyStudent`)
must mirror. Consumed (and pruned back to this header) by that repo's `/sync-web` command.

Format: `- YYYY-MM-DD | <files> | <what the Android student app must mirror>`

<!-- Baseline: the Android student app was ported 1:1 from this repo's working tree
     of 2026-07-20 (every app/(student) page incl. the RASCHmodel suite, lib/xp,
     questionSchema, Exam*/RASCH* libs, checkers). Synced through the commit that
     introduces this file. -->
<!-- synced through 2de0626 by EdifyStudent sync (2026-07-28): teacher rasch quizzes + skills axis, IELTS upgrade, translation batch (no-op) -->
<!-- synced through 96d88a7 + the 2026-07-29 WORKING TREE by EdifyStudent sync (2026-07-29):
     IELTS API error codes, /api/ielts/check self-check, /api/ielts/analyze-writing +
     aiEstimate/teacherGrade.criteria, ielts_test_meta library cards, hub journey card +
     weak-type deep link, joinCode hidden from members, self-practice copy; center-managed
     IELTS groups (tabbed group page with Schedule/Attendance from the linked class,
     CENTER_MANAGED join refusal, IELTS twins hidden from the classes list); tabbed
     My Center + center switcher + merged weekly board; dashboard today's-lessons widget;
     "Markazim" nav destination.
     ⚠️ Those student changes were still UNCOMMITTED here when they were ported — when
     they land in a commit they will reappear in the next `2de0626..HEAD`-style diff.
     They are DONE; do not port them twice. -->
