"use server";

import { revalidatePath } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { assertCanManageCard, assertCanManageListAndGetOwner } from "@/lib/auth/listAccess";
import { requireUid } from "@/lib/auth/session";
import { decryptNullableField, encryptNullableField } from "@/lib/crypto/fieldEncryption";
import { ActionError, toActionResult, type ActionResult } from "@/lib/actions/errors";
import {
  cardIdSchema,
  createCardServerSchema,
  deleteCardSchema,
  type CardIdInput,
  type CreateCardServerInput,
  type DeleteCardInput,
} from "@/lib/validation/card";
import { updateCardDetailsSchema, type UpdateCardDetailsInput } from "@/lib/validation/cardEdit";

// Card creation runs as a Server Action (Admin SDK) — not a direct client
// write like the rest of the card fields — specifically so cvv/barcodeOrCode
// get encrypted (src/lib/crypto/fieldEncryption.ts) before they ever reach
// Firestore. The Firestore rules' cards.create checks (listId ownership,
// manager membership) are bypassed by the Admin SDK, so
// assertCanManageListAndGetOwner re-implements the same check here. cardId
// is generated client-side by CardForm (so the Storage image upload, which
// still happens client-side, has an id to key off before this action runs).
export async function createCard(input: CreateCardServerInput): Promise<ActionResult<{ cardId: string }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = createCardServerSchema.parse(input);

    const listOwnerId = await assertCanManageListAndGetOwner(uid, parsed.listId);

    const cardRef = adminDb.collection("cards").doc(parsed.cardId);
    await cardRef.create({
      ownerId: listOwnerId,
      listId: parsed.listId,
      name: parsed.name,
      categoryId: parsed.categoryId,
      tags: parsed.tags,
      initialBalance: parsed.initialBalance,
      currentBalance: parsed.initialBalance,
      currency: parsed.currency.toUpperCase(),
      expiryDate: parsed.expiryDate ? Timestamp.fromDate(parsed.expiryDate) : null,
      purchaseDate: parsed.purchaseDate ? Timestamp.fromDate(parsed.purchaseDate) : null,
      cardImageUrl: parsed.cardImageUrl,
      barcodeOrCode: encryptNullableField(parsed.barcodeOrCode),
      cvv: encryptNullableField(parsed.cvv),
      acceptingRetailersUrl: parsed.acceptingRetailersUrl,
      notes: parsed.notes,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/cards");
    revalidatePath(`/cards/lists/${parsed.listId}`);
    return { cardId: parsed.cardId };
  });
}

// General-details edit (docs/DECISIONS.md #3/#4/#11 scope — never
// balance/currency) — moved from a direct client updateDoc to a Server
// Action for the same reason as createCard above: cvv/barcodeOrCode must be
// encrypted before they hit Firestore, which requires the Admin SDK key that
// only server code has access to.
export async function updateCardDetails(input: UpdateCardDetailsInput): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = updateCardDetailsSchema.parse(input);

    const cardRef = adminDb.collection("cards").doc(parsed.cardId);
    const cardSnap = await cardRef.get();
    if (!cardSnap.exists) throw new ActionError("הכרטיס לא נמצא");
    const card = cardSnap.data();
    if (!card) throw new ActionError("הכרטיס לא נמצא");
    await assertCanManageCard(uid, card as { ownerId: string; listId: string });

    await cardRef.update({
      name: parsed.name,
      expiryDate: parsed.expiryDate ? Timestamp.fromDate(parsed.expiryDate) : null,
      barcodeOrCode: encryptNullableField(parsed.barcodeOrCode),
      cvv: encryptNullableField(parsed.cvv),
      acceptingRetailersUrl: parsed.acceptingRetailersUrl,
      notes: parsed.notes,
      categoryId: parsed.categoryId,
      tags: parsed.tags,
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath(`/cards/${parsed.cardId}`);
    return { success: true };
  });
}

// Decrypts cvv/barcodeOrCode for display in EditCardDialog's edit form — the
// only place a user sees these fields as plaintext again after creation.
// Gated behind the same manage permission as the edit form itself (only
// owner/manager ever render EditCardDialog, see the card detail page).
export async function getCardSecrets(
  input: CardIdInput
): Promise<ActionResult<{ cvv: string | null; barcodeOrCode: string | null }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = cardIdSchema.parse(input);

    const cardSnap = await adminDb.collection("cards").doc(parsed.cardId).get();
    if (!cardSnap.exists) throw new ActionError("הכרטיס לא נמצא");
    const card = cardSnap.data();
    if (!card) throw new ActionError("הכרטיס לא נמצא");
    await assertCanManageCard(uid, card as { ownerId: string; listId: string });

    return {
      cvv: decryptNullableField(card.cvv ?? null),
      barcodeOrCode: decryptNullableField(card.barcodeOrCode ?? null),
    };
  });
}

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
