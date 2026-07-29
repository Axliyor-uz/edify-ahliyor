# RASCH_QUIZ — teacher-built Rasch papers, opened by a 6-digit code

> **Agent workflow:** read this BEFORE touching `app/teacher/create/rasch/*`,
> `app/(student)/RASCHmodel/quiz/`, `lib/RASCHquiz.ts`,
> `services/teacherRaschQuizService.ts`, the shared runner components in
> `app/(student)/RASCHmodel/_components/`, or the `teacher_rasch_quizzes` /
> `teacher_rasch_results` collections. Update it in the same change whenever you
> alter behavior described here. Index: [README.md](README.md).
> The ability model itself (θ, levels, diagnosis) is in [STUDENT.md](STUDENT.md)
> and [RASCH_SKILLS.md](RASCH_SKILLS.md); the question schema is in
> [QUESTIONS.md](QUESTIONS.md).

**Last verified:** 2026-07-29 (dynamic per-question marks from the cohort; per-slot outcomes on the result document).

## Purpose & scope

`/RASCHmodel/exam` draws a 45-question paper from the blueprint. That measures a
student against the national spec, but a teacher cannot say *which* 45. This
subsystem lets them: pick questions from either bank or write new ones, publish
the paper behind a private six-digit code, and see who sat it.

The paper is **not a second test system**. It is sat in the same runner, graded
by the same functions, and scored into the same `RASCH_levels/{uid}` document as
a mock exam — which is the whole reason it is 45 questions.

## Key files

| File | Responsibility |
|---|---|
| [types/TeacherRaschQuiz.ts](../types/TeacherRaschQuiz.ts) | The document shapes: `TeacherRaschQuiz`, `RaschQuizItem`, `RaschQuizResult`. |
| [lib/RASCHquiz.ts](../lib/RASCHquiz.ts) | Pure layer — code generation, picked-question → stored item, `hydrateQuiz`, slot/topic/difficulty counts, the per-dimension quota rules (`checkQuizAdd`, `quizQuotaGaps`), size guard. No Firestore. |
| [services/teacherRaschQuizService.ts](../services/teacherRaschQuizService.ts) | Every read and write. Nothing else touches the two collections. |
| `app/teacher/create/rasch/page.tsx` | The teacher's papers: code, status, edit, results, delete. |
| `app/teacher/create/rasch/build/page.tsx` | The builder (`?id=` to edit). |
| `app/teacher/create/rasch/_components/QuestionPickers.tsx` | The two pools: `MyBankPicker` (own `teacher_questions`, default, with the closed/open filter) and `BankPicker` (`questions1`). |
| `app/teacher/create/rasch/_components/draft.ts` | The localStorage stash that survives leaving to write a question. |
| `app/teacher/create/rasch/results/[quizId]/page.tsx` | Who sat it; per-dimension 0–5 levels, per class **and per student**. |
| [lib/RASCHmarks.ts](../lib/RASCHmarks.ts) | **Dynamic marks** — cohort outcomes → what each question is worth, renormalised to 100. Pure. |
| [lib/RASCHband.ts](../lib/RASCHband.ts) | Band → colour/name, kit-agnostic. ⚠️ Read by BOTH UI kits — keep it free of component imports. |
| `app/(student)/RASCHmodel/quiz/page.tsx` | Code entry → intro → sitting → results. |
| `app/(student)/RASCHmodel/_components/ExamRunner.tsx` | **The paper**, shared with the mock exam. |
| `app/(student)/RASCHmodel/_components/ExamReview.tsx` | **The per-question review**, shared with the mock exam — a grid of slot numbers, one question per dialog. |

## Flows

### Building — one document, no refs

The builder has TWO pools and two ways to grow them.

1. **Mening savollarim** (the default tab) — the teacher's own
   `teacher_questions`, via `fetchMyQuestionsPage`, so blocks, images and typed
   answers arrive already normalized. A paper is normally built from questions a
   teacher wrote, which is why this tab comes first. Two filter rows, and they
   are applied in **different places on purpose**:
   - **Savol turi — Hammasi / Yopiq / Ochiq**, via `isClosedQuestion`
     ([types/question.ts](../types/question.ts)): a `shared_options` block counts
     as closed, a `multi_part` block only when every part carries options,
     exactly as `toExamItem` files them. ⚠️ **Client-side.** In Firestore it
     would need a `type in […]` equality beside `creatorId` +
     `orderBy createdAt` — a second composite index — and still could not
     express the per-part rule. So a filtered press walks up to **3 pages (30
     documents)** until something matches, and the picker prints what it read.
   - **Kim yozgan — Hammasi / AI / O'zim**, via `fetchMyQuestionsPage(…,
     methods)`: a `creationMethod in […]` on the *existing*
     `creationMethod + creatorId + createdAt` index, so it is **server-side** —
     a filtered page still bills 10 documents and shows all 10. The lists cover
     the legacy strings too (`general_ai`, `by_prompt`, `by_image`, `custom`…);
     **AI** includes image-read questions, since a machine wrote those as well.
     ⚠️ A document with no recognizable method appears **only** under Hammasi —
     guessing would file somebody's AI question under "written by me".
   Every row also carries the **quota badge of the dimension the question would
   land in** (`Geometriya 3/14`), and its Add button is disabled — reading
   *to'ldi* — once that dimension is at quota. `roomForItem` builds the item with
   the same `teacherQuizItem`/`bankQuizItem` the add uses, so the badge names the
   dimension the pick will actually move.
2. **Milliy baza** — `questions1` by chapter × difficulty, for topping up the
   sections the teacher has not written for yet. ⚠️ The query is exactly
   `topicId + chapterId + difficultyId` ordered by `rand`, the SAME single
   composite index the exam sampler rides. Adding a `subtopicId` equality, or
   ordering by anything else, silently demands a second index. The first page
   starts at a random `rand` threshold so two teachers building on the same
   chapter do not get the same ten questions; "load more" walks on from there. A
   pre-backfill document has no `rand` and is invisible here, exactly as in the
   exam. **Every chapter in the dropdown is labelled with its dimension's quota**
   (`05. Tenglama — 3/8`) and the selected one gets a banner saying how many are
   still needed — `topicForQuizChapter` resolves it through the same
   `sectionForChapter` the pick will use, so the teacher can see which sections
   are still open **before spending a single read**. ⚠️ Several chapters map to
   one dimension and therefore show the same numbers: they compete for the same
   slots, which is exactly what the label is there to say.

⚠️ **Both pools are needed.** The national bank was briefly removed on the
argument that a teacher's paper should hold only a teacher's questions; that put
a wall in front of the feature, because publishing needs 45 slots and a teacher
starting from an empty bank could not reach it. Own-questions-first plus a
top-up bank keeps the intent without the wall.

**Writing a new one leaves for the real builders**: two links, one per shape a
question can take — `/teacher/create/question` (single: mcq / written / numeric,
with images) and `/teacher/create/block` (several questions under one stem). An
embedded cut-down compose form shipped first and was removed too: a question is a
first-class bank document (images on the prompt AND on every option, blocks, the
validated topic path from `toQuestionV1`), and a second half-featured editor
would have drifted from the canonical one the moment either was touched. The new
question lands in `teacher_questions`, so pressing **Load** on return picks it up
newest-first.

⚠️ **Those links navigate, so the paper is stashed to localStorage first**
(`_components/draft.ts`, `stash()` on click). Without it, clicking one would
silently destroy up to 45 hand-picked questions — the builder holds the paper in
component state. The draft also closes a hazard that was already there: a
back-swipe used to lose the paper. On mount the **draft wins over the server
copy** when it belongs to the same `quizId` — it is only ever written when the
teacher leaves, so it is strictly newer, and loading the stored paper over it
would throw away exactly what the stash was protecting. It is cleared once the
paper is safely saved, and the restore is announced with a banner carrying a
"start over" action rather than happening silently. One draft at a time, 24h TTL;
the `quizId` rides inside the record so the loader can refuse another paper's.

Every add goes through `bankQuizItem` / `teacherQuizItem` → `slimQuizItem`, and
the whole paper is written as **one document**.

⚠️ **Questions are EMBEDDED SNAPSHOTS, not refs.** A ref list would cost 45 reads
per student per sitting; the snapshot makes a whole paper **one read** however
many students sit it, and it freezes the question — editing the source later can
never re-key a paper somebody already answered. Same choice
`custom_tests.questions[]` makes. The cost: a fixed paper does not pick up a
correction, which is the intended trade.

⚠️ **A Firestore document is capped at 1 MiB and this one holds 45 questions.**
`slimQuizItem` drops `solutions[].steps` (by far the largest field; only
`final_answer` is ever read, and only to grade an open item), the builder shows
the live size against `QUIZ_MAX_BYTES` (900 KB), and `saveQuiz` refuses to write
past it. Failing at the moment of saving 45 hand-picked questions is the worst
thing this feature could do to a teacher, so the ceiling is visible while there
is still something they can do about it.

### Positions are derived, never stored

`RaschQuizItem = Omit<ExamQuestion, 'slotNumber' | 'sectionLabel'>`:

- **`slotNumber`** — a `shared_options` block occupies one slot *per
  sub-question*, so inserting or reordering one question renumbers every question
  after it. `hydrateQuiz` stamps them on load.
- **`sectionLabel`** — a trilingual label that would otherwise be repeated 45
  times. Rehydrated from `sectionId` through the bundled `EXAM_BLUEPRINT`.

⚠️ **`sectionId` IS stored, and must be a real blueprint id.**
`toItemResponses` maps it to the levelling dimension and `archiveExam` files the
question under it; an id no blueprint row carries falls back to `'numbers'` and
silently credits the wrong dimension. `sectionForChapter()`
([lib/Examblueprint.ts](../lib/Examblueprint.ts)) is the only way to produce one —
it resolves from the SAME table `topicForChapter` uses, so a hand-picked question
lands in the dimension a drawn one would.

⚠️ **A `questions1` item is never filed as test type `O`.** `examMode()` reads the
test type for a bank item (a teacher item goes by its own `qType`), so an `O`
would hide the A–D options the teacher picked the question *for* and demand a
typed answer graded against a `final_answer` they never saw. `testTypeFor()`
gives a bank item `Y-1`/`Y-2` by difficulty and reserves `O` for typed teacher
items.

### Dynamic marks — how a section's budget is shared out (2026-07-29)

The DTM protocol prints a ball beside every question and they sum to exactly
100. Read one row at a time it is really a **budget**:

| Section | Budget | over |
|---|---|---|
| Sonlar va amallar (Y-1) | 3.5 | 2 questions |
| Algebraik shakl almashtirishlar (Y-1) | 20.6 | 11 |
| Tenglama va tengsizliklar (Y-1) | 11.4 | 6 |
| Funksiyalar (Y-1) | 3.5 | 2 |
| Matematik analiz asoslari (Y-1) | 4.4 | 2 |
| Geometriya (Y-1) | 13.6 | 7 |
| To'plam, mulohazalar… (Y-1) | 4.4 | 2 |
| Geometriya (Y-2) | 6.6 | 3 |
| Tenglama va tengsizliklar (O) | 6.4 | 2 |
| Funksiyalar (O) | 3.2 | 1 |
| Matematik analiz asoslari (O) | 6.4 | 2 |
| Geometriya (O) | 12.8 | 4 |
| To'plam, mulohazalar… (O) | 3.2 | 1 |

What the protocol cannot know in advance is *how that budget should split* —
which of the 11 algebra questions is the hard one. That is a claim about
difficulty, and difficulty is measurable. So
[lib/RASCHmarks.ts](../lib/RASCHmarks.ts) keeps every section total to the
decimal and lets its questions share it in proportion to how hard the cohort
found them.

```
weight_i = clamp(0.45, 1.6, 1 + 0.24 · ln((1−p̂)/p̂))      ← p̂ shrunk, see below
ball_i   = budget_section × weight_i / Σ weight_section    ← Σ ball = budget, exactly
```

Worked example — the algebra row (20.6 over 11) with 20 students, one question
solved by 1 of them and one by 19:

```
printed  2.2 2.2 1.3 1.3 2.2 2.2 2.2 1.3 2.2 1.3 2.2   = 20.6
dynamic  3.0 1.9 1.0 1.9 1.9 1.9 1.8 1.8 1.8 1.8 1.8   = 20.6
          ↑ 1/20 solved
                  ↑ 19/20 solved
```

- The table itself is `BlueprintSection.balls` in
  [lib/Examblueprint.ts](../lib/Examblueprint.ts) — one array per row of the
  official spec, in printed order. ⚠️ **The 13 arrays hold exactly `count`
  entries each and sum to exactly 100.** Every budget above is derived from
  them, so a typo there silently re-weights the paper.
- **Sections never trade with each other.** Geometriya Y-1 stays worth 13.6
  however badly the class did; only the split inside it moves. That is what keeps
  the paper at 100 and two sittings comparable.
- **`MIN_RESPONSES = 5`**, and a section moves as a whole or not at all. Under
  that it keeps the protocol's printed values, so an unsat paper marks exactly
  like the official table. ⚠️ A half-measured section would price measured
  questions against unmeasured ones, which is not a comparison.
- Weights use the **shrunk** proportion `(correct + 1.5)/(seen + 3)`, so one
  lucky answer cannot hand a question its section's whole budget.
- ⚠️ **The clamps matter.** Without `MULT_MIN`/`MULT_MAX` a question nobody
  solved would eat its section and the rest would round to zero — a paper where
  10 right answers score less than 1 is not a mark scheme. They bound the spread
  inside a section to ~3.5× between its cheapest and dearest question.
- `shareOut` does largest-remainder rounding in tenths **per section**, so each
  section lands on its budget exactly. ⚠️ Rounding each share on its own drifts:
  a section printed as 20.6 that adds to 20.3 makes the whole table look wrong.
- `sectionBalls(sectionId, n)` fits a row to what the paper actually holds.
  ⚠️ A teacher paper only has its **dimension** quotas enforced and Geometriya
  spans three sections (Y-1 ×7, Y-2 ×3, O ×4), so a legal paper can hold a
  different split. Padding repeats the section's modal ball, truncating keeps the
  printed order, and `paperTotal()` reports what the paper actually adds to
  rather than assuming 100.

⚠️ **Nothing is stored.** The marks are derived on every render from the sittings
that exist right now, which means **a question's ball moves when a classmate sits
the paper**. That is the feature, not a bug — the results page says so on screen.
Freezing them would need a snapshot per sitting and would answer a different
question ("what was it worth in March").

⚠️ **It does NOT touch θ or the student's levels.** Rasch already models item
difficulty through `b`; weighting the score by difficulty *and* feeding that into
the ability estimate counts the same evidence twice. The dynamic ball is the
**teacher's score**, on the teacher's page. The student's own result screen and
their 0–5 levels are unchanged.

⚠️ **It is per COHORT, not global.** The statistics come from the sittings of
*this paper*, which is what makes them meaningful — the same question in another
teacher's paper has its own audience. A global item statistic (for the mock exam,
where every student draws different questions) would need its own collection and
server-side writes; deliberately not built.

The data behind it is `teacher_rasch_results.items` — `{ [slotKey]: 0|1 }`, keyed
by **`examSlotKeys`** ([lib/ExamTeacher.ts](../lib/ExamTeacher.ts)), the one place
that vocabulary is defined. ⚠️ The same strings are `ItemResponse.id` and what
`cohortStats` aggregates; two spellings would scatter a paper's statistics
silently. Results saved before the field existed are **excluded** from the
statistics rather than counted as wrong, and their own dynamic score reads "—".

The results page renders it grouped **by section with its budget in the header**
(a flat grid of 45 hides the one rule that matters), each question showing its
printed value struck through when it moved, and each student's expanded row lists
the ball they took on every question. The card also carries the protocol's own
definitions: **Y-1** a closed item with one correct answer, **Y-2** a closed
matching item, **O** an open item with a short answer.

### The access code

Six **digits** — typeable on a phone number pad and readable aloud, unlike the
alphanumeric `custom_tests.accessCode`. Minted on the **first save** and never
regenerated: a teacher who has already read it out must not have it change under
them.

`reserveAccessCode()` queries for the code and retries up to 5 times before
accepting one. ⚠️ **That is a check, not a constraint** — two teachers generating
the same code in the same instant both pass, and `findQuizByCode` takes the first
`published` match, so the loser's students would open the winner's paper. Making
it airtight needs a `rasch_quiz_codes/{code}` reservation document; deliberately
not done yet. It is still strictly better than `custom_tests`, which has no check
at all.

### Sitting it

`findQuizByCode` is **one document read**: `where accessCode == … limit 2`, with
the status checked client-side so a *closed* paper is reported as closed rather
than as a wrong code (a student told "wrong code" retypes it forever).

From there the page is the mock exam with a different source:

- `hydrateQuiz` → `ExamQuestion[]`, shuffled once at lookup if the teacher asked
  for it (⚠️ **once**, not per render — re-shuffling would reorder a paper the
  student is halfway through). Shuffling moves **cards**, so a block is never
  split apart.
- The clock starts when **Start** is pressed, not when the code is entered, and
  runs on the quiz's own `durationMinutes`.
- The sitting is persisted to its own localStorage store
  (`RASCHmodel:quiz:v1`). ⚠️ **Separate key from the mock exam.** One key would
  mean starting a teacher quiz silently discards an exam still running against
  its clock. The store logic is written once (`createSessionStore` in
  [lib/Examsession.ts](../lib/Examsession.ts)) and instantiated twice.
- A paper whose deadline passed with **nothing answered** is abandoned, not
  submitted — identical rule to the mock exam, and it must never reach the
  account *or the teacher* as a 0% result for a paper nobody sat.

### Two writes on submit, deliberately independent

| Write | What it is | If it fails |
|---|---|---|
| `saveQuizResult` | the teacher's copy — `teacher_rasch_results/{quizId}_{uid}` | logged; the student still gets their level |
| `saveExamResult` | the student's own Rasch levels + `RASCH_attempts` row | surfaced on screen; the teacher still got the result |

They are two different facts and neither should be lost because the other failed,
so the teacher's copy is written **first** (it is what the student was asked to
do) and the level save follows. `savingRef` closes the double-save window on the
client; `saveExamResult`'s own `examId` check (the paper's `endsAt`) closes it
across tabs and reloads.

The result id is deterministic, so a **retake overwrites** — the same rule
`attempts/{uid}_{assignmentId}` follows, and the same reason: "how did the class
do" is a per-student question that goes wrong the moment somebody sits twice.

### Reporting: everything is the 0–5 level

The results page reports on the **0–5 Rasch level**, not on percentages. A
percentage answers "how much of this paper did they get", which depends on the
paper; a level answers "how hard a problem can they solve", which does not — and
it is the same scale the student sees on their own progress page. `correct/total`
rides alongside as the evidence, never as the headline.

That needs per-dimension ability, so `saveQuizResult` writes **`topicTheta`** —
`estimateAbility()` over each dimension's items, the same function the student's
own heptagon uses, so the two can never disagree about one paper.

- ⚠️ **Logits, not levels.** `thetaToLevel` has already been restretched once
  (0–3 → 0–5); storing the level would let a second restretch silently re-label
  every saved result.
- ⚠️ **A dimension the paper never touched is ABSENT from the map, never `0`.**
  Zero is a real ability; "not measured" is not. Same rule as the student-side
  heptagon, where `level: null ≠ 0`.
- The field is **optional** — results written before 2026-07-28 have none, and
  those dimensions render as "not measured". They are deliberately NOT
  back-derived from the percentage: under Rasch that is a different quantity.
- The class row averages **in logits, then maps once**. The 0–5 scale is
  piecewise-linear in θ, so averaging levels and averaging abilities give
  different numbers and only the second is the class's ability.
- ⚠️ **Thin dimensions are marked, not hidden.** Under `THIN_EVIDENCE = 4` items
  the level is shown dimmed with a "few items" tag: Rasch does not stop working
  on four items, but the standard error explodes, and a dimension touched twice
  can read 4.2/5 off one lucky answer. A teacher acting on that is being misled
  by a number that looks precise.

Each student row expands to their own seven dimensions, with the weakest and
strongest named outright — a class average tells you which topic is weak, not who
to help.

### Withholding the key

`showAnswers: false` makes `ExamReview` show only whether each question was
right — no correct answer, no per-part expected value, no explanation button. It
is a real mode, not styling: a teacher reusing a paper across two groups depends
on it. Any new surface in that component must respect `hideAnswers`.

⚠️ **The review is a GRID, not a list** (2026-07-28). 45 expanded cards meant
scrolling past everything you got right to reach the one you wanted. It is now
the same geometry as the runner's navigator — green/red/grey slot numbers — and
a tap opens that question in a dialog with prev/next arrows. **Cells are SLOTS,
not documents**: a `shared_options` block gets one cell per part, each coloured
by `isExamPartCorrect` for its own part, all opening the same block. That is why
the student can look for "34" and find it where they left it.

## The shared runner (why the two pages cannot drift)

`ExamRunner` and `ExamReview` were extracted from `exam/page.tsx` when this
shipped. They own the timer bar, the navigator, the question card (closed / typed
/ `shared_options` pool / `multi_part` parts), the submit dialog and the
per-question review — plus their own uz/ru/en dictionaries, so the two papers
cannot end up differently worded.

They own **no** paper state. Answers, flags, position and the clock live in each
page, which is what persists them. The one exception is the submit confirmation,
which is never persisted.

⚠️ **Do not copy either component to add a variant.** A block's answers live
under per-part keys (`partKey(q.id, p.id)`); every surface that forgets to branch
on that renders `[object Object]`. That is exactly the bug two copies would
reintroduce.

## Firestore

```
teacher_rasch_quizzes/{rq_…}
  id, title, description, teacherId, teacherName,
  accessCode: "482913",            ← 6 digits, STRING (never parsed to a number)
  questions: RaschQuizItem[],      ← embedded snapshots
  questionCount: <slots>,          ← slots, not cards
  durationMinutes, shuffle, showAnswers,
  status: 'draft' | 'published' | 'closed',
  createdAt / updatedAt: serverTimestamp

teacher_rasch_results/{quizId}_{uid}
  quizId, quizTitle, teacherId, studentId, studentName,
  correct, total, percent, durationSec,
  submittedAt: <epoch ms>,         ← number, matching every other RASCH timestamp
  examLang, topics: Record<TopicKey, TopicScore>,
  topicTheta?: Partial<Record<TopicKey, number>>,   ← per-dimension ability, LOGITS
  items?: Record<slotKey, 0 | 1>,  ← per-SLOT outcome; keys are `examSlotKeys`,
                                     so a shared_options block has one entry per
                                     sub-question. Feeds the dynamic marks.
                                     OUTCOMES ONLY — never what was answered.
  theta: number | null
```

Rules (`firestore.rules`, section 12b):

- Quizzes: `read: if isAuth()`, write only by `teacherId`.
- Results: read by the student **or** the paper's teacher; create by the student;
  update only by the same student on the same paper; **delete never** — a result
  is not the teacher's to erase and not the student's to withdraw.

⚠️ **KNOWN TRAP, inherited from `custom_tests`: the paper embeds its questions,
and therefore their correct answers, behind `read: if isAuth()`.** A signed-in
student who enumerates the collection can read the key without ever entering a
code. **The 6-digit code is a convenience for sharing, not a security boundary.**
Do not present it as one, and do not use these papers for anything that must be
invigilated until the questions move behind an Admin-SDK route. The student
lookup is a *query* on `accessCode`, so a rule that matched the code could not
serve it; closing this means changing the read path, not the rule.

Index: `teacher_rasch_quizzes (teacherId ASC, createdAt DESC)`, for the teacher's
list. Nothing else needs one — every other query is equality-only, which
Firestore serves from single-field indexes.

## Firestore budget

| Action | Cost |
|---|---|
| Open the builder | **0** — both pickers are on-demand |
| One page of either picker | 10 reads — up to 30 when the own-bank **savol turi** filter is on Yopiq/Ochiq (client-side filtering; the count is shown on screen). The **kim yozgan** filter costs nothing extra: it is a server-side `creationMethod in […]` |
| Save a paper (any length) | 1 read (to keep `createdAt`) + 1 write |
| Mint a code | 1 query, 0 documents on the happy path |
| Student opens a paper by code | **1 read**, whatever its length |
| Student submits | 1 write (teacher's copy) + 1 transaction (1 read + 2 writes) |
| Teacher opens the results | 1 read + 1 query — **the dynamic marks add nothing**: they are computed from the result rows already fetched |

⚠️ **`listMyQuizzes` reads FULL documents**, so ten 45-question papers pull ten
embedded question arrays for a list that shows only titles. It is capped at 20
for that reason. If it ever needs paging, the fix is a summary mirror, not a
bigger limit.

## Invariants & traps

- ⚠️ **45 slots, counted with `examSlotCount`.** A `shared_options` block is worth
  one slot per sub-question, so a 45-slot paper can hold fewer than 45 documents.
  Publishing below 45 is refused; a draft may be any length.
- ⚠️ **The quota is per BLUEPRINT ROW — dimension × test type — and it is a HARD
  rule.** `BLUEPRINT_SECTION_TARGET` (the 13 rows: 2/11/6/2/7/2/2 at Y-1, 3 at
  Y-2, 2/1/2/4/1 at O) is enforced on every add by `checkQuizAdd`, and publishing
  calls `quizQuotaGaps` as well as the 45-slot check. A question whose row is
  full is refused with a toast naming it ("Geometriya · Y-2"), and a **block is
  refused whole** when it would overshoot — truncating it would break its shared
  pool.
  It was per DIMENSION first (2026-07-29 morning), which was not enough:
  Geometriya's 14 could be filled with 14 closed Y-1 questions, so the paper
  never asked a student to *produce* an answer and the O rows — the ones that do
  — stayed empty. The dimension totals are still shown, as the sum of their rows.
  ⚠️ **The five O rows can ONLY be filled by the teacher's own typed questions**:
  `testTypeFor` never files a `questions1` item as `O` (see above), so the
  builder says so on the coverage panel instead of letting a teacher hunt through
  a bank that cannot contain one.
- ⚠️ **The three types, as the protocol defines them** — and `testTypeFor`
  follows the definitions, not a difficulty ladder:
  - **O** — an OPEN item, answered by typing a short answer. **Every typed
    teacher question is O, whatever its difficulty**: "open" is a property of how
    it is answered, so an easy typed question is still an O and never a Y.
  - **Y-2** — a CLOSED item, harder than Y-1 and requiring adaptation. There is
    exactly ONE Y-2 row — hard Geometriya, from the multi-step chapters — so a
    hard question anywhere else (and a hard geometry question from chapter 01,
    which the Y-2 pool excludes) is a **Y-1**. There is no row for it to be Y-2
    in.
  - **Y-1** — every other closed item.
- ⚠️ **An open question the protocol has no row for is REFUSED, not re-typed.**
  `sectionForItem` returns `null` when an `O` cannot be placed (Sonlar and
  Algebraik have no open row at all; `geometry-o` draws only from the multi-step
  chapters), and `checkQuizAdd` answers `noSlot`. The two fallbacks are
  deliberately asymmetric: a closed item that wanted `Y-2` just becomes the `Y-1`
  it always was, but filing an open item in a Y row would put a typed question in
  a closed slot, count it against a closed quota and price it in a closed row's
  ball budget. The picker shows those rows greyed with "no slot" rather than
  letting the click bounce off a toast.
  ⚠️ The publish gate can therefore block a paper saved BEFORE this rule (45
  slots, wrong shares). That is intended: the fix is to rebalance it, and the
  toast names the first offending row with its `have/want`.
- ⚠️ **A section is resolved from the chapter AND the test type**
  (`sectionForChapter(topicId, chapterId, testType)`). Geometriya is drawn at
  Y-1, Y-2 and O from the same chapters, so resolving on the chapter alone —
  which is what shipped first — filed *every* open geometry question under
  `geometry-y1`: it landed in a Y-1 row's ball budget and `geometry-o` could
  never be filled. ⚠️ And the **section's** type is then authoritative, not the
  one derived from the question: an item may not print a type its own row does
  not have. Rendering is unaffected — a bank item is closed at either Y type, and
  a teacher item renders by its own `qType` (`examMode`).
  Papers saved before this keep the section they were stored with; they are
  embedded snapshots, and re-filing them would move marks under a class that has
  already sat them.
- ⚠️ **The paper moves the student's real levels** (`kind: 'exam'`). That is
  intended — it is 45 questions on the same scale — but it means a teacher can
  move a student's measured ability. A deliberately easy paper inflates it.
- ⚠️ **Never write `undefined` to Firestore.** `bankQuizItem`/`teacherQuizItem`
  spread documents that may lack optional fields (`b`, `imageUrl`, `parts`); keep
  the conditional-spread style already in `ExamTeacher.toExamItem`.
- ⚠️ The code is a **string**. `"048213"` parsed as a number loses its leading
  zero and stops matching.
- The teacher's papers list patches status in place after a flip rather than
  refetching — a refetch pays for every embedded question array again.

## Known issues / dead code (verified 2026-07-28)

- **The answer key is readable by any signed-in user** (above). The single
  largest limitation of this subsystem.
- **Code uniqueness is a check, not a constraint** (above).
- **No per-QUESTION review for the teacher.** Since 2026-07-29 `items` records
  whether each slot was right, so "who got question 12" and the class solve rate
  ARE answerable — but the raw answers still are not, so "what did this student
  PUT for question 12" is not. Adding that means an `answers` map on the result
  document: a bigger write per student, and a deliberate cost decision.
- **Dynamic marks are cohort-only.** The mock exam still marks flat (1 point per
  slot): every student draws a different 45 questions, so per-item statistics
  there would need a global collection written server-side on every submit.
- **A published paper can still be edited.** Nothing stops a teacher changing the
  questions after students have sat it, which makes those results incomparable.
  Locking a paper on first submission would need a read of the results on save.

## How to verify changes

**Rules first — `npm run test:rules`.** `tests/rules/raschquiz.rules.test.mjs`
pins both collections down: the code lookup, teacher ownership, the retake
overwrite (and that it cannot re-point at another paper or teacher), the
teacher's provable list query, and delete being denied to everyone. It also
asserts the answer-key leak *on purpose*, so the limitation stays visible — if
that test ever starts failing, the read path has moved behind a server route and
this doc should say so.

Then `npm run dev`, as a **teacher**:

1. `/teacher/create` → **Rasch varianti** → **Yangi test**. The builder opens
   with **zero** network activity (watch the network tab).
2. Name it, then press **Yuklash** on the **Yozgan savollaringiz** tab — 10 of
   your own questions, each row labelled *Yopiq* or *Ochiq* (and *AI* when a
   machine wrote it). Press **Yopiq** and Load again: only option-answered
   questions and `shared_options` blocks come back, and the read counter shows it
   may have walked more than one page. Press **AI**, then **O'zim**, loading
   after each: the first must return only machine-written questions, the second
   only hand-written ones, both at 10 documents a page. Add a
   few. Switch to **Milliy baza**, pick a chapter and
   difficulty, press Load (10 documents read, the count shown on screen) and add
   a few more; both sources must land in the same paper.
3. Press **Bitta savol yaratish**. It must leave for `/teacher/create/question`.
   Write a question, save it, come back to the builder: the paper must still be
   there with a "saved" banner, and pressing Load must now show the new question
   first. Repeat with **Ko'p savolli test yaratish** → `/teacher/create/block`.
3. The coverage panel lists the **13 blueprint rows grouped by test type**
   (Y-1 32, Y-2 3, O 10), each reading `have/want` and green only when the two
   match. Fill one row — say **Funksiyalar Y-1 (2)** — then look at the pickers:
   every question that files there shows a green `Funksiyalar · Y-1 2/2` badge
   with its Add button reading *to'ldi*, and the **Milliy baza** chapter dropdown
   shows the same. Switch the difficulty to **Qiyin** on a geometry chapter and
   the dropdown must retarget to `Geometriya · Y-2` — the row a hard question
   actually lands in. The **O rows cannot be filled from the bank at all**: write
   an open question in `create/question`, come back, and it must land there.
   A block that would overshoot is still refused with the toast (its Add is live,
   because the row is not full — it just cannot fit a 3-slot block into 2 free
   slots). The size counter climbs, adding past 45 slots is refused, and
   **Save & publish** stays disabled until it is 45 slots **and** every section is
   exactly at quota. Saving a draft is never blocked.
4. Publish → the list shows a 6-digit code; tapping it copies it.

As a **student**, in another account:

5. `/RASCHmodel/quiz` (nav: **Kod**) → type the code → the intro names the paper,
   its teacher and its length. Watch the network tab: **one document read**.
6. Start it. The runner must be pixel-identical to `/RASCHmodel/exam` — the same
   navigator, flags, block pool and typed inputs. Answer a few, reload the page:
   the paper resumes with **no** further reads and the clock kept running.
7. Submit → the score card, the per-dimension level movement, the skills card and
   the per-question review with explanations. Now open `/RASCHmodel/exam`: it
   must still offer a **fresh** paper, not the quiz you just sat (separate
   localStorage stores).
8. A paper with `showAnswers: false` must show correctness only — no correct
   answers, no explanations.

Back as the **teacher**:

9. `/teacher/create/rasch` → **Natijalar**. The marks card must read exactly like
    the protocol table — each section headed by its budget (3.5, 20.6, 12.8…),
    every question at its printed ball — with "fewer than 5 answers" underneath:
    one sitting must NOT move a mark. Sit the paper on five more accounts,
    failing one algebra question on all of them and passing another on all of
    them: the failed one climbs and the passed one drops (its printed value
    struck through beside it), **the section still adds to 20.6**, the paper
    still adds to 100, and every student's score is recomputed. Expand a student:
    their ball on every question is listed, 0 where they got it wrong.
    Then check the rest: Every number is a 0–5 level: the
   average tile, the class section list, and each student's headline. **Tap a
   student row** — it expands to their own seven dimensions with weakest and
   strongest called out. A dimension the paper never asked about must read "not
   measured", NOT 0, and a dimension with fewer than 4 items must carry the "few
   items" tag. Sit the paper on a second account and the class averages must
   move.
10. Close the paper; the student's code entry must now say *closed*, not *not
    found*.
