import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { AdminAuthError, requireSuperAdmin } from '@/lib/server/verifySuperAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Delete a query's docs in chunks of 400 (batch limit is 500 ops). Returns count. */
async function deleteByQuery(query: FirebaseFirestore.Query): Promise<number> {
  let total = 0;
  // Loop so re-runs after partial failures are safe (idempotent cleanup).
  while (true) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  return total;
}

/**
 * DELETE /api/admin/centers/[id] — cascade-delete a center.
 * Body: { deleteManagerAccount?: boolean, deleteClasses?: boolean }
 * Only manager-created groups (classes.centerId == center) are ever deleted;
 * teachers' personal classes and teacher accounts are never touched.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin(request);
    const { id: centerId } = await params;

    const centerRef = adminDb.collection('centers').doc(centerId);
    const centerSnap = await centerRef.get();
    if (!centerSnap.exists) {
      return NextResponse.json({ error: 'Center not found.' }, { status: 404 });
    }
    const center = centerSnap.data()!;

    const body = await request.json().catch(() => ({}));
    const deleteManagerAccount = body?.deleteManagerAccount !== false; // default true
    const deleteClasses = body?.deleteClasses !== false; // default true

    const deletedCounts: Record<string, number> = {};

    // 1. Student attendance history (all day docs carry centerId).
    deletedCounts['attendance days'] = await deleteByQuery(
      adminDb.collection('center_attendance').where('centerId', '==', centerId)
    );

    // 2. Staff attendance history.
    deletedCounts['staff attendance days'] = await deleteByQuery(
      adminDb.collection('center_staff_attendance').where('centerId', '==', centerId)
    );

    // 3. Rooms.
    deletedCounts['rooms'] = await deleteByQuery(
      adminDb.collection('rooms').where('centerId', '==', centerId)
    );

    // 4. Manager-created groups (classes stamped with this centerId).
    const classesSnap = await adminDb.collection('classes').where('centerId', '==', centerId).get();
    if (deleteClasses) {
      // recursiveDelete removes the class doc together with its subcollections
      // (assignments, exams, materials, requests, leaderboard).
      for (const classDoc of classesSnap.docs) {
        await adminDb.recursiveDelete(classDoc.ref);
      }
      deletedCounts['groups'] = classesSnap.size;
    } else if (classesSnap.size > 0) {
      const batch = adminDb.batch();
      classesSnap.docs.forEach((d) => batch.update(d.ref, { centerId: FieldValue.delete() }));
      await batch.commit();
      deletedCounts['groups detached'] = classesSnap.size;
    }

    // 5. Teacher links.
    deletedCounts['teacher links'] = await deleteByQuery(
      adminDb.collection('center_teachers').where('centerId', '==', centerId)
    );

    // 6. Manager account (optional).
    if (deleteManagerAccount && center.ownerUid) {
      const ownerRef = adminDb.collection('users').doc(center.ownerUid);
      const ownerSnap = await ownerRef.get();
      if (ownerSnap.exists) {
        const username = ownerSnap.data()!.username;
        if (username) {
          await adminDb.collection('usernames').doc(String(username).toLowerCase()).delete().catch(() => {});
        }
        await ownerRef.delete();
      }
      await adminAuth.deleteUser(center.ownerUid).catch((err: any) => {
        if (err?.code !== 'auth/user-not-found') throw err;
      });
      deletedCounts['manager account'] = 1;
    }

    // 7. The center doc itself, last — a re-run after partial failure still finds it.
    await centerRef.delete();

    return NextResponse.json({ ok: true, deletedCounts });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('DELETE /api/admin/centers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete center. It is safe to retry.' }, { status: 500 });
  }
}
