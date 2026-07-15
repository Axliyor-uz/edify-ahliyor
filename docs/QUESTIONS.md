# QUESTIONS — the canonical question schema (v1)

> **Agent workflow:** read this BEFORE touching anything that creates, stores, renders or grades a question — `teacher_questions`, `questions1`, the embedded `custom_tests.questions[]` snapshots, any `app/teacher/create/*` page, or a student runner. Also read [DATA_MODEL.md](DATA_MODEL.md). Index: [README.md](README.md).

**Last verified:** 2026-07-14.

## The one rule

**Write v1. Read through the normalizer. Never touch a legacy doc.**

```
create → toQuestionV1(source, meta) → teacher_questions/{tq_...}      ← ONE format
read   → normalizeQuestion(doc)     → NormalizedQuestion → UI/grading ← accepts EVERY format
```

Both live in [lib/questionSchema.ts](../lib/questionSchema.ts); the types and enums are in [types/question.ts](../types/question.ts).

## Why a normalizer instead of a migration

The bank already holds thousands of **legacy** questions — `questions1` (bulk-imported, read-only), older `teacher_questions`, and question **snapshots frozen inside `custom_tests.questions[]`** when a test was published. Their shape is flat: `options` is an `{A,B,C,D}` map, `answer` is a letter, `difficulty` is a string.

v1 is structurally different (`options` is an array, the answer lives at `correctAnswer.value`, `difficulty` is an object). Rewriting the old docs would mean a mass migration — thousands of writes, and the frozen test snapshots would still have to be handled anyway. So **nothing is migrated**: `normalizeQuestion()` is a pure function that turns any shape into one view model, at zero Firestore cost. Legacy docs keep working forever.

`NormalizedQuestion` is deliberately **legacy-shaped** (`options` letter map, `answer` letter, `difficulty` lowercase string), which is why the ~30 existing render/grade sites needed only a one-line change at their fetch boundary instead of a rewrite. New code should prefer the richer fields: `optionList`, `correctAnswer`, `type`, `points`, `imageUrl`.

## The flat query mirrors (do not "clean these up")

A v1 doc repeats four fields at the top level even though they also live nested:

| Flat field | Also at | Why it must stay flat |
|---|---|---|
| `creatorId` | `metadata.creatorId` | every bank query filters `creatorId ==` |
| `creationMethod` | `metadata.creationMethod` | the my_questions filter chips |
| `difficultyId` | `difficulty.id` | the difficulty chips + all RASCH math |
| `createdAt` | `metadata.createdAt` | `orderBy createdAt desc` on every listing |

Firestore cannot filter across two different document shapes, and an OR-query over both would **double the reads**. These four names are exactly what legacy docs already use, so **one query + one index serves both eras**. Never filter on `difficulty.name` or `metadata.creatorId`.

⚠️ Consequence: `where("difficulty", "==", "easy")` is **wrong** — it silently returns zero v1 docs. Filter `difficultyId == DIFFICULTY_ID_BY_NAME.easy` instead.

## Enums (types/question.ts)

- **type** (19): `mcq`, `multiple_select`, `true_false`, `open`, `numeric`, `fill_blank`, `matching`, `ordering`, `drag_drop`, `hotspot`, `matrix`, `essay`, `coding`, `proof`, `graph`, `equation_builder`, `interactive`, plus the two BLOCK types `multi_part` and `shared_options` (see below). ⚠️ Only `IMPLEMENTED_QUESTION_TYPES` (`mcq`, `multiple_select`, `true_false`, `open`, `numeric`, `multi_part`, `shared_options`) can actually be authored, rendered and auto-graded today — the rest are declared so the schema is stable, not because the UI supports them.
- **status**: `draft`, `review`, `approved`, `published`, `archived`, `deleted`.
- **creationMethod**: `ai_prompt`, `ai_generated`, `imported`, `exam_import`, `teacher_created`, `copied`, `translated`, `corrected`.
- **language**: `uz`, `ru`, `en`. **mediaType**: `image`, `pdf`, `3d`, `animation`, `latex`, `geogebra`. **testType**: `diagnostic`, `practice`, `homework`, `exam`, `quiz`, `adaptive`, `placement`, `SAT`, `IELTS`, `TOEFL`, `custom`.

### ⚠️ Difficulty ids are NOT a clean ladder

```
beginner=0   easy=1   medium=2   hard=3   olympiad=4   expert=5
```

`easy/medium/hard/olympiad = 1/2/3/4` were already burned into the existing bank, every `where('difficultyId','==',n)` query, and the RASCH anchor tables ([RASCHtheta.ts](../lib/RASCHtheta.ts) `DIFFICULTY_LOGIT`, [RASCHbkt.ts](../lib/RASCHbkt.ts) `SLIP_BY_DIFFICULTY`, [RASCHdiagnosis.ts](../lib/RASCHdiagnosis.ts) `EXPECTED_SEC`). Renumbering would silently re-label thousands of questions, so the two new levels took the free slots. **Sort by `DIFFICULTY_ORDER`, never by the raw id.** Adding a level means adding a row to all three RASCH tables.

## Per-source defaults (`CREATION_METHOD_DEFAULTS`)

`toQuestionV1()` fills anything the creator left unset from a per-`creationMethod` table in [types/question.ts](../types/question.ts), so "by prompt", "by image" and "by hand" produce consistently-populated docs instead of each page inventing its own:

| Source | creationMethod | status | aiModel | provenance tags |
|---|---|---|---|---|
| Free prompt (`by_user_input`) | `ai_prompt` | **review** | gemini-2.5-flash | `ai`, `ai_prompt` |
| Topic/syllabus AI (`ai`, `maktab`, `ixtisos`) | `ai_generated` | **review** | gemini-2.5-flash | `ai` |
| Photo of a paper (`by_image`) | `imported` | **review** | gemini-2.5-flash | `ai`, `by_image` |
| Hand-written (`question`, `custom`) | `teacher_created` | **published** | — | `teacher_created` |
| A human fixed a broken one | `corrected` | published | — | `corrected` |

The load-bearing rule: **a machine-written question lands in `review`, a hand-written one in `published`.** `verified` is never set true by a creator — only a human reviewer sets it. An explicit value on the page (the builder's status dropdown) always wins over the default.

## Every creator asks the teacher for a topic — an LLM cannot pick one

`toQuestionV1()` **throws `InvalidTopicError`** unless the `subject`/`topic`/`subtopic` triple exists in [data/question_topics.json](../data/question_topics.json) (`isValidTopicPath`). That is the single choke point keeping the bank filterable: the AI pages used to write placeholders (`subject: "by_prompt"`, `"by_image"`, `"custom"`, or a syllabus name from the *other* taxonomy) straight into `teacher_questions`.

So every creator page opens **[TopicAssignModal](../app/teacher/create/_components/TopicAssignModal.tsx)** *before* it writes anything — for **both** save paths ("save to bank" and "publish"). The modal offers one topic for the whole batch or one per question, and hands back a `TopicPath[]`, one entry per question, in order. The page merges path `i` into question `i`:

```ts
subject:  { id: p.subjectId,  name: p.subjectName },   // ⚠️ OBJECTS — normalizeQuestion reads .id/.name.
topic:    { id: p.topicId,    name: p.topicName },     //    A bare string sets the id to "" and the save throws.
subtopic: { id: p.subtopicId, name: p.subtopicName },
chapter:  { id: "", name: "" },                        //    The taxonomy has no chapter level.
```

Publish order is **topic → title → TestConfigurationModal**. The `custom_tests` doc's own `subjectName`/`topicName`/`subtopicName` use the chosen path, or **"Aralash"** when the batch spans several (`chapterName` is `""`). `maktab`/`ixtisoslashtirilgan_maktab` generate from `data/syllabus.json`, a **different taxonomy that is not mappable** to this one — they ask too, and keep the syllabus chapter/subtopic as `tags`.

## Blocks — one stem, several sub-questions, ONE document

Two real exam shapes the flat schema could not express. The builder
([app/teacher/create/block/](../app/teacher/create/block/)) presents them to the
teacher as a **multi-question closed test** and a **multi-question open test**:

| Type | Builder label | Shape | Example |
|---|---|---|---|
| `shared_options` | **closed** (variants) | stem + diagram + **one printed A–F pool** that several sub-questions all pick from | *"33-35 testlar"* → a box diagram, then Q33/Q34/Q35 all choosing from `A) 72 B) 4 C) 108 D) 124 E) 40 F) 118` |
| `multi_part` | **open** (typed) | stem + parts a), b), … each answered by **typing** (open/numeric) | *"39. Tenglamalar sistemasi berilgan…"* → a) how many (x;y) pairs? b) product of the roots? |

⚠️ The builder now constrains the two: a **closed** test's parts always pick from the
shared pool, and an **open** test's parts are always typed (the per-part MCQ option was
removed — a part is never "closed" inside an open test). The underlying `QuestionPart.type`
enum still permits `mcq` inside a `multi_part` block, so a **legacy** multi_part with an mcq
part keeps rendering and grading; the builder just won't author a new one.

**A block is one `teacher_questions` document.** That is the point, and it is what keeps Firestore cheap:

- **1 write** for the whole block, not one per sub-question. A 3-question block = 1 document.
- **1 read** to load it, and the stem + diagram come with it instead of being duplicated into 3 docs.
- The **shared pool is stored exactly once** at the block's top-level `options[]`; every part keeps `options: []` and resolves to the pool at read time (`normalizeQuestion` does this). A 6-option pool is never copied 3×.
- The **diagram is uploaded once** (Storage slot `stem`), not once per sub-question.
- A student's whole response is **one entry** in `attempts.answers[questionId]` — a `BlockAnswer` = `{ [partId]: value }` — not N entries.

Fields: `parts: QuestionPart[]` on `QuestionV1` (empty for a normal question); `NormalizedQuestion.parts` + `.isBlock` on the read side. `points` is **always the sum of the parts'** — never the per-source default, or a 3-part block would be worth the same as a single question.

⚠️ **Block options are never shuffled** (unlike a single question, where the correct answer is deliberately moved off a predictable letter). The pool is printed once beside the block and several parts reference the same letters, so reordering would scramble the answer key.

### Grading a block

`gradeQuestion(q, given) → { earned, total }` is **the** scoring entry point:
- normal question → `0` or `q.points`;
- block → the sum of the parts the student got right, i.e. **partial credit** (`isPartCorrect` per part).

`isAnswerCorrect(q, given)` still answers "is this fully right?" (all parts correct), which is what the correct/incorrect filters and the overview grid use. ⚠️ Consequently `attempts.score`/`totalQuestions` are **points**, not question counts — see [DATA_MODEL.md](DATA_MODEL.md). XP is unchanged: a block pays the same XP as one question of its difficulty, never multiplied by its parts.

Every surface that shows a student's answer must branch on `q.isBlock` — the runner, the results page and the teacher's `StudentDetailsModal` all do; a `BlockAnswer` rendered as a plain value comes out as `[object Object]`. Builder: [app/teacher/create/block/](../app/teacher/create/block/), service: [services/questionBlockService.ts](../services/questionBlockService.ts).

### Blocks in the Milliy sertifikat exam (a DIFFERENT counting rule)

The student RASCH exam ([lib/ExamTeacher.ts](../lib/ExamTeacher.ts)) draws slots 33–45 from `teacher_questions`. It samples **per student** through the `rand` field (`toQuestionV1` writes it on every save; `npm run backfill:rand` fills the pre-existing bank) exactly like questions1 — so two students get different questions. A doc without `rand` (legacy, pre-backfill) is invisible to that query and the sampler falls back to a fixed createdAt page that is identical for everyone, which is why the backfill matters. It also does **not** score a block the usual "one document, one question" way — the DTM protocol numbers each closed sub-question of a shared-pool block as its own question. So there:

- **`shared_options` → one grouped card that COUNTS as one question per sub-question.** Rendered as a single card (stem + diagram + the A–F pool printed once, then each sub-question as a compact row of letter buttons), but it occupies N exam slots (`examSlotCount` = `parts.length`) and is scored per sub-question (`examScore` = number of parts correct — partial credit). A 3-question block covers slots e.g. 33–35, so a 45-question paper can hold fewer than 45 source docs. ⚠️ A `shared_options` part is forced to `mcq` even when the doc labels it `open`, because its `correctAnswer.value` is a pool letter, not typed text.
- **`multi_part` → one card, one slot.** Graded all-parts-correct (like `isAnswerCorrect`); `examSlotCount` = 1.

This lives entirely in the exam layer (`ExamQuestion.parts` / `qType` / `examMode` / `examSlotCount` / `examScore`), not in the v1 schema — `gradeQuestion`/`isAnswerCorrect` are unchanged, and the teacher-facing surfaces still treat any block as one document. Slot numbers advance by `examSlotCount`, so `ExamQuestion.slotNumber` is a card's FIRST slot and `toItemResponses` emits one `ItemResponse` per sub-question for a shared_options block.

## Reads are on demand, never on mount

The builder page (`create/question`) shows the question you just created **from memory** — saving does not read it back. It touches Firestore only when the teacher presses **"load 10"**, and then fetches exactly 10 docs per press (`fetchMyQuestionsPage`, cursor-paged). Opening the form costs **zero reads**. Don't add an auto-fetch-on-mount or a refetch-after-save; that was removed deliberately.

## Who fixed it — `metadata.correctedBy`

An edit stamps the corrector: `metadata.correctedBy` (display name), `correctedById` (uid) and `correctedAt`. They are **empty on a freshly created question** — only `updateQuestion()` sets them, and a later save that isn't an edit carries the existing values over rather than erasing them (a second corrector replaces the first). `metadata.creatorId`/`creatorName` always keep the ORIGINAL author, so "who wrote it" and "who last fixed it" stay separate.

`NormalizedQuestion.correctedBy` surfaces it; the bank card, the detail modal and the builder's list render it as small italic text — *Tuzatgan: Ahliyor*.

## Who made it — shown on EVERY question surface, even mid-exam

Every surface that renders a question shows the author (and the corrector, if any)
through one shared component, [components/QuestionCreator.tsx](../components/QuestionCreator.tsx):
the student assignment runner, the student results page, the RASCH exam (both
in-progress and results), the RASCH topic review, the teacher's `StudentDetailsModal`,
`CartItem`, the bank `QuestionCard`, the builder's list, `my_questions`, and the print
page. It reads `creatorName` / `correctedBy` and renders nothing when both are empty
(a `questions1` bank item has no author).

⚠️ **The RASCH exam needed a data-plumbing step**: `ExamQuestion` (and the archived
`SolvedQuestion`) do NOT extend `NormalizedQuestion`, so `creatorId`/`creatorName`/
`correctedBy` are copied across explicitly in [lib/ExamTeacher.ts](../lib/ExamTeacher.ts)
(`toExamItem`) and [lib/RASCHsolved.ts](../lib/RASCHsolved.ts) (`archiveExam`). They then
ride the localStorage `ExamSnapshot`/solved archive through to the UI. If you add a new
field a question surface must show, remember these two boundaries drop anything not
explicitly copied.

## Editing: route on `isBlock` — the two editors are NOT interchangeable

⚠️ **A block must never open in the single-question builder.** That form lifts one option out of `optionList` as "the answer" and has no concept of `parts`, so saving would silently **destroy every sub-question**. Blocks go to `create/block?edit=<id>` (`blockDraftFromQuestion` + `saveBlock(..., original)`); single questions go to `create/question?edit=<id>` (`draftFromQuestion` + `updateQuestion`).

Both entry points route on `q.isBlock`, and **both editors also guard on arrival** — a stale or hand-typed `?edit=` URL pointing the wrong editor at a question redirects to the right one instead of corrupting it. Keep both halves of that guard.

## Firestore cost: the question cache ([lib/questionCache.ts](../lib/questionCache.ts))

A module-level 60s TTL cache, same pattern as the student pages:

- **Opening an editor costs 0 reads.** The bank list already holds the question and hands it over (`cacheQuestion`) before routing, so `fetchQuestionById` serves it from memory. Only a cold deep link (pasted `?edit=…` URL, or an expired TTL) actually reads the doc.
- **Re-entering the bank costs 0 reads** within the TTL — returning from the editor, or flipping a filter chip back and forth, used to re-read 15 documents every single time.

⚠️ **Every write invalidates** (`saveQuestion`, `updateQuestion`, `deleteQuestion`, `saveBlock`, and the bank's own delete). A cache that outlives an edit shows the teacher their OLD question right after they fixed it — that is worse than an extra read. If you add a write path, invalidate in it.

## Editing an existing question

`draftFromQuestion()` rebuilds any stored question — **including a legacy one**, which is the whole point, since those are the ones most likely to be wrong — back into the builder's draft shape. `updateQuestion()` overwrites the same doc: `createdAt` is carried over (an edit is not a new question, and `orderBy createdAt` depends on it), `metadata.updatedAt` moves, and any Storage image the edit replaced is deleted so it doesn't leak. `creationMethod` is **preserved** by default (a question the AI wrote stays AI-authored after a human fixes it).

Entry points: the pencil on each row of the builder's list, and **Tahrirlash** on every card in `create/my_questions` → `/teacher/create/question?edit=<id>`. Re-saving reshuffles the option letters, which is harmless — nothing references a question by option letter.

## Statistics are a separate collection — never mixed into the question

Question content is written once and read constantly; statistics churn on every answer. Keeping them in one doc would rewrite the question (and bust every cache) on each student response.

- `QuestionStats` → `question_stats/{questionId}` — `totalAnswers`, `correctAnswers`, `wrongAnswers`, `skipped`, `averageTime`, `averageAttempts`, `averageAbility`, `raschDifficulty`, `discrimination`, `guessing`, `lastCalculated`.
- `StudentAnswerRecord` — one student's answer to one question (`studentId`, `questionId`, `selectedAnswer`, `correct`, `timeSpent`, `attemptNumber`, `abilityBefore`, `abilityAfter`, `createdAt`).

⚠️ **Both types are declared but nothing writes them yet, on purpose.** A per-answer document would add one Firestore write per question per student — a large, permanent cost increase. Creating a question is still exactly **one** write, and answering one is still a single `attempts` write. The intended filler is an offline/batched aggregation; [scripts/analyzeItems.ts](../scripts/analyzeItems.ts) already computes the RASCH figures from `attempts` for free. Don't wire per-answer writes without a deliberate cost decision.

## What is NOT covered by this schema

`bsb_chsb_tests` questions are a **different, polymorphic type** (`points`, `pairs`, `rubric`; `answer` may be a boolean or a `{uz,ru,en}` map) with their own runner and grader. `normalizeQuestion()` must not be used on them — it would flatten `answer` to a string and break grading. See [TEACHER.md](TEACHER.md).

## Where each piece lives

| Concern | File |
|---|---|
| Types, enums, `NormalizedQuestion` | [types/question.ts](../types/question.ts) |
| `normalizeQuestion` / `toQuestionV1` / `isAnswerCorrect` | [lib/questionSchema.ts](../lib/questionSchema.ts) |
| Bank writes/reads/deletes (+ image upload & GC) | [services/questionBankService.ts](../services/questionBankService.ts) |
| Subject → topic → subtopic taxonomy | [data/question_topics.json](../data/question_topics.json) via [lib/questionTopics.ts](../lib/questionTopics.ts) |
| Single-question builder UI | [app/teacher/create/question/](../app/teacher/create/question/) |

## How to verify a change

`npm run dev`, then:
1. Create one `mcq` (with an image on the prompt *and* on an option) and one `open` question at `/teacher/create/question` → both appear in the list below the form, and in `/teacher/create/my_questions`.
2. Check the Firestore doc: `options` is an array, `correctAnswer.value` is set, `difficulty` is an object, and the flat `creatorId`/`difficultyId`/`creationMethod`/`createdAt` mirrors are present.
3. Filter by difficulty in my_questions → the new question shows up (this is the flat-mirror path).
4. Publish a test containing it, assign it to a class, answer it as a student → options render, the image shows, grading is correct.
5. Open an **old** test (published before this change) as a student → it must still render and grade exactly as before. That is the legacy path, and it is the one most likely to break.
