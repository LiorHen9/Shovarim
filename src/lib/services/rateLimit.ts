// Fixed-window rate limit for MCP tool execution, one doc per uid
// (rateLimits/{uid}) — see docs/ROADMAP.md Phase 5.3, docs/DECISIONS.md ADR
// #21. WhatsApp/Telegram channels will expose a spoofing surface (phone
// number) the web app doesn't have, so every tool call is throttled here
// regardless of channel. Relative imports for the same reason as
// ../firebase/adminApp.ts consumers in mcp-server/: tsx runs outside Next's
// bundler and doesn't resolve the "@/" path alias.
import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { RATE_LIMIT_MAX_CALLS, RATE_LIMIT_WINDOW_MS } from "../mcp/config";

export class RateLimitExceededError extends Error {
  constructor(retryAfterMs: number) {
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    super(`חרגת ממכסת הבקשות המותרת. נסה שוב בעוד ${retryAfterSeconds} שניות.`);
    this.name = "RateLimitExceededError";
  }
}

interface RateLimitDoc {
  windowStart: Timestamp;
  count: number;
}

// Throws RateLimitExceededError if uid already used up its quota for the
// current window; otherwise records the call. Runs inside a transaction so
// concurrent tool calls from the same uid can't race past the limit.
export async function checkAndConsumeRateLimit(uid: string): Promise<void> {
  const ref = adminDb.collection("rateLimits").doc(uid);

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? (snap.data() as RateLimitDoc) : null;
    const windowStartMs = data?.windowStart.toMillis() ?? 0;
    const windowExpired = now - windowStartMs >= RATE_LIMIT_WINDOW_MS;

    if (!data || windowExpired) {
      tx.set(ref, { windowStart: Timestamp.fromMillis(now), count: 1 });
      return;
    }

    if (data.count >= RATE_LIMIT_MAX_CALLS) {
      throw new RateLimitExceededError(windowStartMs + RATE_LIMIT_WINDOW_MS - now);
    }

    tx.update(ref, { count: data.count + 1 });
  });
}
