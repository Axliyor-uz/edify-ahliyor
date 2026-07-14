// lib/Examquestions.ts
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { EXAM_BLUEPRINT, bandFor } from './Examblueprint';
import type { DifficultyId, QuestionDoc } from '@/types/Math';
import type {
  BlueprintSection,
  BuildExamResult,
  ChapterRef,
  ExamQuestion,
  Shortfall,
} from '@/types/Exam';

const QUESTIONS_COLLECTION = 'questions1';

/**
 * A cell whose window is exhausted (every doc already used by an earlier
 * section) would otherwise re-read the same docs forever. Two extra windows is
 * plenty — collisions are vanishingly rare when the thinnest cell still holds
 * 16 questions.
 */
const MAX_ROUNDS = 3;

/** Reads are billed per document returned, so we track exactly that. */
interface Budget {
  used: Set<string>;
  reads: number;
}

// ─── random sampling ─────────────────────────────────────────────────────────

/**
 * Takes `want` questions from one (chapter × difficulty) cell using the
 * random-field pattern: every doc carries `rand` ∈ [0, 1), we pick a random
 * threshold and read the `want` docs sitting just above it, wrapping to the
 * bottom of the range if the window above was too thin.
 *
 * Every `limit()` is exactly the number of questions still missing, so a
 * 45-question exam costs 45 document reads — Firestore never hands back a
 * question we don't put on the paper. (An already-used doc is the one case
 * that costs a read without filling a slot; the top-up round then asks only
 * for the shortfall.)
 *
 * Every query here is an equality match on exactly topicId + chapterId +
 * difficultyId ordered by rand, so the whole exam rides a SINGLE composite
 * index (see firestore.indexes.json). Widening a filter — dropping difficultyId
 * to "any", say — would silently demand another index, so the relaxation ladder
 * in buildSection() varies the *values* instead.
 *
 * Returns [] until scripts/backfillrandfield.ts has run: a doc with no `rand`
 * field is absent from the index entirely.
 */
async function sample(
  cell: { topicId: string; chapterId: string; difficultyId: DifficultyId },
  want: number,
  budget: Budget,
): Promise<QuestionDoc[]> {
  if (want <= 0) return [];

  const base: QueryConstraint[] = [
    where('topicId', '==', cell.topicId),
    where('chapterId', '==', cell.chapterId),
    where('difficultyId', '==', cell.difficultyId),
  ];

  const picked: QuestionDoc[] = [];

  for (let round = 0; round < MAX_ROUNDS && picked.length < want; round++) {
    const threshold = Math.random();
    let foundThisRound = 0;

    for (const op of ['>=', '<'] as const) {
      const missing = want - picked.length;
      if (missing <= 0) break;

      const snap = await getDocs(
        query(
          collection(db, QUESTIONS_COLLECTION),
          ...base,
          where('rand', op, threshold),
          orderBy('rand'),
          limit(missing), // ← read exactly the shortfall, nothing more
        ),
      );
      budget.reads += snap.size;

      for (const doc of snap.docs) {
        if (budget.used.has(doc.id)) continue;
        budget.used.add(doc.id);
        picked.push({ ...(doc.data() as QuestionDoc), id: doc.id });
        foundThisRound += 1;
      }
    }

    // The cell gave us nothing new — it is empty or fully consumed. Retrying
    // with another threshold would just re-read the same documents.
    if (foundThisRound === 0) break;
  }

  return picked;
}

// ─── quota allocation ────────────────────────────────────────────────────────

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface Request {
  chapter: ChapterRef;
  difficultyId: DifficultyId;
  want: number;
}

/**
 * Spreads a section's quota round-robin over shuffled (chapter × difficulty)
 * cells, so an 11-question section pulls from all four of its chapters rather
 * than clustering in one.
 */
function allocate(section: BlueprintSection): Request[] {
  const chapters = shuffle(section.pools);
  const band = shuffle(bandFor(section));
  const byCell = new Map<string, Request>();

  for (let i = 0; i < section.count; i++) {
    const chapter = chapters[i % chapters.length];
    const difficultyId = band[i % band.length];
    const key = `${chapter.topicId}/${chapter.chapterId}/${difficultyId}`;
    const existing = byCell.get(key);
    if (existing) existing.want += 1;
    else byCell.set(key, { chapter, difficultyId, want: 1 });
  }

  return [...byCell.values()];
}

// ─── section builder ─────────────────────────────────────────────────────────

const ALL_DIFFICULTIES: DifficultyId[] = [1, 2, 3];

/**
 * Fills one blueprint section. The allocated cells normally cover it outright;
 * the passes after that exist for the thin corners of the bank (Jismlar
 * kombinatsiyasi has only 16 hard questions) and for sections whose chapters an
 * earlier section already drew from.
 *
 *   1. the allocated (chapter × difficulty) cells
 *   2. every cell in the section's chapters × its difficulty band
 *   3. the same chapters, but difficulties outside the band too
 *
 * Passes 2 and 3 only run when a section is short, and each asks for just the
 * shortfall — so on the normal path they cost nothing at all.
 */
async function buildSection(
  section: BlueprintSection,
  budget: Budget,
): Promise<QuestionDoc[]> {
  const picked = (
    await Promise.all(
      allocate(section).map((r) =>
        sample(
          { topicId: r.chapter.topicId, chapterId: r.chapter.chapterId, difficultyId: r.difficultyId },
          r.want,
          budget,
        ),
      ),
    )
  ).flat();

  const band = bandFor(section);
  const widen = async (difficulties: DifficultyId[]) => {
    for (const chapter of shuffle(section.pools)) {
      for (const difficultyId of shuffle(difficulties)) {
        if (picked.length >= section.count) return;
        picked.push(
          ...(await sample(
            { topicId: chapter.topicId, chapterId: chapter.chapterId, difficultyId },
            section.count - picked.length,
            budget,
          )),
        );
      }
    }
  };

  if (picked.length < section.count) await widen(band);
  if (picked.length < section.count) {
    await widen(ALL_DIFFICULTIES.filter((d) => !band.includes(d)));
  }

  return picked;
}

// ─── exam builder ────────────────────────────────────────────────────────────

/**
 * Builds a TARGETED PRACTICE set: `count` questions drawn from the chapters the
 * student is weakest at, at a difficulty matched to their measured ability.
 *
 * Reads exactly `count` documents on the happy path — the same exact-limit
 * sampling as the exam, and it rides the same single composite index. If a
 * (chapter × difficulty) cell can't fill the quota it widens to the neighbouring
 * difficulties rather than giving up.
 */
export async function buildPractice(params: {
  chapters: ChapterRef[];
  difficultyId: DifficultyId;
  count: number;
}): Promise<{ questions: QuestionDoc[]; docsRead: number }> {
  const { chapters, difficultyId, count } = params;
  const budget: Budget = { used: new Set(), reads: 0 };
  if (chapters.length === 0 || count <= 0) return { questions: [], docsRead: 0 };

  const picked: QuestionDoc[] = [];

  // Spread the quota round-robin across the weak chapters.
  const quota = new Map<string, { chapter: ChapterRef; want: number }>();
  for (let i = 0; i < count; i++) {
    const chapter = chapters[i % chapters.length];
    const key = `${chapter.topicId}/${chapter.chapterId}`;
    const existing = quota.get(key);
    if (existing) existing.want += 1;
    else quota.set(key, { chapter, want: 1 });
  }

  const first = await Promise.all(
    [...quota.values()].map((q) =>
      sample(
        { topicId: q.chapter.topicId, chapterId: q.chapter.chapterId, difficultyId },
        q.want,
        budget,
      ),
    ),
  );
  picked.push(...first.flat());

  // Widen to the neighbouring difficulties only if the target cell ran dry.
  if (picked.length < count) {
    const neighbours = ALL_DIFFICULTIES.filter((d) => d !== difficultyId);
    for (const chapter of shuffle(chapters)) {
      for (const d of neighbours) {
        if (picked.length >= count) break;
        picked.push(
          ...(await sample(
            { topicId: chapter.topicId, chapterId: chapter.chapterId, difficultyId: d },
            count - picked.length,
            budget,
          )),
        );
      }
    }
  }

  return { questions: shuffle(picked).slice(0, count), docsRead: budget.reads };
}

/**
 * Builds the 45-question Milliy sertifikat exam from EXAM_BLUEPRINT.
 *
 * Sections are filled in blueprint order and questions keep that order, so slot
 * numbers line up with the protocol (Y-1 #1–32, Y-2 #33–40, O #41–45). A
 * question is never reused across sections, even where two sections share a
 * chapter.
 *
 * Call this ONCE per exam: the result is cached in the browser by
 * lib/Examsession.ts, so reloading or resuming re-reads nothing.
 *
 * `docsRead` is the number of documents Firestore actually returned — i.e. what
 * you were billed. It should equal `questions.length` on the happy path.
 */
export async function buildExam(): Promise<BuildExamResult> {
  const budget: Budget = { used: new Set(), reads: 0 };
  const questions: ExamQuestion[] = [];
  const shortfalls: Shortfall[] = [];

  for (const section of EXAM_BLUEPRINT) {
    const picked = await buildSection(section, budget);

    if (picked.length < section.count) {
      shortfalls.push({
        sectionId: section.id,
        label: section.label,
        testType: section.testType,
        requested: section.count,
        received: picked.length,
      });
    }

    for (const q of picked) {
      questions.push({
        ...q,
        slotNumber: questions.length + 1,
        sectionId: section.id,
        sectionLabel: section.label,
        testType: section.testType,
      });
    }
  }

  return { questions, shortfalls, docsRead: budget.reads };
}
