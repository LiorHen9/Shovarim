// Shared audit-log writer for adminAuditLog/{entryId} (docs/DATA_MODEL.md,
// docs/DECISIONS.md ADR #42) — the admin-side counterpart to
// src/lib/audit/log.ts's writeAuditLog. Written before the mutation it
// records (same "audit before action" ordering as
// functions/src/accountDeletion.ts's deleteUserAccount), so a partially
// failed admin action still leaves a trail.
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import type { AdminAuditAction } from "../../types/adminAuditLog";

export async function writeAdminAuditLog(entry: {
  adminUid: string;
  targetUid?: string | null;
  action: AdminAuditAction;
  reason?: string | null;
}): Promise<void> {
  await adminDb.collection("adminAuditLog").add({
    adminUid: entry.adminUid,
    targetUid: entry.targetUid ?? null,
    action: entry.action,
    reason: entry.reason ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}
