// Pricing table for estimating Claude API cost from response.usage
// (docs/ROADMAP.md Phase 9.5, docs/DECISIONS.md ADR #49). Rates are USD per
// million tokens for the model this app actually calls (MODEL_ID, ./config.ts).
//
// This produces an ESTIMATE, not a bill: Anthropic's own Usage & Cost Admin
// API (curl-only, /v1/organizations/cost_report) is the source of truth if
// reconciliation is ever needed — see the ADR for why that API cannot itself
// answer "cost per Shovarim uid" (it has no visibility into our uid at all;
// every request goes through one WIF service account, not a key/workspace
// per user). Cache read/write multipliers below are Anthropic's documented
// approximation (~0.1x / ~1.25x of the base input rate), not a per-model
// published rate — expect this estimate to drift slightly from the real
// bill. Relative imports, no "server-only": called from src/lib/mcp/, which
// must run under plain tsx (scripts/mcp-cli.ts) as well as inside Next's
// bundler.
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

// Add an entry here before MODEL_ID (./config.ts) ever points at a model
// that isn't listed — estimateCostUsd() falls back to 0 with a console.error
// rather than throwing, so a missing entry silently under-reports cost
// instead of breaking a chat turn over an accounting side effect.
const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-5": { inputPerMTok: 2.0, outputPerMTok: 10.0 },
};

export interface UsageTokens {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export function estimateCostUsd(model: string, usage: UsageTokens): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    console.error(`[claudeUsageLog] no pricing entry for model "${model}" — logging 0 cost, add it to MODEL_PRICING`);
    return 0;
  }
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMTok;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMTok;
  const cacheWriteCost =
    (usage.cacheCreationInputTokens / 1_000_000) * pricing.inputPerMTok * CACHE_WRITE_MULTIPLIER;
  const cacheReadCost = (usage.cacheReadInputTokens / 1_000_000) * pricing.inputPerMTok * CACHE_READ_MULTIPLIER;
  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}
