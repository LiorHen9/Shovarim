"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { reportActionError } from "@/lib/actions/clientErrors";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { requestAccountDeletion, cancelAccountDeletion } from "@/actions/privacy";
import { GRACE_PERIOD_DAYS, getDeletionEligibleAt } from "@/lib/services/accountDeletion";

export function DeleteAccountSection() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid ?? null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleRequest() {
    setPending(true);
    try {
      const result = await requestAccountDeletion();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("בקשת המחיקה נקלטה");
      setOpen(false);
    } catch (error) {
      reportActionError(error, "בקשת המחיקה נכשלה");
    } finally {
      setPending(false);
    }
  }

  async function handleCancel() {
    setPending(true);
    try {
      const result = await cancelAccountDeletion();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("בקשת המחיקה בוטלה");
    } catch (error) {
      reportActionError(error, "ביטול בקשת המחיקה נכשל");
    } finally {
      setPending(false);
    }
  }

  if (profile?.deletionRequestedAt) {
    const eligibleAt = getDeletionEligibleAt(profile.deletionRequestedAt.toDate());
    return (
      <div className="space-y-2 rounded-lg border border-destructive p-4">
        <p className="font-medium text-destructive">החשבון מתוזמן למחיקה</p>
        <p className="text-sm text-muted-foreground">
          החשבון וכל הנתונים בו יימחקו לצמיתות בתאריך {eligibleAt.toLocaleDateString("he-IL")}. ניתן לבטל
          עד אז.
        </p>
        <Button variant="outline" onClick={() => void handleCancel()} disabled={pending}>
          ביטול בקשת המחיקה
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="size-4" />
          מחיקת החשבון
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מחיקת חשבון</DialogTitle>
          <DialogDescription>
            הפעולה תתזמן מחיקה לצמיתות של כל הכרטיסים, יומני השימושים, הרשימות והתמונות שלך, בעוד{" "}
            {GRACE_PERIOD_DAYS} יום. עד אז ניתן לבטל בכל עת מעמוד ההגדרות. לאחר שהחלון חולף, המחיקה
            סופית ולא ניתנת לשחזור.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            ביטול
          </Button>
          <Button variant="destructive" onClick={() => void handleRequest()} disabled={pending}>
            תזמון מחיקת החשבון
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
