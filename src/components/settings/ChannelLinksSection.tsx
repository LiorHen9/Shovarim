"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";

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
import type { ChannelLinkSummary, IssuedLinkCode } from "@/types/channelLink";

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
  const [issued, setIssued] = useState<IssuedLinkCode | null>(null);
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
    } catch {
      toast.error("טעינת הערוצים המקושרים נכשלה");
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
      setIssued(result);
    } catch {
      toast.error("יצירת קוד הקישור נכשלה");
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
    } catch {
      toast.error("ניתוק הערוץ נכשל");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Button variant="outline" onClick={() => void handleCreateCode()} disabled={pending}>
          <Link2 className="size-4" />
          חיבור WhatsApp
        </Button>

        {issued && (
          // The block appears in response to a click, so it is announced
          // (aria-live) and named (region) rather than dropped in silently.
          <div
            className="space-y-2 rounded-lg border p-4"
            role="region"
            aria-label="קוד קישור WhatsApp"
            aria-live="polite"
          >
            <p className="text-sm text-muted-foreground">
              שלחו את הקוד הבא בהודעת WhatsApp למספר של הבוט, כדי לקשר את המספר שלכם לחשבון:
            </p>
            <code className="block font-mono text-2xl font-bold tracking-[0.3em]" dir="ltr">
              {issued.code}
            </code>
            <p className="text-sm text-muted-foreground">
              הקוד תקף עד {formatDateTime(issued.expiresAt)}, לשימוש חד-פעמי. אל תעבירו אותו לאף אחד
              — מי שמחזיק בקוד יכול לקשר את המספר שלו לחשבון שלכם.
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
