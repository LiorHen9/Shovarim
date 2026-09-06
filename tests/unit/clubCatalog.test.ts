import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CATALOG } from "@/lib/services/clubCatalogData";

// The built-in catalog is data, not code, and nothing else type-checks it
// against the filesystem: a typo in a logoUrl compiles, seeds, and only shows
// up as a broken image in production, because the E2E suite deliberately runs
// against a fixture catalog rather than this one (src/actions/testSeed.ts).
// These are the invariants that a wrong edit to clubCatalogData.ts would break.
const PUBLIC_DIR = path.resolve(import.meta.dirname, "../../public");

describe("club catalog", () => {
  it("points every logoUrl at a file committed under public/", () => {
    const missing = CATALOG.filter(
      (club) => club.logoUrl && !existsSync(path.join(PUBLIC_DIR, club.logoUrl))
    ).map((club) => `${club.id} -> ${club.logoUrl}`);

    expect(missing).toEqual([]);
  });

  it("keeps club ids unique", () => {
    const ids = CATALOG.map((club) => club.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps card ids unique within each club", () => {
    for (const club of CATALOG) {
      const ids = club.cards.map((card) => card.id);
      expect(new Set(ids).size, `duplicate card id in ${club.id}`).toBe(ids.length);
    }
  });

  it("gives every club at least one card", () => {
    // useClubCatalog drops a club with no active cards, so a club seeded
    // without one is invisible rather than broken — silent, and therefore worth
    // catching here.
    expect(CATALOG.filter((club) => club.cards.length === 0)).toEqual([]);
  });

  it("links only to https, and allows no site rather than a placeholder", () => {
    for (const club of CATALOG) {
      if (club.website === null) continue;
      expect(club.website, club.id).toMatch(/^https:\/\//);
    }
  });
});
