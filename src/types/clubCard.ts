// One card tier under a club — what a user actually holds and what benefits
// will later be scraped for. Doc id is `${clubId}-${tier}`, e.g.
// "mifal-hapais-vip". System catalog, read-only to clients.
//
// Flat top-level collection with a clubId field rather than a subcollection of
// clubs: the UI loads the whole catalog at once, and a subcollection would have
// forced a collectionGroup() query, which needs an explicit fieldOverrides entry
// in firestore.indexes.json that the emulator does NOT catch when missing
// (docs/DATA_MODEL.md, ADR #33), plus its own `{path=**}` rule. See ADR #61.
export interface ClubCard {
  id: string;
  clubId: string;
  /** The tier name alone — "רגיל", "VIP" — not repeating the club's name. */
  name: string;
  /** What distinguishes this tier. May be empty. */
  description: string;
  isActive: boolean;
  /** Order within the club. */
  sortOrder: number;
}
