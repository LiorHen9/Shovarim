import { describe, expect, it } from "vitest";

import { __test, DEFAULT_BENEFIT_SCRAPE_LIMIT as FUNCTIONS_DEFAULT } from "../../functions/src/benefits/runner";
import { DEFAULT_BENEFIT_SCRAPE_LIMIT as APP_DEFAULT } from "../../src/lib/validation/club";
import type { BenefitScrapeRun } from "../../src/types/clubBenefit";

const { shrinkAbortReason, toLimit, benefitDocId } = __test;

// The scrape replaces a club's benefits wholesale: every run stamps what it
// writes and then deletes this club's docs carrying any other stamp. That is
// the requested behaviour — a true snapshot, no residue — and it is also a
// loaded gun, because a source having a bad morning would delete a club's
// entire catalogue at 04:00 with nobody watching. The guard below is what
// stands between those two, so it is tested directly rather than through a
// Firestore.

function previousRun(sourceTotal: number): BenefitScrapeRun {
  return { sourceTotal } as BenefitScrapeRun;
}

describe("shrink guard", () => {
  it("aborts when the source returns nothing at all", () => {
    // Always an outage or a broken parser — a club does not empty its whole
    // catalogue overnight — and the case where deleting everything would hurt
    // most.
    expect(shrinkAbortReason(0, 0, previousRun(7000))).toMatch(/לא התקבלה אף הטבה/);
  });

  it("aborts on an empty result even with no history to compare against", () => {
    expect(shrinkAbortReason(0, 0, null)).not.toBeNull();
  });

  it("aborts when the source collapses past the threshold", () => {
    // 7,101 -> 500 is not a sale ending.
    const reason = shrinkAbortReason(500, 500, previousRun(7101));
    expect(reason).toMatch(/הצטמק/);
    expect(reason).toContain("7101");
    expect(reason).toContain("500");
  });

  it("allows an ordinary shrink", () => {
    // Benefits expire all the time; the guard must not cry wolf.
    expect(shrinkAbortReason(6800, 50, previousRun(7101))).toBeNull();
    expect(shrinkAbortReason(3600, 50, previousRun(7101))).toBeNull();
  });

  it("allows the very first run for a club", () => {
    // With no baseline, refusing here would stop the feature ever starting.
    expect(shrinkAbortReason(7101, 50, null)).toBeNull();
    expect(shrinkAbortReason(7101, 50, previousRun(0))).toBeNull();
  });

  it("does not fire when only the admin's cap changed", () => {
    // The reason the comparison is on sourceTotal and never on `written`.
    // Lowering a club's cap from 50 to 10 would otherwise read as an 80%
    // collapse and abort every run after a cap change — verified live against
    // טוב+, where 50 -> 10 swept 40 and reported success.
    expect(shrinkAbortReason(7101, 10, previousRun(7101))).toBeNull();
  });

  it("allows a growing source", () => {
    expect(shrinkAbortReason(9000, 50, previousRun(7101))).toBeNull();
  });
});

describe("cap normalisation", () => {
  it("keeps 0 as 0 rather than treating it as absent", () => {
    // 0 means "no cap". A truthiness check here would silently pin an
    // uncapped club back to 50.
    expect(toLimit(0)).toBe(0);
  });

  it("substitutes the default for a doc written before Phase 10.2", () => {
    // This is what lets the field ship without a backfill.
    expect(toLimit(undefined)).toBe(50);
    expect(toLimit(null)).toBe(50);
  });

  it("substitutes the default for junk rather than crashing the run", () => {
    expect(toLimit("50")).toBe(50);
    expect(toLimit(-1)).toBe(50);
    expect(toLimit(Number.NaN)).toBe(50);
  });

  it("floors a fractional value", () => {
    expect(toLimit(10.7)).toBe(10);
  });
});

describe("benefit doc ids", () => {
  it("is deterministic, so a re-scrape overwrites instead of duplicating", () => {
    expect(benefitDocId("hot", "60841")).toBe(benefitDocId("hot", "60841"));
    expect(benefitDocId("hot", "60841")).toBe("hot__60841");
  });

  it("keeps two clubs' identical source keys apart", () => {
    expect(benefitDocId("hot", "1")).not.toBe(benefitDocId("tov", "1"));
  });

  it("encodes a source key containing a slash", () => {
    // חבר's fallback key is built from a merchant's name and address, which
    // can contain "/" — unencoded that would silently address a subcollection
    // path instead of a document.
    const id = benefitDocId("hever", "שם/עם/לוכסן");
    expect(id).not.toContain("/");
    expect(id.startsWith("hever__")).toBe(true);
  });
});

describe("the functions/ ↔ src/ duplication", () => {
  it("keeps the default cap identical on both sides", () => {
    // functions/tsconfig.json pins rootDir to "src", so the scraper cannot
    // import the app's constant and vice versa (ADR #24) — the same reason
    // GRACE_PERIOD_DAYS is duplicated. If these drift, the form would offer
    // one default while the scraper silently applied another, and nothing
    // else in the build would notice.
    expect(FUNCTIONS_DEFAULT).toBe(APP_DEFAULT);
  });
});

