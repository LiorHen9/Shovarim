import type { Timestamp } from "firebase/firestore";

// A single benefit scraped from a club's public site (docs/ROADMAP.md Phase
// 10.2, docs/DECISIONS.md ADR #62). System data: written only by the scraper
// running under the Admin SDK, `allow write: if false` for every client.
//
// This mirrors ClubBenefitDoc in functions/src/benefits/types.ts. The
// duplication is the same one ADR #24 already forces on GRACE_PERIOD_DAYS:
// functions/tsconfig.json pins rootDir to "src", so the scraper package cannot
// import from here, and this file cannot import from there. Change one, change
// the other — the shapes are checked against each other by
// tests/unit/clubBenefit.test.ts.
//
// The collection is a full snapshot, not an accumulating log: every scrape
// stamps the docs it writes with its own scrapeRunId and then deletes this
// club's docs carrying any other one, so a benefit the club stopped offering
// disappears rather than lingering.

/**
 * Whether this row is something you buy at a members' price, or a merchant
 * that simply honours the card.
 *
 * חבר is the reason this exists: its public datasets are merchant directories
 * with no prices at all (its priced benefits sit behind a login), so without
 * the distinction ~1,900 price-less rows would read as offers whose price
 * failed to parse.
 */
export type BenefitKind = "offer" | "acceptance";

export interface ClubBenefit {
  /** `${clubId}__${encodeURIComponent(sourceKey)}` — deterministic, so a
   *  re-scrape overwrites in place. */
  id: string;
  /** -> clubs/{clubId} */
  clubId: string;
  /** -> clubCards/{id}. Never empty; more than one for a multi-tier club. */
  clubCardIds: string[];
  /** The club's own id for this benefit. Unique within the club only. */
  sourceKey: string;
  benefitKind: BenefitKind;
  title: string;
  /** Plain text — markup is stripped on the way in. */
  description: string;
  /** -> categories/system-*. Always set; unrecognised maps to system-other. */
  categoryId: string;
  /** The club's own category name, kept verbatim so a gap in the mapping
   *  table stays visible instead of vanishing into "other". */
  sourceCategory: string | null;
  /** "החל מ" in ILS. Null for `acceptance` rows and text-only offers. */
  priceFrom: number | null;
  originalPrice: number | null;
  /** Used when there is no number: "20% הנחה", "חודש מתנה". */
  discountText: string | null;
  /** The benefit's public page on the club's own site. */
  url: string;
  /** Points at the club's own CDN rather than our Storage — see ADR #62 on
   *  why 12K images are not copied. Null renders no image. */
  imageUrl: string | null;
  /** The business behind the offer. */
  provider: string | null;
  validUntil: Timestamp | null;
  /** Raw tier/eligibility codes from the source, unmapped. Only מפעל הפיס
   *  sends these today (its four real levels, which ADR #61 collapsed to
   *  רגיל/VIP). */
  sourceMemberTypes: number[] | null;
  /** The run that last wrote this doc. */
  scrapeRunId: string;
  /** Preserved across re-scrapes, so "new this week" stays answerable. */
  firstSeenAt: Timestamp;
  updatedAt: Timestamp;
}

export type ScrapeRunStatus = "running" | "success" | "aborted" | "failed";

/** One scrape of one club. The admin panel's only window into what the
 *  scheduled job did. */
export interface BenefitScrapeRun {
  id: string;
  clubId: string;
  status: ScrapeRunStatus;
  startedAt: Timestamp;
  finishedAt: Timestamp | null;
  /** How many exist at the source in total, before any cap — read from the
   *  source's own metadata, so it stays meaningful even when the cap stopped
   *  us paging early. This is what the shrink guard compares across runs. */
  sourceTotal: number;
  /** Pulled from the source before the caps were applied. */
  fetched: number;
  /** Stored, after the caps. */
  written: number;
  /** Leftovers from previous runs that were swept. */
  deleted: number;
  limitsApplied: { club: number; cards: Record<string, number> };
  /** Which cap cut the run short, if either did. */
  cappedBy: "club" | "card" | null;
  /** Why an "aborted" run refused to write. */
  abortReason: string | null;
  errors: string[];
  /** "schedule", or the adminUid who pressed the button. */
  triggeredBy: string;
}
