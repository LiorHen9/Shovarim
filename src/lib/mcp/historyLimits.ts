// Size bounds for a stored conversation history (docs/ROADMAP.md Phase 5.5.b).
// Split out of src/lib/services/chatSessions.ts, which imports the Admin SDK,
// so this stays pure and directly unit-testable — the same reason
// fieldEncryptionCore.ts is separate from fieldEncryption.ts.

// Firestore's hard limit is 1 MiB per document. This leaves generous room for
// the rest of the doc and for the fact that JSON.stringify length counts UTF-16
// units while Firestore counts UTF-8 bytes (Hebrew costs ~2 bytes per unit, so
// the real ceiling is nearer 400KB).
export const MAX_HISTORY_BYTES = 200_000;

// A real user turn: role "user" with plain string content. The other kind of
// "user" message in a history is the array of tool_result blocks the agent loop
// pushes back, which is only valid directly after the assistant tool_use
// message that produced it.
function isUserTurnBoundary(message: unknown): boolean {
  if (typeof message !== "object" || message === null) return false;
  const { role, content } = message as { role?: unknown; content?: unknown };
  return role === "user" && typeof content === "string";
}

// Drops whole turns off the front until the history fits. Cutting to a fixed
// message count instead would eventually slice between a tool_use block and its
// tool_result, which the Anthropic API rejects outright — so the cut only ever
// lands on a user-turn boundary, and the history is dropped entirely when no
// such boundary is left.
export function trimHistory<T>(history: T[]): T[] {
  let trimmed = history;

  while (JSON.stringify(trimmed).length > MAX_HISTORY_BYTES) {
    const nextBoundary = trimmed.findIndex(
      (message, index) => index > 0 && isUserTurnBoundary(message)
    );
    if (nextBoundary === -1) return [];
    trimmed = trimmed.slice(nextBoundary);
  }

  return trimmed;
}
