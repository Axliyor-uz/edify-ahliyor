import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

/**
 * Thrown when the caller of an /api/manager/* route fails a check.
 * `status` maps directly to the HTTP status the route should respond with.
 * Messages are user-facing (Uzbek) — they surface directly in manager-panel toasts.
 */
export class ManagerApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies the Authorization: Bearer <idToken> header, requires the caller to be
 * a manager (users/{uid}.role) of an ACTIVE center — the server-side twin of the
 * `isActiveCenterManager()` rule that gates all manager writes in firestore.rules.
 * Returns the caller's uid and centerId.
 */
export async function requireActiveCenterManager(request: Request): Promise<{ uid: string; centerId: string }> {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    throw new ManagerApiError('Avtorizatsiya talab qilinadi.', 401);
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(match[1]);
  } catch {
    throw new ManagerApiError('Sessiya muddati tugagan. Qaytadan kiring.', 401);
  }

  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  const userData = userSnap.exists ? userSnap.data()! : null;
  if (!userData || userData.role !== 'manager' || !userData.centerId) {
    throw new ManagerApiError('Menejer huquqi talab qilinadi.', 403);
  }

  const centerSnap = await adminDb.collection('centers').doc(userData.centerId).get();
  if (!centerSnap.exists || centerSnap.data()!.status !== 'active') {
    throw new ManagerApiError('Markazingiz hali faollashtirilmagan.', 403);
  }

  return { uid: decoded.uid, centerId: userData.centerId };
}
