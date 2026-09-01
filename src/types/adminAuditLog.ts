import type { Timestamp } from "firebase/firestore";

export type AdminAuditAction =
  | "role_grant"
  | "role_revoke"
  | "block"
  | "unblock"
  | "delete_scheduled"
  | "delete_immediate";

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
  action: AdminAuditAction;
  reason: string | null;
  createdAt: Timestamp;
}
