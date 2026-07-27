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

**Last verified:** 2026-07-28 (subsystem introduced).

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
| [lib/RASCHquiz.ts](../lib/RASCHquiz.ts) | Pure layer — code generation, picked-question → stored item, `hydrateQuiz`, slot/topic/difficulty counts, size guard. No Firestore. |
| [services/teacherRaschQuizService.ts](../services/teacherRaschQuizService.ts) | Every read and write. Nothing else touches the two collections. |
| `app/teacher/create/rasch/page.tsx` | The teacher's papers: code, status, edit, results, delete. |
| `app/teacher/create/rasch/build/page.tsx` | The builder (`?id=` to edit). |
| `app/teacher/create/rasch/_components/QuestionPickers.tsx` | The two "pick an existing question" tabs. |
| `app/teacher/create/rasch/_components/QuickCompose.tsx` | The "write a new one" tab — saves to `teacher_questions` first. |
| `app/teacher/create/rasch/results/[quizId]/page.tsx` | Who sat it, per-dimension class averages. |
| `app/(student)/RASCHmodel/quiz/page.tsx` | Code entry → intro → sitting → results. |
| `app/(student)/RASCHmodel/_components/ExamRunner.tsx` | **The paper**, shared with the mock exam. |
| `app/(student)/RASCHmodel/_components/ExamReview.tsx` | **The per-question review**, shared with the mock exam. |

## Flows

### Building — one document, no refs

The teacher picks questions from three tabs:

1. **Milliy baza** — `questions1` by chapter × difficulty. ⚠️ The query is exactly
   `topicId + chapterId + difficultyId` ordered by `rand`, the SAME single
   composite index the exam sampler rides. Adding a `subtopicId` equality, or
   ordering by anything else, silently demands a second index. The first page
   starts at a random `rand` threshold; "load more" walks on from there. A
   pre-backfill document has no `rand` and is invisible here, exactly as in the
   exam.
2. **Mening savollarim** — `teacher_questions` through `fetchMyQuestionsPage`, so
   blocks, images and typed answers arrive already normalized.
3. **Yangi savol** — a compact form that writes a real v1 document to
   `teacher_questions` via `saveQuestion`, and *then* adds it. A question written
   here is a normal bank question, reusable and editable; it is never a
   paper-only orphan. Images, blocks and multiple-select are deliberately not
   offered — `/teacher/create/question` and `/teacher/create/block` write to the
   same bank and the "my questions" tab picks them up.

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

### Withholding the key

`showAnswers: false` makes `ExamReview` show only whether each question was
right — no correct answer, no per-part expected value, no explanation button. It
is a real mode, not styling: a teacher reusing a paper across two groups depends
on it. Any new surface in that component must respect `hideAnswers`.

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
  examLang, topics: Record<TopicKey, TopicScore>, theta: number | null
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
| One page of either picker | 10 reads |
| Save a paper (any length) | 1 read (to keep `createdAt`) + 1 write |
| Mint a code | 1 query, 0 documents on the happy path |
| Student opens a paper by code | **1 read**, whatever its length |
| Student submits | 1 write (teacher's copy) + 1 transaction (1 read + 2 writes) |
| Teacher opens the results | 1 read + 1 query |

⚠️ **`listMyQuizzes` reads FULL documents**, so ten 45-question papers pull ten
embedded question arrays for a list that shows only titles. It is capped at 20
for that reason. If it ever needs paging, the fix is a summary mirror, not a
bigger limit.

## Invariants & traps

- ⚠️ **45 slots, counted with `examSlotCount`.** A `shared_options` block is worth
  one slot per sub-question, so a 45-slot paper can hold fewer than 45 documents.
  Publishing below 45 is refused; a draft may be any length.
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
- **No per-student review for the teacher.** The results page shows scores and
  per-dimension class averages; `RaschQuizResult` deliberately does not store the
  raw answers, so "what did this student put for question 12" is not answerable.
  Adding it means adding an `answers` map to the result document — a bigger write
  per student, and a deliberate cost decision.
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
2. Name it. Add questions from all three tabs: pick a chapter + difficulty in
   *Milliy baza* and press Load (10 documents read, shown on screen); load your
   own bank; write one in *Yangi savol* — it must appear in
   `/teacher/create/my_questions` too.
3. The coverage panel updates per pick, the size counter climbs, and adding past
   45 slots is refused. **Save & publish** is disabled until it is exactly 45.
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

9. `/teacher/create/rasch` → **Natijalar** lists the student with their score,
   percent, 0–5 level and duration, plus per-dimension class averages.
10. Close the paper; the student's code entry must now say *closed*, not *not
    found*.
