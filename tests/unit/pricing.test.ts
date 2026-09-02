import { describe, expect, it } from "vitest";

import { estimateCostUsd } from "@/lib/mcp/pricing";

const ZERO_USAGE = { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 };

describe("estimateCostUsd", () => {
  it("prices plain input/output tokens at the model's per-million rate", () => {
    // claude-sonnet-5: $2.00/1M input, $10.00/1M output (src/lib/mcp/pricing.ts)
    const cost = estimateCostUsd("claude-sonnet-5", { ...ZERO_USAGE, inputTokens: 1_000_000, outputTokens: 0 });
    expect(cost).toBeCloseTo(2.0, 10);

    const outputCost = estimateCostUsd("claude-sonnet-5", { ...ZERO_USAGE, inputTokens: 0, outputTokens: 1_000_000 });
    expect(outputCost).toBeCloseTo(10.0, 10);
  });

  it("applies the documented cache write/read multipliers to the input rate", () => {
    // ~1.25x input rate for a cache write, ~0.1x for a cache read (both
    // Anthropic's documented approximation — see the comment in pricing.ts).
    const writeCost = estimateCostUsd("claude-sonnet-5", { ...ZERO_USAGE, cacheCreationInputTokens: 1_000_000 });
    expect(writeCost).toBeCloseTo(2.0 * 1.25, 10);

    const readCost = estimateCostUsd("claude-sonnet-5", { ...ZERO_USAGE, cacheReadInputTokens: 1_000_000 });
    expect(readCost).toBeCloseTo(2.0 * 0.1, 10);
  });

  it("sums all four components for a mixed-usage call", () => {
    const cost = estimateCostUsd("claude-sonnet-5", {
      inputTokens: 500_000,
      outputTokens: 100_000,
      cacheCreationInputTokens: 200_000,
      cacheReadInputTokens: 300_000,
    });
    const expected = (500_000 / 1_000_000) * 2.0 + (100_000 / 1_000_000) * 10.0 + (200_000 / 1_000_000) * 2.0 * 1.25 + (300_000 / 1_000_000) * 2.0 * 0.1;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it("falls back to 0 for an unknown model instead of throwing", () => {
    const cost = estimateCostUsd("claude-opus-99-does-not-exist", { ...ZERO_USAGE, inputTokens: 1_000_000 });
    expect(cost).toBe(0);
  });

  it("returns 0 for zero usage", () => {
    expect(estimateCostUsd("claude-sonnet-5", ZERO_USAGE)).toBe(0);
  });
});
