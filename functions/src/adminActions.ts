// Admin-only immediate deletion (docs/ROADMAP.md Phase 9.4, docs/DECISIONS.md
// ADR #45). Lives here — not as a Server Action — because
// functions/tsconfig.json's rootDir: "src" prevents src/actions/ from
// importing deleteUserAccount from this package (ADR #24); this callable
// calls it directly instead of duplicating the cascade-delete logic.
//
// A callable function is a public HTTP endpoint: it must verify admin status
// itself, the same way src/lib/auth/session.ts's requireAdmin() does for
// Server Actions, never trusting a client-supplied flag.
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { db } from "./firebaseAdmin";
import { deleteUserAccount } from "./accountDeletion";

interface AdminDeleteUserNowRequest {
  uid?: unknown;
}

// Separated from the onCall wrapper below so the admin-permission logic is
// exercisable directly, the same way src/lib/services/adminModeration.ts's
// mutations are tested without going through a Server Action — see
// scripts/smoke-deletion.ts. onCall is just the transport.
export async function adminDeleteUserNowHandler(callerUid: string | undefined, targetUid: unknown): Promise<void> {
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "יש להתחבר");
  }

  const roleDoc = await db.doc(`adminRoles/${callerUid}`).get();
  if (!roleDoc.exists) {
    throw new HttpsError("permission-denied", "אין הרשאת ניהול");
  }

  if (typeof targetUid !== "string" || !targetUid) {
    throw new HttpsError("invalid-argument", "uid חסר");
  }

  // Same lockout concern as blockUser/blockEmail in adminModeration.ts — with
  // a single admin today, self-deletion would be unrecoverable without direct
  // Firebase Console access.
  if (targetUid === callerUid) {
    throw new HttpsError("failed-precondition", "לא ניתן למחוק את עצמך");
  }

  // Audit-before-action, same ordering as deleteUserAccount's own auditLog
  // write and every mutation in src/lib/services/adminModeration.ts.
  await db.collection("adminAuditLog").add({
    adminUid: callerUid,
    targetUid,
    action: "delete_immediate",
    reason: null,
    createdAt: Timestamp.now(),
  });

  await deleteUserAccount(targetUid);
}

// enforceAppCheck verifies the App Check token itself at the function layer —
// this is independent of (and not covered by) the per-service "Enforce"
// toggle in the Firebase Console that docs/DEPLOYMENT.md documents for
// Firestore/Storage; Cloud Functions callables enforce it this way instead.
export const adminDeleteUserNow = onCall<AdminDeleteUserNowRequest>({ enforceAppCheck: true }, (request) =>
  adminDeleteUserNowHandler(request.auth?.uid, request.data.uid)
);
