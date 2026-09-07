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
import { runAllScrapes, runScrapeForClub, type RunOutcome } from "./benefits/runner";

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
    // Null here, always: this action's subject is a user. The field exists for
    // the club-catalog actions (ADR #61) and is written by every producer so
    // AdminAuditLogEntry.targetId can stay non-optional.
    targetId: null,
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

// --- benefit scraping ------------------------------------------------------

// "Run now" for /admin/benefits. A callable rather than a Server Action for the
// same reason adminDeleteUserNow is one: the scrape lives in functions/ (it is
// what the scheduler triggers) and src/ cannot import it across the rootDir
// boundary, so the Server Action calls this instead of the logic being
// duplicated.
//
// Same trust model as above — a callable is a public HTTP endpoint, so admin
// status is verified here and never taken from the client.
interface AdminScrapeBenefitsRequest {
  clubId?: unknown;
}

export async function adminScrapeBenefitsNowHandler(
  callerUid: string | undefined,
  clubId: unknown
): Promise<{ outcomes: RunOutcome[] }> {
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "יש להתחבר");
  }

  const roleDoc = await db.doc(`adminRoles/${callerUid}`).get();
  if (!roleDoc.exists) {
    throw new HttpsError("permission-denied", "אין הרשאת ניהול");
  }

  // Audit-before-action, matching adminDeleteUserNow and every mutation in
  // src/lib/services/adminClubs.ts. targetId is the club when one was named,
  // null for "run everything".
  await db.collection("adminAuditLog").add({
    adminUid: callerUid,
    targetUid: null,
    targetId: typeof clubId === "string" && clubId ? clubId : null,
    action: "benefits_scrape_run",
    reason: null,
    createdAt: Timestamp.now(),
  });

  if (typeof clubId === "string" && clubId) {
    return { outcomes: [await runScrapeForClub(db, clubId, callerUid)] };
  }
  return { outcomes: await runAllScrapes(db, callerUid) };
}

// timeoutSeconds matches the scheduled trigger: pressing the button does the
// same work, and a shorter timeout here would make the manual path fail on
// exactly the uncapped runs an admin is most likely to be testing.
export const adminScrapeBenefitsNow = onCall<AdminScrapeBenefitsRequest>(
  { enforceAppCheck: true, timeoutSeconds: 540, memory: "512MiB" },
  (request) => adminScrapeBenefitsNowHandler(request.auth?.uid, request.data.clubId)
);
