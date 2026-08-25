"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { GiftCard } from "@/types/card";

export function useCard(cardId: string | null) {
  const [card, setCard] = useState<GiftCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cardId) return;
    return onSnapshot(doc(db, "cards", cardId), (snap) => {
      setCard(snap.exists() ? ({ id: snap.id, ...snap.data() } as GiftCard) : null);
      setLoading(false);
    });
  }, [cardId]);

  if (!cardId) return { card: null, loading: false };
  return { card, loading };
}
