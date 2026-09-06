import { describe, expect, it } from "vitest";

import {
  MAX_CLUB_LOGO_BYTES,
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
