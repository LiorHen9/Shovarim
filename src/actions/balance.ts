"use server";

import { revalidatePath } from "next/cache";

import { requireUid } from "@/lib/auth/session";
import { toActionResult, type ActionResult } from "@/lib/actions/errors";
import { updateBalanceSchema, type UpdateBalanceInput } from "@/lib/validation/balanceUpdate";
import { updateCardBalanceForUid } from "@/lib/services/balance";

// Manual balance correction (Phase 3) — a deliberate, narrow exception to
// docs/DECISIONS.md #3/#4: it sets currentBalance directly without a
// usageLog entry. The transaction logic itself lives in
// src/lib/services/balance.ts (updateCardBalanceForUid) so the MCP
// `updateBalance` tool reuses it — see docs/DECISIONS.md ADR #22.
export async function updateCardBalance(
  input: UpdateBalanceInput
): Promise<ActionResult<{ newBalance: number }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = updateBalanceSchema.parse(input);

    const result = await updateCardBalanceForUid(uid, parsed);

    revalidatePath(`/cards/${parsed.cardId}`);
    return result;
  });
}
