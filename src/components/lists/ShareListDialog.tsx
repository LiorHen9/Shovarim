"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { MessageCircle, Share2, TrashIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListMembers } from "@/hooks/useListMembers";
import { db } from "@/lib/firebase/client";
import { inviteListMember } from "@/actions/listShare";
import {
  cancelMyListInvite,
  createListInviteCode,
  listMyListInvites,
} from "@/actions/listInvite";
import { inviteListMemberSchema, type InviteListMemberInput } from "@/lib/validation/cardListMember";
import {
  createListInviteSchema,
  type CreateListInviteInput,
} from "@/lib/validation/listInvite";
import type { ListMemberRole } from "@/types/cardListMember";
import type { ListInviteSummary } from "@/types/listInvite";

const roleLabelHe: Record<ListMemberRole, string> = {
  manager: "מנהל",
  viewer: "צופה",
};

// wa.me with no phone number opens WhatsApp's contact picker with the message
// pre-filled, so the owner chooses the recipient themselves. Deliberately not
// buildWhatsAppLinkCodeUrl, which always targets the bot's own number.
function buildShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function ShareListDialog({ listId, listName }: { listId: string; listName: string }) {
  const [open, setOpen] = useState(false);
  const { members } = useListMembers(open ? listId : null);
  const [invites, setInvites] = useState<ListInviteSummary[]>([]);
  const [issuedShareUrl, setIssuedShareUrl] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteListMemberInput>({
    resolver: zodResolver(inviteListMemberSchema),
    defaultValues: { listId, email: "", role: "viewer" },
  });

  const phoneForm = useForm<CreateListInviteInput>({
    resolver: zodResolver(createListInviteSchema),
    defaultValues: { listId, phone: "", role: "viewer" },
  });

  // Pending phone invites live in listInviteCodes, which is Admin-SDK-only
  // (ADR #37) — so unlike members there is no live subscription, and the list
  // is refetched explicitly whenever it can have changed.
  const reloadInvites = useCallback(async () => {
    try {
      const result = await listMyListInvites({ listId });
      if ("error" in result) return;
      setInvites(result);
    } catch {
      // Non-fatal: the dialog's primary function is inviting, not listing.
    }
  }, [listId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listMyListInvites({ listId })
      .then((result) => {
        if (!cancelled && !("error" in result)) setInvites(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, listId]);

  async function onInvitePhone(values: CreateListInviteInput) {
    try {
      const result = await createListInviteCode(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setIssuedShareUrl(buildShareUrl(result.shareText));
      phoneForm.reset({ listId, phone: "", role: values.role });
      await reloadInvites();
    } catch {
      toast.error("יצירת ההזמנה נכשלה");
    }
  }

  async function cancelInvite(code: string) {
    try {
      const result = await cancelMyListInvite({ code });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("ההזמנה בוטלה");
      await reloadInvites();
    } catch {
      toast.error("ביטול ההזמנה נכשל");
    }
  }

  async function onInvite(values: InviteListMemberInput) {
    try {
      const result = await inviteListMember(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("ההזמנה נשלחה");
      reset({ listId, email: "", role: "viewer" });
    } catch {
      toast.error("שליחת ההזמנה נכשלה");
    }
  }

  async function changeRole(memberUid: string, role: ListMemberRole) {
    try {
      await updateDoc(doc(db, "cardLists", listId, "members", memberUid), {
        role,
        updatedAt: serverTimestamp(),
      });
      toast.success("ההרשאה עודכנה");
    } catch {
      toast.error("עדכון ההרשאה נכשל");
    }
  }

  async function removeMember(memberUid: string) {
    try {
      await deleteDoc(doc(db, "cardLists", listId, "members", memberUid));
      toast.success("השיתוף בוטל");
    } catch {
      toast.error("ביטול השיתוף נכשל");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="size-4" />
          שיתוף
        </Button>
      </DialogTrigger>
      {/* DialogContent is centered with top-1/2 -translate-y-1/2 and ships with
          neither a max-height nor an overflow (src/components/ui/dialog.tsx), so
          content taller than the viewport is clipped at BOTH ends with no way to
          scroll to it. This dialog grows without bound — two invite forms, the
          issued-invite panel, every pending phone invite and every member — so
          on a short window the "יצירת הזמנה לוואטסאפ" button ends up off-screen
          and the feature looks missing. Scoped here rather than in the shared
          component: the same gap exists in the other dialogs (EditCardDialog is
          the next tallest) and is worth fixing globally, but that is a wider
          change than this one. svh, not vh: on mobile vh ignores the browser
          chrome and would keep part of the dialog unreachable. */}
      <DialogContent className="max-h-[85svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>שיתוף הרשימה &quot;{listName}&quot;</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onInvite)} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email">כתובת אימייל</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="name@example.com"
                {...register("email")}
                aria-describedby={errors.email ? "invite-email-error" : undefined}
              />
              {errors.email && (
                <p id="invite-email-error" role="alert" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="w-28 space-y-1.5">
              <Label htmlFor="invite-role">הרשאה</Label>
              <select
                id="invite-role"
                {...register("role")}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="viewer">צופה</option>
                <option value="manager">מנהל</option>
              </select>
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "שולח..." : "שליחת הזמנה"}
          </Button>
        </form>

        {/* Phone invites (ADR #37, issue #58): the only path that works for
            someone who has no account yet, since the email flow resolves the
            invitee's uid up front and fails without one. */}
        <form
          onSubmit={phoneForm.handleSubmit(onInvitePhone)}
          className="space-y-3 border-t pt-3"
        >
          <p className="text-sm text-muted-foreground">
            או שיתוף בוואטסאפ — גם עם מי שעדיין לא רשום/ה באתר:
          </p>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-phone">מספר טלפון</Label>
              <Input
                id="invite-phone"
                type="tel"
                dir="ltr"
                placeholder="+972501234567"
                {...phoneForm.register("phone")}
                aria-describedby={phoneForm.formState.errors.phone ? "invite-phone-error" : undefined}
              />
              {phoneForm.formState.errors.phone && (
                <p id="invite-phone-error" role="alert" className="text-sm text-destructive">
                  {phoneForm.formState.errors.phone.message}
                </p>
              )}
            </div>
            <div className="w-28 space-y-1.5">
              <Label htmlFor="invite-phone-role">הרשאה</Label>
              <select
                id="invite-phone-role"
                {...phoneForm.register("role")}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="viewer">צופה</option>
                <option value="manager">מנהל</option>
              </select>
            </div>
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={phoneForm.formState.isSubmitting}
            className="w-full"
          >
            <MessageCircle className="size-4" />
            {phoneForm.formState.isSubmitting ? "יוצר..." : "יצירת הזמנה לוואטסאפ"}
          </Button>
        </form>

        {issuedShareUrl && (
          // Appears in response to a click, so it is announced and named.
          <div
            className="space-y-2 rounded-lg border p-3"
            role="region"
            aria-label="הזמנה מוכנה לשליחה"
            aria-live="polite"
          >
            <p className="text-sm text-muted-foreground">
              ההזמנה מוכנה. לחצו כדי לפתוח וואטסאפ עם ההודעה, ובחרו למי לשלוח אותה.
            </p>
            <Button asChild className="w-full">
              <a href={issuedShareUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" />
                פתיחת וואטסאפ
              </a>
            </Button>
            <p className="text-sm text-muted-foreground">
              שלחו את ההודעה רק לבעל/ת המספר שהזנתם — ההצטרפות תושלם רק ממכשיר עם אותו מספר.
            </p>
          </div>
        )}

        {invites.length > 0 && (
          <ul className="space-y-2 border-t pt-3">
            {invites.map((invite) => (
              <li
                key={invite.code}
                className="flex items-center justify-between gap-2 rounded-lg border p-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" dir="ltr">
                    {invite.phone}
                  </p>
                  <Badge variant="secondary">
                    ממתין להצטרפות · {roleLabelHe[invite.role]}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void cancelInvite(invite.code)}
                  aria-label={`ביטול ההזמנה למספר ${invite.phone}`}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {members.length > 0 && (
          <ul className="space-y-2 border-t pt-3">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.email}</p>
                  <Badge variant={member.status === "accepted" ? "default" : "secondary"}>
                    {member.status === "accepted" ? "פעיל" : "ממתין לאישור"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Select
                    value={member.role}
                    onValueChange={(value) => void changeRole(member.memberUid, value as ListMemberRole)}
                  >
                    <SelectTrigger className="h-8 w-24" aria-label={`הרשאת ${member.email}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">{roleLabelHe.viewer}</SelectItem>
                      <SelectItem value="manager">{roleLabelHe.manager}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void removeMember(member.memberUid)}
                    aria-label={`ביטול שיתוף עם ${member.email}`}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            סגירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
