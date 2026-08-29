// Sink for browser-side sign-in failures (docs/DECISIONS.md ADR #27).
//
// Why this exists: a blocked popup, an unauthorized domain, or a dead network
// all fail entirely inside the browser. The server never sees a request, so
// Cloud Logging has nothing — which is exactly why diagnosing the 2026-08-29
// mobile Safari outage needed git archaeology instead of a log query.
//
// Deliberately unauthenticated: it reports failures that happen before a
// session cookie exists. See src/lib/validation/clientError.ts for the
// resulting shape-only abuse ceiling. Not covered by src/proxy.ts (its
// matcher lists page prefixes only), and not rate-limited — the per-uid
// limiter in src/lib/services/rateLimit.ts needs a uid there is none of here,
// and a Firestore write per anonymous POST would be a worse trade than the
// bounded log noise this can produce.
import { clientAuthErrorSchema, normalizeAuthErrorCode } from "@/lib/validation/clientError";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = clientAuthErrorSchema.safeParse(body);

  // Always 204, even on a malformed body: the caller is already inside a
  // failed sign-in and has nothing useful to do with an error here, and a
  // uniform response keeps this from being a probing oracle.
  if (!parsed.success) return new Response(null, { status: 204 });

  const { stage, providerId, code } = parsed.data;
  const safeCode = normalizeAuthErrorCode(code);

  // Single-line JSON on stderr — Cloud Run's logging agent parses `severity`
  // and `message` into structured fields, so this is filterable in Cloud
  // Logging as jsonPayload.event="auth_sign_in_failed".
  console.error(
    JSON.stringify({
      severity: "ERROR",
      event: "auth_sign_in_failed",
      message: `sign-in failed at ${stage}: ${safeCode}`,
      stage,
      providerId,
      code: safeCode,
    })
  );

  return new Response(null, { status: 204 });
}
