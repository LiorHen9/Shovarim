"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { GiftCard } from "@/types/card";

export function useCards(uid: string | null) {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "cards"),
      where("ownerId", "==", uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GiftCard));
      setLoading(false);
    });
  }, [uid]);

  if (!uid) return { cards: [], loading: false };
  return { cards, loading };
}
