import "server-only";

import type { Transaction } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { ActionError } from "@/lib/actions/errors";

interface CardOwnership {
  ownerId: string;
  listId: string;
}

// A user may manage a card (log usage, adjust balance, delete it) if they own
// it directly, or if they've accepted a "manager" invite on the card's list —
// see docs/DECISIONS.md #15. Pass the active transaction when called from
// inside one so the membership check is atomic with the write that follows it.
export async function assertCanManageCard(
  uid: string,
  card: CardOwnership,
  tx?: Transaction
): Promise<void> {
  if (card.ownerId === uid) return;

  const memberRef = adminDb
    .collection("cardLists")
    .doc(card.listId)
    .collection("members")
    .doc(uid);
  const memberSnap = tx ? await tx.get(memberRef) : await memberRef.get();
  const member = memberSnap.data();

  if (member?.status === "accepted" && member?.role === "manager") return;
  throw new ActionError("אין הרשאה לכרטיס זה");
}
