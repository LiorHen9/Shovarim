import type { ClientAuthErrorInput } from "@/lib/validation/clientError";

// Fire-and-forget report to POST /api/auth-errors. Never rejects and never
// blocks the UI: this runs while the user is already looking at a failed
// sign-in, and a failure to *report* the failure must not change what they
// see. `keepalive` so the request survives the navigation that a retry or a
// late-arriving redirect may trigger.
export async function reportAuthError(payload: ClientAuthErrorInput): Promise<void> {
  try {
    await fetch("/api/auth-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Intentionally swallowed — see above.
  }
}
