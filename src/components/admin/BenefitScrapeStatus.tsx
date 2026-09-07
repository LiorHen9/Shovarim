"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FunctionsError, httpsCallable } from "firebase/functions";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { functions } from "@/lib/firebase/client";
import type { ClubScrapeStatus, SerializedRun } from "@/lib/services/adminBenefits";

// Straight to the Cloud Function rather than through a Server Action, for the
// same reason UserDeletionSection calls adminDeleteUserNow directly: the
// scrape lives in functions/ (it is what the scheduler triggers) and
// functions/tsconfig.json's rootDir keeps it out of reach from src/actions/.
// The callable verifies the admin role itself.
const adminScrapeBenefitsNow = httpsCallable<
  { clubId?: string },
  { outcomes: Array<{ clubId: string; status: string; written: number; deleted: number }> }
>(functions, "adminScrapeBenefitsNow");

const STATUS_LABELS: Record<SerializedRun["status"], string> = {
  running: "רץ כעת",
  success: "הצליח",
  aborted: "בוטל",
  failed: "נכשל",
};

const STATUS_VARIANTS: Record<SerializedRun["status"], "default" | "secondary" | "destructive" | "outline"> =
  {
    running: "secondary",
    success: "default",
    // "aborted" is deliberately not destructive: the run refused to overwrite
    // and the previous data survived intact, which is the guard working, not a
    // failure. Showing it in red would train an admin to ignore real ones.
    aborted: "outline",
    failed: "destructive",
  };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

export function BenefitScrapeStatus({ statuses }: { statuses: ClubScrapeStatus[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function runScrape(clubId?: string) {
    setBusy(clubId ?? "__all__");
    try {
      const result = await adminScrapeBenefitsNow(clubId ? { clubId } : {});
      const outcomes = result.data.outcomes ?? [];
      const written = outcomes.reduce((sum, outcome) => sum + outcome.written, 0);
      const deleted = outcomes.reduce((sum, outcome) => sum + outcome.deleted, 0);
      const stalled = outcomes.filter((outcome) => outcome.status !== "success");

      // A run that aborted still "succeeded" as an HTTP call, so reporting
      // only the totals would show a cheerful green toast for a scrape that
      // deliberately wrote nothing.
      if (stalled.length > 0) {
        toast.warning(
          `הסתיים עם בעיות: ${stalled.map((outcome) => `${outcome.clubId} (${outcome.status})`).join(", ")}`
        );
      } else {
        toast.success(`נשמרו ${written} הטבות, נמחקו ${deleted} שאריות`);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof FunctionsError ? error.message : "הסריקה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  const anyBusy = busy !== null;
  const scrapeable = statuses.filter((status) => status.unsupportedReason === null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {scrapeable.length} מתוך {statuses.length} מועדונים ניתנים לסריקה.
        </p>
        <Button onClick={() => void runScrape()} disabled={anyBusy}>
          {busy === "__all__" ? "סורק..." : "הרץ הכל עכשיו"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">סטטוס סריקת ההטבות לכל מועדון</caption>
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="p-3 text-start font-medium">
                מועדון
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                הטבות שמורות
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                תקרה
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                ריצה אחרונה
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                <span className="sr-only">פעולות</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((status) => (
              <tr key={status.clubId} className="border-t align-top">
                <th scope="row" className="p-3 text-start font-medium">
                  {status.clubName}
                  {status.unsupportedReason && (
                    <p className="mt-1 max-w-xs text-xs font-normal text-muted-foreground">
                      {status.unsupportedReason}
                    </p>
                  )}
                </th>

                <td className="p-3 tabular-nums">{status.benefitCount.toLocaleString("he-IL")}</td>

                <td className="p-3 tabular-nums">
                  {status.benefitScrapeLimit === 0 ? "ללא הגבלה" : status.benefitScrapeLimit}
                </td>

                <td className="p-3">
                  <RunSummary run={status.lastRun} />
                </td>

                <td className="p-3 text-end">
                  {status.unsupportedReason === null && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={anyBusy}
                      onClick={() => void runScrape(status.clubId)}
                    >
                      {busy === status.clubId ? "סורק..." : "הרץ"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunSummary({ run }: { run: SerializedRun | null }) {
  if (!run) return <span className="text-muted-foreground">טרם רץ</span>;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANTS[run.status]}>{STATUS_LABELS[run.status]}</Badge>
        <span className="text-xs text-muted-foreground">{formatDateTime(run.startedAt)}</span>
      </div>

      <p className="text-xs text-muted-foreground tabular-nums">
        {/* sourceTotal alongside written is what makes the cap legible: "50
            נשמרו מתוך 7,099" reads very differently from "50 נשמרו". */}
        נשמרו {run.written.toLocaleString("he-IL")} מתוך {run.sourceTotal.toLocaleString("he-IL")} במקור
        {run.deleted > 0 && ` · נמחקו ${run.deleted.toLocaleString("he-IL")} שאריות`}
        {run.cappedBy === "club" && " · נעצר בתקרת המועדון"}
        {run.cappedBy === "card" && " · נעצר בתקרת הכרטיס"}
      </p>

      {/* Amber with an explicit dark pair, following OfflineBanner: a bare
          text-amber-600 fails contrast on the dark theme, which the axe scan
          in tests/e2e/accessibility.spec.ts covers for this page. */}
      {run.abortReason && (
        <p className="max-w-sm text-xs text-amber-700 dark:text-amber-300">{run.abortReason}</p>
      )}

      {run.errors.map((error, index) => (
        // Indexed because a run can legitimately record the same message
        // twice (two categories failing the same way), and the list is
        // rebuilt wholesale on every refresh rather than reordered.
        <p key={`${index}-${error}`} className="max-w-sm text-xs text-destructive">
          {error}
        </p>
      ))}
    </div>
  );
}
