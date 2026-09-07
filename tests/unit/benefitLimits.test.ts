import { describe, expect, it } from "vitest";

import { createLimiter } from "../../functions/src/benefits/limits";
import type { ParsedBenefit } from "../../functions/src/benefits/types";

// The caps are the one part of this feature an admin drives directly, and
// getting them wrong is invisible: too low silently truncates a club, too high
// runs 237 pages a night. So the interaction between the two levels is pinned
// here rather than left to the adapters to demonstrate.

function benefit(sourceKey: string, clubCardIds: string[]): ParsedBenefit {
  return {
    sourceKey,
    clubCardIds,
    kind: "offer",
    title: `הטבה ${sourceKey}`,
    description: "",
    sourceCategory: null,
    priceFrom: null,
    originalPrice: null,
    discountText: null,
    url: "https://example.co.il/1",
    imageUrl: null,
    provider: null,
    validUntil: null,
    sourceMemberTypes: null,
  };
}

describe("club-level cap", () => {
  it("keeps the first N and rejects the rest", () => {
    const limiter = createLimiter({ clubLimit: 2, cardLimits: { a: 0 } });

    expect(limiter.offer(benefit("1", ["a"]))).toBe("kept");
    expect(limiter.offer(benefit("2", ["a"]))).toBe("kept");
    expect(limiter.offer(benefit("3", ["a"]))).toBe("rejected");

    expect(limiter.kept().map((b) => b.sourceKey)).toEqual(["1", "2"]);
    expect(limiter.cappedBy()).toBe("club");
  });

  it("stops the adapter as soon as it is full", () => {
    const limiter = createLimiter({ clubLimit: 1, cardLimits: { a: 0 } });
    expect(limiter.shouldStop()).toBe(false);
    limiter.offer(benefit("1", ["a"]));
    // This is what turns the cap into a fetch optimisation: הוט pulls 2 pages
    // at the default instead of 237.
    expect(limiter.shouldStop()).toBe(true);
  });
});

describe("card-level cap", () => {
  it("fills one card while another is still open", () => {
    const limiter = createLimiter({ clubLimit: 0, cardLimits: { a: 1, b: 3 } });

    expect(limiter.offer(benefit("1", ["a"]))).toBe("kept");
    expect(limiter.offer(benefit("2", ["a"]))).toBe("rejected"); // a is full
    expect(limiter.offer(benefit("3", ["b"]))).toBe("kept"); // b is not
    expect(limiter.cappedBy()).toBe("card");
  });

  it("accepts a benefit while any of its cards has room", () => {
    // The multi-tier case (מפעל הפיס): most benefits carry both tiers, and
    // requiring every card to have room would let the full tier block a
    // benefit the emptier tier still wants.
    const limiter = createLimiter({ clubLimit: 0, cardLimits: { a: 1, b: 5 } });

    expect(limiter.offer(benefit("1", ["a", "b"]))).toBe("kept");
    expect(limiter.offer(benefit("2", ["a", "b"]))).toBe("kept");
  });

  it("counts a kept benefit against every card it applies to", () => {
    const limiter = createLimiter({ clubLimit: 0, cardLimits: { a: 2, b: 2 } });

    limiter.offer(benefit("1", ["a", "b"]));
    limiter.offer(benefit("2", ["a", "b"]));
    // Both cards are now at 2, so nothing further is admissible even though
    // only two benefits were stored.
    expect(limiter.offer(benefit("3", ["a", "b"]))).toBe("rejected");
    expect(limiter.shouldStop()).toBe(true);
  });

  it("does not stop while a single card still has room", () => {
    const limiter = createLimiter({ clubLimit: 0, cardLimits: { a: 1, b: 5 } });
    limiter.offer(benefit("1", ["a"]));
    expect(limiter.shouldStop()).toBe(false);
  });
});

describe("0 means unlimited", () => {
  it("never caps the club", () => {
    const limiter = createLimiter({ clubLimit: 0, cardLimits: { a: 0 } });
    for (let i = 0; i < 500; i += 1) limiter.offer(benefit(String(i), ["a"]));

    expect(limiter.kept()).toHaveLength(500);
    expect(limiter.shouldStop()).toBe(false);
    expect(limiter.cappedBy()).toBeNull();
  });

  it("is not confused with a cap of nothing", () => {
    // The bug this guards: a truthiness check on the limit would read 0 as
    // "falsy, use the default" and quietly cap an uncapped club at 50.
    const limiter = createLimiter({ clubLimit: 0, cardLimits: {} });
    for (let i = 0; i < 60; i += 1) limiter.offer(benefit(String(i), ["a"]));
    expect(limiter.kept()).toHaveLength(60);
  });
});

describe("interaction between the two caps", () => {
  it("lets the club cap bound the union of the cards", () => {
    // Card caps sum to 10, club cap says 3. The club cap wins.
    const limiter = createLimiter({ clubLimit: 3, cardLimits: { a: 5, b: 5 } });
    for (let i = 0; i < 10; i += 1) limiter.offer(benefit(String(i), [i % 2 === 0 ? "a" : "b"]));

    expect(limiter.kept()).toHaveLength(3);
    expect(limiter.cappedBy()).toBe("club");
  });

  it("reports the club cap when both bite", () => {
    const limiter = createLimiter({ clubLimit: 2, cardLimits: { a: 1 } });
    limiter.offer(benefit("1", ["a"]));
    limiter.offer(benefit("2", ["a"])); // card full -> "card"
    expect(limiter.cappedBy()).toBe("card");
    limiter.offer(benefit("3", ["a"]));
    // Still "card": the club cap of 2 was never reached, because the card cap
    // stopped anything being kept.
    expect(limiter.cappedBy()).toBe("card");
  });

  it("counts everything offered, not only what was kept", () => {
    // `fetched` on the run doc is this number — it is what makes "we pulled
    // 200 and stored 50" legible in the admin panel.
    const limiter = createLimiter({ clubLimit: 1, cardLimits: {} });
    limiter.offer(benefit("1", ["a"]));
    limiter.offer(benefit("2", ["a"]));
    limiter.offer(benefit("3", ["a"]));

    expect(limiter.offered()).toBe(3);
    expect(limiter.kept()).toHaveLength(1);
  });
});

describe("nothing configured", () => {
  it("does not stop when no card caps are known", () => {
    // An unknown card is uncapped, so the run must not give up on it.
    const limiter = createLimiter({ clubLimit: 0, cardLimits: {} });
    limiter.offer(benefit("1", ["mystery"]));
    expect(limiter.shouldStop()).toBe(false);
  });
});
