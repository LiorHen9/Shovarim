import { describe, expect, it } from "vitest";

import { didMutate, isMutatingTool, MUTATING_TOOL_NAMES } from "@/lib/mcp/toolEffects";

// The only automatically testable part of issue #62. The button itself can't be
// observed end to end: E2E runs with no outbound WhatsApp credentials, so
// sendWhatsAppCtaUrl returns false and leaves no trace. What can be pinned is
// the decision that drives it — which tools count as "the bot changed
// something" — so that a rename in mcpServer.ts breaks a test instead of
// quietly removing the button from that tool's replies.

// Every tool createMcpServer registers today, split the way the feature reads
// them. Kept as one explicit list rather than two scattered assertions: when an
// eleventh tool appears, this is where someone notices it needs classifying.
const WRITE_TOOLS = [
  "createCard",
  "updateCard",
  "deleteCard",
  "logUsage",
  "deleteUsageEntry",
  "updateBalance",
  "createList",
];

const READ_TOOLS = ["listCards", "getCard", "listCardLists"];

describe("isMutatingTool", () => {
  it.each(WRITE_TOOLS)("treats %s as a write", (name) => {
    expect(isMutatingTool(name)).toBe(true);
  });

  it.each(READ_TOOLS)("treats %s as a read", (name) => {
    expect(isMutatingTool(name)).toBe(false);
  });

  it("classifies exactly the seven write tools and no others", () => {
    expect([...MUTATING_TOOL_NAMES].sort()).toEqual([...WRITE_TOOLS].sort());
  });

  // An unknown name is a read, not a write: the allowlist is the whole point
  // (ADR #60), and defaulting the other way would put a button on every reply
  // the moment anything unexpected ran.
  it("does not treat an unknown tool as a write", () => {
    expect(isMutatingTool("exportEverything")).toBe(false);
  });
});

describe("didMutate", () => {
  it("is false for a turn that called no tools at all", () => {
    expect(didMutate([])).toBe(false);
  });

  it("is false for a turn that only read", () => {
    expect(didMutate(["listCards", "getCard"])).toBe(false);
  });

  it("is true when a single write happened", () => {
    expect(didMutate(["createCard"])).toBe(true);
  });

  // The realistic shape of a WhatsApp turn: the model looks something up
  // before changing it. One write anywhere in the turn earns the button.
  it("is true for a mixed turn, whatever the order", () => {
    expect(didMutate(["listCards", "logUsage"])).toBe(true);
    expect(didMutate(["updateBalance", "getCard"])).toBe(true);
  });
});
