"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { ClubMembership } from "@/types/clubMembership";

const EMPTY: ReadonlySet<string> = new Set();

// The club cards this user has marked as held, as a set of clubCardIds.
//
// The where("ownerId", "==", uid) is load-bearing beyond filtering: a list
// request only guarantees resource.data for the fields the query itself filters
// on, so firestore.rules' `isExistingOwner()` read check would fail outright
// without it (see the note in firestore.rules).
export function useClubMemberships(uid: string | null) {
  const [heldCardIds, setHeldCardIds] = useState<ReadonlySet<string>>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "clubMemberships"), where("ownerId", "==", uid));
    return onSnapshot(
      q,
      (snap) => {
        setHeldCardIds(new Set(snap.docs.map((d) => (d.data() as ClubMembership).clubCardId)));
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setError(error);
        setLoading(false);
      }
    );
  }, [uid]);

  if (!uid) return { heldCardIds: EMPTY, loading: false, error: null };
  return { heldCardIds, loading, error };
}
