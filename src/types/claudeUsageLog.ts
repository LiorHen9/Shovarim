import type { Timestamp } from "firebase/firestore";

import type { AuditLogChannel } from "./auditLog";

// claudeUsageLog/{entryId} — see docs/DATA_MODEL.md. One entry per Claude
// messages.create() call (not per user turn: a turn with tool calls makes
// several model calls in the same runAgentTurn loop). Raw token counts are
// the source of truth; estimatedCostUsd is a snapshot computed at write time
// from src/lib/mcp/pricing.ts and can drift if pricing changes later —
// recompute from tokens/model rather than trusting the stored dollar figure
// for anything but a quick read.
export interface ClaudeUsageLogEntry {
  id: string;
  uid: string;
  channel: AuditLogChannel;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  estimatedCostUsd: number;
  createdAt: Timestamp;
}
