import { describe, expect, it } from "vitest";

import {
  channelLinkReverifyDeadlineMs,
  isChannelLinkStale,
} from "@/lib/services/channelLinkExpiry";

const DAY_MS = 24 * 60 * 60 * 1000;

function at(msAgo: number) {
  return { toMillis: () => Date.now() - msAgo };
}

describe("isChannelLinkStale", () => {
  it("is not stale for a link that is both recent and recently active", () => {
    expect(isChannelLinkStale(at(5 * DAY_MS), at(1 * DAY_MS))).toBe(false);
  });

  it("is stale past the 30-day hard cap even with activity yesterday", () => {
    expect(isChannelLinkStale(at(31 * DAY_MS), at(1 * DAY_MS))).toBe(true);
  });

  it("is stale past the 14-day inactivity cap even though under 30 days old", () => {
    expect(isChannelLinkStale(at(20 * DAY_MS), at(15 * DAY_MS))).toBe(true);
  });

  it("falls back to linkedAt as the activity basis when lastMessageAt is null", () => {
    expect(isChannelLinkStale(at(10 * DAY_MS), null)).toBe(false);
    expect(isChannelLinkStale(at(15 * DAY_MS), null)).toBe(true);
  });
});

describe("channelLinkReverifyDeadlineMs", () => {
  it("returns the earlier of the two deadlines", () => {
    const linkedAt = at(20 * DAY_MS);
    const lastMessageAt = at(1 * DAY_MS);
    const deadline = channelLinkReverifyDeadlineMs(linkedAt, lastMessageAt);
    const inactivityDeadline = lastMessageAt.toMillis() + 14 * DAY_MS;
    const ageDeadline = linkedAt.toMillis() + 30 * DAY_MS;
    expect(deadline).toBe(Math.min(inactivityDeadline, ageDeadline));
  });
});
