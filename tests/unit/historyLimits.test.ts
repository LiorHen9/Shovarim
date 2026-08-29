import { describe, expect, it } from "vitest";

import { MAX_HISTORY_BYTES, trimHistory } from "@/lib/mcp/historyLimits";

// Guards the one way a stored WhatsApp conversation can break the next turn:
// trimming that separates a tool_use block from its tool_result produces a
// request the Anthropic API rejects outright (docs/ROADMAP.md Phase 5.5.b).

const userTurn = (text: string) => ({ role: "user", content: text });
const assistantToolUse = () => ({
  role: "assistant",
  content: [{ type: "tool_use", id: "toolu_1", name: "listCards", input: {} }],
});
const toolResult = (text: string) => ({
  role: "user",
  content: [{ type: "tool_result", tool_use_id: "toolu_1", content: text }],
});

describe("trimHistory", () => {
  it("leaves a history that already fits untouched", () => {
    const history = [userTurn("שלום"), { role: "assistant", content: "היי" }];
    expect(trimHistory(history)).toBe(history);
  });

  it("drops oldest turns until the history fits", () => {
    const filler = "א".repeat(60_000);
    const history = [
      userTurn(`ראשון ${filler}`),
      { role: "assistant", content: filler },
      userTurn(`שני ${filler}`),
      { role: "assistant", content: filler },
      userTurn("אחרון"),
    ];

    const trimmed = trimHistory(history);

    expect(JSON.stringify(trimmed).length).toBeLessThanOrEqual(MAX_HISTORY_BYTES);
    expect(trimmed[0]).toEqual(expect.objectContaining({ role: "user" }));
    expect(trimmed.at(-1)).toEqual(userTurn("אחרון"));
  });

  it("never leaves a tool_result as the first message", () => {
    const filler = "א".repeat(120_000);
    const history = [
      userTurn("כמה יתרה יש לי?"),
      assistantToolUse(),
      toolResult(filler),
      { role: "assistant", content: filler },
      userTurn("ותודה"),
    ];

    const trimmed = trimHistory(history);

    expect(trimmed).toEqual([userTurn("ותודה")]);
  });

  it("gives up on the whole history when no user-turn boundary is left", () => {
    // A single turn that is itself over the limit cannot be cut safely.
    const history = [userTurn("א".repeat(MAX_HISTORY_BYTES + 1))];
    expect(trimHistory(history)).toEqual([]);
  });
});
