"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import { toActionResult, type ActionResult } from "@/lib/actions/errors";
import { firestoreIdSchema } from "@/lib/validation/card";
import * as adminDeletion from "@/lib/services/adminDeletion";

// Thin wrappers, same shape as src/actions/adminModeration.ts — the actual
// mutations (including the self-protection check) live in
// src/lib/services/adminDeletion.ts. Immediate deletion is deliberately not
// here: it's a Cloud Function callable (functions/src/adminActions.ts),
// called directly from the client — see docs/DECISIONS.md ADR #45.

export async function adminScheduleUserDeletionAction(uid: string): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const parsedUid = firestoreIdSchema.parse(uid);
    await adminDeletion.scheduleUserDeletion(adminUid, parsedUid);
    revalidatePath(`/admin/users/${parsedUid}`);
    return { success: true };
  });
}

export async function adminCancelUserDeletionAction(uid: string): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const parsedUid = firestoreIdSchema.parse(uid);
    await adminDeletion.cancelUserDeletion(adminUid, parsedUid);
    revalidatePath(`/admin/users/${parsedUid}`);
    return { success: true };
  });
}
