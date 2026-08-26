"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { UsageLogEntry } from "@/types/usageLog";

// `ownerId` here is the card's owner (list owner) — not necessarily the
// caller's own uid, since a shared-list manager/viewer reads entries owned by
// whoever owns the list. Pass card.ownerId, not the viewing user's uid.
export function useUsageLog(cardId: string | null, ownerId: string | null) {
  const [entries, setEntries] = useState<UsageLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!cardId || !ownerId) return;
    // ownerId filter is redundant within a single card's subcollection, but
    // Firestore rules require list queries to be provably restricted by the
    // same condition the rule checks (isExistingOwner()).
    const q = query(
      collection(db, "cards", cardId, "usageLog"),
      where("ownerId", "==", ownerId),
      orderBy("date", "desc")
    );
    return onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UsageLogEntry));
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setError(error);
        setLoading(false);
      }
    );
  }, [cardId, ownerId]);

  if (!cardId || !ownerId) return { entries: [], loading: false, error: null };
  return { entries, loading, error };
}
