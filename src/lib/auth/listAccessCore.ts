// Portable core for src/lib/auth/listAccess.ts — no "server-only" import
// here on purpose, mirroring src/lib/firebase/adminApp.ts: the service layer
// (src/lib/services/) and the MCP server (mcp-server/) need to run the same
// ownership/manager checks Server Actions use, under plain Node/tsx outside
// Next's bundler. Next.js app code must import ./listAccess.ts instead,
// which re-exports this with the "server-only" guard in front.
import type { Transaction } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { ActionError } from "../actions/errorsCore";

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

// Used when creating a card in an existing list — there's no card doc yet to
// check ownership against, only the list. Mirrors the isNewOwner()/
// isManagerOfList() check in firestore.rules' `cards` create rule, since
// this path runs through the Admin SDK and bypasses those rules entirely.
// Returns the list's ownerId, which becomes the new card's ownerId
// (docs/DATA_MODEL.md: cards are always owned by the list owner, even when a
// manager creates them).
export async function assertCanManageListAndGetOwner(uid: string, listId: string): Promise<string> {
  const listSnap = await adminDb.collection("cardLists").doc(listId).get();
  const list = listSnap.data() as { ownerId: string } | undefined;
  if (!list) throw new ActionError("הרשימה לא נמצאה");
  if (list.ownerId === uid) return list.ownerId;

  const memberSnap = await adminDb.collection("cardLists").doc(listId).collection("members").doc(uid).get();
  const member = memberSnap.data();
  if (member?.status === "accepted" && member?.role === "manager") return list.ownerId;

  throw new ActionError("אין הרשאה לרשימה זו");
}
