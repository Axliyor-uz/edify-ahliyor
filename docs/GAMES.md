# GAMES — classroom games built from a teacher's own tests

> **Agent workflow:** read this BEFORE touching `app/teacher/games/*`, `services/teacherTestService.ts`, or the tests-library quick-launch button; update it in the same change whenever you alter behavior described here. Index: [README.md](README.md).

**Last verified:** 2026-10-18 (uncommitted, on top of `0bbf31c`).

## Purpose & scope

`/teacher/games` is a catalogue of projector games that play questions from the teacher's **own tests** (`custom_tests`, built in `/teacher/library/tests`). Three games are live: **Arqon tortish** (tug of war), **Savol doskasi** (Baamboozle-style question board) and **Omad g'ildiragi** (lucky wheel). Live quiz is a "Tez kunda" card with no code behind it.

**No Firestore writes, no rules, no index.** The only read is the teacher's own `custom_tests` (same query shape as the tests library). Game results are not saved anywhere.

## Key files

| File | Responsibility |
|---|---|
| `app/teacher/games/page.tsx` | Hub: clean cards (animated scene, name, one line, full-width button). The whole card is the link; the button is a styled span. Non-live cards show a grey "Tez kunda" button |
| `app/teacher/games/_components/{TestPicker,Confetti}.tsx` | Shared by every game: test picker (strings via the `PickerText` shape) and the confetti burst |
| `app/teacher/games/_components/{TeamBar,QuestionCard,Podium,StageBackdrop,TeamGameSettings,PlayControls}.tsx` | Shared by the **team games** (board + wheel), presentational, each takes its strings as a small `*Text` shape: team cards with counting scores + floating "+20"; the open question (generic props: `question`, `turn`, `nextTeam` — `null` → the button reads "Natijalar", `badge`, `morphId`…; timer ring, answers, result + one Continue); full-screen result podium; floating backdrop shapes; setup blocks `TeamSetup` / `TimerField` (− / + stepper) / `QuestionSummary`; footer `ControlButton` + `PauseOverlay` |
| `app/teacher/games/_lib/{stage,ranking}.ts` | Team-game colors (`GAME_TEAMS` ×4, `STAGE` page wash / tile faces / correct / wrong / gold, `OPTION_COLORS`) and `ranking` (equal scores share a place) |
| `app/teacher/games/_lib/sound.ts` | Shared Web Audio sound kit (`sfx.*`, synthesized, no files) + `useGameSound()` → `[muted, toggle]`, persisted in localStorage `edify.games.muted` |
| `app/teacher/games/_lib/useBigScreen.ts` | Shared `(min-width:768px) and (orientation: landscape)` check for play views |
| `app/teacher/games/question-board/page.tsx` | Savol doskasi: setup ↔ full-screen board, sounds, keyboard, pause, exit/finish guards |
| `question-board/_lib/engine.ts` | **All board rules** as a pure reducer: tiles (10/20/30 points each, `buildPoints`), turns, timer |
| `question-board/_lib/i18n.ts` | Every board string, uz/ru/en |
| `question-board/_components/{BoardSettings,TileGrid}.tsx` | Settings (shared blocks + board size); tile grid (gloss, shine wave, used tiles show ✓ +points or ✗). The question card morphs out of the tile (`morphId`) |
| `app/teacher/games/lucky-wheel/page.tsx` | Omad g'ildiragi: setup ↔ full-screen wheel, landed beat → reveal timer, sounds, keyboard, pause, exit/finish guards |
| `lucky-wheel/_lib/engine.ts` | **All wheel rules** as a pure reducer: `SEGMENTS` (12: 10–50 points, one ×2, one Bankrot), turns/rounds, multiplier, timer, `isLastTurn`, `questionsNeeded` |
| `lucky-wheel/_lib/{theme,i18n}.ts` | Fixed wheel colors (`WHEEL`, `WEDGE_FILLS`); every wheel string, uz/ru/en |
| `lucky-wheel/_components/Wheel.tsx` | The wheel: static rim + blinking bulbs → rotating disc (wedges, labels, pegs) → static gloss → flapping pointer → hub button (spin, then the landed value). Spin animation + drag-flick |
| `lucky-wheel/_components/{WheelSettings,BankruptCard}.tsx` | Settings (shared blocks + rounds, `roundChoices`); the Bankrot card |
| `app/teacher/games/_components/GameArt.tsx` | The 4 animated card scenes (tug uses the real `Puller` + `FIELD`; quiz/board/wheel use M3 tokens so palettes and dark mode work). `on=false` → still frame |
| `app/teacher/games/_lib/questionDeck.ts` | Shared by every game: eligibility, `analyzeTest`, `buildDeck` (shuffle + option re-lettering), time estimates, `MIN_GAME_QUESTIONS = 6` |
| `services/teacherTestService.ts` | Read-only `fetchActiveTeacherTests(uid, pageSize, cursor)` / `fetchTeacherTest(id, uid)` (returns null if not the caller's) |
| `app/teacher/games/tug-of-war/page.tsx` | Setup ↔ full-screen play: game clock, keyboard, pause, exit guard, fullscreen |
| `tug-of-war/_lib/engine.ts` | **All rules** as a pure reducer; time is passed in (`now`) |
| `tug-of-war/_lib/teams.ts` | Blue/red team colors + `FIELD`, the chosen "Maydon" (sports field) look: blue/red split page, sky arena, grass mat, yellow timer (red last 10 s). The only hard-coded game colors |
| `tug-of-war/_lib/i18n.ts` | Every game string, uz/ru/en |
| `tug-of-war/_components/RopeArena.tsx` | SVG stage (viewBox cropped to the action): floor + lanes, win flags, rope (tension sag + shake per pull) with tails on the floor, 4 pullers as one spring group, dust/skid puffs, ribbon |
| `tug-of-war/_components/Puller.tsx` | One figure: rig of body/legs/torso pivots + 5 face expressions; the `Pose` contract (= designer brief below) |
| `tug-of-war/_components/Scoreboard.tsx` | Top bar (names, scores, test title) + `TimerPill` + `TugMeter` (rope position cells) used in the arena panel |
| `tug-of-war/_components/TeamPanel.tsx` | One team's question, answer buttons, correct/wrong feedback, freeze ring |
| `tug-of-war/_components/{Countdown,ResultCard,Confetti,TestPicker,GameSettings}.tsx` | The rest of the UI |
| `app/teacher/library/_components/TestCard.tsx` | Gamepad button → `/teacher/games/tug-of-war?testId=…` (active tests only) |

## Flows

**Eligibility** (`questionDeck.ts`): a question is playable iff `!isBlock && answerMode === 'single' && 2 ≤ optionList.length ≤ 6 && answer ∈ option ids`, i.e. mcq + true_false. Others are counted as skipped by reason: `open` (typed), `multi` (multiple_select…), `block`, `broken` (no or invalid correct answer). Grading goes through `isAnswerCorrect` (docs/QUESTIONS.md).

**Setup:** pick a test (paginated 12/page, title search on loaded rows; tests with fewer than 6 usable questions are disabled), two team names (max 20 chars, empty → default), time `1·2·3·5 min | ∞`. The summary shows usable/total, skipped by reason, and an estimate of `n × 8 s / 2 teams`. If usable is below what the chosen time needs (`neededForMinutes`), a non-blocking warning appears. With fewer than 6 usable, Start is disabled.

**Play (engine):**
- `init` → `countdown` (3-2-1-Go, 3.2 s) → `begin` draws one question per side from **one shared shuffled pile**. Each question is used once per game, so a faster team simply gets through more.
- **Correct:** rope moves 1 step toward that team (`rope < 0` = blue), green flash for `CORRECT_FLASH_MS = 650`, then the side draws next. `|rope| ≥ WIN_STEPS (5)` → instant win (`finishReason: 'rope'`).
- **Wrong:** the side is frozen for `FREEZE_MS = 2000` and then gets a NEW question. The wrong question is discarded and **the correct answer is never shown**. The rope does not move.
- Clock 0 → `'time'`; winner by rope sign, 0 = draw.
- When the pile is empty and both sides have no question or feedback → `'questions'`.
- `pause` stores `pausedAt`; `resume` shifts `endsAt`, every feedback `until` and `lastPullAt` by the paused span.
- The page drives `tick` every 100 ms only while `playing`. Keyboard: blue `1–4`, red `7 8 9 0`, `P`/Space = pause.

**Play layout:** top bar (team names + scores, test title) → 3 columns `1 : 1.2 : 1` (`1 : 1.45 : 1` from `xl`). Center panel = timer (top) · stage, vertically centered in the free height (`RopeArena` svg `h-full w-full`, `meet`) · rope meter + "1 tortish qoldi" (bottom). Teacher controls (pause, fullscreen, exit) sit **bottom-left on their own footer row**, under the three columns, so they can never cover a team's answers. No keyboard hint is shown (clean screen); the keys still work. The pause screen carries its own Resume + Exit, because it covers the arena controls.

### Savol doskasi (question board)

**Setup:** pick a test (same picker/eligibility, ≥ 6 usable), 2–4 teams (blue, red, green, yellow; names editable, max 20), time per question via a **− / + stepper** (5 s steps, 5–300 s; from "off" either button turns it on at 30 s) or the quick chips `15 · 30 · 60 s | off`, board size `12 · 16 · 20 · 24` (sizes above the usable count are disabled; a test with 6–11 usable gets one size = all of them). Tiles take a random slice of the shuffled deck.

**Play (engine):**
- Board → the team whose turn it is picks a tile → `answers` (question AND its options open together; the timer starts here) → teacher taps the option the team said → `result`. Pressing **Start** also enters browser full screen (inside the click, so the browser allows it; a refusal is ignored).
- **Correct:** the tile's points (10/20/30, shown only now) go to the team: "To'g'ri! +20 ochko", the score counts up and "+20" floats on the team card. Then ONE button: "Davom etish" (in the next team's color).
- **Wrong / time-out:** no points; the correct answer is highlighted green, then "Davom etish". Nothing else is shown (kept deliberately clean).
- `next` → the turn passes to the next team in order (always, right or wrong). When no tiles are left → `finished`. "Finish game" (board phase, with confirm) ends early.
- No surprise tiles or gift boxes — removed 2026-10-18 at the user's request ("just show the points earned and continue"). `buildPoints` spreads 10/20/30 evenly in random spots.
- Pause (only while a timed question is open) shifts `endsAt` by the paused span and covers the screen. Opening the exit dialog pauses too; cancel resumes.
- `ranking`: equal scores share a place (1, 1, 3). Two teams tied for first → "Durang!".
- Keyboard: Enter/Space = continue, A–F or 1–6 = answer, P = pause.
- Sounds: flip (pick), tick (last 5 s), correct/wrong/timeout, win. Mute button in the footer.

**Result screen (`Podium`):** opaque full-screen overlay (stage wash + a glow in the winner's color) — only: trophy medallion with slowly turning gold rays, "G'olib" + the winner's name, the podium, and two buttons (Qayta o'ynash, Sozlamalar); an X in the corner leaves to the games hub. Sequence: bars rise from last place to first (scores count up from 0 on each), then the trophy and name land, confetti in the winner's color (`Confetti` `delay` prop), then the buttons. Ties share a place and bar height; a tie for first shows a handshake + "Durang!" and no confetti. No per-team correct/wrong stats (kept clean on purpose).

**Play layout:** team cards (active one raised with a team-color ring + "Navbat") → "X, katak tanlang!" pill → tile grid filling the free height (`gridShape`: 12 → 4×3, 16 → 4×4, 20 → 5×4, 24 → 6×4) → footer (controls left, tiles left center, Finish right). The question card overlays only the board area, so the team cards (and their score floats) stay visible.

### Omad g'ildiragi (lucky wheel)

**Setup:** same test picker, teams (2–4) and timer stepper as the board, plus **rounds** `3 · 5 · 8 · 10` (one round = one spin per team). A round count is disabled when `teams × rounds` (`questionsNeeded`) exceeds the usable questions; a short test gets one fitting count (`floor(usable / teams)`). The deck is cut to exactly that many questions.

**Play (engine phases `spin → spinning → landed → answers → result → spin…`, `finished`):**
- **Spin:** a student flicks the wheel (drag → release faster than `MIN_FLICK` 0.25°/ms; the speed sets turns/duration and the flick direction sets the spin direction), or the teacher taps the hub **Aylantir** button / presses Space or Enter. A gentle drag shows "Kuchliroq aylantiring!". The page picks `target = random segment` and dispatches `spin`; the wheel animates to it (4–8 turns, 4.2–6.2 s, ease-out) and dispatches `land`.
- **Points** (10–50): `landed` beat (the wedge glows, the hub shows the value, "50 ochko" pill, ding) → after 1.1 s `reveal` opens the shared question card worth `value × multiplier` (badge shows it). Correct → the points + confetti; wrong / time-out → nothing, the correct answer is shown. One Continue → next team.
- **×2:** gold beat + gold confetti → after 1.5 s the SAME team spins again with `multiplier × 2` (max ×4; the prompt shows "yana aylantiring! ×2").
- **Bankrot:** straight to `result` with the Bankrot card: no points this turn, **earlier points are kept** (the user's choice — kinder than the TV rule), no question used, multiplier reset.
- `next` → the next team; after the last team the round advances. After round `rounds` (or when the deck is empty) → `finished` → the shared `Podium`. "Finish game" (spin phase, with confirm) ends early.
- Keyboard: Space/Enter = spin or continue, A–F or 1–6 = answer, P = pause (timed question only).
- Sounds: `peg` click per peg passed (throttled 35 ms), `land`, `double`, `bankrupt`, plus correct/wrong/tick/timeout/win.

**Play layout:** team cards → prompt pill ("X, g'ildirakni aylantiring!") → the wheel (square, `min(97% of the free height, 58vw)`) → footer (controls left, "2-raund / 5" + round pips center, Finish right). The question / Bankrot card overlays the wheel area only, so the team cards stay visible.

## Invariants & traps

- ⚠️ **Anti-cheat is by design; don't "simplify" it.** Each question appears once per game and never on both sides. MCQ options are reshuffled and re-lettered by position (true_false keeps its order). A miss never reveals the answer. Pause covers the whole screen with an opaque layer.
- ⚠️ **Team colors are hard-coded on purpose** (`teams.ts`): blue/red must survive every palette. Tints use `color-mix(…, var(--m3-surface-container-lowest))` so dark mode works. Never inline team hex elsewhere; import `TEAM_THEME`.
- ⚠️ Poses and animations are **derived from engine state** (`clock`, `lastPullAt`, `pulls`/`misses` counters used as React keys). Don't add effects/timeouts to drive them. One-shot animations (dust, ribbon swing, score pop) remount by key.
- ⚠️ **Sizes are fluid:** every play-view size is `clamp(min, vw+vh, max)` (question tiers by length, answers, badges, scoreboard, timer, meter, controls), so laptops, projectors and landscape tablets get no breakpoint jumps. Keep new play-view sizes in the same form. Fixed `text-[Npx]` there breaks small or 4K screens.
- Motion: everything is gated on `MOTION_ON && !useReducedMotion()`. Off → no idle loop, dust or confetti, and short fades instead. Only transform/opacity animate.
- ⚠️ **The play view is portaled to `<body>`** (`createPortal`). The shell wraps every page in a transformed `motion.div` (`pageTransition`), and `position: fixed` inside a transformed ancestor is fixed to THAT box, so the sidebar sat on top of the game and cropped the blue panel. Theme tokens live on `<html>`, so they still apply; the portal root re-adds `t-canvas font-t-body`. It needs `(min-width: 768px) and (orientation: landscape)`; otherwise it shows a "use a big screen" message.
- ⚠️ **Rig pivots:** framer rotates SVG groups around their bounding box, so every pivot group in `Puller` holds an invisible `<Pivot>` square centered on its joint (origin 50%/50%). Don't remove it or move joints without moving the pivot. `ROPE_Y = GROUND − 65` matches the hand position at the base lean (−26°); change both together.
- `useSearchParams` requires the page's `<Suspense>` wrapper (Next 16 build).
- ⚠️ **Board tile ↔ card morph** uses framer `layoutId={`tile-${n}`}`: the active tile renders as a plain empty slot (no layoutId) while the card's background holds the id; used tiles keep the id so the card shrinks back into them. Two mounted elements with the same id break the morph. Off when motion is off.
- ⚠️ **framer springs take only 2 keyframes.** `type: 'spring'` + an array like `scale: [1, 1.05, 1]` throws at runtime ("Only two keyframes currently supported with spring") and kills the component — the board's result row once never rendered because of it. Give keyframe props their own tween: `transition={{ default: {type:'spring',…}, scale: { duration: 0.5 } }}`.
- ⚠️ **`.m3-interactive` forces `position: relative`** (unlayered CSS in `components/ui/theme.css` beats Tailwind's `absolute`). An absolutely placed button with that class drops into normal flow — the podium's ✕ once landed on the trophy. Put the position on a wrapper `div` instead.
- Team-game colors are a deliberate hard-coded exception like `teams.ts`; keep them in `games/_lib/stage.ts` (wheel wedges in `lucky-wheel/_lib/theme.ts`).
- ⚠️ **The wheel result comes from the engine, never from the drag.** `spin` carries a random `target`; the flick only chooses strength/direction and the animation solves the angle to land inside that wedge (± jitter). Don't derive the result from where the wheel physically stops — a slow, careful drag could then steer it.
- ⚠️ **framer's `style={{ rotate }}` / `animate` writes the whole `transform`,** so a Tailwind `-translate-x-1/2` on the same element is lost (the wheel pointer and the "spin harder" chip once jumped off-center). Center with a wrapper `div`, animate the inner element.
- ⚠️ **Shared team-game components are presentational.** Each game's engine owns its rules and maps its state to their props (`QuestionCard` knows nothing about tiles or wheels). Add rules to the engine, not to the shared card.
- Sounds must start from a click (browser autoplay policy). Every game starts from a click, so the lazy `AudioContext` in `sound.ts` is always allowed. Never call `sfx` on mount.
- The Games nav entry is appended late in `navItems` (topbar inlines `slice(0, 5)`). Its `soon` flag support stays in the layout for future items.

## Designer brief: Rive character (planned replacement for `Puller`)

The user chose designer animation (Rive) for the final characters. Until a file exists, `Puller.tsx` is the shipping placeholder. A delivered file must match this contract so it drops in without touching the engine:

- **One artboard `Puller`**, facing RIGHT, feet at the artboard's bottom-center; the hands must sit at **65 units above the feet** (the rope height) in the base pull pose. The game mirrors it for the Red team.
- **Team color** comes from an input, not separate files: a number input `team` (0 = blue `#2563eb`, 1 = red `#dc2626`) or a bound color property. A second shade (`#1e40af` / `#991b1b`) is used for the back puller.
- **State machine `pose`** with one number input `pose`: 0 stand (ready stance, hands on the rope), 1 idle (looping strain), 2 heave (one-shot ~0.45 s backward step + strong lean), 3 lurch (one-shot ~0.45 s dragged forward, surprised face), 4 droop (after a wrong answer), 5 fall (one-shot, ends lying down), 6 cheer (looping hop, happy face). Expressions are part of each state (strain / surprised / sad / happy).
- Style: minimal flat, Uzbek-inspired (doppi cap, atlas/ikat shirt pattern), readable at ~150 px tall on a projector, light and dark backgrounds.
- Integration plan: add `@rive-app/react-canvas`, render one `<Rive>` per figure inside the arena group, map `poseFor()` → the `pose` input; keep `Puller` as the fallback when the file fails to load or motion is off.

## Known issues / dead code (verified 2026-10-17)

- The non-live hub card (live quiz) is a placeholder with no route.
- The TestCard quick-launch only opens Arqon tortish; the board and the wheel are reached from the hub (both accept `?testId=`).
- Arqon tortish has no sounds yet (the board does). Results are not persisted (deliberate for v1).

## How to verify changes

`npx tsc --noEmit`, `npx eslint app/teacher/games`. Then `npm run dev` → `/teacher/games` → Arqon tortish:
1. A test with fewer than 6 usable questions is disabled; a mixed test shows correct skipped counts.
2. A 1-min game: correct answers pull the rope, and the score pops; a wrong one shakes and shows the 2 s lock without revealing the answer; when time runs out the result is correct (winner or draw).
3. ∞ with a small test ends with "Savollar tugadi"; a 5-step lead wins instantly with confetti.
4. Pause hides everything; Exit asks for confirmation; Play again reshuffles; keys 1–4 / 7–0 work; LaTeX and images render.
5. Check light, dark and a second palette: blue and red stay distinct.
6. The TestCard gamepad button opens setup with that test's summary preloaded.
7. Board: a test with 8 usable → only one size chip (8). With 3 teams + 15 s: Start goes full screen; options open with the question; a correct answer shows "+N ochko" and the score counts up; wrong shows the right answer; the timer runs out → "Vaqt tugadi"; pause during a question hides it. The last tile → podium; Finish early → confirm → podium; ties share a place. Mute persists after reload.
8. Wheel: 2 teams + 3 rounds. Flick the wheel hard → long spin, pointer flaps and clicks; a gentle drag → "Kuchliroq aylantiring!"; Space spins too. Points → the value pops in the hub, then the question opens worth that much. ×2 → gold beat, same team spins again for double. Bankrot → the card, scores unchanged, next team. After 3 rounds → podium (the last card's button reads "Natijalar").
