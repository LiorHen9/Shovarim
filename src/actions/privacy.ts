"use server";

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { requireUid } from "@/lib/auth/session";
import { toActionResult, type ActionResult } from "@/lib/actions/errors";
import { buildUserDataExport, type UserDataExport } from "@/lib/services/export";
import { writeAuditLog } from "@/lib/audit/log";
import type { UserProfile } from "@/types/user";

// Right-to-access/portability (docs/PRIVACY.md, docs/ROADMAP.md Phase 4).
// uid is derived from the session only, never accepted as an argument.
export async function exportUserData(): Promise<ActionResult<UserDataExport>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    try {
      const data = await buildUserDataExport(uid);
      await writeAuditLog({ uid, eventType: "export", channel: "web", result: "success" });
      return data;
    } catch (error) {
      await writeAuditLog({ uid, eventType: "export", channel: "web", result: "error" });
      throw error;
    }
  });
}

// Right-to-erasure, stage 1 (docs/PRIVACY.md § "זכות מחיקה"): marks the
// account for deletion after a grace period (functions/src/accountDeletion.ts
// sweeps and deletes it for real once the window elapses). Idempotent — a
// repeat request does not push the deadline back out.
export async function requestAccountDeletion(): Promise<ActionResult<{ deletionRequestedAt: string }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const existing = (userSnap.data() as UserProfile | undefined)?.deletionRequestedAt;
    if (existing) return { deletionRequestedAt: existing.toDate().toISOString() };

    const deletionRequestedAt = Timestamp.now();
    await userRef.update({ deletionRequestedAt });
    await writeAuditLog({ uid, eventType: "deletion_request", channel: "web", result: "success" });
    return { deletionRequestedAt: deletionRequestedAt.toDate().toISOString() };
  });
}

// Right-to-erasure, cancellation: reversible any time before the scheduled
// sweep runs.
export async function cancelAccountDeletion(): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    await adminDb.collection("users").doc(uid).update({ deletionRequestedAt: null });
    await writeAuditLog({ uid, eventType: "deletion_cancelled", channel: "web", result: "success" });
    return { success: true };
  });
}
