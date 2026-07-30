# IELTS practice dataset (authoring source)

Ready-made IELTS papers written in the **admin JSON-import format**. These files are *not* read at
runtime — nothing imports them, and there is no API route serving this folder. They are the source
of truth for the **platform dataset**: an admin pastes a file into
`/admin/ielts` → **Import JSON**, which validates it with
[`lib/ielts/testSchema.ts`](../../lib/ielts/testSchema.ts) `validateTestJson` and writes it through
`saveIeltsTest(test, { asPlatform: true })`.

See [docs/IELTS.md](../../docs/IELTS.md) for the collections and the answer-key split.

## Contents

| File | Module | Questions | Purpose |
|---|---|---|---|
| `reading/academic-01.json` | Academic Reading | 40 | Full paper — water clocks / hedgerows / expert forecasting |
| `reading/academic-02.json` | Academic Reading | 40 | Full paper — saffron / mass timber / the psychology of waiting |
| `reading/_template-all-question-types.json` | Academic Reading | 24 | Fixture exercising **all 13** question types, incl. `diagram_completion`. Import this first when testing the pipeline. |

Between the two full papers, twelve of the thirteen types are covered in exam-realistic proportions;
`diagram_completion` appears only in the template, because it needs a hosted image
(Storage `ielts_diagrams/`) to be worth setting on a real paper.

**These passages are original work written to Cambridge specification** (3 passages, 40 questions,
60 minutes, ascending difficulty, standard instruction wording). They are not reproductions of
Cambridge IELTS texts — those are copyrighted and must not be pasted into the platform dataset.

## Importing

1. Sign in as a `super_admin` and open `/admin/ielts` → **Reading** tab → **Import JSON**.
2. Paste the whole file, press **Validate** (shows question count + type breakdown), then **Import to dataset**.
3. `saveIeltsTest` renumbers the paper, extracts the key into `ielts_answer_keys/{testId}`, strips
   `correct_answer` from the public doc (`answers_split: true`) and writes `ielts_test_meta/{testId}`
   in the same batch.
4. Verify: `/teacher/ielts/reading/view/{id}` shows the paper answer-free with the
   "answers hidden (platform test)" chip; the test appears in the student Practice Library.

`test_id` is fixed in each file, so re-importing **overwrites** rather than duplicating.

## Checking a file before you import it

```bash
node "data/ielts practise/verify.mjs" "data/ielts practise/reading"
```

The script re-implements the parts of the pipeline that fail *silently* rather than loudly, so a
paper that imports cleanly can still be wrong in the runner. It checks:

- authored `question_number`s match what `renumberTest` will actually assign (a `list_selection`
  block consumes **one number per correct letter**, so everything after it shifts);
- gap-token count equals answer-row count in `summary_completion` / `table_completion` /
  `flowchart_completion` — tokens are **positional** (`start_question + index`), so a mismatch
  silently misaligns every answer in the block;
- `correct_answer` shape per type (see below) and every letter answer resolving to a real option id;
- `word_limit` vs the accepted answers, using the official token convention;
- each `passage_reference` appearing verbatim in the passage, so the review page's **Locate**
  button actually finds it;
- table rows matching the header count; 40 questions on files named `platform_reading_academic_*`.

## Answer shapes per question type

The builders are inconsistent about this and the grader depends on it. Copy exactly:

| Type | Block-level | Row fields | `correct_answer` |
|---|---|---|---|
| `matching_headings` | `options: [{id:'i', text}]` | `target_paragraph` | `"iv"` (string) |
| `matching_paragraph_information` | `options: ["A","B",…]` (plain strings) | `statement` | `"C"` (string) |
| `matching_features` | `options: [{id:'A', text}]` | `statement` | `["A"]` (1-element array) |
| `matching_sentence_endings` | `options: [{id:'A', text}]` | `sentence_start` | `["A"]` (1-element array) |
| `true_false_not_given` | `options: [{label, description}]` | `statement` | `"TRUE"` / `"FALSE"` / `"NOT GIVEN"` |
| `multiple_choice` | — | `question_text`, `options: [{id,text}]` | `["B"]` (1-element array) |
| `list_selection` | — | **one row**: `question_text`, `options: [{id,text}]` | `["A","C"]` — length = numbers consumed |
| `sentence_completion` | `word_limit`, `options: null` | `sentence` with **one** gap token | `["answer","alternate"]` |
| `short_answer` | `word_limit` | `question_text` | `["answer","alternate"]` |
| `summary_completion` | `summary_text` with gap tokens; word bank → `options:[{id,text}]`, free text → `options: null` + `word_limit` | (rows are answers only) | word bank → `"A"`; free text → `["answer"]` |
| `table_completion` | `headers`, `rows:[{cells}]` with gap tokens | (rows are answers only) | same as summary |
| `flowchart_completion` | `steps` with gap tokens | (rows are answers only) | same as summary |
| `diagram_completion` | `diagram_url`, `diagram_alt_text` | (rows are answers only) | same as summary |

Gap tokens are `[1]`, `[ 7 ]`, `[_]` or `[]` — **the number inside is ignored**. Only position
counts. Keep the numbers accurate anyway: they are what a human proof-reads against.

Answer strings support the grader's alternate syntax: `"taxi/cab"` (either accepted),
`"(the) library"` (parenthetical optional). UK/US spellings, digit↔word numbers and thousands
separators are handled automatically by [`lib/ielts/grading.ts`](../../lib/ielts/grading.ts) — do
not list those variants by hand.

## Authoring traps

- **"Choose TWO letters" must be `list_selection`, never a multi-answer `multiple_choice`.** Public
  docs carry no `correct_answer`, so the student renderer detects multi-select only from the
  `list_selection` span; a multi-answer MCQ renders as single-select and is unanswerable.
- Free-text `summary_completion` answers of **three letters or fewer** are treated as letter answers
  by the grader — avoid them, or use a longer accepted form.
- Distractor headings must not paraphrase the correct heading for another paragraph; the verifier
  cannot catch this, only proof-reading can.
- `test_category` selects the band table (`academic` vs `general` differ for Reading) — set it.
