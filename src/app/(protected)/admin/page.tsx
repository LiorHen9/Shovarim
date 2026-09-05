import type { Metadata } from "next";
import Link from "next/link";

import { formatUsd } from "@/lib/format";
import {
  getClaudeUsageOverview,
  type ClaudeCreditBank,
  type ClaudeUsageWindow,
} from "@/lib/services/adminClaudeUsage";

// Foundations shell (docs/DECISIONS.md ADR #42, docs/ROADMAP.md Phase 9.1),
// now carrying the Claude spend overview (Phase 9.6 layer 1 — Firestore
// aggregations only, no new infrastructure). Access is already gated by
// admin/layout.tsx.
// Per-page <title> (WCAG 2.4.2, Level A) — see the note in src/app/layout.tsx.
export const metadata: Metadata = { title: "פאנל ניהול" };

export default async function AdminHomePage() {
  const usage = await getClaudeUsageOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">ניהול מערכת</h1>
        <p className="text-sm text-muted-foreground">צריכה כלל-מערכתית וניהול משתמשים</p>
      </div>

      <Link href="/admin/users" className="inline-block underline underline-offset-2">
        משתמשים
      </Link>

      <section className="space-y-3">
        <h2 className="font-semibold">צריכת Claude API</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UsageTile label="24 שעות אחרונות" data={usage.last24h} />
          <UsageTile label="7 ימים אחרונים" data={usage.last7d} />
          <UsageTile label="החודש הנוכחי" data={usage.monthToDate} />
          <UsageTile label="מאז ומתמיד" data={usage.allTime} />
        </div>

        {usage.creditBank && <CreditBankPanel bank={usage.creditBank} />}

        <p className="text-xs text-muted-foreground">
          העלות היא הערכה מטבלת תמחור סטטית (src/lib/mcp/pricing.ts) ולא חשבונית של Anthropic. חלון
          &quot;החודש הנוכחי&quot; נמדד מתחילת חודש הלוח לפי UTC — הבנק עצמו אינו מתאפס
          בתחילת חודש.
        </p>
      </section>
    </div>
  );
}

function UsageTile({ label, data }: { label: string; data: ClaudeUsageWindow }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      {data ? (
        <>
          <p className="text-2xl font-bold">{formatUsd(data.estimatedCostUsd)}</p>
          <p className="text-sm text-muted-foreground">
            {data.calls.toLocaleString("he-IL")} קריאות
          </p>
        </>
      ) : (
        // One window failing (a missing index is the realistic cause — see
        // src/lib/services/adminClaudeUsage.ts) must not blank the page.
        <p className="pt-1 text-sm text-muted-foreground">לא זמין</p>
      )}
    </div>
  );
}

function CreditBankPanel({ bank }: { bank: ClaudeCreditBank }) {
  const { bankUsd, remainingUsd, usedUsd, balanceReadAt } = bank;
  const pct = (usedUsd / bankUsd) * 100;
  const depleted = remainingUsd <= 0;
  const low = !depleted && remainingUsd < bankUsd * 0.1;
  const rounded = Math.round(pct);
  // aria-valuenow has to stay inside min/max to be valid; the real figure (which
  // can exceed 100 once the bank is overdrawn) is carried by aria-valuetext.
  const clamped = Math.min(100, Math.max(0, rounded));
  const barColor = depleted ? "bg-destructive" : low ? "bg-amber-500" : "bg-primary";

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-sm text-muted-foreground">יתרת קרדיטים משוערת</p>
          <p
            className={`text-2xl font-bold ${depleted ? "text-destructive" : low ? "text-amber-600" : ""}`}
            dir="ltr"
          >
            {formatUsd(remainingUsd)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground" dir="ltr">
          {formatUsd(usedUsd)} / {formatUsd(bankUsd)} ({rounded}%)
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="ניצול בנק הקרדיטים של Claude API"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${rounded}% מהבנק נוצל, נותרו ${formatUsd(remainingUsd)}`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${clamped}%` }} />
      </div>

      {depleted && <p className="mt-2 text-xs text-destructive">הבנק מוצה — יש לטעון קרדיט מחדש.</p>}
      {low && <p className="mt-2 text-xs text-amber-600">נותרו פחות מ-10% מהבנק.</p>}

      {/* The number is only as fresh as the last reading: everything before it is
          taken on faith, everything after it is our own estimate. Saying so is
          what keeps this from being read as the Console's live balance. */}
      <p className="mt-2 text-xs text-muted-foreground">
        מחושב מיתרה שנקראה ב-Claude Console ב-{formatDateTime(balanceReadAt)}, בניכוי העלות
        המשוערת שנרשמה מאז. לדיוק מרבי יש לקרוא את היתרה האמיתית בקונסולה ולעדכן את{" "}
        <span dir="ltr" className="font-mono">
          CLAUDE_CREDIT_BALANCE_USD
        </span>{" "}
        ו-
        <span dir="ltr" className="font-mono">
          CLAUDE_CREDIT_BALANCE_AT
        </span>{" "}
        יחד.
      </p>
    </div>
  );
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
