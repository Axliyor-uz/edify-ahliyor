# Android impact ledger

One line per change that the Android manager app (`/home/matimatik/AndroidStudioProjects/EdifyManager`)
must mirror. Consumed (and pruned back to this header) by the Android repo's `/sync-web` command.

Format: `- YYYY-MM-DD | <files> | <what the Android app must mirror>`

<!-- Synced through web commit 3ea8690 PLUS the uncommitted working tree of 2026-07-29
     (center IELTS groups: /api/manager/ielts-groups, IeltsOverviewTab, roster/settings
     twin mirroring, center_students-anchored add-to-group picker + multi-select,
     center_students-anchored dashboard student KPI) — consumed 2026-07-29.
     Deliberately NOT ported: the manager panel visual redesign and the uz/ru/en
     switcher (Android is Uzbek-only and has its own design system). -->
- 2026-07-31 — `lib/ielts/types.ts`, `services/ieltsService.ts`, `lib/ielts/importValidation.ts` (new), `app/admin/ielts/page.tsx`, `docs/IELTS.md`: **IELTS platform-catalog fields** — `ielts_test_meta` and the `ielts_*_tests` docs gained optional `catalogOrder` / `hiddenFromStudents` / `hiddenFromTeachers`, written only by the super-admin panel. **No-op for the manager app**: it reads neither the test banks nor `ielts_test_meta` (its IELTS surface is the group pair + the read-only overview API). Logged only because the ledger tracks every Firestore shape change. No rules change, no new index, no `/api/manager|directory|auth` change.
