"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FunctionsError, httpsCallable } from "firebase/functions";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { adminScheduleUserDeletionAction, adminCancelUserDeletionAction } from "@/actions/adminDeletion";
import { functions } from "@/lib/firebase/client";
import { GRACE_PERIOD_DAYS, getDeletionEligibleAt } from "@/lib/services/accountDeletion";
import type { ActionResult } from "@/lib/actions/errors";
import type { UserProfile } from "@/types/user";

// Immediate deletion goes straight from this client component to the Cloud
// Function (docs/ROADMAP.md Phase 9.4, docs/DECISIONS.md ADR #45) — not a
// Server Action — because functions/tsconfig.json's rootDir keeps
// deleteUserAccount() out of reach from src/actions/. The callable verifies
// admin status itself server-side, same as every Server Action's requireAdmin().
const adminDeleteUserNow = httpsCallable<{ uid: string }, void>(functions, "adminDeleteUserNow");

export function UserDeletionSection({
  uid,
  email,
  deletionRequestedAt,
}: {
  uid: string;
  email: string;
  deletionRequestedAt: UserProfile["deletionRequestedAt"];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function run(action: () => Promise<ActionResult<{ success: true }>>, successMessage: string) {
    setPending(true);
    try {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("הפעולה נכשלה");
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteNow() {
    setPending(true);
    try {
      await adminDeleteUserNow({ uid });
      toast.success("המשתמש נמחק לצמיתות");
      // The user doc this page reads no longer exists — router.refresh()
      // would just 404 here, so leave the (now-deleted) detail page instead.
      router.push("/admin/users");
    } catch (error) {
      const message = error instanceof FunctionsError ? error.message : "המחיקה נכשלה";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h2 className="font-semibold">מחיקה</h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm">
            סטטוס:{" "}
            {deletionRequestedAt ? (
              <Badge variant="destructive">מחיקה מתוזמנת</Badge>
            ) : (
              <Badge variant="outline">פעיל</Badge>
            )}
          </p>
          {deletionRequestedAt && (
            <p className="text-sm text-muted-foreground">
              יימחק לצמיתות בתאריך{" "}
              {getDeletionEligibleAt(deletionRequestedAt.toDate()).toLocaleDateString("he-IL")}
            </p>
          )}
        </div>
        {deletionRequestedAt ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => void run(() => adminCancelUserDeletionAction(uid), "בקשת המחיקה בוטלה")}
          >
            ביטול מחיקה מתוזמנת
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => void run(() => adminScheduleUserDeletionAction(uid), "המחיקה תוזמנה")}
          >
            תזמון מחיקה ({GRACE_PERIOD_DAYS} יום)
          </Button>
        )}
      </div>

      <div className="border-t pt-3">
        <Dialog
          open={confirmOpen}
          onOpenChange={(open) => {
            setConfirmOpen(open);
            if (!open) setConfirmText("");
          }}
        >
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={pending}>
              מחיקה מיידית
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>מחיקה מיידית וסופית</DialogTitle>
              <DialogDescription>
                הפעולה מוחקת מיד, לצמיתות וללא אפשרות שחזור, את כל הכרטיסים, הרשימות, יומני השימוש
                והתמונות של המשתמש, וכן את חשבון ה-Auth שלו. כדי לאשר, יש להקליד את כתובת האימייל של
                המשתמש: <span dir="ltr">{email}</span>
              </DialogDescription>
            </DialogHeader>
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={email}
              aria-label="אימות כתובת אימייל למחיקה מיידית"
              dir="ltr"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
                ביטול
              </Button>
              <Button
                variant="destructive"
                disabled={pending || confirmText.trim() !== email}
                onClick={() => void handleDeleteNow()}
              >
                מחיקה סופית
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
