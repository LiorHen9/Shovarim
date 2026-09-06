"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { Club } from "@/types/club";
import type { ClubCard } from "@/types/clubCard";

export interface ClubWithCards extends Club {
  cards: ClubCard[];
}

// The club catalog, joined into the shape the UI renders: clubs in sortOrder,
// each carrying its own cards in sortOrder. Two listeners rather than one
// because clubCards is a flat top-level collection, not a subcollection (ADR
// #61) — the join happens here, in memory, over a catalog of a few dozen docs.
//
// Both collections are world-readable to any signed-in user and identical for
// everyone, so unlike useCategories there is no uid to scope by.
export function useClubCatalog() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [cards, setCards] = useState<ClubCard[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    return onSnapshot(
      collection(db, "clubs"),
      (snap) => {
        setClubs(snap.docs.map((d) => ({ ...(d.data() as Omit<Club, "id">), id: d.id })));
        setClubsLoading(false);
      },
      (error) => {
        console.error(error);
        setError(error);
        setClubsLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    return onSnapshot(
      collection(db, "clubCards"),
      (snap) => {
        setCards(snap.docs.map((d) => ({ ...(d.data() as Omit<ClubCard, "id">), id: d.id })));
        setCardsLoading(false);
      },
      (error) => {
        console.error(error);
        setError(error);
        setCardsLoading(false);
      }
    );
  }, []);

  const catalog = useMemo<ClubWithCards[]>(() => {
    const cardsByClub = new Map<string, ClubCard[]>();
    for (const card of cards) {
      if (!card.isActive) continue;
      const bucket = cardsByClub.get(card.clubId);
      if (bucket) bucket.push(card);
      else cardsByClub.set(card.clubId, [card]);
    }

    return clubs
      .filter((club) => club.isActive)
      .map((club) => ({
        ...club,
        cards: (cardsByClub.get(club.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      // A club with no active cards has nothing to tick, and a card whose club
      // is missing or retired is dropped by the join above. Neither should
      // render as an empty box — a half-applied seed shouldn't break the page.
      .filter((club) => club.cards.length > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [clubs, cards]);

  return { catalog, loading: clubsLoading || cardsLoading, error };
}
