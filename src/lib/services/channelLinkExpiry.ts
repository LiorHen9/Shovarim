// Pure re-verification policy for channelLinks (docs/ROADMAP.md issue #68,
// docs/DECISIONS.md ADR #41). Split out from channelLinks.ts so it can be
// unit-tested without pulling in firebase-admin — same reason
// fieldEncryptionCore.ts exists. Takes structural timestamps rather than a
// concrete Timestamp type so it works with both firebase/firestore and
// firebase-admin/firestore instances (and plain test doubles) without caring
// which one the caller has.
import { CHANNEL_LINK_REVERIFY } from "../mcp/config";

const DAY_MS = 24 * 60 * 60 * 1000;

interface TimestampLike {
  toMillis(): number;
}

// A link stops being trusted once either clock runs out, whichever is first
// — see the comment on CHANNEL_LINK_REVERIFY for why it's "or" and not "and".
export function isChannelLinkStale(
  linkedAt: TimestampLike,
  lastMessageAt: TimestampLike | null
): boolean {
  const now = Date.now();
  if (now - linkedAt.toMillis() > CHANNEL_LINK_REVERIFY.maxAgeDays * DAY_MS) return true;
  const lastActivityMs = (lastMessageAt ?? linkedAt).toMillis();
  return now - lastActivityMs > CHANNEL_LINK_REVERIFY.inactivityDays * DAY_MS;
}

// The earlier of the two deadlines, for display in /settings — "renew
// before" while still active, effectively "expired since" once it has passed.
export function channelLinkReverifyDeadlineMs(
  linkedAt: TimestampLike,
  lastMessageAt: TimestampLike | null
): number {
  const lastActivityMs = (lastMessageAt ?? linkedAt).toMillis();
  return Math.min(
    linkedAt.toMillis() + CHANNEL_LINK_REVERIFY.maxAgeDays * DAY_MS,
    lastActivityMs + CHANNEL_LINK_REVERIFY.inactivityDays * DAY_MS
  );
}
