import "server-only";

// Thrown for *expected* failures inside a Server Action (not-found, permission
// denied, business-rule violation) — never for genuine bugs. Next.js redacts
// the message of any error that escapes a Server Action in production
// (replaced with a generic "Server Components render" error, minified to
// React error #441 on the client), so callers must catch ActionError and
// return its message as data instead of letting it propagate. See
// docs/DECISIONS.md and node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md.
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
