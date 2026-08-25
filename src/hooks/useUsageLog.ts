"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { UsageLogEntry } from "@/types/usageLog";

export function useUsageLog(cardId: string | null, uid: string | null) {
  const [entries, setEntries] = useState<UsageLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cardId || !uid) return;
    // ownerId filter is redundant within a single card's subcollection, but
    // Firestore rules require list queries to be provably restricted by the
    // same condition the rule checks (isExistingOwner()).
    const q = query(
      collection(db, "cards", cardId, "usageLog"),
      where("ownerId", "==", uid),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UsageLogEntry));
      setLoading(false);
    });
  }, [cardId, uid]);

  if (!cardId || !uid) return { entries: [], loading: false };
  return { entries, loading };
}
