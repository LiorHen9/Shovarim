"use client";

import { useAuth } from "@/hooks/useAuth";
import { CategoryManager } from "@/components/categories/CategoryManager";
import { ExportDataButton } from "@/components/settings/ExportDataButton";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";
import { ChannelLinksSection } from "@/components/settings/ChannelLinksSection";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">הגדרות</h1>
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">מחובר/ת כ-</p>
        <p className="font-medium">{user?.email}</p>
      </div>

      {user && (
        <div className="space-y-2">
          <h2 className="font-semibold">קטגוריות</h2>
          <CategoryManager uid={user.uid} />
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-semibold">נתונים אישיים</h2>
        <ExportDataButton />
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">ערוצי הודעות</h2>
        <p className="text-sm text-muted-foreground">
          קישור מספר WhatsApp לחשבון, כדי לנהל את הכרטיסים בשיחה. הבוט פועל בשם החשבון המקושר בלבד.
        </p>
        <ChannelLinksSection />
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">מחיקת חשבון</h2>
        <DeleteAccountSection />
        <p className="text-sm text-muted-foreground">
          ראו{" "}
          <a href="/privacy" className="underline underline-offset-2">
            מדיניות הפרטיות
          </a>{" "}
          לפרטים נוספים.
        </p>
      </div>
    </div>
  );
}
