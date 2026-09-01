// Admin-initiated scheduled deletion (docs/ROADMAP.md Phase 9.4, docs/DECISIONS.md
// ADR #45). Reuses the existing grace-period mechanism (deletionRequestedAt on
// users/{uid}, swept by functions/src/accountDeletion.ts) exactly as a
// self-service request would — no parallel scheduling system. Called only
// from src/actions/adminDeletion.ts, which already ran requireAdmin().
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { ActionError } from "../actions/errorsCore";
import { writeAdminAuditLog } from "../audit/adminLog";

// Same lockout concern as blockUser in adminModeration.ts — scheduling one's
// own deletion would (after the grace period) remove the only admin with no
// way back short of direct Firebase Console access.
export async function scheduleUserDeletion(adminUid: string, targetUid: string): Promise<void> {
  if (adminUid === targetUid) {
    throw new ActionError("לא ניתן לתזמן מחיקה לעצמך — היחיד עם הרשאת אדמין כרגע");
  }

  await writeAdminAuditLog({ adminUid, targetUid, action: "delete_scheduled" });

  await adminDb.collection("users").doc(targetUid).update({
    deletionRequestedAt: FieldValue.serverTimestamp(),
  });
}

// Mirrors the user-facing cancelAccountDeletion (src/actions/privacy.ts) —
// same field, same reversibility, just admin-initiated and audit-logged
// under adminAuditLog instead of the user's own auditLog.
export async function cancelUserDeletion(adminUid: string, targetUid: string): Promise<void> {
  await writeAdminAuditLog({ adminUid, targetUid, action: "delete_cancelled" });

  await adminDb.collection("users").doc(targetUid).update({
    deletionRequestedAt: null,
  });
}
