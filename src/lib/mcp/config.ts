// Shared constants for the Claude/MCP agent loop (docs/DECISIONS.md ADR
// #20). scripts/mcp-cli.ts and any future web route handler import these
// instead of hardcoding the model per call site - the walking skeleton
// (Phase 5.1) had claude-opus-5 hardcoded in scripts/mcp-cli.ts, which was
// the dominant driver of per-question cost.
export const MODEL_ID = "claude-sonnet-5";
export const MAX_TOKENS = 16000;

// Fixed-window rate limit per uid, enforced by src/lib/services/rateLimit.ts
// around every MCP tool call (docs/ROADMAP.md Phase 5.3, docs/DECISIONS.md
// ADR #21).
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
export const RATE_LIMIT_MAX_CALLS = 30;
