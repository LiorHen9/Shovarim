// Server-side card reads, callable from both Next.js server code and plain
// Node contexts (mcp-server/, scripts/) — see docs/ROADMAP.md Phase 5.1. Uses
// relative imports (not "@/...") for the same reason as scripts/seed-categories.ts:
// tsx run outside Next's bundler doesn't resolve the "@/" tsconfig path alias.
import { adminDb } from "../firebase/adminApp";
import type { GiftCard } from "../../types/card";
import type { CardListMember } from "../../types/cardListMember";

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
