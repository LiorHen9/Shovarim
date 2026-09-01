import type { Timestamp } from "firebase/firestore";

// Only "super_admin" exists today (single-admin, docs/DECISIONS.md ADR #42) —
// the union is kept open for the RBAC roles (e.g. "support", "read_only")
// this doc shape was designed to support without a schema migration.
export type AdminRoleName = "super_admin";

export interface AdminRole {
  uid: string;
  role: AdminRoleName;
  grantedBy: string; // uid of the granter, "system" for the bootstrap script
  grantedAt: Timestamp;
}
