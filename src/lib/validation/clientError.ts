import { z } from "zod";

// Shared client+server contract for POST /api/auth-errors — the sign-in
// failure report sent from the browser (docs/DECISIONS.md ADR #27).
//
// This endpoint is unauthenticated by necessity: it exists precisely to
// report failures that happen *before* a session cookie exists, so there is
// no uid to attribute the report to. The abuse ceiling is therefore kept low
// by shape alone — every field below is a bounded enum or a pattern-matched
// code, so nothing free-form and attacker-controlled can reach Cloud
// Logging. Do not add a free-text field here without revisiting that.

// Which half of handleSignIn failed. Worth separating: "ההתחברות נכשלה" was
// previously reported identically for a blocked Google popup (client-side,
// never reaches us) and for a rejected session-cookie mint (server-side,
// already in Cloud Logging) — two failures with nothing in common.
export const AUTH_ERROR_STAGES = ["provider-sign-in", "create-session"] as const;
export type AuthErrorStage = (typeof AUTH_ERROR_STAGES)[number];

// Firebase error codes look like "auth/popup-blocked". Anything not matching
// is normalized to UNKNOWN_AUTH_ERROR_CODE rather than logged verbatim.
export const AUTH_ERROR_CODE_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+$/;
export const UNKNOWN_AUTH_ERROR_CODE = "unknown";

export const clientAuthErrorSchema = z.object({
  stage: z.enum(AUTH_ERROR_STAGES),
  providerId: z.enum(["google", "apple"]),
  code: z.string().trim().max(64),
});

export type ClientAuthErrorInput = z.infer<typeof clientAuthErrorSchema>;

export function normalizeAuthErrorCode(code: string): string {
  return AUTH_ERROR_CODE_PATTERN.test(code) ? code : UNKNOWN_AUTH_ERROR_CODE;
}
