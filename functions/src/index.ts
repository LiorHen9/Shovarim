import { setGlobalOptions } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { sweepExpiredAccountDeletions } from "./accountDeletion";

// Same region as the App Hosting backend (docs/DEPLOYMENT.md, docs/DECISIONS.md #16)
// to avoid cross-region latency between Firestore/Storage and Cloud Functions.
setGlobalOptions({ region: "europe-west4" });

export { adminDeleteUserNow } from "./adminActions";

// Right-to-erasure, stage 2 (docs/PRIVACY.md § "זכות מחיקה", docs/DECISIONS.md #24).
// Runs daily; deleteUserAccount is idempotent-safe per user (a failure just
// gets retried on the next run since deletionRequestedAt isn't cleared until
// the user doc itself is deleted).
export const deleteExpiredAccounts = onSchedule("0 3 * * *", async () => {
  const { processed, failed } = await sweepExpiredAccountDeletions(new Date());
  console.log(`Account deletion sweep: ${processed} deleted, ${failed} failed.`);
});
