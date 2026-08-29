"use server";

import { ActionError } from "@/lib/actions/errors";
import { redeemLinkCode } from "@/lib/services/channelLinks";
import { redeemLinkCodeSchema } from "@/lib/validation/channelLink";

// Playwright-only helper, same hard emulator guard as mintTestCustomToken in
// ./testAuth.ts (docs/DECISIONS.md #18). It stands in for the WhatsApp webhook
// that arrives in Phase 5.5.b, so the linking flow can be proven end to end
// before a messaging provider is involved at all.
//
// Note what it deliberately does NOT do: call requireUid(). Redemption is an
// *unauthenticated* inbound action — the code is the only credential — which is
// exactly why the emulator guard is not optional here. Against a real project
// this would let any caller bind a phone number to whichever account holds an
// outstanding code.
export async function redeemTestLinkCode(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (process.env.FIREBASE_USE_EMULATOR !== "true") {
    throw new Error("redeemTestLinkCode is only available against the Firebase emulator");
  }

  const { channel, externalId, code } = redeemLinkCodeSchema.parse(input);
  try {
    await redeemLinkCode(channel, externalId, code);
    return { ok: true };
  } catch (error) {
    if (error instanceof ActionError) return { ok: false, error: error.message };
    throw error;
  }
}
