"use client";

import { useEffect, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { CardList, CardListWithRole } from "@/types/cardList";
import type { CardListMember } from "@/types/cardListMember";

export function useCardLists(uid: string | null) {
  const [ownedLists, setOwnedLists] = useState<CardList[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(true);
  const [ownedError, setOwnedError] = useState<Error | null>(null);
  const [memberships, setMemberships] = useState<CardListMember[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [membershipsError, setMembershipsError] = useState<Error | null>(null);
  const [sharedLists, setSharedLists] = useState<Record<string, CardList>>({});

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "cardLists"),
      where("ownerId", "==", uid),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(
      q,
      (snap) => {
        setOwnedLists(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CardList));
        setOwnedLoading(false);
      },
      (error) => {
        console.error(error);
        setOwnedError(error);
        setOwnedLoading(false);
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collectionGroup(db, "members"),
      where("memberUid", "==", uid),
      where("status", "==", "accepted")
    );
    return onSnapshot(
      q,
      (snap) => {
        setMemberships(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CardListMember));
        setMembershipsLoading(false);
      },
      (error) => {
        console.error(error);
        setMembershipsError(error);
        setMembershipsLoading(false);
      }
    );
  }, [uid]);

  // Shared list documents are fetched once per membership-set change rather
  // than kept live (one onSnapshot per shared list would be needed for that) —
  // fine at personal/family scale, where a rename by the owner just needs a
  // refresh on the next membership change or reload. See docs/DECISIONS.md #15.
  // No need to reset sharedLists when memberships is empty: the `shared`
  // derivation below only iterates current memberships, so stale entries for
  // since-removed lists are simply never read.
  useEffect(() => {
    if (memberships.length === 0) return;
    let cancelled = false;
    Promise.all(
      memberships.map(async (m) => {
        const snap = await getDoc(doc(db, "cardLists", m.listId));
        return snap.exists() ? ({ id: snap.id, ...snap.data() } as CardList) : null;
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, CardList> = {};
      for (const list of results) if (list) map[list.id] = list;
      setSharedLists(map);
    });
    return () => {
      cancelled = true;
    };
  }, [memberships]);

  if (!uid) return { lists: [] as CardListWithRole[], loading: false, error: null };

  const owned: CardListWithRole[] = ownedLists.map((l) => ({ ...l, role: "owner" as const }));
  const shared: CardListWithRole[] = memberships
    .map((m): CardListWithRole | null => {
      const list = sharedLists[m.listId];
      return list ? { ...list, role: m.role } : null;
    })
    .filter((l): l is CardListWithRole => l !== null);

  return {
    lists: [...owned, ...shared],
    loading: ownedLoading || membershipsLoading,
    error: ownedError ?? membershipsError,
  };
}
