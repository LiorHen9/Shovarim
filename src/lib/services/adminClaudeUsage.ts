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

// A prepaid credit bank, not a monthly budget: the balance does not reset on the
// 1st, it only goes down until credit is topped up.
//
// The log cannot answer "how much is left" on its own. claudeUsageLog only
// exists from Phase 9.5 onward, so spend that predates it is invisible here and
// summing the whole collection undercounts. Rather than carry a fixed offset for
// that gap, the config records a balance actually read off the Claude Console
// plus when it was read: everything before that instant — logged or not — is
// already baked into the figure, so only entries after it need adding up. Re-read
// the real balance and update both values and the drift resets to zero; a top-up
// is the same edit.
export interface ClaudeCreditBank {
  /** Total credit purchased — the denominator of the utilization bar. */
  bankUsd: number;
  /** Estimated credit left: the snapshot balance minus what has been logged since. */
  remainingUsd: number;
  /** bankUsd - remainingUsd, so it includes spend from before logging existed. */
  usedUsd: number;
  /** When the snapshot balance was read off the Console. */
  balanceReadAt: Date;
}

export interface ClaudeUsageOverview {
  last24h: ClaudeUsageWindow;
  last7d: ClaudeUsageWindow;
  monthToDate: ClaudeUsageWindow;
  allTime: ClaudeUsageWindow;
  /** null when the bank is not configured, or when its aggregation failed. */
  creditBank: ClaudeCreditBank | null;
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
// the variables present — same pattern as src/lib/whatsapp/deepLink.ts.
//
// All three are required together: a bank size with no balance reading (or the
// reverse) cannot produce a remaining figure, so the bar is simply not rendered
// rather than shown with a number guessed from half the config.
interface CreditBankConfig {
  bankUsd: number;
  balanceUsd: number;
  balanceReadAt: Date;
}

function readPositiveUsd(raw: string | undefined): number | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readCreditBankConfig(): CreditBankConfig | null {
  const bankUsd = readPositiveUsd(process.env.CLAUDE_CREDIT_BANK_USD);
  const balanceUsd = readPositiveUsd(process.env.CLAUDE_CREDIT_BALANCE_USD);
  const rawReadAt = process.env.CLAUDE_CREDIT_BALANCE_AT?.trim();
  if (bankUsd === null || balanceUsd === null || !rawReadAt) return null;

  const balanceReadAt = new Date(rawReadAt);
  // An unparseable date would otherwise become an Invalid Date and turn the
  // where() clause into a query that throws deep inside the aggregation.
  if (Number.isNaN(balanceReadAt.getTime())) {
    console.error("claudeUsageOverview: CLAUDE_CREDIT_BALANCE_AT is not a valid date", rawReadAt);
    return null;
  }
  if (balanceUsd > bankUsd) {
    console.error("claudeUsageOverview: balance exceeds bank size", { bankUsd, balanceUsd });
    return null;
  }
  return { bankUsd, balanceUsd, balanceReadAt };
}

export async function getClaudeUsageOverview(): Promise<ClaudeUsageOverview> {
  const now = new Date();
  // Calendar month boundary in UTC, matching how Anthropic bills. The cost here
  // is our own estimate anyway, so pinning it to Asia/Jerusalem would only make
  // the first and last 3 hours of a month ambiguous without adding accuracy.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const bankConfig = readCreditBankConfig();

  const [last24h, last7d, monthToDate, allTime, sinceBalanceRead] = await Promise.all([
    runWindow(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    runWindow(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
    runWindow(monthStart),
    runWindow(null),
    bankConfig ? runWindow(bankConfig.balanceReadAt) : Promise.resolve(null),
  ]);

  // Same rule as the tiles: a failed aggregation drops this one panel rather
  // than the page. Showing the snapshot balance unadjusted would be worse than
  // showing nothing — it would read as a current figure while silently ignoring
  // everything spent since.
  const creditBank: ClaudeCreditBank | null =
    bankConfig && sinceBalanceRead
      ? {
          bankUsd: bankConfig.bankUsd,
          remainingUsd: bankConfig.balanceUsd - sinceBalanceRead.estimatedCostUsd,
          usedUsd: bankConfig.bankUsd - (bankConfig.balanceUsd - sinceBalanceRead.estimatedCostUsd),
          balanceReadAt: bankConfig.balanceReadAt,
        }
      : null;

  return { last24h, last7d, monthToDate, allTime, creditBank };
}
