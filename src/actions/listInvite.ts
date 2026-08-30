"use server";

import { revalidatePath } from "next/cache";

import { adminAuth } from "@/lib/firebase/admin";
import { requireUid, getSessionUid } from "@/lib/auth/session";
import { toActionResult, type ActionResult } from "@/lib/actions/errors";
import { buildListInviteUrl } from "@/lib/appUrl";
import {
  acceptListInvite,
  cancelListInvite,
  createListInvite,
  declineListInvite,
  getListInviteGate,
  getListInvitePreview,
  listInvitesForList,
} from "@/lib/services/listInvites";
import {
  createListInviteSchema,
  listInviteCodeSchema,
  listInvitesForListSchema,
} from "@/lib/validation/listInvite";
import type {
  IssuedListInvite,
  ListInviteGate,
  ListInvitePreview,
  ListInviteSummary,
} from "@/types/listInvite";

// Thin actions over src/lib/services/listInvites.ts (ADR #18 pattern), for the
// phone-number sharing flow of ADR #37. Inputs are re-parsed here because
// Server Actions are directly POST-able with arbitrary payloads (ADR #25), and
// uid always comes from the session — never as an argument.

export async function createListInviteCode(
  input: unknown
): Promise<ActionResult<IssuedListInvite>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = createListInviteSchema.parse(input);
    const issued = await createListInvite(uid, parsed, buildListInviteUrl);
    revalidatePath(`/cards/lists/${parsed.listId}`);
    return issued;
  });
}

export async function listMyListInvites(input: unknown): Promise<ActionResult<ListInviteSummary[]>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const { listId } = listInvitesForListSchema.parse(input);
    return listInvitesForList(uid, listId);
  });
}

export async function cancelMyListInvite(input: unknown): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const { code } = listInviteCodeSchema.parse(input);
    await cancelListInvite(uid, code);
    return { success: true as const };
  });
}

// Deliberately unauthenticated: the code itself is the secret (same trust model
// as a channelLinkCodes code), and the invitee has to be able to see what they
// were invited to *before* deciding to sign in. Returns nothing about the list
// beyond its name — see getListInvitePreview.
export async function getInvitePreview(input: unknown): Promise<ActionResult<ListInvitePreview>> {
  return toActionResult(async () => {
    const { code } = listInviteCodeSchema.parse(input);
    return getListInvitePreview(code);
  });
}

// Wrapped in an object rather than returned bare: ActionResult<T> is
// `T | { error: string }`, and callers narrow it with `"error" in result` —
// which needs an object on the left. A bare string union would not compile.
export async function getInviteGate(
  input: unknown
): Promise<ActionResult<{ gate: ListInviteGate }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const { code } = listInviteCodeSchema.parse(input);
    return { gate: await getListInviteGate(uid, code) };
  });
}

export async function acceptInvite(input: unknown): Promise<ActionResult<{ listId: string }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const { code } = listInviteCodeSchema.parse(input);

    // The member doc carries an email (ADR #15 shape, rendered by
    // ShareListDialog/PendingInvitationsPanel). Unlike the email flow we start
    // from a uid, so it is looked up here; the Admin SDK types it optional, and
    // ensureUserProfile falls back the same way for the same reason.
    const user = await adminAuth.getUser(uid);
    const result = await acceptListInvite(uid, code, user.email ?? "");

    revalidatePath("/cards");
    revalidatePath(`/cards/lists/${result.listId}`);
    return result;
  });
}

// Declining does not require the channel link (refusing is not an identity
// claim), and does not even require being signed in — someone who received a
// link by mistake should be able to dismiss it. The uid, when present, is only
// used for the audit entry.
export async function declineInvite(input: unknown): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const { code } = listInviteCodeSchema.parse(input);
    const uid = await getSessionUid();
    await declineListInvite(code, uid);
    return { success: true as const };
  });
}
