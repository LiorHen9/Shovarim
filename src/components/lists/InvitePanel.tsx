"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, LogIn, MessageCircle, RefreshCw, X } from "lucide-react";
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
import { acceptInvite, declineInvite, getInviteGate } from "@/actions/listInvite";
import { createChannelLinkCode } from "@/actions/channelLink";
import { buildWhatsAppLinkCodeUrl } from "@/lib/whatsapp/deepLink";
import type { ListInviteGate, ListInvitePreview } from "@/types/listInvite";

const ROLE_LABELS = {
  manager: "מנהל/ת (הוספה, עריכה ומחיקה של כרטיסים)",
  viewer: "צופה (צפייה בלבד)",
} as const;

// How long to keep re-checking whether the number got linked. The link code
// itself expires in 10 minutes, but anyone who is going to send the WhatsApp
// message does so within a minute or two of leaving this tab; past that the
// manual button is the right affordance rather than a timer nobody is watching.
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

// The invite landing UI (ADR #39). Joining takes two proofs, and this screen is
// where the second one is collected: signing in says which account, and linking
// the WhatsApp number the invite was addressed to is what authorizes the join
// at all — holding the link is not enough. Both steps try to get out of the
// way, and the accept/decline choice is a dialog that opens by itself the
// moment they are done.
export function InvitePanel({
  preview,
  initialGate,
  signedIn,
}: {
  preview: ListInvitePreview;
  initialGate: ListInviteGate | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [gate, setGate] = useState<ListInviteGate | null>(initialGate);
  const [pending, setPending] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  // Why the WhatsApp link never appeared. Without this the panel showed
  // "preparing the link" indefinitely for every failure — which is how a
  // production dead end went unreported until a real invitee hit it.
  const [linkError, setLinkError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(initialGate === "ready");

  const terminal = preview.status !== "pending" || preview.expired;

  // Shared by the poll and the manual button; only the latter says anything out
  // loud, since a background check that finds nothing is not news.
  const checkGate = useCallback(
    async (announce: boolean) => {
      try {
        const result = await getInviteGate({ code: preview.code });
        if ("error" in result) {
          if (announce) toast.error(result.error);
          return;
        }
        setGate(result.gate);
        if (result.gate === "ready") {
          setLinkUrl(null);
          setConfirmOpen(true);
        } else if (announce) {
          toast.info("המספר עדיין לא מקושר. שלחו את ההודעה בוואטסאפ ונסו שוב.");
        }
      } catch {
        if (announce) toast.error("בדיקת מצב הקישור נכשלה");
      }
    },
    [preview.code]
  );

  async function refreshGate() {
    setPending(true);
    try {
      await checkGate(true);
    } finally {
      setPending(false);
    }
  }

  // Issued on arrival rather than behind a first click, so the screen the
  // invitee lands on already offers the single button that matters. The code is
  // short-lived and supersedes any earlier one for this user, so minting it
  // eagerly costs nothing.
  useEffect(() => {
    if (!signedIn || gate !== "needs_channel_link" || linkUrl !== null) return;
    let cancelled = false;
    createChannelLinkCode({ channel: "whatsapp" })
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) {
          setLinkError(result.error);
          return;
        }
        const url = buildWhatsAppLinkCodeUrl(result.code);
        if (url) {
          setLinkUrl(url);
          return;
        }
        // null means NEXT_PUBLIC_WHATSAPP_BOT_PHONE was absent at build time.
        // A deployment fault rather than anything this visitor can fix, so it
        // points them at the one person who can.
        setLinkError("שירות הקישור אינו זמין כרגע. פנו לבעל/ת הרשימה.");
      })
      .catch(() => {
        if (!cancelled) setLinkError("יצירת קישור הוואטסאפ נכשלה. רעננו את העמוד ונסו שוב.");
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, gate, linkUrl]);

  // Linking finishes out of band — the user sends a WhatsApp message and the
  // webhook redeems the code — so nothing tells this tab about it. Returning to
  // the tab is the precise signal, and the interval covers the desktop case
  // where WhatsApp Web never took focus away.
  useEffect(() => {
    if (!signedIn || gate !== "needs_channel_link") return;
    // Local to the effect rather than a ref: the deadline is meaningful only
    // while this gate is the one being watched, and the effect re-runs whenever
    // that changes.
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    const expired = () => Date.now() > deadline;
    const onReturn = () => {
      if (document.visibilityState === "visible" && !expired()) void checkGate(false);
    };

    const timer = window.setInterval(() => {
      if (expired()) window.clearInterval(timer);
      else void checkGate(false);
    }, POLL_INTERVAL_MS);
    // visibilitychange is dispatched at the Document, focus at the window —
    // together they cover both "switched back from the WhatsApp app" and
    // "clicked back into this tab".
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [signedIn, gate, checkGate]);

  async function handleAccept() {
    setPending(true);
    try {
      const result = await acceptInvite({ code: preview.code });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      setDone("accepted");
      toast.success("הצטרפת לרשימה");
      router.push(`/cards/lists/${result.listId}`);
    } catch {
      toast.error("אישור ההצטרפות נכשל");
    } finally {
      setPending(false);
    }
  }

  async function handleDecline() {
    setPending(true);
    try {
      const result = await declineInvite({ code: preview.code });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      setDone("declined");
    } catch {
      toast.error("דחיית ההזמנה נכשלה");
    } finally {
      setPending(false);
    }
  }

  if (done === "accepted") {
    return (
      <Panel title={preview.listName}>
        <p className="text-muted-foreground">הצטרפת לרשימה בהצלחה.</p>
      </Panel>
    );
  }

  if (done === "declined") {
    return (
      <Panel title={preview.listName}>
        <p className="text-muted-foreground">ההזמנה נדחתה. הרשימה לא שותפה איתך.</p>
      </Panel>
    );
  }

  if (terminal) {
    return (
      <Panel title={preview.listName}>
        <p className="text-muted-foreground">
          {preview.expired
            ? "תוקף ההזמנה פג. בקשו מבעל/ת הרשימה לשלוח הזמנה חדשה."
            : "ההזמנה כבר טופלה."}
        </p>
      </Panel>
    );
  }

  return (
    <Panel title={preview.listName}>
      <p className="text-muted-foreground">
        הוזמנת להצטרף לרשימה &quot;{preview.listName}&quot; בהרשאת {ROLE_LABELS[preview.role]}.
      </p>

      {!signedIn && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            כדי לאשר את ההצטרפות יש להתחבר עם חשבון Google. אם אין לכם חשבון עדיין, ההתחברות תיצור
            אותו.
          </p>
          <Button asChild>
            {/* Reuses the existing ?next= convention that src/proxy.ts sets and
                SignInButtons reads after createSession — no auth changes. */}
            <Link href={`/?next=${encodeURIComponent(`/invite/${preview.code}`)}`}>
              <LogIn className="size-4" />
              התחברות והמשך
            </Link>
          </Button>
        </div>
      )}

      {signedIn && gate === "self_invite" && (
        <p className="text-sm text-muted-foreground">
          ההזמנה הזו נוצרה על ידכם. שלחו אותה למי שאיתו תרצו לשתף את הרשימה.
        </p>
      )}

      {signedIn && gate === "already_member" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">כבר יש לכם גישה לרשימה הזו.</p>
          <Button asChild variant="outline">
            <Link href="/cards">מעבר לרשימות שלי</Link>
          </Button>
        </div>
      )}

      {/* The account is real but wrong: it has proved a different number from
          the one this invite names, which is exactly the case the binding
          exists to stop. */}
      {signedIn && gate === "linked_to_other_number" && (
        <p className="text-sm text-muted-foreground">
          החשבון שלכם מקושר למספר WhatsApp אחר מזה שאליו נשלחה ההזמנה
          {preview.phoneHint && (
            <>
              {" "}
              (מסתיים ב-<span dir="ltr">{preview.phoneHint}</span>)
            </>
          )}
          . כדי לאשר, נתקו את הקישור הקיים בהגדרות וקשרו את המספר שאליו נשלחה ההזמנה.
        </p>
      )}

      {signedIn && gate === "needs_channel_link" && (
        <div className="space-y-3 rounded-lg border p-4" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            {preview.phoneHint ? (
              <>
                כדי לאשר את ההצטרפות, יש לוודא שמספר הוואטסאפ שאליו נשלחה ההזמנה (מסתיים ב-
                <span dir="ltr">{preview.phoneHint}</span>) שייך לחשבון שלכם. שלחו הודעה מהמספר הזה
                — כך נדע שהוא באמת שלכם. אחרי השליחה חזרו לכאן — נמשיך אוטומטית.
              </>
            ) : (
              /* No hint means an ADR #38 bearer leftover, which named no
                 number: any linked number will do, and it is collected so the
                 owner can see who joined rather than to authorize it. */
              <>
                נותר שלב אחד: שליחת הודעה אחת בוואטסאפ, כדי שנוכל לשייך את המספר שלכם לחשבון. אחרי
                השליחה חזרו לכאן — נמשיך אוטומטית.
              </>
            )}
          </p>

          {/* "בדיקה מחדש" sits outside the conditional on purpose: when the
              link could not be issued there was previously no control at all on
              screen, so the page became a dead end rather than something the
              visitor could retry. */}
          <div className="space-y-2">
            {linkUrl && (
              <Button asChild>
                <a href={linkUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" />
                  פתיחת WhatsApp
                </a>
              </Button>
            )}
            {!linkUrl && !linkError && (
              <p className="text-sm text-muted-foreground">מכינים את הקישור...</p>
            )}
            {linkError && (
              <p className="text-sm text-destructive" role="alert">
                {linkError}
              </p>
            )}
            <Button variant="outline" onClick={() => void refreshGate()} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              בדיקה מחדש
            </Button>
          </div>
        </div>
      )}

      {/* Opens by itself once nothing is in the way — on arrival for a visitor
          who is already set up, or the moment polling notices the number was
          linked. Reopenable from the panel so dismissing it is not a dead end. */}
      {signedIn && gate === "ready" && (
        <>
          <Button variant="outline" onClick={() => setConfirmOpen(true)}>
            הצגת ההזמנה
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="max-h-[85svh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>הצטרפות לרשימה &quot;{preview.listName}&quot;</DialogTitle>
                <DialogDescription>
                  ההצטרפות תיתן לכם הרשאת {ROLE_LABELS[preview.role]}. אפשר לצאת מהרשימה בכל שלב.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => void handleAccept()} disabled={pending}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  אישור והצטרפות
                </Button>
                <Button variant="outline" onClick={() => void handleDecline()} disabled={pending}>
                  <X className="size-4" />
                  דחייה
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">הזמנה לרשימה</h1>
      <div className="space-y-4 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
