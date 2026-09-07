import { setGlobalOptions } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { sweepExpiredAccountDeletions } from "./accountDeletion";
import { runAllScrapes } from "./benefits/runner";
import { db } from "./firebaseAdmin";

// Same region as the App Hosting backend (docs/DEPLOYMENT.md, docs/DECISIONS.md #16)
// to avoid cross-region latency between Firestore/Storage and Cloud Functions.
setGlobalOptions({ region: "europe-west4" });

export { adminDeleteUserNow, adminScrapeBenefitsNow } from "./adminActions";

// Right-to-erasure, stage 2 (docs/PRIVACY.md § "זכות מחיקה", docs/DECISIONS.md #24).
// Runs daily; deleteUserAccount is idempotent-safe per user (a failure just
// gets retried on the next run since deletionRequestedAt isn't cleared until
// the user doc itself is deleted).
export const deleteExpiredAccounts = onSchedule("0 3 * * *", async () => {
  const { processed, failed } = await sweepExpiredAccountDeletions(new Date());
  console.log(`Account deletion sweep: ${processed} deleted, ${failed} failed.`);
});

// Club-benefit snapshot (docs/ROADMAP.md Phase 10.2, docs/DECISIONS.md #62).
//
// 04:00 Israel time, an hour after deleteExpiredAccounts, so the two never
// contend. Unlike that sweep this one has an explicit timeZone: benefit
// freshness is user-visible ("what is on offer today"), and a UTC schedule
// would drift an hour against the reader twice a year.
//
// 540s and 512MiB because this is the only function here that does real work:
// at the default cap of 50 a full pass over four clubs is well under a minute,
// but an admin who sets a club's cap to 0 (unlimited) puts הוט's 237 pages in
// scope, and the run must be able to finish rather than be killed halfway.
export const scrapeClubBenefits = onSchedule(
  { schedule: "0 4 * * *", timeZone: "Asia/Jerusalem", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const outcomes = await runAllScrapes(db, "schedule");
    for (const outcome of outcomes) {
      console.log(
        `Benefit scrape ${outcome.clubId}: ${outcome.status}, ` +
          `${outcome.written} written, ${outcome.deleted} swept` +
          (outcome.abortReason ? ` — ${outcome.abortReason}` : "")
      );
    }
  }
);
