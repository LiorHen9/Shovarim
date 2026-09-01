"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  blockUserAction,
  unblockUserAction,
  blockEmailAction,
  unblockEmailAction,
  blockPhoneAction,
  unblockPhoneAction,
} from "@/actions/adminModeration";
import type { ActionResult } from "@/lib/actions/errors";
import type { AdminUserDetail } from "@/lib/services/adminUsers";

// Block/unblock UI for a single user (docs/ROADMAP.md Phase 9.3). Only the
// account-level block (Auth disable+revoke, via blockUserAction) asks for a
// reason through a confirm dialog — it's the highest-impact action here.
// Blocking a specific email/phone is a lower-stakes, reversible, single-click
// action with a canned reason, same proportionality as unblock everywhere
// below needing no confirmation at all.
export function UserModerationSection({
  uid,
  email,
  moderation,
  emailBlocked,
  channelLinks,
}: {
  uid: string;
  email: string;
  moderation: AdminUserDetail["moderation"];
  emailBlocked: boolean;
  channelLinks: AdminUserDetail["channelLinks"];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [reason, setReason] = useState("");

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

  async function handleBlockUser() {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("יש לציין סיבה");
      return;
    }
    await run(() => blockUserAction({ uid, reason: trimmed }), "המשתמש נחסם");
    setBlockDialogOpen(false);
    setReason("");
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h2 className="font-semibold">חסימה</h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm">
            סטטוס חשבון:{" "}
            {moderation.blocked ? <Badge variant="destructive">חסום</Badge> : <Badge variant="outline">פעיל</Badge>}
          </p>
          {moderation.blocked && moderation.reason && (
            <p className="text-sm text-muted-foreground">סיבה: {moderation.reason}</p>
          )}
        </div>
        {moderation.blocked ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => void run(() => unblockUserAction(uid), "המשתמש שוחרר")}
          >
            שחרור חסימה
          </Button>
        ) : (
          <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={pending}>
                חסימת משתמש
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>חסימת משתמש</DialogTitle>
                <DialogDescription>
                  החשבון יושבת מיידית (Auth disable + ביטול הפעלות קיימות) — כניסה נוכחית מפסיקה לעבוד בבקשה
                  הבאה. ניתן לשחרר חסימה בכל עת.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="סיבת החסימה"
                aria-label="סיבת החסימה"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setBlockDialogOpen(false)} disabled={pending}>
                  ביטול
                </Button>
                <Button variant="destructive" onClick={() => void handleBlockUser()} disabled={pending}>
                  חסימה
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 border-t pt-3">
        <p className="text-sm">
          אימייל ({email}):{" "}
          {emailBlocked ? <Badge variant="destructive">חסום</Badge> : <Badge variant="outline">לא חסום</Badge>}
        </p>
        {emailBlocked ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void run(() => unblockEmailAction(email), "האימייל שוחרר")}
          >
            שחרור
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              void run(() => blockEmailAction({ email, reason: "נחסם דרך עמוד המשתמש" }), "האימייל נחסם")
            }
          >
            חסימת אימייל
          </Button>
        )}
      </div>

      {channelLinks.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">ערוצי הודעות</p>
          {channelLinks.map((link) => (
            <div key={link.channelKey} className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground" dir="ltr">
                {link.externalId}
              </p>
              {link.phoneBlocked ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => void run(() => unblockPhoneAction(link.externalId), "המספר שוחרר")}
                >
                  שחרור
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      () => blockPhoneAction({ phone: link.externalId, reason: "נחסם דרך עמוד המשתמש" }),
                      "המספר נחסם"
                    )
                  }
                >
                  חסימת מספר
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
