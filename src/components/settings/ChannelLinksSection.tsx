"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, MessageCircle, RefreshCw, Unlink } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  createChannelLinkCode,
  listMyChannelLinks,
  unlinkMyChannel,
} from "@/actions/channelLink";
import { buildWhatsAppLinkCodeUrl } from "@/lib/whatsapp/deepLink";
import type { ChannelLinkSummary } from "@/types/channelLink";

// What the section keeps in state after issuing a code: only the built
// wa.me URL and its expiry, never the raw code — the UI is link-only
// (issue #39), so there is nothing left for a user to read and retype.
interface IssuedLink {
  url: string;
  expiresAt: string;
}

const CHANNEL_LABELS: Record<ChannelLinkSummary["channel"], string> = {
  whatsapp: "WhatsApp",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

// Phase 5.5.a: the linking flow end to end, with no messaging provider behind
// it yet. Reads go through a Server Action rather than the client SDK because
// channelLinks is Admin-SDK-only in firestore.rules (docs/DATA_MODEL.md), so
// there is no live subscription here — the list is refetched explicitly, since
// the link itself is created out of band (from the chat app) and the browser
// has no way to be notified.
export function ChannelLinksSection() {
  const [links, setLinks] = useState<ChannelLinkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [pending, setPending] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<ChannelLinkSummary | null>(null);

  const applyResult = useCallback((result: ChannelLinkSummary[] | { error: string }) => {
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setLinks(result);
  }, []);

  // The initial load has to reach state only from promise callbacks —
  // react-hooks/set-state-in-effect rejects a setState (or a call into one)
  // in the effect body itself, which is why this is not written as
  // `void reload()`. `cancelled` keeps a late response from a unmounted
  // section out of state.
  useEffect(() => {
    let cancelled = false;
    listMyChannelLinks()
      .then((result) => {
        if (!cancelled) applyResult(result);
      })
      .catch(() => {
        if (!cancelled) toast.error("טעינת הערוצים המקושרים נכשלה");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  async function reload() {
    setLoading(true);
    try {
      applyResult(await listMyChannelLinks());
    } catch (error) {
      reportActionError(error, "טעינת הערוצים המקושרים נכשלה");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCode() {
    setPending(true);
    try {
      const result = await createChannelLinkCode({ channel: "whatsapp" });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const url = buildWhatsAppLinkCodeUrl(result.code);
      if (!url) {
        toast.error("קישור החיבור לא הוגדר. פנו למנהל המערכת.");
        return;
      }
      setIssued({ url, expiresAt: result.expiresAt });
    } catch (error) {
      reportActionError(error, "יצירת קישור החיבור נכשלה");
    } finally {
      setPending(false);
    }
  }

  async function handleUnlink() {
    if (!unlinkTarget) return;
    setPending(true);
    try {
      const result = await unlinkMyChannel({ channelKey: unlinkTarget.channelKey });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הערוץ נותק");
      setUnlinkTarget(null);
      await reload();
    } catch (error) {
      reportActionError(error, "ניתוק הערוץ נכשל");
    } finally {
      setPending(false);
    }
  }

  // Issuing a code while the channel has a still-active link would hand the
  // user a live bearer credential they have no use for (issue #26) — the way
  // to swap numbers is to unlink first. An *expired* link (issue #68, ADR
  // #41) does not count here — that's exactly the renewal case, and this
  // button doubling as "renew" reuses the connect flow with no separate
  // button/dialog. Rendered only once the list has loaded, so the button does
  // not flash in before a known link arrives; the server enforces the same
  // rule anyway (createLinkCodeForUid).
  const hasActiveWhatsAppLink = links.some(
    (link) => link.channel === "whatsapp" && link.status === "active"
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {!loading &&
          (hasActiveWhatsAppLink ? (
            <p className="text-sm text-muted-foreground">
              חשבון WhatsApp כבר מקושר. כדי לקשר מספר אחר, נתקו תחילה את הקישור הקיים.
            </p>
          ) : (
            <Button variant="outline" onClick={() => void handleCreateCode()} disabled={pending}>
              <Link2 className="size-4" />
              חיבור WhatsApp
            </Button>
          ))}

        {issued && !hasActiveWhatsAppLink && (
          // The block appears in response to a click, so it is announced
          // (aria-live) and named (region) rather than dropped in silently.
          // It also disappears once a refresh shows the link landed — a
          // redeemed code is spent, and leaving it on screen invites a retry
          // that can only fail.
          <div
            className="space-y-2 rounded-lg border p-4"
            role="region"
            aria-label="קישור חיבור WhatsApp"
            aria-live="polite"
          >
            <p className="text-sm text-muted-foreground">
              לחצו על הכפתור כדי לפתוח WhatsApp עם הודעה מוכנה למספר של הבוט — שליחתה תקשר את המספר
              שלכם לחשבון:
            </p>
            <Button asChild>
              <a href={issued.url} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" />
                פתיחת WhatsApp
              </a>
            </Button>
            <p className="text-sm text-muted-foreground">
              הקישור תקף עד {formatDateTime(issued.expiresAt)}, לשימוש חד-פעמי. אל תעבירו אותו לאף
              אחד — מי שישלח את ההודעה דרכו יכול לקשר את המספר שלו לחשבון שלכם.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">ערוצים מקושרים</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void reload()}
            disabled={loading}
            aria-label="רענון רשימת הערוצים המקושרים"
          >
            <RefreshCw className="size-4" />
            רענון
          </Button>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            טוען ערוצים מקושרים…
          </p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין ערוצים מקושרים.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => (
              <li
                key={link.channelKey}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{CHANNEL_LABELS[link.channel]}</p>
                  <p className="text-sm text-muted-foreground" dir="ltr">
                    {link.externalId}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    קושר בתאריך {formatDateTime(link.linkedAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {link.lastMessageAt
                      ? `פעילות אחרונה: ${formatDateTime(link.lastMessageAt)}`
                      : "טרם נשלחה הודעה מאז הקישור"}
                  </p>
                  {link.status === "expired" ? (
                    <p className="text-sm font-medium text-destructive">
                      פג תוקף הקישור — לחצו על &quot;חיבור WhatsApp&quot; למעלה כדי לחדש אותו
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      נדרש אימות מחדש עד {formatDateTime(link.reverifyBy)}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUnlinkTarget(link)}
                  disabled={pending}
                >
                  <Unlink className="size-4" />
                  ניתוק
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={unlinkTarget !== null} onOpenChange={(open) => !open && setUnlinkTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ניתוק ערוץ</DialogTitle>
            <DialogDescription>
              {unlinkTarget &&
                `לאחר הניתוק, הודעות מהמספר ${unlinkTarget.externalId} לא יזוהו יותר כשלכם והבוט לא יגיב להן. ניתן לקשר מחדש בכל עת עם קוד חדש.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlinkTarget(null)} disabled={pending}>
              ביטול
            </Button>
            <Button variant="destructive" onClick={() => void handleUnlink()} disabled={pending}>
              ניתוק הערוץ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
