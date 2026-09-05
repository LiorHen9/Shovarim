import Link from "next/link";

import { formatUsd } from "@/lib/format";
import {
  getClaudeUsageOverview,
  type ClaudeUsageWindow,
} from "@/lib/services/adminClaudeUsage";

// Foundations shell (docs/DECISIONS.md ADR #42, docs/ROADMAP.md Phase 9.1),
// now carrying the Claude spend overview (Phase 9.6 layer 1 — Firestore
// aggregations only, no new infrastructure). Access is already gated by
// admin/layout.tsx.
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

        {usage.monthlyBudgetUsd !== null && usage.monthToDate && (
          <BudgetBar spent={usage.monthToDate.estimatedCostUsd} budget={usage.monthlyBudgetUsd} />
        )}

        <p className="text-xs text-muted-foreground">
          העלות היא הערכה מטבלת תמחור סטטית (src/lib/mcp/pricing.ts) ולא חשבונית של Anthropic. חלון
          &quot;החודש הנוכחי&quot; נמדד מתחילת חודש הלוח לפי UTC.
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

function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const pct = (spent / budget) * 100;
  const over = pct > 100;
  const rounded = Math.round(pct);
  // aria-valuenow has to stay inside min/max to be valid; the real figure (which
  // can exceed 100) is carried by aria-valuetext and the visible label.
  const clamped = Math.min(100, Math.max(0, rounded));

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-baseline justify-between gap-4 text-sm">
        <span className="text-muted-foreground">ניצול תקציב חודשי</span>
        <span dir="ltr" className={over ? "font-medium text-destructive" : "font-medium"}>
          {formatUsd(spent)} / {formatUsd(budget)} ({rounded}%)
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="ניצול התקציב החודשי של Claude API"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${rounded}% מתוך התקציב החודשי`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {over && <p className="mt-2 text-xs text-destructive">חריגה מהתקציב החודשי המוגדר.</p>}
    </div>
  );
}
