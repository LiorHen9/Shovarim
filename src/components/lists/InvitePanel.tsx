"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2, LogIn, MessageCircle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptInvite, declineInvite, getInviteGate } from "@/actions/listInvite";
import { createChannelLinkCode } from "@/actions/channelLink";
import { buildWhatsAppLinkCodeUrl } from "@/lib/whatsapp/deepLink";
import type { ListInviteGate, ListInvitePreview } from "@/types/listInvite";

const ROLE_LABELS = {
  manager: "מנהל/ת (הוספה, עריכה ומחיקה של כרטיסים)",
  viewer: "צופה (צפייה בלבד)",
} as const;

// The invite landing UI (ADR #37). Accepting requires two separate facts — an
// invite addressed to a number, and proof that the number belongs to this
// account — so most of this component is about explaining which one is missing.
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
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  const terminal = preview.status !== "pending" || preview.expired;

  async function refreshGate() {
    setPending(true);
    try {
      const result = await getInviteGate({ code: preview.code });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setGate(result.gate);
      if (result.gate === "ready") {
        setLinkUrl(null);
        toast.success("המספר קושר בהצלחה — אפשר לאשר את ההצטרפות");
      } else {
        toast.info("המספר עדיין לא מקושר. שלחו את ההודעה בוואטסאפ ונסו שוב.");
      }
    } catch {
      toast.error("בדיקת מצב הקישור נכשלה");
    } finally {
      setPending(false);
    }
  }

  async function handleLinkNumber() {
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
      setLinkUrl(url);
    } catch {
      toast.error("יצירת קישור החיבור נכשלה");
    } finally {
      setPending(false);
    }
  }

  async function handleAccept() {
    setPending(true);
    try {
      const result = await acceptInvite({ code: preview.code });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
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

      {signedIn && gate === "linked_to_other_number" && (
        <p className="text-sm text-muted-foreground">
          החשבון שלכם מקושר למספר WhatsApp אחר מזה שאליו נשלחה ההזמנה (מסתיים ב-
          <span dir="ltr">{preview.phoneHint}</span>). כדי לאשר, נתקו את הקישור הקיים בהגדרות וקשרו
          את המספר שאליו נשלחה ההזמנה.
        </p>
      )}

      {signedIn && gate === "needs_channel_link" && (
        <div className="space-y-3 rounded-lg border p-4" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            כדי לאשר את ההצטרפות, יש לוודא שמספר הוואטסאפ שאליו נשלחה ההזמנה (מסתיים ב-
            <span dir="ltr">{preview.phoneHint}</span>) שייך לחשבון שלכם. שלחו הודעה מהמספר הזה —
            כך נדע שהוא באמת שלכם.
          </p>

          {linkUrl ? (
            <div className="space-y-2">
              <Button asChild>
                <a href={linkUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" />
                  פתיחת WhatsApp
                </a>
              </Button>
              <p className="text-sm text-muted-foreground">
                אחרי שליחת ההודעה, חזרו לכאן ולחצו על &quot;בדיקה מחדש&quot;.
              </p>
              <Button variant="outline" onClick={() => void refreshGate()} disabled={pending}>
                <RefreshCw className="size-4" />
                בדיקה מחדש
              </Button>
            </div>
          ) : (
            <Button onClick={() => void handleLinkNumber()} disabled={pending}>
              <Link2 className="size-4" />
              קישור מספר הוואטסאפ
            </Button>
          )}
        </div>
      )}

      {signedIn && gate === "ready" && (
        <div className="flex gap-2">
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
        </div>
      )}

      {signedIn && gate !== "ready" && gate !== "already_member" && gate !== "self_invite" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleDecline()}
          disabled={pending}
        >
          דחיית ההזמנה
        </Button>
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
