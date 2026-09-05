"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { reportActionError } from "@/lib/actions/clientErrors";

import { Button } from "@/components/ui/button";
import { exportUserData } from "@/actions/privacy";

export function ExportDataButton() {
  const [pending, setPending] = useState(false);

  async function handleExport() {
    setPending(true);
    try {
      const result = await exportUserData();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `shovarim-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("הנתונים יוצאו בהצלחה");
    } catch (error) {
      // Anything reaching here is a *thrown* Server Action error, not an
      // ActionError (those come back as `{ error }` above). The stale-action-id
      // case (ADR #32) used to be indistinguishable from a server crash here,
      // which is why the digest was surfaced at all; reportActionError now tells
      // the two apart and handles the stale one with its own message. What is
      // left is a genuine server-side failure, whose message Next redacts in
      // production leaving only `digest` — the id of the matching log line.
      console.error("[export] Server Action failed", error);
      const digest =
        typeof error === "object" && error !== null && "digest" in error
          ? String((error as { digest: unknown }).digest)
          : null;
      reportActionError(
        error,
        digest ? `ייצוא הנתונים נכשל (קוד שגיאה ${digest})` : "ייצוא הנתונים נכשל",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" onClick={() => void handleExport()} disabled={pending}>
      <Download className="size-4" />
      ייצוא כל הנתונים שלי (JSON)
    </Button>
  );
}
