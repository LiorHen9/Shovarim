// Extracted from src/actions/balance.ts (docs/DECISIONS.md ADR #22) so both
// the Server Action and the MCP `updateBalance` tool run the exact same
// transaction logic. Relative imports for the same reason as ./cards.ts.
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { assertCanManageCard } from "../auth/listAccessCore";
import { ActionError } from "../actions/errorsCore";
import type { UpdateBalanceInput } from "../validation/balanceUpdate";

export async function updateCardBalanceForUid(
  uid: string,
  input: UpdateBalanceInput
): Promise<{ newBalance: number }> {
  const cardRef = adminDb.collection("cards").doc(input.cardId);

  await adminDb.runTransaction(async (tx) => {
    const cardSnap = await tx.get(cardRef);
    if (!cardSnap.exists) throw new ActionError("הכרטיס לא נמצא");

    const card = cardSnap.data();
    if (!card) throw new ActionError("הכרטיס לא נמצא");
    await assertCanManageCard(uid, card as { ownerId: string; listId: string }, tx);
    if (card.status === "archived") throw new ActionError("לא ניתן לעדכן יתרה בכרטיס בארכיון");

    const nextStatus =
      input.newBalance === 0 ? "depleted" : card.status === "depleted" ? "active" : card.status;

    tx.update(cardRef, {
      currentBalance: input.newBalance,
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { newBalance: input.newBalance };
}
