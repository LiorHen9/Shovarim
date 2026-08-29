// Shared constants for the Claude/MCP agent loop (docs/DECISIONS.md ADR
// #20). scripts/mcp-cli.ts and any future web route handler import these
// instead of hardcoding the model per call site - the walking skeleton
// (Phase 5.1) had claude-opus-5 hardcoded in scripts/mcp-cli.ts, which was
// the dominant driver of per-question cost.
export const MODEL_ID = "claude-sonnet-5";
export const MAX_TOKENS = 16000;

// Fixed-window rate limits per uid, enforced by src/lib/services/rateLimit.ts
// (docs/ROADMAP.md Phase 5.3, docs/DECISIONS.md ADR #21). Two independent
// buckets on the same uid:
//   tools — one unit per MCP tool call (withToolExecution, since Phase 5.3).
//   turns — one unit per inbound conversation turn, whether or not it calls a
//           tool. Added in Phase 5.5.b: on a webhook channel every inbound
//           message costs an LLM call, so a chatty sender with no tool use was
//           previously unlimited — the gap docs/CHATBOT.md flagged.
// A single turn may legitimately fan out into several tool calls, which is why
// the turn budget is the smaller of the two.
export const RATE_LIMITS = {
  tools: { windowMs: 5 * 60 * 1000, maxCalls: 30 },
  turns: { windowMs: 5 * 60 * 1000, maxCalls: 12 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;
