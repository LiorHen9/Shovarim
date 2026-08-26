"use client";

import { useAuth } from "@/hooks/useAuth";
import { CategoryManager } from "@/components/categories/CategoryManager";

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
