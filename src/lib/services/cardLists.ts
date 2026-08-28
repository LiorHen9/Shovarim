// Admin SDK equivalent of src/hooks/useCardLists.ts (owned lists + accepted
// shared memberships), plus new server-side list creation — there was no
// server path for creating a list before Phase 5.4 (docs/DECISIONS.md ADR
// #22); src/components/lists/CreateListDialog.tsx still writes directly from
// the client and is untouched by this. Relative imports for the same reason
// as ./cards.ts.
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import type { CardList, CardListWithRole } from "../../types/cardList";
import type { CardListMember } from "../../types/cardListMember";
import type { CreateCardListInput } from "../validation/cardList";

export async function listCardListsForUid(uid: string): Promise<CardListWithRole[]> {
  const [ownedSnap, membershipsSnap] = await Promise.all([
    adminDb.collection("cardLists").where("ownerId", "==", uid).orderBy("createdAt", "asc").get(),
    adminDb
      .collectionGroup("members")
      .where("memberUid", "==", uid)
      .where("status", "==", "accepted")
      .get(),
  ]);

  const owned: CardListWithRole[] = ownedSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data(), role: "owner" as const }) as CardListWithRole
  );

  const memberships = membershipsSnap.docs.map((doc) => doc.data() as CardListMember);
  const sharedDocs = await Promise.all(
    memberships.map((m) => adminDb.collection("cardLists").doc(m.listId).get())
  );

  const shared: CardListWithRole[] = sharedDocs
    .map((snap, i) => {
      if (!snap.exists) return null;
      const role = memberships[i]?.role;
      if (!role) return null;
      return { id: snap.id, ...(snap.data() as Omit<CardList, "id">), role } as CardListWithRole;
    })
    .filter((l): l is CardListWithRole => l !== null);

  return [...owned, ...shared];
}

export async function createCardListForUid(
  uid: string,
  input: CreateCardListInput
): Promise<{ listId: string }> {
  const docRef = await adminDb.collection("cardLists").add({
    ownerId: uid,
    name: input.name,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { listId: docRef.id };
}
