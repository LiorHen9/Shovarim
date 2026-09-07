// Read side of the benefit scraper for /admin/benefits (Phase 10.2, ADR #62).
//
// Read-only on purpose. The scraped benefits are a snapshot of somebody else's
// site, and the next run overwrites them wholesale — so an "edit this benefit"
// button would promise a change that silently disappears within the day. What
// the panel does offer is the two things that genuinely are ours: the
// extraction caps (edited on the club and card, in /admin/clubs) and a
// "run now" trigger.
//
// The scrape itself lives in functions/ and is invoked as a callable from the
// client, the same way adminDeleteUserNow is — src/ cannot import across the
// rootDir boundary (ADR #24).
import { adminDb } from "../firebase/adminApp";
import { DEFAULT_BENEFIT_SCRAPE_LIMIT } from "../validation/club";
import { CLUB_SCRAPE_SUPPORT } from "./benefitScrapeSupport";
import type { BenefitScrapeRun } from "../../types/clubBenefit";
import type { Club } from "../../types/club";

const BENEFITS_COLLECTION = "clubBenefits";
const RUNS_COLLECTION = "benefitScrapeRuns";

export interface ClubScrapeStatus {
  clubId: string;
  clubName: string;
  /** Null when the club has a working adapter. */
  unsupportedReason: string | null;
  /** The club-level cap in force, for context next to the run's numbers. */
  benefitScrapeLimit: number;
  /** How many benefits are stored for this club right now. */
  benefitCount: number;
  lastRun: SerializedRun | null;
}

/** Timestamps flattened to ISO strings: this crosses into a "use client"
 *  component, and Next refuses to serialize Firestore Timestamp instances —
 *  the same conversion UserDeletionSection's props already do. */
export interface SerializedRun {
  status: BenefitScrapeRun["status"];
  startedAt: string;
  finishedAt: string | null;
  sourceTotal: number;
  fetched: number;
  written: number;
  deleted: number;
  cappedBy: "club" | "card" | null;
  abortReason: string | null;
  errors: string[];
  triggeredBy: string;
}

function serializeRun(run: BenefitScrapeRun): SerializedRun {
  return {
    status: run.status,
    startedAt: run.startedAt.toDate().toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toDate().toISOString() : null,
    sourceTotal: run.sourceTotal ?? 0,
    fetched: run.fetched ?? 0,
    written: run.written ?? 0,
    deleted: run.deleted ?? 0,
    cappedBy: run.cappedBy ?? null,
    abortReason: run.abortReason ?? null,
    errors: run.errors ?? [],
    triggeredBy: run.triggeredBy ?? "schedule",
  };
}

/**
 * One row per club in the catalog — including the ones that cannot be scraped,
 * which is the point: a club silently missing from this table would be
 * indistinguishable from one whose scraper broke.
 */
export async function listScrapeStatus(): Promise<ClubScrapeStatus[]> {
  const clubsSnap = await adminDb.collection("clubs").orderBy("sortOrder").get();

  return Promise.all(
    clubsSnap.docs.map(async (doc) => {
      const club = doc.data() as Club;

      // count() rather than reading the docs: clubBenefits is the largest
      // collection in the app and this page only needs the number — the same
      // call assertNoMemberships() makes in adminClubs.ts.
      const [countSnap, runSnap] = await Promise.all([
        adminDb.collection(BENEFITS_COLLECTION).where("clubId", "==", doc.id).count().get(),
        adminDb
          .collection(RUNS_COLLECTION)
          .where("clubId", "==", doc.id)
          .orderBy("startedAt", "desc")
          .limit(1)
          .get(),
      ]);

      const lastRunDoc = runSnap.docs[0];

      return {
        clubId: doc.id,
        clubName: club.name,
        // An id absent from the map is a club added since — treat it as
        // unsupported rather than claiming a scraper that does not exist.
        unsupportedReason:
          doc.id in CLUB_SCRAPE_SUPPORT
            ? CLUB_SCRAPE_SUPPORT[doc.id] ?? null
            : "לא מוגדר סקרייפר למועדון הזה",
        benefitScrapeLimit: club.benefitScrapeLimit ?? DEFAULT_BENEFIT_SCRAPE_LIMIT,
        benefitCount: countSnap.data().count,
        lastRun: lastRunDoc ? serializeRun(lastRunDoc.data() as BenefitScrapeRun) : null,
      };
    })
  );
}
