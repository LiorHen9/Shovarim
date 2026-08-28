// Portable core for src/lib/actions/errors.ts — no "server-only" import here
// on purpose, mirroring src/lib/firebase/adminApp.ts: the service layer
// (src/lib/services/) and the MCP server (mcp-server/) run under plain
// Node/tsx outside Next's bundler, where "server-only" unconditionally
// throws. Next.js app code must import ./errors.ts instead, which re-exports
// this with the "server-only" guard in front.

// Thrown for *expected* failures (not-found, permission denied, business-rule
// violation) — never for genuine bugs. Next.js redacts the message of any
// error that escapes a Server Action in production, so Server Action callers
// must catch ActionError and return its message as data instead of letting
// it propagate. See docs/DECISIONS.md ADR #18.
export class ActionError extends Error {}

export type ActionResult<T> = T | { error: string };

export async function toActionResult<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    throw error;
  }
}
