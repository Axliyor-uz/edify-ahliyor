// Publishes the English-grammar dataset to Firestore `enggrammar_*` — content the
// EdifyStudent Android app reads (its docs/GRAMMAR.md). The dataset is the source
// of truth: ~/Documents/dataset/English_grammar (data/syllabus.json + data/topics/*).
//
// DRY-RUN by default (validates, prints versions, sizes and what would change):
//   node --env-file=.env.local scripts/publishGrammar.mjs
// Apply:
//   node --env-file=.env.local scripts/publishGrammar.mjs --apply [--dataset <dir>]
//
// Documents (content is stored as the dataset's exact JSON text — Firestore has
// no arrays-in-arrays, and byte-exact JSON keeps one parser for assets + cloud):
//   enggrammar_syllabus/main      { schema, version, json }
//   enggrammar_topics/{topicId}   { schema, version, topicId, topicJson, lessonsJson, tagsJson, gamesJson }
//   enggrammar_questions/{topicId}{ schema, version, topicId, questionsJson }
//   enggrammar_meta/current       { schema, contentVersion, syllabusVersion, topics: {topicId: version}, publishedAt }
// Versions = first 16 hex of sha256 over the files (topic files joined by "\0" in
// the order topic, lessons, questions, error_tags, games) — the SAME formula as
// EdifyStudent's tools/sync_grammar.sh manifest, so phones skip content they
// already bundle. Only changed topics are written; meta goes LAST.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const argAfter = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const DATASET = argAfter('dataset') ?? path.join(homedir(), 'Documents/dataset/English_grammar');
const MAX_DOC_BYTES = 700 * 1024; // Firestore caps a doc at 1 MiB — keep a safety margin.
const TOPIC_FILES = ['topic.json', 'lessons.json', 'questions.json', 'error_tags.json', 'games.json'];

const sha16 = (text) => createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

// ── 1. Validate with the dataset's own tools (the strict gate) ───────────────
function run(args) {
  const r = spawnSync('python3', ['-I', ...args], { cwd: DATASET, encoding: 'utf8' });
  const out = `${r.stdout}${r.stderr}`;
  return { ok: r.status === 0 && /OK: 0 errors/.test(out), out };
}
if (!existsSync(path.join(DATASET, 'data/syllabus.json'))) fail(`no data/syllabus.json in ${DATASET}`);
const sylRaw = readFileSync(path.join(DATASET, 'data/syllabus.json'), 'utf8');
const syllabus = JSON.parse(sylRaw);
const ready = syllabus.topics.filter((t) => t.status === 'ready' && t.folder);
if (!ready.length) fail('no ready topics');

const sylCheck = run(['tools/check_syllabus.py']);
if (!sylCheck.ok) fail(`check_syllabus.py failed:\n${sylCheck.out}`);
for (const t of ready) {
  const v = run(['tools/validate.py', path.join('data', t.folder)]);
  if (!v.ok) fail(`validate.py failed for ${t.id}:\n${v.out.split('\n').slice(-15).join('\n')}`);
}
console.log(`✓ dataset valid — ${ready.length} ready topics`);

// ── 2. Build docs + versions ──────────────────────────────────────────────────
const sylDoc = { schema: 1, version: sha16(sylRaw), json: sylRaw };
const topics = ready.map((t) => {
  const dir = path.join(DATASET, 'data', t.folder);
  const files = Object.fromEntries(TOPIC_FILES.map((f) => [f, readFileSync(path.join(dir, f), 'utf8')]));
  const topicJson = JSON.parse(files['topic.json']);
  if (topicJson.id !== t.id) fail(`${t.folder}/topic.json id ${topicJson.id} ≠ syllabus id ${t.id}`);
  const version = sha16(TOPIC_FILES.map((f) => files[f]).join('\0'));
  return {
    id: t.id,
    version,
    topicDoc: {
      schema: 1, version, topicId: t.id,
      topicJson: files['topic.json'], lessonsJson: files['lessons.json'],
      tagsJson: files['error_tags.json'], gamesJson: files['games.json'],
    },
    questionsDoc: { schema: 1, version, topicId: t.id, questionsJson: files['questions.json'] },
  };
});

// Size guard (UTF-8 bytes of every string field + a margin for names).
const docBytes = (d) => Object.values(d).reduce((n, v) => n + Buffer.byteLength(String(v), 'utf8') + 64, 0);
const sizes = [['enggrammar_syllabus/main', docBytes(sylDoc)]];
for (const t of topics) {
  sizes.push([`enggrammar_topics/${t.id}`, docBytes(t.topicDoc)], [`enggrammar_questions/${t.id}`, docBytes(t.questionsDoc)]);
}
for (const [name, bytes] of sizes) {
  if (bytes > MAX_DOC_BYTES) fail(`${name} is ${(bytes / 1024).toFixed(0)} KB (> ${MAX_DOC_BYTES / 1024} KB) — split the topic`);
}

const meta = {
  schema: 1,
  syllabusVersion: sylDoc.version,
  topics: Object.fromEntries(topics.map((t) => [t.id, t.version])),
};
meta.contentVersion = sha16(JSON.stringify(meta));

// ── 3. Compare with what is live ──────────────────────────────────────────────
const { default: admin } = await import('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const metaRef = db.collection('enggrammar_meta').doc('current');
const live = (await metaRef.get()).data();

const changedTopics = topics.filter((t) => live?.topics?.[t.id] !== t.version);
const syllabusChanged = live?.syllabusVersion !== sylDoc.version;
const dropped = Object.keys(live?.topics ?? {}).filter((id) => !meta.topics[id]);

console.log(`\nlive contentVersion: ${live?.contentVersion ?? '(none)'}  →  new: ${meta.contentVersion}`);
console.log(`syllabus ${sylDoc.version}  ${syllabusChanged ? 'CHANGED' : 'same'}  (${(sizes[0][1] / 1024).toFixed(0)} KB)`);
for (const t of topics) {
  const tb = docBytes(t.topicDoc) / 1024;
  const qb = docBytes(t.questionsDoc) / 1024;
  const state = live?.topics?.[t.id] === t.version ? 'same' : live?.topics?.[t.id] ? 'CHANGED' : 'NEW';
  console.log(`  ${t.id.padEnd(16)} ${t.version}  ${state.padEnd(7)} topic ${tb.toFixed(0)} KB · questions ${qb.toFixed(0)} KB`);
}
if (dropped.length) console.log(`  no longer ready (dropped from meta, docs kept): ${dropped.join(', ')}`);

if (!changedTopics.length && !syllabusChanged && !dropped.length) {
  console.log('\n✓ nothing to publish — Firestore already has this content');
  process.exit(0);
}
if (!APPLY) {
  console.log(`\nDRY-RUN — would write ${changedTopics.length * 2 + (syllabusChanged ? 1 : 0)} docs + meta. Re-run with --apply.`);
  process.exit(0);
}

// ── 4. Write: content first, meta LAST (phones switch only when all is there) ─
for (const t of changedTopics) {
  const batch = db.batch();
  batch.set(db.collection('enggrammar_topics').doc(t.id), t.topicDoc);
  batch.set(db.collection('enggrammar_questions').doc(t.id), t.questionsDoc);
  await batch.commit();
  console.log(`  ✓ wrote ${t.id}`);
}
if (syllabusChanged) {
  await db.collection('enggrammar_syllabus').doc('main').set(sylDoc);
  console.log('  ✓ wrote syllabus');
}
await metaRef.set({ ...meta, publishedAt: admin.firestore.FieldValue.serverTimestamp() });
console.log(`\n✓ published ${meta.contentVersion}`);
