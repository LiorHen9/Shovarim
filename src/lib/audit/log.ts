// Shared audit-log writer for auditLog/{entryId} (docs/DATA_MODEL.md). Used by
// both Server Actions (src/actions/) and the local MCP server (mcp-server/,
// plain Node/tsx outside Next's bundler — see docs/ROADMAP.md Phase 5.1), so
// relative imports are used here for the same reason as ../services/cards.ts.
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import type { AuditLogChannel, AuditLogEventType } from "../../types/auditLog";

export async function writeAuditLog(entry: {
  uid: string;
  eventType: AuditLogEventType;
  tool?: string | null;
  channel?: AuditLogChannel | null;
  paramsSummary?: string | null;
  result: "success" | "error";
}): Promise<void> {
  await adminDb.collection("auditLog").add({
    uid: entry.uid,
    eventType: entry.eventType,
    tool: entry.tool ?? null,
    channel: entry.channel ?? null,
    paramsSummary: entry.paramsSummary ?? null,
    result: entry.result,
    createdAt: FieldValue.serverTimestamp(),
  });
}
