"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

import { reportActionError } from "@/lib/actions/clientErrors";
import { Loader2, MessageCircle, Share2, TrashIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListMembers } from "@/hooks/useListMembers";
import { db } from "@/lib/firebase/client";
import { ilPhoneSchema } from "@/lib/validation/channelLink";
import { createListInviteSchema } from "@/lib/validation/listInvite";
import {
  cancelMyListInvite,
  createListInviteCode,
  listMyListInvites,
} from "@/actions/listInvite";
import type { CardListMember, ListMemberRole } from "@/types/cardListMember";
import type { ListInviteSummary } from "@/types/listInvite";

const roleLabelHe: Record<ListMemberRole, string> = {
  manager: "מנהל",
  viewer: "צופה",
};

// wa.me addressed to the invited number opens that one chat directly, with no
// recipient picker in between — so the message cannot land anywhere except the
// number the invite is actually bound to. Digits only, no leading "+": wa.me
// rejects the plus. Deliberately not buildWhatsAppLinkCodeUrl, which always
// targets the bot's own number.
//
// A null phone is an ADR #38 bearer leftover; it degrades to the picker the
// same way it always behaved, which is the only thing that makes sense for a
// link addressed to nobody.
function buildShareUrl(phone: string | null, text: string): string {
  const to = phone ? phone.replace(/\D/g, "") : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Sharing takes one number and one click (ADR #39): the owner types the
// recipient's Israeli mobile, and the link is minted in the background on the
// way to that person's WhatsApp chat. The number is what binds the invite —
// only an account that has proved it can accept — so it is the one thing the
// owner has to supply. Everything else here is after-the-fact management: who
// has access, and which links are still redeemable.
export function ShareListDialog({ listId, listName }: { listId: string; listName: string }) {
  const [open, setOpen] = useState(false);
  const { members } = useListMembers(open ? listId : null);
  const [invites, setInvites] = useState<ListInviteSummary[]>([]);
  const [sharing, setSharing] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const phoneFieldId = useId();
  // Only set when the popup blocker won that round — see handleShare.
  const [blockedShareUrl, setBlockedShareUrl] = useState<string | null>(null);

  // Same normalization the server applies (ilPhoneSchema → E.164), so a typed
  // number can be compared against the phone already stored on members/invites
  // without waiting for a round trip. null while the field isn't a valid
  // number yet — no duplicate check runs until it is.
  const normalizedPhone = useMemo(() => {
    const parsed = ilPhoneSchema.safeParse(phone);
    return parsed.success ? parsed.data : null;
  }, [phone]);

  // Blocks the share: createListInvite (listInvites.ts) rejects this exact
  // case server-side regardless, but member.phone is only set at accept time
  // (CardListMember.phone) so this pre-check can miss older members who joined
  // before that field existed — a false negative here just falls back to the
  // server's toast, never a false positive that blocks a share the server
  // would allow.
  const isDuplicateMember = normalizedPhone !== null && members.some((member) => member.phone === normalizedPhone);

  // Not a block — re-sharing the same number supersedes the existing link by
  // design (ADR #37/#39, "resend" not "a second live code"). This is only a
  // heads-up before that happens.
  const duplicateInvite =
    !isDuplicateMember && normalizedPhone !== null
      ? invites.find((invite) => invite.phone === normalizedPhone)
      : undefined;

  // Invites live in listInviteCodes, which is Admin-SDK-only (ADR #37) — so
  // unlike members there is no live subscription, and the list is refetched
  // explicitly whenever it can have changed.
  const reloadInvites = useCallback(async () => {
    try {
      const result = await listMyListInvites({ listId });
      if ("error" in result) return;
      setInvites(result);
    } catch {
      // Non-fatal: the dialog's primary function is sharing, not listing.
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

  // The whole point of the button is that one click reaches the recipient's
  // chat, but the link does not exist until the server mints it — and a
  // window.open() issued *after* an await has lost the user gesture, which
  // Safari and iOS block outright. An async function still runs synchronously
  // up to its first await, so validation and window.open both happen inside the
  // gesture, and the tab is navigated once the code arrives. If the browser
  // refused even that (popup === null), fall back to a link the user clicks.
  //
  // This is also why the field is hand-rolled instead of react-hook-form as the
  // rest of the project's forms are: handleSubmit resolves a promise before
  // calling the handler, which would put window.open on the far side of an
  // await and hand it straight to the popup blocker. The shared Zod schema —
  // the part that actually matters, since the action re-parses the same one
  // server-side (ADR #25) — is still the single source of truth, and safeParse
  // is synchronous.
  async function handleShare() {
    const parsed = createListInviteSchema.safeParse({ listId, phone });
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0]?.message ?? "מספר טלפון לא תקין");
      return;
    }
    setPhoneError(null);
    setSharing(true);
    setBlockedShareUrl(null);
    const popup = window.open("", "_blank");
    try {
      const result = await createListInviteCode({ listId, phone });
      if ("error" in result) {
        popup?.close();
        toast.error(result.error);
        return;
      }

      // result.phone, not the field: the server normalized it, and the chat
      // opened has to be the one the invite was actually bound to.
      const shareUrl = buildShareUrl(result.phone, result.shareText);
      if (popup) {
        popup.location.href = shareUrl;
      } else {
        setBlockedShareUrl(shareUrl);
      }
      setPhone("");
      await reloadInvites();
    } catch (error) {
      popup?.close();
      reportActionError(error, "יצירת קישור השיתוף נכשלה");
    } finally {
      setSharing(false);
    }
  }

  async function cancelInvite(code: string) {
    try {
      const result = await cancelMyListInvite({ code });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הלינק בוטל");
      await reloadInvites();
    } catch (error) {
      reportActionError(error, "ביטול הלינק נכשל");
    }
  }

  async function changeRole(memberUid: string, role: ListMemberRole) {
    try {
      await updateDoc(doc(db, "cardLists", listId, "members", memberUid), {
        role,
        updatedAt: serverTimestamp(),
      });
      toast.success("ההרשאה עודכנה");
    } catch (error) {
      reportActionError(error, "עדכון ההרשאה נכשל");
    }
  }

  async function removeMember(memberUid: string) {
    try {
      await deleteDoc(doc(db, "cardLists", listId, "members", memberUid));
      toast.success("השיתוף בוטל");
    } catch (error) {
      reportActionError(error, "ביטול השיתוף נכשל");
    }
  }

  // Members created by the removed email flow (ADR #15) sit at "pending" until
  // the invitee accepts from /cards. No new ones are created, but the existing
  // ones stay actionable and so are still shown apart from active shares.
  const active = members.filter((member) => member.status === "accepted");
  const pending = members.filter((member) => member.status !== "accepted");

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
          scroll to it. This dialog grows without bound — every member and every
          open link — so on a short window the lower sections end up off-screen
          and look missing. Scoped here rather than in the shared component: the
          same gap exists in the other dialogs (EditCardDialog is the next
          tallest) and is worth fixing globally, but that is a wider change than
          this one. svh, not vh: on mobile vh ignores the browser chrome and
          would keep part of the dialog unreachable. */}
      <DialogContent className="max-h-[85svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>שיתוף הרשימה &quot;{listName}&quot;</DialogTitle>
          <DialogDescription>
            הזינו את מספר הטלפון של מי שאיתו תרצו לשתף. הלינק שייווצר משויך למספר הזה בלבד וניתן
            לשימוש חד-פעמי תוך 48 שעות — גם אם הוא יגיע לגורם אחר, רק חשבון שמקושר למספר יוכל לאשר.
            המצטרף מקבל הרשאת צופה, ואפשר לשנות אותה כאן אחרי ההצטרפות.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={phoneFieldId}>מספר הטלפון של הנמען</Label>
          {/* dir="ltr" on the field only: the dialog is RTL, but a phone number
              read right-to-left is a different number. type="tel" rather than
              "number" — a number input strips the leading zero and offers
              spinners that mean nothing here. */}
          <Input
            id={phoneFieldId}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              setPhoneError(null);
            }}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            dir="ltr"
            placeholder="0501234567"
            disabled={sharing}
            aria-invalid={phoneError !== null || isDuplicateMember}
            aria-describedby={
              phoneError || isDuplicateMember
                ? `${phoneFieldId}-error`
                : duplicateInvite
                  ? `${phoneFieldId}-hint ${phoneFieldId}-notice`
                  : `${phoneFieldId}-hint`
            }
          />
          {phoneError || isDuplicateMember ? (
            <p id={`${phoneFieldId}-error`} role="alert" className="text-sm text-destructive">
              {phoneError ?? "הרשימה כבר משותפת עם המספר הזה"}
            </p>
          ) : (
            <p id={`${phoneFieldId}-hint`} className="text-sm text-muted-foreground">
              10 ספרות, ללא קידומת מדינה וללא מקפים או רווחים.
            </p>
          )}
          {/* Non-blocking: re-sharing supersedes the existing link rather than
              being refused (ADR #37/#39) — this just tells the owner what the
              click is about to do before they make it. */}
          {duplicateInvite && (
            <p id={`${phoneFieldId}-notice`} className="text-sm text-muted-foreground">
              כבר יש לינק פתוח למספר הזה, בתוקף עד {formatExpiry(duplicateInvite.expiresAt)}. שיתוף ישלח לינק
              חדש במקומו.
            </p>
          )}
        </div>

        {/* No green variant exists in ui/button.tsx and one brand-coloured
            button does not justify adding one. #128C7E is WhatsApp's dark brand
            green rather than the familiar #25D366: the light green carries only
            ~1.8:1 against white text, well under the 4.5:1 that
            docs/ACCESSIBILITY.md requires, while this clears it in both themes. */}
        {/* aria-label extends the visible text rather than replacing it: the
            dialog trigger is also called "שיתוף", and two identically named
            buttons on the same screen are ambiguous to anyone navigating by
            name. WCAG 2.5.3 is satisfied because the accessible name still
            contains the visible label. */}
        <Button
          onClick={() => void handleShare()}
          disabled={sharing || isDuplicateMember}
          aria-label="שיתוף בוואטסאפ"
          className="w-full bg-[#128C7E] text-white hover:bg-[#0f7168] focus-visible:ring-[#128C7E]"
        >
          {sharing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <MessageCircle className="size-4" aria-hidden="true" />
          )}
          שיתוף
        </Button>

        {blockedShareUrl && (
          <div
            className="space-y-2 rounded-lg border p-3"
            role="region"
            aria-label="הלינק מוכן לשליחה"
            aria-live="polite"
          >
            <p className="text-sm text-muted-foreground">
              הדפדפן חסם את פתיחת וואטסאפ. הלינק נוצר — לחצו כאן כדי לפתוח את הצ&apos;אט עם הנמען.
            </p>
            <Button asChild variant="outline" className="w-full">
              <a href={blockedShareUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" aria-hidden="true" />
                פתיחת וואטסאפ
              </a>
            </Button>
          </div>
        )}

        {active.length > 0 && (
          <Section title="שיתופים פעילים">
            {active.map((member) => (
              <MemberRow key={member.id} member={member}>
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
              </MemberRow>
            ))}
          </Section>
        )}

        {pending.length > 0 && (
          <Section title="ממתינים לאישור">
            {pending.map((member) => (
              <MemberRow key={member.id} member={member}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void removeMember(member.memberUid)}
                  aria-label={`ביטול ההזמנה של ${member.email}`}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </MemberRow>
            ))}
          </Section>
        )}

        {invites.length > 0 && (
          <Section title="לינקים פתוחים">
            {invites.map((invite) => (
              <li
                key={invite.code}
                className="flex items-center justify-between gap-2 rounded-lg border p-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {invite.phone ? (
                      <span dir="ltr">{invite.phone}</span>
                    ) : (
                      "לינק שטרם נוצל"
                    )}
                  </p>
                  <Badge variant="secondary">בתוקף עד {formatExpiry(invite.expiresAt)}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  {/* Reopens the link that already exists instead of minting a
                      second one, which would supersede it and kill a link the
                      recipient may already be holding. */}
                  <Button asChild variant="ghost" size="icon-sm">
                    <a
                      href={buildShareUrl(invite.phone, invite.shareText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="פתיחת הלינק בוואטסאפ"
                    >
                      <MessageCircle className="size-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void cancelInvite(invite.code)}
                    aria-label="ביטול הלינק"
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t pt-3">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function MemberRow({
  member,
  children,
}: {
  member: CardListMember;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border p-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{member.email}</p>
        {/* Absent for members who joined before the field existed, or who have
            no linked WhatsApp number — the row is still complete without it. */}
        {member.phone && (
          <p className="truncate text-sm text-muted-foreground" dir="ltr">
            {member.phone}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">{children}</div>
    </li>
  );
}
