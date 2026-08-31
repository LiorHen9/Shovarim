"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Loader2, MessageCircle, Share2, TrashIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListMembers } from "@/hooks/useListMembers";
import { db } from "@/lib/firebase/client";
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

// wa.me with no phone number opens WhatsApp's contact picker with the message
// pre-filled, so the owner chooses the recipient themselves. Deliberately not
// buildWhatsAppLinkCodeUrl, which always targets the bot's own number.
function buildShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Sharing is one click (ADR #38): the owner names nobody, and the link is minted
// in the background on the way to WhatsApp's contact picker. Everything else
// here is after-the-fact management — who has access, and which links are still
// redeemable.
export function ShareListDialog({ listId, listName }: { listId: string; listName: string }) {
  const [open, setOpen] = useState(false);
  const { members } = useListMembers(open ? listId : null);
  const [invites, setInvites] = useState<ListInviteSummary[]>([]);
  const [sharing, setSharing] = useState(false);
  // Only set when the popup blocker won that round — see handleShare.
  const [blockedShareUrl, setBlockedShareUrl] = useState<string | null>(null);

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

  // The whole point of the button is that one click reaches WhatsApp, but the
  // link does not exist until the server mints it — and a window.open() issued
  // *after* an await has lost the user gesture, which Safari and iOS block
  // outright. So the tab is opened synchronously, still inside the gesture, and
  // navigated once the code arrives. If the browser refused even that
  // (w === null), fall back to a link the user clicks themselves.
  async function handleShare() {
    setSharing(true);
    setBlockedShareUrl(null);
    const popup = window.open("", "_blank");
    try {
      const result = await createListInviteCode({ listId });
      if ("error" in result) {
        popup?.close();
        toast.error(result.error);
        return;
      }

      const shareUrl = buildShareUrl(result.shareText);
      if (popup) {
        popup.location.href = shareUrl;
      } else {
        setBlockedShareUrl(shareUrl);
      }
      await reloadInvites();
    } catch {
      popup?.close();
      toast.error("יצירת קישור השיתוף נכשלה");
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
    } catch {
      toast.error("ביטול הלינק נכשל");
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
            כל שיתוף יוצר לינק חד-פעמי שתקף ל-48 שעות. מי שמקבל אותו מצטרף כצופה, ואפשר לשנות את
            ההרשאה כאן אחרי ההצטרפות.
          </DialogDescription>
        </DialogHeader>

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
          disabled={sharing}
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
              הדפדפן חסם את פתיחת וואטסאפ. הלינק נוצר — לחצו כאן כדי לפתוח אותו ולבחור נמען.
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
                      second redeemable credential for the same recipient. */}
                  <Button asChild variant="ghost" size="icon-sm">
                    <a
                      href={buildShareUrl(invite.shareText)}
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
