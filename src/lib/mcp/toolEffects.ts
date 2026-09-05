// Which MCP tools change state, and nothing else (issue #62, docs/DECISIONS.md
// ADR #60). Pure and free of firebase imports for the same reason as
// historyLimits.ts: it is the only automatically testable part of the
// "attach a link after an action" feature, so it must be importable from a
// unit test without the Admin SDK coming along.
//
// This is deliberately an allowlist, not "everything except the readers".
// listCards/getCard/listCardLists are the overwhelming majority of WhatsApp
// traffic ("what's my balance?"), and a button on every one of those turns the
// link into noise. The cost of that choice is real and worth stating: a NEW
// write tool that nobody adds here simply shows no button, silently. Anyone
// adding a tool to mcpServer.ts must classify it here — see the note there and
// in docs/CHATBOT.md.
export const MUTATING_TOOL_NAMES = [
  "createCard",
  "updateCard",
  "deleteCard",
  "logUsage",
  "deleteUsageEntry",
  "updateBalance",
  "createList",
] as const;

const MUTATING = new Set<string>(MUTATING_TOOL_NAMES);

export function isMutatingTool(name: string): boolean {
  return MUTATING.has(name);
}

// True when a finished agent turn actually wrote something — the signal that
// the reply is a "summary of an action" rather than an answer to a question.
// Derived from the tool names the loop already reports through onToolCall, so
// the model is never asked and no tokens are spent deciding this.
export function didMutate(toolNames: readonly string[]): boolean {
  return toolNames.some(isMutatingTool);
}
