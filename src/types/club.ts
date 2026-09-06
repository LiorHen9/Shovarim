// A consumer/loyalty club (מועדון צרכנות). System catalog only — seeded by
// scripts/seed-clubs.ts via the Admin SDK and read-only to clients, unlike
// categories which mixes system defaults with user-created rows. See
// docs/DECISIONS.md ADR #61 and docs/DATA_MODEL.md.
//
// The cards a user can actually hold live in clubCards, one level down: a
// single club can offer several tiers (מפעל הפיס: רגיל, VIP) whose benefits
// differ, and a membership points at a tier, never at the club.
export interface Club {
  id: string;
  name: string;
  description: string;
  /** Official club site, linked from the UI. */
  website: string;
  /** Hex, for the group's accent bar — same role as Category.color. */
  color: string;
  /** Retires a club from the catalog without deleting anyone's memberships. */
  isActive: boolean;
  sortOrder: number;
}
