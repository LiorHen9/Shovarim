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
   * Path to a logo committed under `public/clubs/`, e.g. "/clubs/hot.jpg".
   * Deliberately a local path and never a remote URL: hotlinking the clubs'
   * own CDNs would make every visitor's browser contact seven third parties,
   * which is a new recipient to disclose in docs/PRIVACY.md and a
   * PRIVACY_POLICY_VERSION bump (ADR #59) for a decorative image. Null renders
   * the letter tile in ClubsGrid instead, so a missing file is never a
   * broken-image icon.
   */
  logoUrl: string | null;
  /** Hex, for the group's accent bar — same role as Category.color. */
  color: string;
  /** Retires a club from the catalog without deleting anyone's memberships. */
  isActive: boolean;
  sortOrder: number;
}
