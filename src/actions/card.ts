"use server";

import { revalidatePath } from "next/cache";

import { requireUid } from "@/lib/auth/session";
import { toActionResult, type ActionResult } from "@/lib/actions/errors";
import {
  cardIdSchema,
  createCardServerSchema,
  deleteCardSchema,
  type CardIdInput,
  type CreateCardServerInput,
  type DeleteCardInput,
} from "@/lib/validation/card";
import { updateCardDetailsSchema, type UpdateCardDetailsInput } from "@/lib/validation/cardEdit";
import {
  createCardForUid,
  deleteCardForUid,
  getCardSecretsForUid,
  updateCardDetailsForUid,
} from "@/lib/services/cards";

// Card creation runs as a Server Action (Admin SDK) — not a direct client
// write like the rest of the card fields — specifically so cvv/barcodeOrCode
// get encrypted before they ever reach Firestore. cardId is generated
// client-side by CardForm (so the Storage image upload, which still happens
// client-side, has an id to key off before this action runs). The
// ownership/encryption logic itself lives in src/lib/services/cards.ts
// (createCardForUid) so the MCP `createCard` tool reuses it — see
// docs/DECISIONS.md ADR #22.
export async function createCard(input: CreateCardServerInput): Promise<ActionResult<{ cardId: string }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = createCardServerSchema.parse(input);

    const result = await createCardForUid(uid, parsed);

    revalidatePath("/cards");
    revalidatePath(`/cards/lists/${parsed.listId}`);
    return result;
  });
}

// General-details edit (docs/DECISIONS.md #3/#4/#11 scope — never
// balance/currency).
export async function updateCardDetails(input: UpdateCardDetailsInput): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = updateCardDetailsSchema.parse(input);

    const result = await updateCardDetailsForUid(uid, parsed);

    revalidatePath(`/cards/${parsed.cardId}`);
    return result;
  });
}

// Decrypts cvv/barcodeOrCode for display in EditCardDialog's edit form — the
// only place a user sees these fields as plaintext again after creation.
export async function getCardSecrets(
  input: CardIdInput
): Promise<ActionResult<{ cvv: string | null; barcodeOrCode: string | null }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = cardIdSchema.parse(input);

    return getCardSecretsForUid(uid, parsed);
  });
}

// Full deletion (not archival): removes the card doc, its usageLog
// subcollection, and any Storage files under the card's path prefix.
export async function deleteCard(input: DeleteCardInput): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = deleteCardSchema.parse(input);

    const { listId } = await deleteCardForUid(uid, parsed);

    revalidatePath("/cards");
    revalidatePath(`/cards/lists/${listId}`);
    return { success: true };
  });
}
