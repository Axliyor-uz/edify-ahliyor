// Seeds/updates appConfig/androidStudent — the Android student app's update gate
// (docs/DATA_MODEL.md). Run this after every Play release to bump the version
// thresholds; the Android app compares BuildConfig.VERSION_CODE against them:
//   < minRequiredVersionCode (or in blockedVersionCodes) → hard-blocked
//   < latestVersionCode                                  → dismissible dialog
//
// DRY-RUN by default. Apply with:
//   node --env-file=.env.local scripts/seedAppConfig.mjs --apply --latest 8 --min 1
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

function intArg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  const n = Number.parseInt(process.argv[i + 1], 10);
  if (Number.isNaN(n)) throw new Error(`--${name} must be an integer`);
  return n;
}

const ref = db.collection('appConfig').doc('androidStudent');
const existing = (await ref.get()).data();
console.log('current:', existing ?? '(missing)');

const payload = {
  latestVersionCode: intArg('latest', existing?.latestVersionCode ?? 8),
  minRequiredVersionCode: intArg('min', existing?.minRequiredVersionCode ?? 1),
  blockedVersionCodes: existing?.blockedVersionCodes ?? [],
};
console.log(APPLY ? 'writing:' : 'DRY-RUN, would write:', payload);

if (APPLY) {
  await ref.set(payload, { merge: true });
  console.log('done.');
}
