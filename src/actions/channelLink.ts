"use server";

import { requireUid } from "@/lib/auth/session";
import { toActionResult, type ActionResult } from "@/lib/actions/errors";
import {
  createLinkCodeForUid,
  listChannelLinksForUid,
  unlinkChannel,
} from "@/lib/services/channelLinks";
import { createLinkCodeSchema, unlinkChannelSchema } from "@/lib/validation/channelLink";
import type { ChannelLinkSummary, IssuedLinkCode } from "@/types/channelLink";

// Thin actions over src/lib/services/channelLinks.ts (ADR #18 pattern). uid
// always comes from requireUid() — never as an argument — which is what makes
// "generate a link code" an act of proven account ownership rather than a
// request anyone can POST on someone else's behalf. Inputs are re-parsed here
// because Server Actions are directly POST-able with arbitrary payloads
// (docs/DECISIONS.md ADR #25).

export async function createChannelLinkCode(
  input: unknown
): Promise<ActionResult<IssuedLinkCode>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const { channel } = createLinkCodeSchema.parse(input);
    return createLinkCodeForUid(uid, channel);
  });
}

export async function listMyChannelLinks(): Promise<ActionResult<ChannelLinkSummary[]>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    return listChannelLinksForUid(uid);
  });
}

export async function unlinkMyChannel(input: unknown): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const { channelKey } = unlinkChannelSchema.parse(input);
    await unlinkChannel(uid, channelKey);
    return { success: true as const };
  });
}
