"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

import { useCardLists } from "@/hooks/useCardLists";
import { db } from "@/lib/firebase/client";
import type { GiftCard } from "@/types/card";

// Firestore's `in` operator caps at 30 values — a personal/family user isn't
// expected to own or be shared into more lists than that. See docs/DECISIONS.md #15.
const MAX_IN_CLAUSE = 30;

export function useCards(uid: string | null) {
  const { lists, loading: listsLoading, error: listsError } = useCardLists(uid);
  const listIds = useMemo(() => lists.map((l) => l.id).slice(0, MAX_IN_CLAUSE), [lists]);
  const listIdsKey = listIds.join(",");
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid || listsLoading || listIds.length === 0) return;
    const q = query(
      collection(db, "cards"),
      where("listId", "in", listIds),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
      q,
      (snap) => {
        setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GiftCard));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err);
        setLoading(false);
      }
    );
    // listIds is derived fresh every render; listIdsKey is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, listsLoading, listIdsKey]);

  if (!uid) return { cards: [], loading: false, error: null };
  if (listIds.length === 0) return { cards: [], loading: listsLoading, error: listsError };
  return { cards, loading, error: listsError ?? error };
}
