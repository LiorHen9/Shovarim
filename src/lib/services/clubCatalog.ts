import type { Firestore } from "firebase-admin/firestore";

// Shared writer for the clubs/clubCards catalog (ADR #61). Both writers of that
// catalog go through here: scripts/seed-clubs.ts with the real list, and
// src/actions/testSeed.ts with a small fixture for Playwright. The Firestore
// instance is a parameter rather than an import so this module stays portable —
// it must load under `tsx` for the script as well as inside Next.
//
// The catalog is expressed nested, because that is how a person reads it, and
// flattened on write: a card's doc id is `${club.id}-${card.id}`.

export interface SeedClubCard {
  id: string;
  name: string;
  description: string;
}

export interface SeedClub {
  id: string;
  name: string;
  description: string;
  website: string;
  color: string;
  cards: SeedClubCard[];
}

// Idempotent — every doc id is deterministic, so re-running overwrites rather
// than duplicating. Deliberately does not delete clubs dropped from the list:
// set isActive: false instead, which hides a club from the UI while leaving
// existing clubMemberships intact.
export async function seedClubCatalog(
  db: Firestore,
  catalog: SeedClub[]
): Promise<{ clubs: number; cards: number }> {
  const batch = db.batch();
  let cards = 0;

  catalog.forEach((club, clubIndex) => {
    batch.set(db.collection("clubs").doc(club.id), {
      id: club.id,
      name: club.name,
      description: club.description,
      website: club.website,
      color: club.color,
      isActive: true,
      sortOrder: clubIndex + 1,
    });

    club.cards.forEach((card, cardIndex) => {
      const clubCardId = `${club.id}-${card.id}`;
      batch.set(db.collection("clubCards").doc(clubCardId), {
        id: clubCardId,
        clubId: club.id,
        name: card.name,
        description: card.description,
        isActive: true,
        sortOrder: cardIndex + 1,
      });
      cards += 1;
    });
  });

  await batch.commit();
  return { clubs: catalog.length, cards };
}
