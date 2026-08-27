import type { Timestamp } from "firebase/firestore";

export type AuditLogEventType =
  | "mcp_tool_call"
  | "login"
  | "export"
  | "deletion_request"
  | "deletion_completed"
  | "permission_change";

export type AuditLogChannel = "cli" | "web" | "whatsapp" | "telegram";

// Append-only, written only via the Admin SDK (Cloud Functions or the local
// MCP server — see docs/ROADMAP.md Phase 5.1). paramsSummary must never
// include secrets (cvv, barcodeOrCode, tokens) — see docs/SECURITY.md.
export interface AuditLogEntry {
  id: string;
  uid: string;
  eventType: AuditLogEventType;
  tool: string | null;
  channel: AuditLogChannel | null;
  paramsSummary: string | null;
  result: "success" | "error";
  createdAt: Timestamp;
}
