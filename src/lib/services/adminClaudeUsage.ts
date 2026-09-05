// Admin-only aggregate read of claudeUsageLog (docs/ROADMAP.md Phase 9.5,
// docs/DECISIONS.md ADR #49). Called only from Server Components under
// app/(protected)/admin/ — that route's layout.tsx already gates every
// request on isAdminUid() before any child page runs, same reasoning as
// src/lib/services/adminUsers.ts.
import { AggregateField, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";

export interface ClaudeUsageSummary {
  calls: number;
  estimatedCostUsd: number;
}

// One time window of the admin dashboard overview. `null` means the aggregation
// for that window failed — see runWindow() below for why that is a value rather
// than a thrown error.
export type ClaudeUsageWindow = ClaudeUsageSummary | null;

export interface ClaudeUsageOverview {
  last24h: ClaudeUsageWindow;
  last7d: ClaudeUsageWindow;
  monthToDate: ClaudeUsageWindow;
  allTime: ClaudeUsageWindow;
  /** From CLAUDE_MONTHLY_BUDGET_USD; null when unset or not a positive number. */
  monthlyBudgetUsd: number | null;
}

// count()+sum() aggregation, not a full document fetch — same principle as
// getUserDetail's card/list counts (docs/DECISIONS.md ADR #43): billed as a
// small fixed number of reads regardless of how many log entries the uid has
// accumulated, not one read per entry.
//
// Needs the composite index `uid ASC, estimatedCostUsd ASC` in
// firestore.indexes.json: unlike count(), a sum()/average() aggregation must
// read the summed field out of the index itself, so the automatic single-field
// index on `uid` is not enough once a where() filter is combined with sum().
// The emulator builds an index for whatever query reaches it, so a missing one
// only shows up in production — same failure mode as the collection-group
// fieldOverrides (docs/DECISIONS.md #33, docs/DATA_MODEL.md).
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

// Whole-collection rollup for the admin home page (docs/ROADMAP.md Phase 9.6
// layer 1). Same aggregation shape as getClaudeUsageSummaryForUid above, only
// filtered by createdAt instead of uid, so the cost stays a small fixed number
// of reads per window no matter how large the log grows.
//
// Needs the composite index `createdAt ASC, estimatedCostUsd ASC` in
// firestore.indexes.json, for exactly the reason spelled out above the per-uid
// query: a sum() has to read the summed field out of the index itself.
//
// Each window is caught independently rather than sharing one rejection.
// A missing index is a FAILED_PRECONDITION at query time that the emulator
// cannot reproduce (it builds an index for whatever query reaches it), and on
// 2026-09-05 that took down the whole /admin/users/[uid] page because the
// per-uid aggregation sat inside a shared Promise.all — see the postmortem in
// docs/DEPLOYMENT.md. This is the admin home page, so the same failure would
// blank the entire panel. The tile renders "לא זמין" instead.
async function runWindow(since: Date | null): Promise<ClaudeUsageWindow> {
  try {
    const base = adminDb.collection("claudeUsageLog");
    const query = since ? base.where("createdAt", ">=", Timestamp.fromDate(since)) : base;
    const snap = await query
      .aggregate({
        calls: AggregateField.count(),
        estimatedCostUsd: AggregateField.sum("estimatedCostUsd"),
      })
      .get();
    const data = snap.data();
    return { calls: data.calls, estimatedCostUsd: data.estimatedCostUsd };
  } catch (error) {
    console.error("claudeUsageOverview: window aggregation failed", { since, error });
    return null;
  }
}

// Read lazily inside the call, not at module scope, so `next build` never needs
// the variable present — same pattern as src/lib/whatsapp/deepLink.ts.
function readMonthlyBudgetUsd(): number | null {
  const raw = process.env.CLAUDE_MONTHLY_BUDGET_USD?.trim();
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function getClaudeUsageOverview(): Promise<ClaudeUsageOverview> {
  const now = new Date();
  // Calendar month boundary in UTC, matching how Anthropic bills. The cost here
  // is our own estimate anyway, so pinning it to Asia/Jerusalem would only make
  // the first and last 3 hours of a month ambiguous without adding accuracy.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [last24h, last7d, monthToDate, allTime] = await Promise.all([
    runWindow(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    runWindow(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
    runWindow(monthStart),
    runWindow(null),
  ]);

  return { last24h, last7d, monthToDate, allTime, monthlyBudgetUsd: readMonthlyBudgetUsd() };
}
