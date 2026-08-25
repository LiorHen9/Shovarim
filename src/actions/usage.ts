"use server";

import { revalidatePath } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { requireUid } from "@/lib/auth/session";
import { createUsageEntrySchema, type CreateUsageEntryInput } from "@/lib/validation/usageLog";

// Runs as a Server Action (Admin SDK) rather than a client-SDK write because
// the balance update must be atomic and re-validated server-side — this is
// the one financial invariant in the app that must never be wrong. See
// docs/DECISIONS.md #3 and docs/DATA_MODEL.md.
export async function addUsageEntry(input: CreateUsageEntryInput): Promise<{ newBalance: number }> {
  const uid = await requireUid();
  const parsed = createUsageEntrySchema.parse(input);

  const cardRef = adminDb.collection("cards").doc(parsed.cardId);
  const entryRef = cardRef.collection("usageLog").doc();

  const newBalance = await adminDb.runTransaction(async (tx) => {
    const cardSnap = await tx.get(cardRef);
    if (!cardSnap.exists) throw new Error("הכרטיס לא נמצא");

    const card = cardSnap.data();
    if (!card || card.ownerId !== uid) throw new Error("אין הרשאה לכרטיס זה");
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
      ownerId: uid,
      cardId: parsed.cardId,
      amount: parsed.amount,
      date: Timestamp.fromDate(parsed.date),
      purpose: parsed.purpose,
      location: parsed.location,
      receiptImageUrl: null,
      balanceAfter: updatedBalance,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
    });

    return updatedBalance;
  });

  revalidatePath(`/cards/${parsed.cardId}`);
  return { newBalance };
}
