// Fixed-window rate limit, one doc per uid (rateLimits/{uid}) with one window
// per bucket — see docs/ROADMAP.md Phase 5.3/5.5.b, docs/DECISIONS.md ADR #21.
// WhatsApp/Telegram channels expose a spoofing surface (phone number) the web
// app doesn't have, so both tool calls and whole conversation turns are
// throttled here regardless of channel. Relative imports for the same reason as
// ../firebase/adminApp.ts consumers in mcp-server/: tsx runs outside Next's
// bundler and doesn't resolve the "@/" path alias.
import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { RATE_LIMITS, type RateLimitBucket } from "../mcp/config";

export class RateLimitExceededError extends Error {
  constructor(retryAfterMs: number) {
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    super(`חרגת ממכסת הבקשות המותרת. נסה שוב בעוד ${retryAfterSeconds} שניות.`);
    this.name = "RateLimitExceededError";
  }
}

interface RateLimitWindow {
  windowStart: Timestamp;
  count: number;
}

// One doc per uid, one nested map per bucket: { tools: {...}, turns: {...} }.
// Phase 5.3 stored windowStart/count at the root; docs written by that version
// simply read as "no bucket yet" (a fresh window) and their stale root fields
// are ignored — no migration needed for a quota that expires in 5 minutes.
type RateLimitDoc = Partial<Record<RateLimitBucket, RateLimitWindow>>;

// Throws RateLimitExceededError if the subject already used up its quota for
// the current window of `bucket`; otherwise records the call. Runs inside a
// transaction so concurrent calls from the same subject can't race past the
// limit.
//
// `subjectId` is a uid everywhere a caller is authenticated. The one exception
// is inbound channel traffic from a number that isn't linked yet (Phase
// 5.5.b): there is no uid to charge, and those messages are precisely the
// link-code guessing surface, so they are throttled by channelKey instead.
export async function checkAndConsumeRateLimit(
  subjectId: string,
  bucket: RateLimitBucket = "tools"
): Promise<void> {
  const ref = adminDb.collection("rateLimits").doc(subjectId);
  const { windowMs, maxCalls } = RATE_LIMITS[bucket];

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const window = snap.exists ? (snap.data() as RateLimitDoc)[bucket] : undefined;
    const windowStartMs = window?.windowStart.toMillis() ?? 0;
    const windowExpired = now - windowStartMs >= windowMs;

    // merge:true so writing one bucket never clears the other one's window.
    if (!window || windowExpired) {
      tx.set(ref, { [bucket]: { windowStart: Timestamp.fromMillis(now), count: 1 } }, { merge: true });
      return;
    }

    if (window.count >= maxCalls) {
      throw new RateLimitExceededError(windowStartMs + windowMs - now);
    }

    tx.set(ref, { [bucket]: { windowStart: window.windowStart, count: window.count + 1 } }, { merge: true });
  });
}
