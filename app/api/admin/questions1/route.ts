import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { AdminAuthError, requireSuperAdmin } from '@/lib/server/verifySuperAdmin';
import {
  coerceQuestion1, questions1Content, questions1Key, Q1_MAX_PER_REQUEST, type Q1Draft, type Q1Issue,
} from '@/lib/questions1Schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The only writer of `questions1` (docs/ADMIN.md "Question bank").
 *
 *   POST  { items, dryRun?, allowDuplicates? } → { added: [{ index, id }], duplicates: [index] }
 *   PATCH { id, item }    → edit one question's content
 *   PATCH { id, benched } → bench (drop `rand`) / restore
 *
 * Every item is re-validated with lib/questions1Schema.ts. The server stamps
 * what the readers depend on but the admin must never type: `rand` (without it
 * the Milliy exam sampler never draws the question), `uploadedAt` (every
 * listing orders by it — written in the SAME type the bank already uses),
 * `number`, and `subjectId`/`subject` copied from the bank.
 */

const COLLECTION = 'questions1';

function fail(error: unknown, label: string) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`${label} error:`, error);
  return NextResponse.json({ error: 'Failed to save questions.' }, { status: 500 });
}

const describe = (index: number, e: Q1Issue) =>
  `Question ${index + 1}: ${e.message}${e.lang ? ` (${e.lang.toUpperCase()})` : ''}`;

/** The bank was bulk-imported outside this repo, so the `uploadedAt` type is read from it, not assumed. */
function stampLike(sample: unknown, ms: number): Timestamp | string | number {
  if (typeof sample === 'string') return new Date(ms).toISOString();
  if (typeof sample === 'number') return sample > 1e11 ? ms : Math.floor(ms / 1000);
  return Timestamp.fromMillis(ms);
}

export async function POST(request: Request) {
  try {
    const uid = await requireSuperAdmin(request);
    const body = await request.json().catch(() => null);
    const items: unknown[] = Array.isArray(body?.items) ? body.items : [];
    const dryRun = body?.dryRun === true;
    const allowDuplicates = body?.allowDuplicates === true;

    if (!items.length || items.length > Q1_MAX_PER_REQUEST) {
      return NextResponse.json({ error: `Send 1–${Q1_MAX_PER_REQUEST} questions per request.` }, { status: 400 });
    }

    const drafts: Q1Draft[] = [];
    const invalid: { index: number; errors: Q1Issue[] }[] = [];
    items.forEach((raw, index) => {
      const check = coerceQuestion1(raw);
      if (check.errors.length) invalid.push({ index, errors: check.errors });
      else drafts.push(check.draft);
    });
    if (invalid.length) {
      return NextResponse.json({ error: describe(invalid[0].index, invalid[0].errors[0]), invalid }, { status: 400 });
    }

    const col = adminDb.collection(COLLECTION);
    const contents = drafts.map(questions1Content);
    const groupOf = (c: (typeof contents)[number]) => `${c.topicId}|${c.chapterId}|${c.subtopicId}`;

    // Per subtopic: the questions already there (duplicate keys + the running number).
    const groups = new Map<string, { keys: Set<string>; size: number }>();
    await Promise.all(
      [...new Map(contents.map((c) => [groupOf(c), c])).values()].map(async (c) => {
        const snap = await col
          .where('topicId', '==', c.topicId)
          .where('chapterId', '==', c.chapterId)
          .where('subtopicId', '==', c.subtopicId)
          .select('question')
          .get();
        groups.set(groupOf(c), { keys: new Set(snap.docs.map((d) => questions1Key(d.get('question')))), size: snap.size });
      }),
    );

    const duplicates: number[] = [];
    const accepted: number[] = [];
    contents.forEach((c, i) => {
      const group = groups.get(groupOf(c))!;
      const key = questions1Key(c.question);
      if (!allowDuplicates && group.keys.has(key)) { duplicates.push(i); return; }
      group.keys.add(key); // a repeat inside the same request is a duplicate too
      accepted.push(i);
    });

    if (dryRun || !accepted.length) {
      return NextResponse.json({ added: [], duplicates, wouldAdd: accepted.length });
    }

    // Bank-wide fields are copied from an existing question of the same topic.
    const templates = new Map<string, FirebaseFirestore.DocumentData | undefined>();
    await Promise.all(
      [...new Set(contents.map((c) => c.topicId))].map(async (topicId) => {
        const snap = await col.where('topicId', '==', topicId).limit(1).get();
        templates.set(topicId, snap.docs[0]?.data());
      }),
    );

    const batch = adminDb.batch();
    const added: { index: number; id: string }[] = [];
    const now = Date.now();
    accepted.forEach((i, n) => {
      const c = contents[i];
      const tpl = templates.get(c.topicId);
      const group = groups.get(groupOf(c))!;
      group.size += 1;
      const ref = col.doc();
      batch.set(ref, {
        ...c,
        subjectId: typeof tpl?.subjectId === 'string' ? tpl.subjectId : '01',
        subject: typeof tpl?.subject === 'string' ? tpl.subject : 'Matematika',
        number: typeof tpl?.number === 'number' ? group.size : String(group.size),
        tags: [],
        language: ['uz', 'ru', 'en'],
        // Listings are uploadedAt desc — the file's first question gets the newest stamp.
        uploadedAt: stampLike(tpl?.uploadedAt, now + accepted.length - n),
        rand: Math.random(),
        addedBy: uid,
        source: 'admin',
      });
      added.push({ index: i, id: ref.id });
    });
    await batch.commit();

    return NextResponse.json({ added, duplicates });
  } catch (error) {
    return fail(error, 'POST /api/admin/questions1');
  }
}

export async function PATCH(request: Request) {
  try {
    const uid = await requireSuperAdmin(request);
    const body = await request.json().catch(() => null);
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Missing question id.' }, { status: 400 });

    const ref = adminDb.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

    // Bench = no `rand` = never drawn into a Milliy exam (the scripts/analyzeItems.ts mechanism).
    // Restoring is a human review, so it also clears the calibration's `suspect` flag.
    if (typeof body.benched === 'boolean') {
      await ref.update(body.benched
        ? { rand: FieldValue.delete(), editedAt: Timestamp.now(), editedBy: uid }
        : { rand: Math.random(), suspect: FieldValue.delete(), editedAt: Timestamp.now(), editedBy: uid });
      return NextResponse.json({ ok: true });
    }

    const check = coerceQuestion1(body.item);
    if (check.errors.length) {
      return NextResponse.json({ error: describe(0, check.errors[0]).replace(/^Question 1: /, ''), invalid: [{ index: 0, errors: check.errors }] }, { status: 400 });
    }
    const content = questions1Content(check.draft);
    // Only the first solution is edited here; any further ones the import carried are kept.
    const previous = snap.get('solutions');
    const rest = Array.isArray(previous) ? previous.slice(1) : [];

    await ref.update({
      ...content,
      solutions: [...content.solutions, ...rest],
      editedAt: Timestamp.now(),
      editedBy: uid,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error, 'PATCH /api/admin/questions1');
  }
}
