"use client";

import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">הגדרות</h1>
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">מחובר/ת כ-</p>
        <p className="font-medium">{user?.email}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        ניהול נתונים אישיים (ייצוא/מחיקת חשבון) יתווסף כאן בהמשך — ראו{" "}
        <a href="/privacy" className="underline underline-offset-2">
          מדיניות הפרטיות
        </a>
        .
      </p>
    </div>
  );
}
