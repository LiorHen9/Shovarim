import type { Metadata } from "next";
import { A11Y_MAIN_CONTENT_ID } from "@/lib/a11y/constants";

// Per-page <title> (WCAG 2.4.2, Level A) — see the note in src/app/layout.tsx.
export const metadata: Metadata = { title: "תנאי שימוש" };

export default function TermsPage() {
  return (
    <main id={A11Y_MAIN_CONTENT_ID} className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">תנאי שימוש</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">השירות</h2>
        <p>
          שוברים הוא כלי אישי לניהול שוברים וכרטיסי מתנה. השירות ניתן כפי
          שהוא (as-is), ללא אחריות לדיוק מוחלט של נתוני היתרה שהוזנו — האחריות
          לוודא יתרה מול נותן השובר בפועל היא שלכם.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">החשבון שלכם</h2>
        <p>
          אתם אחראים לשמירה על אבטחת חשבון ה-Google/Apple שדרכו אתם מתחברים.
          כל פעולה שמבוצעת דרך חשבונכם נחשבת כמבוצעת על ידכם.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">שינויים בשירות</h2>
        <p>השירות עשוי להשתנות או להיפסק בכל עת, עם או בלי הודעה מוקדמת.</p>
      </section>
    </main>
  );
}
