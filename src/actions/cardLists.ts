"use server";

import { requireUid } from "@/lib/auth/session";
import { toActionResult, type ActionResult } from "@/lib/actions/errors";
import { createCardListSchema, type CreateCardListInput } from "@/lib/validation/cardList";
import { createCardListForUid } from "@/lib/services/cardLists";

// Server-side equivalent of src/components/lists/CreateListDialog.tsx's
// direct client write — added for the MCP `createList` tool (docs/DECISIONS.md
// ADR #22). The existing UI dialog keeps writing directly via the client SDK;
// this action is not wired into it yet, to avoid changing a working flow
// outside this phase's scope.
export async function createCardList(input: CreateCardListInput): Promise<ActionResult<{ listId: string }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = createCardListSchema.parse(input);

    return createCardListForUid(uid, parsed);
  });
}
