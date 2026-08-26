"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { CardListMember } from "@/types/cardListMember";

// Only the list owner may query the full members subcollection (Security
// Rules deny a non-owner listing docs other than their own) — callers must
// pass listId only when the current user is the owner, null otherwise.
export function useListMembers(listId: string | null) {
  const [members, setMembers] = useState<CardListMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!listId) return;
    const q = query(collection(db, "cardLists", listId, "members"), orderBy("createdAt", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CardListMember));
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setError(error);
        setLoading(false);
      }
    );
  }, [listId]);

  if (!listId) return { members: [], loading: false, error: null };
  return { members, loading, error };
}
