// Server-side card reads/writes, callable from both Next.js server code
// (src/actions/card.ts, thin wrappers) and plain Node contexts (mcp-server/,
// scripts/) — see docs/ROADMAP.md Phase 5.1/5.4. Uses relative imports (not
// "@/...") for the same reason as scripts/seed-categories.ts: tsx run outside
// Next's bundler doesn't resolve the "@/" tsconfig path alias.
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb, adminStorage } from "../firebase/adminApp";
import { assertCanManageCard, assertCanManageListAndGetOwner } from "../auth/listAccessCore";
import { ActionError } from "../actions/errorsCore";
import { decryptNullableField, encryptNullableField } from "../crypto/fieldEncryptionCore";
import type { GiftCard } from "../../types/card";
import type { CardListMember } from "../../types/cardListMember";
import type { CardIdInput, CreateCardServerInput, DeleteCardInput } from "../validation/card";
import type { UpdateCardDetailsInput } from "../validation/cardEdit";

const MAX_IN_CLAUSE = 30;

// Admin SDK equivalent of the combined client-side logic in useCards/useCardLists
// (src/hooks/useCards.ts, src/hooks/useCardLists.ts): lists owned by uid, plus
// lists uid has an accepted membership on, then cards belonging to any of those
// lists. This is new server-side code, not an extraction — card reads today only
// happen client-side. Both MCP tools and any future Server Action should call
// this instead of reimplementing the query.
export async function listCardsForUid(uid: string): Promise<GiftCard[]> {
  const [ownedListsSnap, membershipsSnap] = await Promise.all([
    adminDb.collection("cardLists").where("ownerId", "==", uid).get(),
    adminDb
      .collectionGroup("members")
      .where("memberUid", "==", uid)
      .where("status", "==", "accepted")
      .get(),
  ]);

  const ownedListIds = ownedListsSnap.docs.map((doc) => doc.id);
  const sharedListIds = membershipsSnap.docs.map((doc) => (doc.data() as CardListMember).listId);
  const listIds = Array.from(new Set([...ownedListIds, ...sharedListIds])).slice(0, MAX_IN_CLAUSE);

  if (listIds.length === 0) return [];

  const cardsSnap = await adminDb
    .collection("cards")
    .where("listId", "in", listIds)
    .orderBy("createdAt", "desc")
    .get();

  return cardsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as GiftCard);
}

async function getCardOrThrow(cardId: string): Promise<GiftCard> {
  const cardSnap = await adminDb.collection("cards").doc(cardId).get();
  if (!cardSnap.exists) throw new ActionError("הכרטיס לא נמצא");
  const card = cardSnap.data();
  if (!card) throw new ActionError("הכרטיס לא נמצא");
  return { id: cardSnap.id, ...card } as GiftCard;
}

// Single-card fetch behind the same manage permission as the rest of this
// file — used by the `getCard` MCP tool (docs/ROADMAP.md Phase 5.4).
export async function getCardForUid(uid: string, cardId: string): Promise<GiftCard> {
  const card = await getCardOrThrow(cardId);
  await assertCanManageCard(uid, card);
  return card;
}

// Extracted from src/actions/card.ts createCard (see docs/DECISIONS.md ADR
// #22) so both the Server Action and the MCP `createCard` tool run the exact
// same ownership/encryption logic.
export async function createCardForUid(
  uid: string,
  input: CreateCardServerInput
): Promise<{ cardId: string }> {
  const listOwnerId = await assertCanManageListAndGetOwner(uid, input.listId);

  const cardRef = adminDb.collection("cards").doc(input.cardId);
  await cardRef.create({
    ownerId: listOwnerId,
    listId: input.listId,
    name: input.name,
    categoryId: input.categoryId,
    tags: input.tags,
    initialBalance: input.initialBalance,
    currentBalance: input.initialBalance,
    currency: input.currency.toUpperCase(),
    expiryDate: input.expiryDate ? Timestamp.fromDate(input.expiryDate) : null,
    purchaseDate: input.purchaseDate ? Timestamp.fromDate(input.purchaseDate) : null,
    cardImageUrl: input.cardImageUrl,
    barcodeOrCode: encryptNullableField(input.barcodeOrCode),
    cvv: encryptNullableField(input.cvv),
    acceptingRetailersUrl: input.acceptingRetailersUrl,
    notes: input.notes,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { cardId: input.cardId };
}

// Extracted from src/actions/card.ts updateCardDetails.
export async function updateCardDetailsForUid(
  uid: string,
  input: UpdateCardDetailsInput
): Promise<{ success: true }> {
  const card = await getCardOrThrow(input.cardId);
  await assertCanManageCard(uid, card);

  await adminDb
    .collection("cards")
    .doc(input.cardId)
    .update({
      name: input.name,
      expiryDate: input.expiryDate ? Timestamp.fromDate(input.expiryDate) : null,
      barcodeOrCode: encryptNullableField(input.barcodeOrCode),
      cvv: encryptNullableField(input.cvv),
      acceptingRetailersUrl: input.acceptingRetailersUrl,
      notes: input.notes,
      categoryId: input.categoryId,
      tags: input.tags,
      updatedAt: FieldValue.serverTimestamp(),
    });

  return { success: true };
}

// Extracted from src/actions/card.ts getCardSecrets — the only place
// plaintext cvv/barcodeOrCode is ever returned after creation.
export async function getCardSecretsForUid(
  uid: string,
  input: CardIdInput
): Promise<{ cvv: string | null; barcodeOrCode: string | null }> {
  const card = await getCardOrThrow(input.cardId);
  await assertCanManageCard(uid, card);

  return {
    cvv: decryptNullableField(card.cvv ?? null),
    barcodeOrCode: decryptNullableField(card.barcodeOrCode ?? null),
  };
}

// Extracted from src/actions/card.ts deleteCard — full deletion (card doc +
// usageLog subcollection + Storage files), not archival. Returns the card's
// listId so the Server Action wrapper can revalidate the right list page.
export async function deleteCardForUid(
  uid: string,
  input: DeleteCardInput
): Promise<{ success: true; listId: string }> {
  const cardRef = adminDb.collection("cards").doc(input.cardId);
  const card = await getCardOrThrow(input.cardId);
  await assertCanManageCard(uid, card);

  await adminDb.recursiveDelete(cardRef);
  await adminStorage.bucket().deleteFiles({ prefix: `users/${card.ownerId}/cards/${input.cardId}/` });

  return { success: true, listId: card.listId };
}
