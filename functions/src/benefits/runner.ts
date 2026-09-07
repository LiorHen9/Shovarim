// The scrape itself: read the caps, pull from the source, and replace the
// club's benefits with what came back.
//
// "Replace" is the requirement, and doing it safely is most of what this file
// is. Every doc written in a run carries that run's id, and anything left
// carrying an older one is a leftover from a benefit the club has since
// removed — so the sweep is "delete everything for this club that this run did
// not just write". That is what makes the result a true snapshot with no
// residue, rather than an accumulating pile.
//
// The dangerous corollary is that a source having a bad day would delete a
// club's entire catalogue, silently, at 04:00. The shrink guard below is the
// answer to that and is the single most important thing here.
import { Timestamp, type Firestore } from "firebase-admin/firestore";

import { mapCategory } from "./categoryMap";
import { createLimiter } from "./limits";
import { findClubSource, SCRAPEABLE_CLUB_IDS } from "./registry";
import type { BenefitScrapeRunDoc, ClubBenefitDoc, ParsedBenefit } from "./types";

export const BENEFITS_COLLECTION = "clubBenefits";
export const RUNS_COLLECTION = "benefitScrapeRuns";

/** Mirrors DEFAULT_BENEFIT_SCRAPE_LIMIT in src/lib/validation/club.ts — the
 *  duplication is the usual functions/ ↔ src/ one (ADR #24). Applied when a
 *  club or card doc predates the field, so no migration is needed. */
export const DEFAULT_BENEFIT_SCRAPE_LIMIT = 50;

/**
 * How far the source may shrink before a run refuses to overwrite.
 *
 * A source returning *fewer* benefits is normal (a sale ends); a source
 * returning half of what it had yesterday is not, and is far more likely to be
 * an outage, a layout change, or a partial fetch than a real event. Refusing
 * to write costs a day of staleness; writing costs the club's entire
 * catalogue with no undo.
 */
const SHRINK_ABORT_RATIO = 0.5;

export interface RunOutcome {
  clubId: string;
  status: BenefitScrapeRunDoc["status"];
  written: number;
  deleted: number;
  abortReason: string | null;
}

interface CatalogLimits {
  clubLimit: number;
  cardLimits: Record<string, number>;
}

function toLimit(value: unknown): number {
  // 0 is a real, meaningful value here ("no cap"), so this cannot use `||`.
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : DEFAULT_BENEFIT_SCRAPE_LIMIT;
}

async function readLimits(db: Firestore, clubId: string): Promise<CatalogLimits> {
  const [clubSnap, cardsSnap] = await Promise.all([
    db.collection("clubs").doc(clubId).get(),
    db.collection("clubCards").where("clubId", "==", clubId).get(),
  ]);

  const cardLimits: Record<string, number> = {};
  for (const card of cardsSnap.docs) {
    cardLimits[card.id] = toLimit(card.data().benefitScrapeLimit);
  }

  return { clubLimit: toLimit(clubSnap.data()?.benefitScrapeLimit), cardLimits };
}

/** The most recent run that actually wrote something, for the shrink guard's
 *  baseline. Aborted and failed runs are skipped on purpose: an aborted run's
 *  sourceTotal is the anomaly we refused to trust, so using it as the next
 *  run's baseline would launder the bad number into the accepted one. */
async function lastSuccessfulRun(db: Firestore, clubId: string): Promise<BenefitScrapeRunDoc | null> {
  const snap = await db
    .collection(RUNS_COLLECTION)
    .where("clubId", "==", clubId)
    .where("status", "==", "success")
    .orderBy("startedAt", "desc")
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? (doc.data() as BenefitScrapeRunDoc) : null;
}

function toDoc(
  benefit: ParsedBenefit,
  clubId: string,
  runId: string,
  now: Timestamp,
  firstSeenAt: Timestamp
): ClubBenefitDoc {
  return {
    id: benefitDocId(clubId, benefit.sourceKey),
    clubId,
    clubCardIds: benefit.clubCardIds,
    sourceKey: benefit.sourceKey,
    benefitKind: benefit.kind,
    title: benefit.title,
    description: benefit.description,
    categoryId: mapCategory(benefit.sourceCategory),
    sourceCategory: benefit.sourceCategory,
    priceFrom: benefit.priceFrom,
    originalPrice: benefit.originalPrice,
    discountText: benefit.discountText,
    url: benefit.url,
    imageUrl: benefit.imageUrl,
    provider: benefit.provider,
    validUntil: benefit.validUntil ? Timestamp.fromDate(benefit.validUntil) : null,
    sourceMemberTypes: benefit.sourceMemberTypes,
    scrapeRunId: runId,
    firstSeenAt,
    updatedAt: now,
  };
}

/** Deterministic, so a re-scrape overwrites rather than duplicating — the same
 *  reason clubCards uses `${clubId}-${tier}`. The sourceKey is encoded because
 *  חבר's fallback key is derived from a merchant's name and address and can
 *  contain "/", which would otherwise create a subcollection path. */
export function benefitDocId(clubId: string, sourceKey: string): string {
  return `${clubId}__${encodeURIComponent(sourceKey)}`;
}

export async function runScrapeForClub(
  db: Firestore,
  clubId: string,
  triggeredBy: string
): Promise<RunOutcome> {
  const source = findClubSource(clubId);
  if (!source?.adapter) {
    return {
      clubId,
      status: "failed",
      written: 0,
      deleted: 0,
      abortReason: source?.unsupportedReason ?? `אין סקרייפר למועדון ${clubId}`,
    };
  }

  const startedAt = Timestamp.now();
  const runId = `${clubId}-${startedAt.toDate().toISOString()}`;
  const runRef = db.collection(RUNS_COLLECTION).doc(runId);

  const limits = await readLimits(db, clubId);
  const limiter = createLimiter(limits);

  const base = {
    id: runId,
    clubId,
    startedAt,
    limitsApplied: { club: limits.clubLimit, cards: limits.cardLimits },
    triggeredBy,
  };

  await runRef.set({
    ...base,
    status: "running",
    finishedAt: null,
    sourceTotal: 0,
    fetched: 0,
    written: 0,
    deleted: 0,
    cappedBy: null,
    abortReason: null,
    errors: [],
  } satisfies BenefitScrapeRunDoc);

  const finish = async (patch: Partial<BenefitScrapeRunDoc>): Promise<void> => {
    await runRef.set({ finishedAt: Timestamp.now(), ...patch }, { merge: true });
  };

  // --- fetch -------------------------------------------------------------
  // Nothing is written or deleted until this has finished and been vetted.
  let sourceTotal = 0;
  let errors: string[] = [];
  try {
    const result = await source.adapter({
      offer: (benefit) => void limiter.offer(benefit),
      shouldStop: () => limiter.shouldStop(),
    });
    sourceTotal = result.sourceTotal;
    errors = result.errors;
  } catch (error) {
    await finish({ status: "failed", abortReason: String(error), errors });
    return { clubId, status: "failed", written: 0, deleted: 0, abortReason: String(error) };
  }

  const kept = limiter.kept();

  // --- the shrink guard --------------------------------------------------
  const previous = await lastSuccessfulRun(db, clubId);
  const abortReason = shrinkAbortReason(sourceTotal, kept.length, previous);
  if (abortReason) {
    await finish({
      status: "aborted",
      sourceTotal,
      fetched: limiter.offered(),
      abortReason,
      errors,
    });
    return { clubId, status: "aborted", written: 0, deleted: 0, abortReason };
  }

  // --- write, then sweep -------------------------------------------------
  // Wrapped so that a Firestore failure still closes out the run document.
  // Without this the doc would sit at "running" forever and /admin/benefits
  // would report a scrape that is merely stuck as one still in progress.
  //
  // Failing between the write and the sweep is safe by construction: the
  // leftovers simply stay, and the next run's sweep removes them. The order
  // matters and is deliberate — writing first means the collection never
  // passes through a state where the club has no benefits at all.
  let deleted = 0;
  try {
    const now = Timestamp.now();
    const firstSeen = await readFirstSeen(db, clubId);

    const writer = db.bulkWriter();
    for (const benefit of kept) {
      const id = benefitDocId(clubId, benefit.sourceKey);
      // set() with no merge, on purpose: a benefit whose price was removed at
      // the source must lose the field here too, and a merge would keep
      // serving yesterday's price forever.
      void writer.set(
        db.collection(BENEFITS_COLLECTION).doc(id),
        toDoc(benefit, clubId, runId, now, firstSeen.get(id) ?? now)
      );
    }
    await writer.close();

    deleted = await sweepStale(db, clubId, runId);
  } catch (error) {
    await finish({ status: "failed", sourceTotal, fetched: limiter.offered(), abortReason: String(error), errors });
    return { clubId, status: "failed", written: 0, deleted: 0, abortReason: String(error) };
  }

  await finish({
    status: "success",
    sourceTotal,
    fetched: limiter.offered(),
    written: kept.length,
    deleted,
    cappedBy: limiter.cappedBy(),
    errors,
  });

  return { clubId, status: "success", written: kept.length, deleted, abortReason: null };
}

function shrinkAbortReason(
  sourceTotal: number,
  keptCount: number,
  previous: BenefitScrapeRunDoc | null
): string | null {
  // Nothing at all came back. Always an outage or a broken parser — a club
  // does not empty its entire catalogue overnight — and the one case where
  // deleting everything would be most catastrophic.
  if (keptCount === 0) {
    return "לא התקבלה אף הטבה מהמקור — הריצה בוטלה וההטבות הקיימות נשמרו";
  }

  // First ever run for this club: there is nothing to compare against, and
  // refusing here would mean the guard prevents the feature from ever starting.
  if (!previous || previous.sourceTotal <= 0) return null;

  // Compared on sourceTotal, never on `written`: written is bounded by the
  // admin's cap, so lowering the cap from 50 to 10 would otherwise read as an
  // 80% collapse of the source and abort every run after a cap change.
  const ratio = sourceTotal / previous.sourceTotal;
  if (ratio < SHRINK_ABORT_RATIO) {
    return `המקור הצטמק מ-${previous.sourceTotal} ל-${sourceTotal} הטבות (${Math.round(ratio * 100)}%) — הריצה בוטלה כדי לא למחוק נתונים תקינים`;
  }

  return null;
}

/** Existing doc ids and their firstSeenAt, so a benefit that has been listed
 *  for months keeps its original date across the overwrite. Fetches only that
 *  one field — the rest of the doc is about to be replaced anyway. */
async function readFirstSeen(db: Firestore, clubId: string): Promise<Map<string, Timestamp>> {
  const snap = await db
    .collection(BENEFITS_COLLECTION)
    .where("clubId", "==", clubId)
    .select("firstSeenAt")
    .get();

  const map = new Map<string, Timestamp>();
  for (const doc of snap.docs) {
    const value = doc.data().firstSeenAt;
    if (value instanceof Timestamp) map.set(doc.id, value);
  }
  return map;
}

/**
 * Deletes this club's benefits that the current run did not write — the
 * "no residue" half of the requirement.
 *
 * The `!=` filter means the query reads only the leftovers instead of the
 * club's whole collection; it needs the (clubId, scrapeRunId) composite index
 * in firestore.indexes.json. Note that `!=` also excludes docs missing the
 * field entirely, which is safe here because every doc this feature has ever
 * written carries a scrapeRunId.
 */
async function sweepStale(db: Firestore, clubId: string, runId: string): Promise<number> {
  const snap = await db
    .collection(BENEFITS_COLLECTION)
    .where("clubId", "==", clubId)
    .where("scrapeRunId", "!=", runId)
    .select()
    .get();

  if (snap.empty) return 0;

  const writer = db.bulkWriter();
  for (const doc of snap.docs) void writer.delete(doc.ref);
  await writer.close();

  return snap.size;
}

/** Every scrapeable club, in sequence. Sequential rather than parallel so one
 *  club's source being slow or down cannot take the others' runs down with it,
 *  and so the outbound request rate stays one host at a time. */
export async function runAllScrapes(db: Firestore, triggeredBy: string): Promise<RunOutcome[]> {
  const outcomes: RunOutcome[] = [];
  for (const clubId of SCRAPEABLE_CLUB_IDS) {
    try {
      outcomes.push(await runScrapeForClub(db, clubId, triggeredBy));
    } catch (error) {
      // A throw that escaped runScrapeForClub is a bug, not a source problem.
      // It still must not abort the remaining clubs.
      console.error(`Benefit scrape for ${clubId} threw:`, error);
      outcomes.push({
        clubId,
        status: "failed",
        written: 0,
        deleted: 0,
        abortReason: String(error),
      });
    }
  }
  return outcomes;
}

// Exported for tests/unit/. The shrink guard is the one piece of this file
// that must be exercised without a Firestore: it is the difference between a
// bad morning at the source and a club's entire catalogue being deleted.
export const __test = { shrinkAbortReason, toLimit, benefitDocId, SHRINK_ABORT_RATIO };

