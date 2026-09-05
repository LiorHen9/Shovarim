import type { Metadata } from "next";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal/constants";
import { A11Y_MAIN_CONTENT_ID } from "@/lib/a11y/constants";

// Per-page <title> (WCAG 2.4.2, Level A) — see the note in src/app/layout.tsx.
export const metadata: Metadata = { title: "מדיניות פרטיות" };

export default function PrivacyPage() {
  return (
    <main id={A11Y_MAIN_CONTENT_ID} className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">מדיניות פרטיות</h1>
      <p className="text-sm text-muted-foreground">גרסה מיום {PRIVACY_POLICY_VERSION}</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">איזה מידע אנחנו אוספים</h2>
        <p>
          שם, כתובת אימייל ותמונת פרופיל מספק ההתחברות (Google), ופרטי השוברים
          וכרטיסי המתנה שאתם מזינים באופן יזום: שם הכרטיס, יתרה, תוקף, ויומן
          שימושים (כולל מטרת השימוש והיכן נעשה, אם צוין). שדות כמו מספר כרטיס
          או מיקום השימוש הם אופציונליים ונאספים רק אם תבחרו למלא אותם.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">למה אנחנו אוספים את זה</h2>
        <p>
          אך ורק כדי לספק לכם את השירות: הצגת הכרטיסים שלכם, מעקב יתרות,
          תזכורות לפני פקיעת תוקף ודוחות שימוש. איננו מוכרים או משתפים את
          המידע שלכם עם צדדים שלישיים למטרות שיווק.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">היכן המידע מאוחסן</h2>
        <p>
          המידע מאוחסן ב-Google Firebase (Firestore), הפועל כמעבד מידע מטעמנו.
          הגישה למידע שלכם מוגבלת אליכם בלבד באמצעות כללי הרשאה (Security
          Rules) ברמת בסיס הנתונים.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">הזכויות שלכם</h2>
        <p>
          בהתאם לתקנות ה-GDPR ולחוק הגנת הפרטיות הישראלי, יש לכם זכות לעיין
          במידע שלכם, לייצא אותו, ולבקש את מחיקתו במלואו. אפשרויות אלו יהיו
          זמינות בעמוד ההגדרות של החשבון.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">מסירת מידע</h2>
        <p>מסירת המידע היא וולונטרית, אך נדרשת כדי להשתמש בשירות.</p>
      </section>
    </main>
  );
}
