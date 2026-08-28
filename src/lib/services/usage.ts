// Extracted from src/actions/usage.ts (docs/DECISIONS.md ADR #22) so both the
// Server Actions and the MCP `logUsage`/`deleteUsageEntry` tools run the
// exact same balance-transaction logic. Relative imports for the same reason
// as ./cards.ts: tsx run outside Next's bundler doesn't resolve "@/".
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { assertCanManageCard } from "../auth/listAccessCore";
import { ActionError } from "../actions/errorsCore";
import type { CreateUsageEntryInput, DeleteUsageEntryInput } from "../validation/usageLog";

export async function addUsageEntryForUid(
  uid: string,
  input: CreateUsageEntryInput
): Promise<{ newBalance: number }> {
  const cardRef = adminDb.collection("cards").doc(input.cardId);
  const entryRef = input.entryId
    ? cardRef.collection("usageLog").doc(input.entryId)
    : cardRef.collection("usageLog").doc();

  const newBalance = await adminDb.runTransaction(async (tx) => {
    const cardSnap = await tx.get(cardRef);
    if (!cardSnap.exists) throw new ActionError("הכרטיס לא נמצא");

    const card = cardSnap.data();
    if (!card) throw new ActionError("הכרטיס לא נמצא");
    await assertCanManageCard(uid, card as { ownerId: string; listId: string }, tx);
    if (card.status === "archived") throw new ActionError("לא ניתן לעדכן שימוש בכרטיס בארכיון");

    const currentBalance: number = card.currentBalance;
    if (input.amount > currentBalance) {
      throw new ActionError("הסכום גדול מהיתרה הזמינה בכרטיס");
    }

    const updatedBalance = currentBalance - input.amount;
    const nextStatus = updatedBalance === 0 ? "depleted" : card.status;

    tx.update(cardRef, {
      currentBalance: updatedBalance,
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(entryRef, {
      id: entryRef.id,
      ownerId: card.ownerId,
      cardId: input.cardId,
      amount: input.amount,
      date: Timestamp.fromDate(input.date),
      purpose: input.purpose,
      location: input.location,
      receiptImageUrl: input.receiptImageUrl ?? null,
      balanceAfter: updatedBalance,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
    });

    return updatedBalance;
  });

  return { newBalance };
}

export async function deleteUsageEntryForUid(
  uid: string,
  input: DeleteUsageEntryInput
): Promise<{ newBalance: number }> {
  const cardRef = adminDb.collection("cards").doc(input.cardId);
  const entryRef = cardRef.collection("usageLog").doc(input.entryId);

  const newBalance = await adminDb.runTransaction(async (tx) => {
    const [cardSnap, entrySnap] = await Promise.all([tx.get(cardRef), tx.get(entryRef)]);
    if (!cardSnap.exists) throw new ActionError("הכרטיס לא נמצא");
    if (!entrySnap.exists) throw new ActionError("רשומת השימוש לא נמצאה");

    const card = cardSnap.data();
    if (!card) throw new ActionError("הכרטיס לא נמצא");
    await assertCanManageCard(uid, card as { ownerId: string; listId: string }, tx);

    const entry = entrySnap.data();
    if (!entry || entry.cardId !== input.cardId) throw new ActionError("אין הרשאה לרשומה זו");

    const currentBalance: number = card.currentBalance;
    const updatedBalance = input.restoreBalance ? currentBalance + entry.amount : currentBalance;
    const nextStatus =
      updatedBalance === 0 ? "depleted" : card.status === "depleted" && updatedBalance > 0 ? "active" : card.status;

    tx.update(cardRef, {
      currentBalance: updatedBalance,
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.delete(entryRef);

    return updatedBalance;
  });

  return { newBalance };
}
