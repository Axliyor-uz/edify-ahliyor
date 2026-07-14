/**
 * scripts/backfillrandfield.ts
 *
 * Adds a `rand` field (uniform in [0, 1)) to every questions1 doc that lacks
 * one. lib/Examquestions.ts samples the exam through that field, so a doc with
 * no `rand` is invisible to the exam builder — it is absent from the index.
 *
 *   npm run backfill:rand           # only docs missing `rand`
 *   npm run backfill:rand -- --force  # re-randomise every doc
 *
 * Run it again whenever new questions are bulk-imported. Credentials come from
 * .env.local (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY),
 * the same ones lib/firebaseAdmin.ts uses.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function loadEnvLocal() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, '');
  }
}

if (!process.env.FIREBASE_PRIVATE_KEY) loadEnvLocal();

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const PAGE_SIZE = 2000;
const FORCE = process.argv.includes('--force');

async function main() {
  const col = db.collection('questions1');
  const total = (await col.count().get()).data().count;
  console.log(`questions1: ${total} documents. force=${FORCE}`);

  const writer = db.bulkWriter();
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let scanned = 0;
  let updated = 0;

  for (;;) {
    // select('rand') keeps the page tiny — the question bodies are never read.
    let page = col.select('rand').orderBy('__name__').limit(PAGE_SIZE);
    if (cursor) page = page.startAfter(cursor);

    const snap = await page.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      scanned += 1;
      if (!FORCE && typeof doc.get('rand') === 'number') continue;
      void writer.update(doc.ref, { rand: Math.random() });
      updated += 1;
    }

    cursor = snap.docs[snap.docs.length - 1];
    console.log(`scanned ${scanned}/${total} · queued ${updated} updates`);
    if (snap.size < PAGE_SIZE) break;
  }

  await writer.close();
  console.log(`Done. Wrote rand to ${updated} documents.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
