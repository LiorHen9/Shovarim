// Writes one claudeUsageLog/{entryId} document per Claude messages.create()
// call (docs/ROADMAP.md Phase 9.5, docs/DECISIONS.md ADR #49). Relative
// imports, no "server-only" — called from src/lib/mcp/agentLoop.ts, which
// must run under plain tsx (scripts/mcp-cli.ts) as well as inside Next's
// bundler, same constraint as the rest of src/lib/mcp/.
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { estimateCostUsd, type UsageTokens } from "./pricing";
import type { AuditLogChannel } from "../../types/auditLog";

export interface ClaudeUsageLogInput {
  uid: string;
  channel: AuditLogChannel;
  model: string;
  usage: UsageTokens;
}

// Never throws: a failed write here must not break the chat turn it's
// billing for. This is a cost/telemetry ledger, not the security-relevant
// auditLog — writeAuditLog (src/lib/audit/log.ts) is deliberately NOT
// wrapped this way, and its callers still let a write failure fail the tool
// call. Errors are logged and swallowed here instead.
export async function logClaudeUsage(entry: ClaudeUsageLogInput): Promise<void> {
  try {
    await adminDb.collection("claudeUsageLog").add({
      uid: entry.uid,
      channel: entry.channel,
      model: entry.model,
      inputTokens: entry.usage.inputTokens,
      outputTokens: entry.usage.outputTokens,
      cacheCreationInputTokens: entry.usage.cacheCreationInputTokens,
      cacheReadInputTokens: entry.usage.cacheReadInputTokens,
      estimatedCostUsd: estimateCostUsd(entry.model, entry.usage),
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("[claudeUsageLog] write failed", error);
  }
}
