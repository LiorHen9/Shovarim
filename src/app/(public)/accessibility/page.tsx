import type { Metadata } from "next";

import { A11Y_MAIN_CONTENT_ID } from "@/lib/a11y/constants";
import {
  ACCESSIBILITY_CONTACT_EMAIL,
  ACCESSIBILITY_STATEMENT_VERSION,
} from "@/lib/legal/constants";

export const metadata: Metadata = { title: "הצהרת נגישות" };

// Required alongside conformance itself by תקנות שוויון זכויות לאנשים עם מוגבלות
// (התאמות נגישות לשירות), תשע"ג-2013 — the regulation that binds an internet service to
// ת"י 5568 at level AA.
//
// Written to be accurate rather than flattering. A statement that claims full conformance
// the site has not actually demonstrated is worse than no statement: it is the document a
// complaint would be measured against. The "מגבלות ידועות" section below therefore names
// what has genuinely not been checked yet, and gets shortened only when it has been.
//
// Same shape as /privacy and /terms, and versioned the same way — but the version here is
// a "date of last accessibility review", so it must only move when a review really happens.
export default function AccessibilityPage() {
  return (
    <main id={A11Y_MAIN_CONTENT_ID} className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">הצהרת נגישות</h1>
      <p className="text-muted-foreground text-sm">
        עודכן לאחרונה: {ACCESSIBILITY_STATEMENT_VERSION}
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">המחויבות שלנו</h2>
        <p>
          אנחנו רואים בנגישות האתר חלק מהשירות עצמו, ולא תוספת. אנחנו פועלים כדי
          שכל אדם, לרבות אנשים עם מוגבלות, יוכל להשתמש באתר באופן עצמאי, שוויוני
          ונוח.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">התקן שלפיו הונגש האתר</h2>
        <p>
          האתר הונגש בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות
          לשירות), תשע&quot;ג-2013, ובהתאם לתקן הישראלי ת&quot;י 5568 ברמת התאמה
          AA — המבוסס על הנחיות WCAG של ארגון התקינה W3C. הבדיקות באתר מתבצעות מול
          WCAG 2.1 ברמה AA, שהיא מחמירה מהבסיס שהתקן דורש.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">אמצעי הנגישות באתר</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>האתר כתוב עברית ומוגדר לכיוון קריאה מימין לשמאל.</li>
          <li>
            קישור &quot;דלג לתוכן המרכזי&quot; המופיע בלחיצת Tab ראשונה בכל עמוד,
            ומאפשר לדלג על התפריטים.
          </li>
          <li>ניווט מלא באמצעות מקלדת בכל חלקי האתר, כולל טפסים, תפריטים וחלונות.</li>
          <li>
            מבנה סמנטי ותגיות ARIA לקוראי מסך: כותרות היררכיות, אזורי ניווט מסומנים,
            שדות טופס מקושרים לתוויות, והודעות שגיאה ועדכוני סטטוס המוכרזים בזמן אמת.
          </li>
          <li>תמיכה בהגדלת התצוגה של הדפדפן עד 200% ללא אובדן תוכן. הגדלה אינה נעולה.</li>
          <li>ניגודיות צבעים העומדת ביחס של 4.5:1 לפחות בטקסט רגיל, במצב בהיר ובמצב כהה.</li>
          <li>
            בר נגישות הזמין בכל עמוד (הכפתור בפינה התחתונה), הכולל: הגדלת טקסט עד 150%,
            מצב ניגודיות גבוהה, הדגשת קישורים, הדגשת מיקוד המקלדת, ועצירת אנימציות.
            ההעדפות נשמרות בדפדפן וחלות בכניסות הבאות.
          </li>
          <li>
            כיבוד הגדרת מערכת ההפעלה &quot;צמצום תנועה&quot; (prefers-reduced-motion)
            גם בלי הגדרה יזומה באתר.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">כיצד נבדקה הנגישות</h2>
        <p>
          האתר נבדק אוטומטית מול WCAG 2.1 ברמות A ו-AA באמצעות מנוע הבדיקה axe-core,
          במצב בהיר ובמצב כהה, כחלק מתהליך הבנייה — כלומר הבדיקה חוזרת בכל שינוי קוד
          ולא פעם אחת. נוסף על כך מופעלת בדיקת נגישות סטטית על קוד המקור.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">מגבלות ידועות</h2>
        <p>
          אנחנו מציינים במפורש מה טרם הושלם. בדיקה אוטומטית מזהה כשליש מבעיות
          הנגישות האפשריות ואינה יכולה לשפוט, למשל, אם תיאור חלופי לתמונה הוא בעל
          משמעות:
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>בדיקה ידנית מלאה עם קורא מסך (NVDA) טרם הושלמה על כל מסלולי השימוש.</li>
          <li>
            תמונות שמשתמשים מעלים בעצמם (תמונת כרטיס, צילום קבלה) מוצגות עם תיאור
            כללי, מאחר שתוכן התמונה אינו ידוע לנו.
          </li>
          <li>
            תוכן המופק על ידי מודל שפה בעמוד הצ&apos;אט משתנה בכל תשובה, ולכן אינו
            ניתן לבדיקה מראש.
          </li>
        </ul>
        <p>
          אם נתקלתם בבעיה שאינה מופיעה כאן, נשמח שתדווחו — זו הדרך הטובה ביותר שיש
          לנו לתקן אותה.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">פניות בנושא נגישות</h2>
        <p>
          לדיווח על בעיית נגישות, לבקשת התאמה, או לכל שאלה בנושא, אפשר לפנות אלינו
          במייל:{" "}
          <a
            href={`mailto:${ACCESSIBILITY_CONTACT_EMAIL}`}
            className="underline underline-offset-2"
          >
            {ACCESSIBILITY_CONTACT_EMAIL}
          </a>
          . נשתדל לטפל בפנייה בהקדם. כדי שנוכל לעזור מהר, יעזור לנו לדעת באיזה עמוד
          מדובר, מה ניסיתם לעשות, ובאיזה דפדפן או טכנולוגיה מסייעת השתמשתם.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">הערה על אופי השירות</h2>
        <p>
          השירות ניתן באינטרנט בלבד. אין לנו סניפים או משרדי קבלת קהל, ולכן הצהרה זו
          מתייחסת לאתר ולשירות המקוון בלבד.
        </p>
      </section>
    </main>
  );
}
