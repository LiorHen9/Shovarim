// Types for the club-benefit scrapers (docs/ROADMAP.md Phase 10.2, ADR #62).
//
// Split in two on purpose:
//   ParsedBenefit    — what an adapter produces. Plain data, no firebase-admin
//                      types, so every adapter is a pure function that
//                      tests/unit/ can import and run without a Firestore.
//   ClubBenefitDoc   — what the runner writes. Adds the fields only the runner
//                      can know (the run stamp, the timestamps).
//
// src/types/clubBenefit.ts mirrors ClubBenefitDoc for the Next side. The
// duplication is deliberate and unavoidable: functions/tsconfig.json pins
// rootDir to "src", so this package cannot import from the app's src/
// (docs/DECISIONS.md #24), the same reason GRACE_PERIOD_DAYS is duplicated.
import type { Timestamp } from "firebase-admin/firestore";

/**
 * Whether the row is an offer with a price, or merely a merchant that honours
 * the card.
 *
 * חבר publishes open merchant directories but no prices at all (its priced
 * benefits sit behind a login). Without this discriminator those ~1,900
 * price-less rows would sit in the same collection as real offers and read as
 * "benefits whose price we failed to parse", which is a different and much
 * more alarming thing. Phase 10.3 renders the two differently.
 */
export type BenefitKind = "offer" | "acceptance";

export interface ParsedBenefit {
  /** The club's own id for this row. Unique within the club, not globally. */
  sourceKey: string;
  /** clubCards doc ids this applies to. Never empty. */
  clubCardIds: string[];
  kind: BenefitKind;
  title: string;
  /** Plain text — adapters run stripHtml() before this lands here. */
  description: string;
  /** The club's own category name, verbatim, before mapCategory() runs. */
  sourceCategory: string | null;
  /** "החל מ" in ILS. Null for `acceptance` rows and for text-only offers. */
  priceFrom: number | null;
  originalPrice: number | null;
  /** Used when there is no number: "20% הנחה", "חודש מתנה". */
  discountText: string | null;
  /** Public, canonical page for this benefit. */
  url: string;
  imageUrl: string | null;
  provider: string | null;
  validUntil: Date | null;
  /**
   * Whatever tier/eligibility codes the source used, unmapped. Kept so that
   * splitting מפעל הפיס's four real eligibility levels across רגיל/VIP (the
   * known debt in ADR #61 decision 8) is a data migration later rather than a
   * re-scrape.
   */
  sourceMemberTypes: number[] | null;
}

export interface ClubBenefitDoc extends Omit<ParsedBenefit, "validUntil" | "kind"> {
  id: string;
  clubId: string;
  benefitKind: BenefitKind;
  categoryId: string;
  validUntil: Timestamp | null;
  /** The run that last wrote this doc. Anything else is a leftover. */
  scrapeRunId: string;
  firstSeenAt: Timestamp;
  updatedAt: Timestamp;
}

export type ScrapeRunStatus = "running" | "success" | "aborted" | "failed";

export interface BenefitScrapeRunDoc {
  id: string;
  clubId: string;
  status: ScrapeRunStatus;
  startedAt: Timestamp;
  finishedAt: Timestamp | null;
  /**
   * How many benefits exist at the source in total, before any cap. Read from
   * the source's own metadata, so it stays meaningful even when the cap made
   * us stop paging early — which is what lets the shrink guard compare like
   * with like across runs whose caps differed.
   */
  sourceTotal: number;
  /** How many were actually pulled, before the caps were applied. */
  fetched: number;
  /** How many were stored, after the caps. */
  written: number;
  /** How many leftovers from previous runs were swept. */
  deleted: number;
  limitsApplied: { club: number; cards: Record<string, number> };
  cappedBy: "club" | "card" | null;
  abortReason: string | null;
  errors: string[];
  /** "schedule", or the adminUid who pressed the button. */
  triggeredBy: string;
}

/**
 * Handed to every adapter. The adapter pulls pages/categories and calls
 * `offer` for each row in the source's own order, stopping as soon as
 * `shouldStop()` goes true. It never sees the caps themselves — which is what
 * lets a future adapter for a closed club inherit cap enforcement for free.
 */
export interface AdapterSink {
  offer: (benefit: ParsedBenefit) => void;
  shouldStop: () => boolean;
}

export interface AdapterResult {
  /** Source's own total, for the shrink guard. */
  sourceTotal: number;
  /** Non-fatal problems worth surfacing in the admin panel. */
  errors: string[];
}

export type BenefitAdapter = (sink: AdapterSink) => Promise<AdapterResult>;
