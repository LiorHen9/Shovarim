"use server";

import { revalidatePath } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { assertCanManageCard } from "@/lib/auth/listAccess";
import { requireUid } from "@/lib/auth/session";
import {
  createUsageEntrySchema,
  deleteUsageEntrySchema,
  type CreateUsageEntryInput,
  type DeleteUsageEntryInput,
} from "@/lib/validation/usageLog";

// Runs as a Server Action (Admin SDK) rather than a client-SDK write because
// the balance update must be atomic and re-validated server-side — this is
// the one financial invariant in the app that must never be wrong. See
// docs/DECISIONS.md #3 and docs/DATA_MODEL.md.
export async function addUsageEntry(input: CreateUsageEntryInput): Promise<{ newBalance: number }> {
  const uid = await requireUid();
  const parsed = createUsageEntrySchema.parse(input);

  const cardRef = adminDb.collection("cards").doc(parsed.cardId);
  const entryRef = parsed.entryId
    ? cardRef.collection("usageLog").doc(parsed.entryId)
    : cardRef.collection("usageLog").doc();

  const newBalance = await adminDb.runTransaction(async (tx) => {
    const cardSnap = await tx.get(cardRef);
    if (!cardSnap.exists) throw new Error("הכרטיס לא נמצא");

    const card = cardSnap.data();
    if (!card) throw new Error("הכרטיס לא נמצא");
    await assertCanManageCard(uid, card as { ownerId: string; listId: string }, tx);
    if (card.status === "archived") throw new Error("לא ניתן לעדכן שימוש בכרטיס בארכיון");

    const currentBalance: number = card.currentBalance;
    if (parsed.amount > currentBalance) {
      throw new Error("הסכום גדול מהיתרה הזמינה בכרטיס");
    }

    const updatedBalance = currentBalance - parsed.amount;
    const nextStatus = updatedBalance === 0 ? "depleted" : card.status;

    tx.update(cardRef, {
      currentBalance: updatedBalance,
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(entryRef, {
      id: entryRef.id,
      ownerId: card.ownerId,
      cardId: parsed.cardId,
      amount: parsed.amount,
      date: Timestamp.fromDate(parsed.date),
      purpose: parsed.purpose,
      location: parsed.location,
      receiptImageUrl: parsed.receiptImageUrl ?? null,
      balanceAfter: updatedBalance,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
    });

    return updatedBalance;
  });

  revalidatePath(`/cards/${parsed.cardId}`);
  return { newBalance };
}

// Scoped exception to docs/DECISIONS.md #4 (usageLog immutability) — see #12.
// Client-side Security Rules still deny update/delete on usageLog; this Server
// Action (Admin SDK, bypasses rules) is the only sanctioned deletion path, and
// it recalculates currentBalance atomically in the same transaction just like
// addUsageEntry above, per docs/DECISIONS.md #10.
export async function deleteUsageEntry(input: DeleteUsageEntryInput): Promise<{ newBalance: number }> {
  const uid = await requireUid();
  const parsed = deleteUsageEntrySchema.parse(input);

  const cardRef = adminDb.collection("cards").doc(parsed.cardId);
  const entryRef = cardRef.collection("usageLog").doc(parsed.entryId);

  const newBalance = await adminDb.runTransaction(async (tx) => {
    const [cardSnap, entrySnap] = await Promise.all([tx.get(cardRef), tx.get(entryRef)]);
    if (!cardSnap.exists) throw new Error("הכרטיס לא נמצא");
    if (!entrySnap.exists) throw new Error("רשומת השימוש לא נמצאה");

    const card = cardSnap.data();
    if (!card) throw new Error("הכרטיס לא נמצא");
    await assertCanManageCard(uid, card as { ownerId: string; listId: string }, tx);

    const entry = entrySnap.data();
    if (!entry || entry.cardId !== parsed.cardId) throw new Error("אין הרשאה לרשומה זו");

    const currentBalance: number = card.currentBalance;
    const updatedBalance = parsed.restoreBalance ? currentBalance + entry.amount : currentBalance;
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

  revalidatePath(`/cards/${parsed.cardId}`);
  return { newBalance };
}
