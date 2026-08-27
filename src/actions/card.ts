"use server";

import { revalidatePath } from "next/cache";

import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { assertCanManageCard } from "@/lib/auth/listAccess";
import { requireUid } from "@/lib/auth/session";
import { ActionError, toActionResult, type ActionResult } from "@/lib/actions/errors";
import { deleteCardSchema, type DeleteCardInput } from "@/lib/validation/card";

// Full deletion (not archival): removes the card doc, its usageLog subcollection
// (client Security Rules deny direct delete there, see docs/DECISIONS.md #4/#12 —
// recursiveDelete via the Admin SDK bypasses that), and any Storage files (card
// image, receipts) under the card's path prefix.
export async function deleteCard(input: DeleteCardInput): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = deleteCardSchema.parse(input);

    const cardRef = adminDb.collection("cards").doc(parsed.cardId);
    const cardSnap = await cardRef.get();
    if (!cardSnap.exists) throw new ActionError("הכרטיס לא נמצא");

    const card = cardSnap.data();
    if (!card) throw new ActionError("הכרטיס לא נמצא");
    await assertCanManageCard(uid, card as { ownerId: string; listId: string });

    await adminDb.recursiveDelete(cardRef);
    await adminStorage.bucket().deleteFiles({ prefix: `users/${card.ownerId}/cards/${parsed.cardId}/` });

    revalidatePath("/cards");
    revalidatePath(`/cards/lists/${card.listId}`);
    return { success: true };
  });
}
