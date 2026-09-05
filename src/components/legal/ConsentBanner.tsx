"use client";

import { useAuth } from "@/hooks/useAuth";
import { useConsent } from "@/hooks/useConsent";
import { Button } from "@/components/ui/button";

export function ConsentBanner() {
  const { user } = useAuth();
  const { status, grantConsent } = useConsent(user?.uid ?? null);

  if (status !== "needed") return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
    >
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 text-card-foreground shadow-lg">
        <h2 id="consent-title" className="text-lg font-semibold">
          לפני שממשיכים
        </h2>
        {/* This is the moment consent is actually given, so the third-party recipients
            have to be named here and not only behind the link — a policy link alone is not
            "informed" when the material change is who else sees the data (ADR #59). Kept to
            two sentences on purpose: a wall of text in a blocking dialog gets clicked
            through, which defeats the point. */}
        <p className="text-sm text-muted-foreground">
          אנחנו שומרים את פרטי הכרטיסים והשימושים שתזינו כדי להפעיל את השירות.
          אם תשתמשו בצ&apos;אט, תוכן ההודעות מעובד גם אצל ספק המודל (Anthropic),
          ואם תקשרו מספר WhatsApp — גם בתשתית של Meta. קראו את{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            מדיניות הפרטיות
          </a>{" "}
          לפני שממשיכים.
        </p>
        <Button onClick={() => void grantConsent()} className="w-full">
          מאשר/ת, המשך
        </Button>
      </div>
    </div>
  );
}
