import type { Timestamp } from "firebase/firestore";

export type AdminAuditAction =
  | "role_grant"
  | "role_revoke"
  | "block"
  | "unblock"
  | "delete_scheduled"
  | "delete_cancelled"
  | "delete_immediate"
  // Club catalog (ADR #61, Phase 10.1.b). These are the first actions here
  // whose target is not a user, which is what targetId below exists for.
  | "club_upsert"
  | "club_delete"
  | "club_logo_set"
  | "club_logo_clear"
  | "club_card_upsert"
  | "club_card_delete"
  | "club_catalog_sync"
  // Benefit scraping (ADR #62, Phase 10.2). targetId is the club when one was
  // named, null when the admin ran every club at once.
  | "benefits_scrape_run";

// Append-only, written only via the Admin SDK. Deliberately separate from
// auditLog (docs/DATA_MODEL.md): auditLog is per-user and travels with that
// user's own data (export, and survives their deletion by design); this
// collection is the admin-side ledger of actions taken *on* users — it needs
// to support "all admin activity" queries across every target, and it must
// keep existing even for a uid that no longer has any other document at all.
export interface AdminAuditLogEntry {
  id: string;
  adminUid: string;
  targetUid: string | null;
  /**
   * The non-user subject of the action — the clubs/{id} or clubCards/{id}
   * document id — for actions on system data rather than on a person. Null for the
   * user-targeted actions, which use targetUid. Kept as a separate field
   * rather than overloading targetUid so "everything this admin did to this
   * user" stays a clean query.
   */
  targetId: string | null;
  action: AdminAuditAction;
  reason: string | null;
  createdAt: Timestamp;
}
