import { describe, expect, it } from "vitest";

import {
  DEFAULT_BENEFIT_SCRAPE_LIMIT,
  MAX_CLUB_LOGO_BYTES,
  benefitScrapeLimitSchema,
  clubCardFormSchema,
  clubColorSchema,
  clubFormSchema,
  clubSlugSchema,
  clubWebsiteSchema,
  validateClubLogo,
} from "@/lib/validation/club";

// These schemas are the only boundary between an authenticated admin's browser
// and the catalog: the Server Actions write with the Admin SDK, which bypasses
// firestore.rules entirely, and a Server Action is POST-able with any payload.
// So the interesting cases here are the malformed ones, not the happy path.

describe("clubSlugSchema", () => {
  it("accepts a lowercase kebab slug", () => {
    expect(clubSlugSchema.parse("mifal-hapais")).toBe("mifal-hapais");
  });

  it.each([
    ["Mifal-Hapais", "uppercase"],
    ["mifal_hapais", "underscore"],
    ["-mifal", "leading dash"],
    ["mifal-", "trailing dash"],
    ["mifal--hapais", "double dash"],
    ["a", "too short"],
    ["מפעל", "non-ascii"],
    // The one that actually matters: firebase-admin's .doc() treats "/" as a
    // path separator, so a slug carrying one could nest a write somewhere else
    // entirely.
    ["clubs/evil", "path separator"],
  ])("rejects %s (%s)", (value) => {
    expect(clubSlugSchema.safeParse(value).success).toBe(false);
  });
});

describe("clubColorSchema", () => {
  it("accepts #RRGGBB", () => {
    expect(clubColorSchema.parse("#0EA5E9")).toBe("#0EA5E9");
  });

  it.each(["0ea5e9", "#0ea", "#0ea5e9ff", "red", "rgb(1,2,3)", "javascript:alert(1)"])(
    "rejects %s",
    (value) => {
      expect(clubColorSchema.safeParse(value).success).toBe(false);
    }
  );
});

describe("clubWebsiteSchema", () => {
  it("accepts an empty string, which upsertClub stores as null", () => {
    expect(clubWebsiteSchema.parse("")).toBe("");
  });

  it("accepts an https url", () => {
    expect(clubWebsiteSchema.parse("https://www.hvr.co.il")).toBe("https://www.hvr.co.il");
  });

  it.each([
    ["http://www.hvr.co.il", "plain http"],
    ["javascript:alert(1)", "javascript: scheme"],
    ["www.hvr.co.il", "no scheme"],
    ["https://", "scheme only"],
  ])("rejects %s (%s)", (value) => {
    expect(clubWebsiteSchema.safeParse(value).success).toBe(false);
  });
});

describe("clubFormSchema", () => {
  const valid = {
    id: "hever",
    name: "חבר",
    description: "",
    website: "",
    color: "#e6007e",
    sortOrder: 2,
    isActive: true,
    benefitScrapeLimit: DEFAULT_BENEFIT_SCRAPE_LIMIT,
  };

  it("accepts a complete club", () => {
    expect(clubFormSchema.parse(valid)).toMatchObject({ id: "hever", sortOrder: 2 });
  });

  it("rejects a fractional sortOrder", () => {
    expect(clubFormSchema.safeParse({ ...valid, sortOrder: 1.5 }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(clubFormSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });
});

describe("clubCardFormSchema", () => {
  it("validates both halves of the composed doc id", () => {
    // The stored id is `${clubId}-${cardId}`, so a bad value in either half is
    // a bad document path.
    expect(
      clubCardFormSchema.safeParse({
        clubId: "mifal-hapais",
        cardId: "vip/../../evil",
        name: "VIP",
        description: "",
        sortOrder: 1,
        isActive: true,
      }).success
    ).toBe(false);
  });
});

describe("validateClubLogo", () => {
  it("accepts a small png", () => {
    expect(validateClubLogo({ type: "image/png", size: 50_000 })).toBeNull();
  });

  it("rejects a non-image", () => {
    expect(validateClubLogo({ type: "application/pdf", size: 1000 })).not.toBeNull();
  });

  it("rejects an empty file", () => {
    expect(validateClubLogo({ type: "image/png", size: 0 })).not.toBeNull();
  });

  it("rejects a file over the cap", () => {
    expect(validateClubLogo({ type: "image/png", size: MAX_CLUB_LOGO_BYTES + 1 })).not.toBeNull();
  });

  it("keeps the cap under Next's default 1MB Server Action body limit", () => {
    // The upload travels through a Server Action, so a cap at or above the
    // framework's own limit would surface as an opaque 413 instead of the
    // message above.
    expect(MAX_CLUB_LOGO_BYTES).toBeLessThan(1024 * 1024);
  });
});

describe("benefitScrapeLimit", () => {
  it("accepts the default and any whole number up to the cap", () => {
    for (const value of [0, 1, DEFAULT_BENEFIT_SCRAPE_LIMIT, 10000]) {
      expect(benefitScrapeLimitSchema.safeParse(value).success).toBe(true);
    }
  });

  it("treats 0 as a legitimate value, not as absent", () => {
    // 0 means "no cap" in the form. A schema that rejected it, or a reader
    // that treated it as falsy, would silently pin an uncapped club to 50.
    const parsed = benefitScrapeLimitSchema.parse(0);
    expect(parsed).toBe(0);
  });

  it("rejects negatives, fractions and out-of-range values", () => {
    for (const value of [-1, 1.5, 10001]) {
      expect(benefitScrapeLimitSchema.safeParse(value).success).toBe(false);
    }
  });

  it("rejects the NaN an empty number input produces", () => {
    // register(..., { valueAsNumber: true }) yields NaN for a cleared field,
    // so this is the message the admin actually sees.
    expect(benefitScrapeLimitSchema.safeParse(Number.NaN).success).toBe(false);
  });

  it("is required on both the club and the card form", () => {
    // The cap exists at both levels; a schema missing it on one would let the
    // form silently drop that level's value on save.
    expect(clubFormSchema.safeParse({
      id: "x", name: "x", description: "", website: "", color: "#000000", sortOrder: 1, isActive: true,
    }).success).toBe(false);
    expect(clubCardFormSchema.safeParse({
      clubId: "x", cardId: "y", name: "x", description: "", sortOrder: 1, isActive: true,
    }).success).toBe(false);
  });
});

