// The webhook's only trust boundary (docs/DECISIONS.md ADR #29). Everything
// else in an inbound payload — above all the sender's phone number — is
// attacker-supplied; the HMAC is the one part that proves Meta sent it.
//
// No "server-only" import and no Firebase here on purpose: this is pure crypto
// over a string, which is what lets tests/unit/whatsappSignature.test.ts cover
// it directly.
import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "sha256=";

// Verifies X-Hub-Signature-256 over the *raw* request body. The body must be
// the exact bytes received: re-serializing parsed JSON changes key order and
// whitespace, and the digest then never matches — which is why the caller
// reads request.text() first and parses only after this returns true.
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(PREFIX)) return false;

  const received = Buffer.from(signatureHeader.slice(PREFIX.length), "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();

  // timingSafeEqual throws on a length mismatch, so the length is checked
  // first — a truncated hex header is a plain rejection, not a 500.
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

// Test/tooling counterpart — used by the E2E spec to sign a payload the way
// Meta would. Kept next to the verifier so the two can't drift apart.
export function signMetaBody(rawBody: string, appSecret: string): string {
  return PREFIX + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
}
