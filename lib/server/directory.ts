import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

/**
 * Server-side directory access (docs/AUTH.md).
 *
 * Contact details (email/phone) live in `users/{uid}/private/contact`, which is
 * owner-only in the rules. Teachers and managers legitimately need them — a
 * teacher must be able to phone a student's parents — but a rules-level
 * "is this student in one of my classes?" check is impossible (rules cannot run
 * queries). So the relationship is proven HERE, with the Admin SDK, and the
 * rules stay a flat owner-only check that nobody can widen by accident.
 */

export class DirectoryError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface Caller {
  uid: string;
  role: string | null;
  isSuperAdmin: boolean;
  /** centerId of an ACTIVE center this caller actually owns (ownerUid match), else null. */
  ownedCenterId: string | null;
}

/** Verifies the bearer token and resolves what the caller actually is. */
export async function identifyCaller(request: Request): Promise<Caller> {
  const match = (request.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!match) throw new DirectoryError('Avtorizatsiya talab qilinadi.', 401);

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(match[1]);
  } catch {
    throw new DirectoryError('Sessiya muddati tugagan. Qaytadan kiring.', 401);
  }

  const userData = (await adminDb.doc(`users/${decoded.uid}`).get()).data() ?? null;
  const role: string | null = userData?.role ?? null;

  // ⚠️ users.centerId is client-writable — never trust it. Prove ownership.
  let ownedCenterId: string | null = null;
  if (role === 'manager' && userData?.centerId) {
    const center = (await adminDb.doc(`centers/${userData.centerId}`).get()).data();
    if (center?.ownerUid === decoded.uid && center?.status === 'active') {
      ownedCenterId = userData.centerId;
    }
  }

  return {
    uid: decoded.uid,
    role,
    isSuperAdmin: decoded.super_admin === true,
    ownedCenterId,
  };
}

/** Is `teacherUid` a teacher of the caller's center? (center_teachers doc id == teacher uid) */
async function isTeacherOfCenter(teacherUid: string, centerId: string): Promise<boolean> {
  const link = (await adminDb.doc(`center_teachers/${teacherUid}`).get()).data();
  return link?.centerId === centerId;
}

/**
 * May `caller` see `targetUid`'s contact details?
 *
 *  - yourself, or a super admin           → yes
 *  - a teacher, for a student in one of THEIR OWN classes
 *  - a manager, for a teacher of their center, or for a student enrolled in a
 *    class taught by one of their center's teachers
 *
 * Anything else is no. In particular a student can never read another student's
 * contact details, and a teacher can never read a student they don't teach.
 */
export async function canReadContact(caller: Caller, targetUid: string): Promise<boolean> {
  if (caller.isSuperAdmin || caller.uid === targetUid) return true;

  // Classes the target is enrolled in (single-field array-contains index — no
  // composite index needed).
  const enrolledSnap = await adminDb
    .collection('classes')
    .where('studentIds', 'array-contains', targetUid)
    .get();
  const teacherIds = enrolledSnap.docs.map((d) => d.data().teacherId as string);

  if (caller.role === 'teacher') {
    return teacherIds.includes(caller.uid);
  }

  if (caller.ownedCenterId) {
    // A teacher of my center?
    if (await isTeacherOfCenter(targetUid, caller.ownedCenterId)) return true;
    // A student of one of my center's teachers?
    const checks = await Promise.all(
      [...new Set(teacherIds)].map((tid) => isTeacherOfCenter(tid, caller.ownedCenterId!)),
    );
    return checks.some(Boolean);
  }

  return false;
}

/**
 * Reads a user's contact details. During the staged migration the fields still
 * exist on the parent `users/{uid}` doc; the subcollection is authoritative and
 * the parent is the fallback. Once DEPLOY 2 strips the parent fields, the
 * fallback simply stops matching — no code change needed here.
 */
export async function readContact(uid: string): Promise<{ email: string; phone: string }> {
  const [priv, parent] = await Promise.all([
    adminDb.doc(`users/${uid}/private/contact`).get(),
    adminDb.doc(`users/${uid}`).get(),
  ]);
  const p = priv.data() ?? {};
  const legacy = parent.data() ?? {};
  return {
    email: p.email ?? legacy.email ?? '',
    phone: p.phone ?? legacy.phone ?? '',
  };
}
