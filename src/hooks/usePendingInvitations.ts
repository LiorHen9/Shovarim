"use client";

import { useEffect, useState } from "react";
import { collectionGroup, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { CardListMember } from "@/types/cardListMember";

export function usePendingInvitations(uid: string | null) {
  const [invitations, setInvitations] = useState<CardListMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collectionGroup(db, "members"),
      where("memberUid", "==", uid),
      where("status", "==", "pending")
    );
    return onSnapshot(
      q,
      (snap) => {
        setInvitations(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CardListMember));
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setError(error);
        setLoading(false);
      }
    );
  }, [uid]);

  if (!uid) return { invitations: [], loading: false, error: null };
  return { invitations, loading, error };
}
