import type { Metadata } from "next";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal/constants";
import { A11Y_MAIN_CONTENT_ID } from "@/lib/a11y/constants";

// Per-page <title> (WCAG 2.4.2, Level A) — see the note in src/app/layout.tsx.
export const metadata: Metadata = { title: "מדיניות פרטיות" };

// The "עוגיות ואחסון בדפדפן" and "העברת מידע לצדדים שלישיים" sections are the disclosure
// half of ADR #59. The consent half is deliberately absent: every item listed there is
// strictly necessary or user-initiated, which is the ePrivacy 5(3) exemption, so there is
// no cookie banner and should not be one. If analytics ever lands (ROADMAP 9.6 layer 3),
// that is the point where a real opt-in mechanism becomes mandatory — read ADR #59 first.
//
// Any material change here — a new third-party recipient above all — must bump
// PRIVACY_POLICY_VERSION, which re-prompts every existing user through ConsentBanner.
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
        <h2 className="text-lg font-semibold">העברת מידע לצדדים שלישיים</h2>
        <p>
          איננו מוכרים מידע ואיננו מעבירים אותו לצורכי שיווק. אלה ההעברות
          היחידות שמתרחשות, וכולן נדרשות כדי להפעיל את השירות:
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong>Google (Firebase)</strong> — אחסון המידע וניהול ההתחברות,
            כמעבד מידע מטעמנו, כמתואר בסעיף הקודם.
          </li>
          <li>
            <strong>Anthropic (Claude)</strong> — אם אתם משתמשים בצ&apos;אט,
            תוכן ההודעות והתשובות מעובד אצל ספק המודל כדי לייצר את התשובה.
            התוכן כולל את כל מה שהקלדתם בשיחה — ואם בחרתם להזין בצ&apos;אט מספר
            כרטיס או קוד CVV, גם הם נכללים בו.
          </li>
          <li>
            <strong>Meta (WhatsApp)</strong> — רק אם קישרתם ביוזמתכם מספר
            WhatsApp בעמוד ההגדרות. במקרה כזה ההודעות והתשובות עוברות בתשתית של
            Meta וכפופות גם למדיניות הפרטיות שלה. אפשר לנתק את הקישור בכל עת
            מעמוד ההגדרות, ומרגע הניתוק ההעברה הזו נפסקת.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">עוגיות ואחסון בדפדפן</h2>
        <p>
          <strong>איננו משתמשים בעוגיות מעקב, באנליטיקס או בפרסום.</strong> אין
          באתר Google Analytics, אין פיקסלים של רשתות חברתיות ואין כלי אחר
          שעוקב אחרי הגלישה שלכם — ולכן גם אין כאן בקשת הסכמה לעוגיות. מה שכן
          נשמר במכשיר שלכם נדרש כדי שהשירות יעבוד:
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong>עוגיית התחברות</strong> (
            <code dir="ltr">__session</code>) — נוצרת רק ברגע שאתם מתחברים,
            ומאפשרת לשרת לזהות אתכם במעבר בין העמודים. מבקר שלא התחבר אינו מקבל
            אותה כלל.
          </li>
          <li>
            <strong>אחסון מקומי בדפדפן</strong> — שומר את מצב ההתחברות כדי שלא
            תצטרכו להתחבר מחדש בכל כניסה, ואת העדפות הנגישות שבחרתם בעצמכם בסרגל
            הנגישות (גודל טקסט, ניגודיות וכדומה).
          </li>
          <li>
            <strong>עוגיית אבטחה של Google</strong> (
            <code dir="ltr">_GRECAPTCHA</code>) — נועדה אך ורק לזהות שימוש
            אוטומטי ולמנוע ניצול לרעה של השירות, ואינה משמשת לפרסום.
          </li>
        </ul>
        <p>
          התנתקות מוחקת את עוגיית ההתחברות. את שאר הפריטים ניתן למחוק דרך
          הגדרות הדפדפן בכל עת — אך חסימת עוגיית ההתחברות תמנע מכם להתחבר
          לשירות.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">הזכויות שלכם</h2>
        <p>
          בהתאם לתקנות ה-GDPR ולחוק הגנת הפרטיות הישראלי, יש לכם זכות לעיין
          במידע שלכם, לייצא אותו, ולבקש את מחיקתו במלואו. האפשרויות האלו זמינות
          בעמוד ההגדרות של החשבון: ייצוא כל המידע שלכם לקובץ, ובקשת מחיקת חשבון
          שניתן לבטל בתוך תקופת המתנה לפני שהמחיקה מתבצעת בפועל.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">מסירת מידע</h2>
        <p>מסירת המידע היא וולונטרית, אך נדרשת כדי להשתמש בשירות.</p>
      </section>
    </main>
  );
}
