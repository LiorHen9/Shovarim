"use server";

import { revalidatePath } from "next/cache";

import { requireUid } from "@/lib/auth/session";
import { toActionResult, type ActionResult } from "@/lib/actions/errors";
import {
  createUsageEntrySchema,
  deleteUsageEntrySchema,
  type CreateUsageEntryInput,
  type DeleteUsageEntryInput,
} from "@/lib/validation/usageLog";
import { addUsageEntryForUid, deleteUsageEntryForUid } from "@/lib/services/usage";

// Runs as a Server Action (Admin SDK) rather than a client-SDK write because
// the balance update must be atomic and re-validated server-side. The
// transaction logic itself lives in src/lib/services/usage.ts
// (addUsageEntryForUid) so the MCP `logUsage` tool reuses it — see
// docs/DECISIONS.md ADR #22.
export async function addUsageEntry(
  input: CreateUsageEntryInput
): Promise<ActionResult<{ newBalance: number }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = createUsageEntrySchema.parse(input);

    const result = await addUsageEntryForUid(uid, parsed);

    revalidatePath(`/cards/${parsed.cardId}`);
    return result;
  });
}

// Scoped exception to docs/DECISIONS.md #4 (usageLog immutability) — see #12.
export async function deleteUsageEntry(
  input: DeleteUsageEntryInput
): Promise<ActionResult<{ newBalance: number }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = deleteUsageEntrySchema.parse(input);

    const result = await deleteUsageEntryForUid(uid, parsed);

    revalidatePath(`/cards/${parsed.cardId}`);
    return result;
  });
}
