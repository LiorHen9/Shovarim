"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { cancelAccountDeletion } from "@/actions/privacy";
import { getDeletionEligibleAt } from "@/lib/services/accountDeletion";

export function DeletionPendingBanner() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid ?? null);
  const [pending, setPending] = useState(false);

  if (!profile?.deletionRequestedAt) return null;

  const eligibleAt = getDeletionEligibleAt(profile.deletionRequestedAt.toDate());

  async function handleCancel() {
    setPending(true);
    try {
      const result = await cancelAccountDeletion();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("בקשת המחיקה בוטלה");
    } catch {
      toast.error("ביטול בקשת המחיקה נכשל");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive bg-destructive/10 px-4 py-2 text-sm">
      <p>
        החשבון מתוזמן למחיקה בתאריך {eligibleAt.toLocaleDateString("he-IL")} —{" "}
        <a href="/settings" className="underline underline-offset-2">
          פרטים בהגדרות
        </a>
        .
      </p>
      <Button variant="outline" size="sm" onClick={() => void handleCancel()} disabled={pending}>
        ביטול
      </Button>
    </div>
  );
}
