// Which clubs have a working scraper, and how each one is wired up.
//
// Every club in the catalog appears here, including the ones with no usable
// source. A club that is simply absent from this file would be indistinguishable
// from one whose adapter broke, and the admin panel would have nothing to say
// about it. `null` means "researched, nothing to scrape" and carries the reason
// so the panel can show it.
//
// The clubCards ids below are the built-in catalog's
// (src/lib/services/clubCatalogData.ts). They are passed to the adapters rather
// than looked up, because which tier a source's rows belong to is knowledge
// about the *source*, not about the catalog.
import { createDolceAdapter } from "./adapters/dolce";
import { createHeverAdapter } from "./adapters/hever";
import { createHotAdapter } from "./adapters/hot";
import type { BenefitAdapter } from "./types";

export interface ClubSource {
  clubId: string;
  /** Null when there is no reachable public source. */
  adapter: BenefitAdapter | null;
  /** Shown in the admin panel when adapter is null. */
  unsupportedReason?: string;
}

export const CLUB_SOURCES: ClubSource[] = [
  {
    clubId: "hot",
    adapter: createHotAdapter(["hot-regular"]),
  },
  {
    clubId: "tov",
    adapter: createDolceAdapter({
      origin: "https://www.tovplus.org.il",
      clubCardIds: ["tov-regular"],
    }),
  },
  {
    clubId: "mifal-hapais",
    // Both tiers, deliberately. The source does carry per-tier eligibility in
    // allowed_for_member_types, but those are פיס פלוס's four real levels
    // (כסף/זהב/זהב+/פלטינום) and the catalog only models רגיל/VIP (ADR #61
    // decision 8). Assigning every benefit to both tiers over-includes rather
    // than hiding a benefit from someone entitled to it, and the raw codes are
    // stored so the split can be done properly later.
    adapter: createDolceAdapter({
      origin: "https://paisplus.co.il",
      clubCardIds: ["mifal-hapais-regular", "mifal-hapais-vip"],
    }),
  },
  {
    clubId: "hever",
    adapter: createHeverAdapter({ giftCard: "hever-regular", teamim: "hever-teamim" }),
  },
  {
    clubId: "shavve",
    adapter: null,
    unsupportedReason:
      "מועדון סגור — כל 64 נתיבי ה-API של הפלטפורמה (back.shavve.co.il) מחזירים 401 ללא התחברות חבר מועדון",
  },
  {
    clubId: "behatsdaa",
    adapter: null,
    unsupportedReason:
      "מועדון סגור — back.behatsdaa.org.il מחזיר 401, והאתר עצמו מוגן ב-Imperva/Incapsula",
  },
  {
    clubId: "ashmoret",
    adapter: null,
    unsupportedReason: "אין אתר פעיל — ashmoret-itu.co.il מחזיר עמוד ריק",
  },
];

export const SCRAPEABLE_CLUB_IDS = CLUB_SOURCES.filter((source) => source.adapter !== null).map(
  (source) => source.clubId
);

export function findClubSource(clubId: string): ClubSource | undefined {
  return CLUB_SOURCES.find((source) => source.clubId === clubId);
}
