# Android STUDENT impact ledger

One line per change that the Android **student** app (`/home/matimatik/AndroidStudioProjects/EdifyStudent`)
must mirror. Consumed (and pruned back to this header) by that repo's `/sync-web` command.

Format: `- YYYY-MM-DD | <files> | <what the Android student app must mirror>`

<!-- Baseline: the Android student app was ported 1:1 from this repo's working tree
     of 2026-07-20 (every app/(student) page incl. the RASCHmodel suite, lib/xp,
     questionSchema, Exam*/RASCH* libs, checkers). Synced through the commit that
     introduces this file. -->
- 2026-07-21 | app/(student)/games/checkers/** | Checkers rebuilt: strict Russian shashki rules module (rules.ts — ghost captures until chain end, king landing-continuation rule, mid-chain crowning), new engine.ts (full-chain negamax + alpha-beta + iterative deepening + quiescence + TT; level 5 ≈2.6s unbeatable, levels 1-4 scored mistakes) run off the UI thread (aiWorker.ts → Android: coroutine on Default dispatcher), draw rules (threefold repetition / 30 quiet king moves; draws pay 0 XP), 3 board themes (wood default/green/slate) persisted locally, synthesized sounds + mute (Android: add haptics), online doc field mustJumpPiece now stores chain state {pos, ghosts} and winner may be 'draw'. Port engine+rules 1:1 to core/games/, rework CheckersScreen accordingly.
