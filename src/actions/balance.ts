"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { assertCanManageCard } from "@/lib/auth/listAccess";
import { requireUid } from "@/lib/auth/session";
import { updateBalanceSchema, type UpdateBalanceInput } from "@/lib/validation/balanceUpdate";

// Manual balance correction (Phase 3) — a deliberate, narrow exception to
// docs/DECISIONS.md #3/#4: it sets currentBalance directly without a usageLog
// entry (e.g. store re-issued balance after a support call, physical
// recount). Kept as a Server Action rather than a client-SDK write so the
// same ownership/status invariants enforced in addUsageEntry (src/actions/usage.ts)
// stay centralized in one place — see docs/DECISIONS.md #11.
export async function updateCardBalance(input: UpdateBalanceInput): Promise<{ newBalance: number }> {
  const uid = await requireUid();
  const parsed = updateBalanceSchema.parse(input);

  const cardRef = adminDb.collection("cards").doc(parsed.cardId);

  await adminDb.runTransaction(async (tx) => {
    const cardSnap = await tx.get(cardRef);
    if (!cardSnap.exists) throw new Error("הכרטיס לא נמצא");

    const card = cardSnap.data();
    if (!card) throw new Error("הכרטיס לא נמצא");
    await assertCanManageCard(uid, card as { ownerId: string; listId: string }, tx);
    if (card.status === "archived") throw new Error("לא ניתן לעדכן יתרה בכרטיס בארכיון");

    const nextStatus =
      parsed.newBalance === 0 ? "depleted" : card.status === "depleted" ? "active" : card.status;

    tx.update(cardRef, {
      currentBalance: parsed.newBalance,
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  revalidatePath(`/cards/${parsed.cardId}`);
  return { newBalance: parsed.newBalance };
}
