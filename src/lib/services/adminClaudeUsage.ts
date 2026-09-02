// Admin-only aggregate read of claudeUsageLog (docs/ROADMAP.md Phase 9.5,
// docs/DECISIONS.md ADR #49). Called only from Server Components under
// app/(protected)/admin/ — that route's layout.tsx already gates every
// request on isAdminUid() before any child page runs, same reasoning as
// src/lib/services/adminUsers.ts.
import { AggregateField } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";

export interface ClaudeUsageSummary {
  calls: number;
  estimatedCostUsd: number;
}

// count()+sum() aggregation, not a full document fetch — same principle as
// getUserDetail's card/list counts (docs/DECISIONS.md ADR #43): billed as a
// small fixed number of reads regardless of how many log entries the uid has
// accumulated, not one read per entry. Single equality filter on uid, no
// composite index needed (docs/DATA_MODEL.md).
export async function getClaudeUsageSummaryForUid(uid: string): Promise<ClaudeUsageSummary> {
  const snap = await adminDb
    .collection("claudeUsageLog")
    .where("uid", "==", uid)
    .aggregate({
      calls: AggregateField.count(),
      estimatedCostUsd: AggregateField.sum("estimatedCostUsd"),
    })
    .get();
  const data = snap.data();
  return { calls: data.calls, estimatedCostUsd: data.estimatedCostUsd };
}
