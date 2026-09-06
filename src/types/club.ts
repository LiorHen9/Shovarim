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
  /**
   * Official club site, linked from the UI. Nullable because not every club
   * has a live one — אשמורת's domain currently serves an empty stub and the
   * teachers' union domain is suspended, and a dead "לאתר המועדון" link is
   * worse than no link at all.
   */
  website: string | null;
  /**
   * Either a path to a logo committed under `public/clubs/` (the built-in
   * catalog, e.g. "/clubs/hot.jpg") or a Firebase Storage download URL for one
   * uploaded from /admin/clubs. Never a link to the club's own CDN:
   * hotlinking would make every visitor's browser contact a new third party,
   * which is a disclosure in docs/PRIVACY.md and a PRIVACY_POLICY_VERSION bump
   * (ADR #59) for a decorative image. Storage is already a disclosed processor
   * for card images, so an upload adds no recipient. Null renders the letter
   * tile in ClubsGrid instead, so a missing logo is never a broken-image icon.
   */
  logoUrl: string | null;
  /** Hex, for the group's accent bar — same role as Category.color. */
  color: string;
  /** Retires a club from the catalog without deleting anyone's memberships. */
  isActive: boolean;
  sortOrder: number;
}
