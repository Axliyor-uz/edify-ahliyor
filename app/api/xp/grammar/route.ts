// POST /api/xp/grammar — the ONLY writer of grammar XP (EdifyStudent Android
// grammar block). The app sends what the student answered; the server re-grades
// it against the published content, decides the XP from its own record
// (enggrammar_xp/{uid}, lib/grammar/session.ts) and writes grammar XP +
// users.totalXP / streak / dailyHistory + the leaderboards in ONE transaction.
//
// Request  { id, kind: lesson|round|review|test|speed|hunt, topicId, pointId?,
//            answers?: [{ t?, i, s?, a, r?, h? }], right?, textId?, misses? }
// Response { ok, duplicate?, award: {lines, total}, finalXp, bonuses, totalXP,
//            level, leveledUp, streak, grammarXp, percent, correct, total, passed }
// Errors   { ok:false, error, code, retryAfterMs? } — 400 forged/invalid (drop it),
//            409 out of order (drop it), 429 TOO_FAST (retry later), 401 auth, 5xx retry.
// `id` is the client's submission id: a repeat returns the stored result
// (offline queues may resend) and never pays twice.

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireUser, IeltsApiError } from '@/lib/server/ieltsRoute';
import { loadGrammarContent } from '@/lib/server/grammarContent';
import { applyUserXpAdmin, mirrorLeaderboardsAdmin, notifyLevelUpAdmin, studentClassIds } from '@/lib/server/xpAdmin';
import { evaluate, seedState, GrammarXpError, type GrammarXpState, type Submission } from '@/lib/grammar/session';
import { xpDayKey } from '@/lib/xpDays';

export const dynamic = 'force-dynamic';

const KINDS = new Set(['lesson', 'round', 'review', 'test', 'speed', 'hunt']);
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const KEY_RE = /^[A-Za-z0-9_.#-]{1,80}$/;
const MAX_BODY = 64 * 1024;

function fail(status: number, code: string, error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, error, code, ...extra }, { status });
}

function normalizeState(d: FirebaseFirestore.DocumentData | undefined): GrammarXpState {
  return {
    schema: 1,
    xp: Number(d?.xp) || 0,
    points: d?.points && typeof d.points === 'object' ? d.points : {},
    done: Array.isArray(d?.done) ? d!.done.map(String) : [],
    clockAt: Number(d?.clockAt) || 0,
  };
}

export async function POST(request: Request) {
  let uid: string;
  try {
    ({ uid } = await requireUser(request));
  } catch (e) {
    const err = e as IeltsApiError;
    return fail(err.status || 401, err.code || 'AUTH_REQUIRED', err.message);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail(413, 'TOO_LARGE', 'So‘rov juda katta.');
  let sub: Submission;
  try { sub = JSON.parse(raw); } catch { return fail(400, 'BAD_JSON', 'JSON noto‘g‘ri.'); }
  if (!sub || typeof sub !== 'object') return fail(400, 'BAD_REQUEST', 'So‘rov noto‘g‘ri.');
  if (typeof sub.id !== 'string' || !ID_RE.test(sub.id)) return fail(400, 'BAD_ID', 'id noto‘g‘ri.');
  if (!KINDS.has(sub.kind)) return fail(400, 'BAD_KIND', 'kind noto‘g‘ri.');
  if (typeof sub.topicId !== 'string' || !KEY_RE.test(sub.topicId)) return fail(400, 'BAD_TOPIC', 'topicId noto‘g‘ri.');
  if (sub.pointId != null && (typeof sub.pointId !== 'string' || !KEY_RE.test(sub.pointId))) return fail(400, 'BAD_POINT', 'pointId noto‘g‘ri.');
  if (sub.answers != null && (!Array.isArray(sub.answers) || sub.answers.length > 40)) return fail(400, 'BAD_ANSWERS', 'answers noto‘g‘ri.');

  const topicIds = sub.kind === 'review'
    ? [...new Set((sub.answers || []).map((a) => (typeof a?.t === 'string' && KEY_RE.test(a.t) ? a.t : sub.topicId)))]
    : [sub.topicId];
  if (topicIds.length > 20) return fail(400, 'BAD_ANSWERS', 'answers noto‘g‘ri.');

  const xpRef = adminDb.collection('enggrammar_xp').doc(uid);
  const subRef = xpRef.collection('subs').doc(sub.id);
  const userRef = adminDb.collection('users').doc(uid);
  const progressRef = adminDb.collection('enggrammar_progress').doc(uid);

  try {
    const known = (await xpRef.get()).exists;
    // A test (or first contact, which seeds) needs the whole level to see completions.
    const content = await loadGrammarContent(topicIds, sub.kind === 'test' || !known ? sub.topicId : undefined);
    const classIds = await studentClassIds(uid);
    const now = new Date();

    const result = await adminDb.runTransaction(async (tx) => {
      const subSnap = await tx.get(subRef);
      if (subSnap.exists) return { ...(subSnap.get('result') || {}), duplicate: true };
      const [xpSnap, userSnap] = await Promise.all([tx.get(xpRef), tx.get(userRef)]);
      const prev = xpSnap.exists
        ? normalizeState(xpSnap.data())
        : seedState((await tx.get(progressRef)).get('points'), content, now.getTime());

      const ev = evaluate(prev, sub, content, now.getTime(), xpDayKey(now));
      const isGame = sub.kind === 'speed' || sub.kind === 'hunt';
      const applied = applyUserXpAdmin(tx, userRef, userSnap, {
        xp: ev.award.total,
        breakdown: [`Grammar: +${ev.award.total}`],
        activityEntry: isGame
          ? { id: sub.id, game: ev.title, result: 'done', xpEarned: ev.award.total, timestamp: now.getTime() }
          : {
              id: sub.id, kind: 'grammar', testTitle: `Grammar · ${ev.title}`,
              score: ev.correct, totalQuestions: ev.total, xpEarned: ev.award.total, submittedAt: now.getTime(),
            },
        activityLimit: isGame ? 10 : 5,
      }, now);
      mirrorLeaderboardsAdmin(tx, uid, applied.finalXp, { displayName: applied.displayName, avatar: applied.avatar }, classIds, now);
      tx.set(xpRef, { ...ev.state, updatedAt: FieldValue.serverTimestamp() });

      const out = {
        ok: true,
        award: ev.award,
        finalXp: applied.finalXp,
        bonuses: applied.bonuses,
        totalXP: applied.totalXP,
        level: applied.newLevel,
        leveledUp: applied.leveledUp,
        streak: applied.currentStreak,
        grammarXp: ev.state.xp,
        percent: ev.percent,
        correct: ev.correct,
        total: ev.total,
        passed: ev.passed,
      };
      tx.set(subRef, { kind: sub.kind, topicId: sub.topicId, result: out, at: FieldValue.serverTimestamp() });
      return out;
    });

    if (result.leveledUp && !result.duplicate) await notifyLevelUpAdmin(uid, result.level);
    return Response.json(result);
  } catch (e) {
    if (e instanceof GrammarXpError) {
      return fail(e.status, e.code, e.message, e.retryAfterMs ? { retryAfterMs: e.retryAfterMs } : {});
    }
    console.error('[xp/grammar]', e);
    return fail(500, 'SERVER', 'Server xatosi. Keyinroq qayta urinib ko‘ring.');
  }
}
