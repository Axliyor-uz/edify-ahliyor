import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { adminApiFetch } from '@/lib/adminApi';
import { Q1_DIFFICULTIES, Q1_MAX_PER_REQUEST, type Q1Draft, type Q1DifficultyId } from '@/lib/questions1Schema';

/**
 * Admin access to the `questions1` bank (docs/ADMIN.md "Question bank").
 * Reads go through the client SDK (the collection is world-readable); every
 * write goes through /api/admin/questions1 so the server stamps rand /
 * uploadedAt / number. Listing a subtopic reuses lib/Mathquestion.ts.
 */

export interface Q1AddResult {
  /** `index` is the position in the `items` passed in. */
  added: { index: number; id: string }[];
  duplicates: number[];
  wouldAdd?: number;
}

/** Adds questions in request-sized chunks. `dryRun` only reports duplicates. */
export async function addQuestions1(
  items: Q1Draft[],
  opts: { dryRun?: boolean; allowDuplicates?: boolean } = {},
): Promise<Q1AddResult> {
  const result: Q1AddResult = { added: [], duplicates: [], wouldAdd: 0 };
  for (let start = 0; start < items.length; start += Q1_MAX_PER_REQUEST) {
    const res = await adminApiFetch<Q1AddResult>('/api/admin/questions1', {
      method: 'POST',
      body: { items: items.slice(start, start + Q1_MAX_PER_REQUEST), ...opts },
    });
    result.added.push(...res.added.map((a) => ({ ...a, index: a.index + start })));
    result.duplicates.push(...res.duplicates.map((i) => i + start));
    result.wouldAdd! += res.wouldAdd ?? 0;
  }
  return result;
}

export async function updateQuestion1(id: string, item: Q1Draft): Promise<void> {
  await adminApiFetch('/api/admin/questions1', { method: 'PATCH', body: { id, item } });
}

/** Benched = no `rand` = never drawn into a Milliy exam. */
export async function setQuestion1Benched(id: string, benched: boolean): Promise<void> {
  await adminApiFetch('/api/admin/questions1', { method: 'PATCH', body: { id, benched } });
}

/** Questions per difficulty in one subtopic — 3 count reads. */
export async function countQuestions1(
  topicId: string, chapterId: string, subtopicId: string,
): Promise<Record<Q1DifficultyId, number>> {
  const counts = await Promise.all(
    Q1_DIFFICULTIES.map(async (d) => {
      const snap = await getCountFromServer(query(
        collection(db, 'questions1'),
        where('topicId', '==', topicId),
        where('chapterId', '==', chapterId),
        where('subtopicId', '==', subtopicId),
        where('difficultyId', '==', d.id),
      ));
      return [d.id, snap.data().count] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<Q1DifficultyId, number>;
}
