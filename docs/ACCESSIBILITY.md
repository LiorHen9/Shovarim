# ACCESSIBILITY — WCAG 2.1 AA

## עקרונות בסיס לפרויקט
- shadcn/ui נבנה על Radix primitives → keyboard nav, focus management ו-ARIA roles מגיעים מובנים ברוב הרכיבים (Dialog, DropdownMenu, Select וכו'). לא לבנות מודלים/תפריטים custom בלי Radix.
- `--rtl` הופעל ב-shadcn init → קומפוננטות משתמשות ב-logical properties (`ms-`/`me-`/`ps-`/`pe-`) ולא `ml-`/`mr-`. **חובה להמשיך בעיקרון הזה בקוד חדש** — לא לכתוב `ml-`/`mr-`/`text-left`/`text-right` ישירות.
- `<html lang="he" dir="rtl">` מוגדר ב-`app/layout.tsx`.

## Checklist לכל קומפוננטה/עמוד חדש
- [ ] ניגודיות צבעים: 4.5:1 טקסט רגיל, 3:1 טקסט גדול/אייקונים — נבדק מול theme tokens ב-`globals.css`, לא צבעים hardcoded.
- [ ] נגיש מלא במקלדת: `Tab`/`Shift+Tab` מגיעים לכל control, `Enter`/`Space` מפעילים, `Escape` סוגר dialogs.
- [ ] `focus-visible` ברור על כל אלמנט אינטראקטיבי (מגיע מ-shadcn/Tailwind כברירת מחדל — לא לבטל עם `outline-none` בלי תחליף).
- [ ] כל `<input>`/`<select>` מקושר ל-`<Label>` (shadcn `Label` + `htmlFor`/`id`, או `FormLabel` אם נבנה form wrapper).
- [ ] הודעות שגיאה בטופס מקושרות ב-`aria-describedby`, ומוכרזות לקורא מסך (react-hook-form errors + `role="alert"` או `aria-live="polite"`).
- [ ] עדכוני יתרה/סטטוס בזמן אמת (`onSnapshot`) עם `aria-live="polite"` region כדי שקורא מסך יקרא שינויים.
- [ ] תמונות (`cardImageUrl`, `receiptImageUrl`) עם `alt` משמעותי — לא ריק, לא "image".
- [ ] אייקוני כיווניות (חצים, back/forward) עוברים flip נכון ב-RTL — לבדוק ויזואלית.
- [ ] תפקוד תקין עד zoom 200% ללא אובדן תוכן/חפיפה.

## בדיקות נדרשות לפני שחרור פיצ'ר UI
1. Lighthouse Accessibility score (DevTools) — יעד 100 או קרוב, לתעד חריגות מודעות.
2. ניווט מקלדת מלא ידני על כל flow חדש (יצירת כרטיס, הוספת שימוש).
3. בדיקה עם קורא מסך NVDA (Windows — סביבת המשתמש) לפחות על flows קריטיים.

## סטטוס נוכחי
Phase 1: טפסי כרטיס/שימוש/עריכה (`CardForm`, `AddUsageForm`, `EditCardDialog`) בנויים עם `Label`+`htmlFor`, שגיאות עם `role="alert"` ו-`aria-describedby`. `ConsentBanner` עם `role="alertdialog"`/`aria-modal`/`aria-labelledby`.

Phase 2: אותו דפוס הורחב לרכיבים החדשים — `ImageDropInput` (label+`aria-describedby`+`alt` משמעותי לתצוגה מקדימה), `TagsInput` (נגיש למקלדת: Enter/פסיק להוספה, Backspace להסרת התגית האחרונה, כפתור הסרה מתויג לכל צ'יפ, `aria-live="polite"` על שינויים), `CategorySelect` (מבוסס Radix `Select` קיים). יתרת הכרטיס בעמוד פרטי הכרטיס עטופה כעת ב-`aria-live="polite"` כדי שעדכוני `onSnapshot` יוכרזו לקורא מסך.

Phase 3: אותו דפוס הוחל על השדות החדשים (`cvv`, `acceptingRetailersUrl` ב-`CardForm`/`EditCardDialog`) ועל `UpdateBalanceDialog` (`Label`+`htmlFor`, `aria-describedby`+`role="alert"` לשגיאות).

עדיין לא בוצעה בדיקת Lighthouse/NVDA בפועל — יש לבצע לפני שחרור רחב.

### Phase 6 (2026-09-05)
- **בדיקה אוטומטית ראשונה אי-פעם**: `@axe-core/playwright` רץ ב-`tests/e2e/dashboard.spec.ts` ו-`public.spec.ts`, מוגבל ל-`wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` (בלי כללי best-practice, כדי שכשל תמיד יסמן פער תאימות אמיתי). עובר נקי. `eslint-plugin-jsx-a11y` מופעל במפורש ולא רק דרך מה ש-`eslint-config-next` מטמיע.
- **ניגודיות ב-dark mode נבדקה** (`expectNoA11yViolationsInDark`) — Phase 6.4 הרכיב את ה-`ThemeProvider` שהפך את טוקני ה-`.dark` לנגישים לראשונה, והם מעולם לא נבדקו קודם. עובר נקי.
- **zoom 200% נשמר במפורש**: ה-`viewport` ב-`src/app/layout.tsx` **לא** קובע `maximumScale`/`userScalable`, ויש טסט E2E ייעודי (`pwa.spec.ts`) שנכשל אם מישהו יוסיף אותם. נעילת zoom היא ההעתקה הסטנדרטית שגורמת ל-PWA "להרגיש נייטיב", והיא מפירה את הפריט הזה.
- **חריגי `autoFocus` מוצדקים**: שני מקומות (שינוי שם רשימה, עריכת קטגוריה) שומרים `autoFocus` עם `eslint-disable` מנומק — ה-input מחליף את הכפתור שהמשתמש הפעיל, כך שהסרתו הייתה מאבדת את הפוקוס ל-`body` ופוגעת בנגישות, לא משפרת אותה.
- **חיווי הניתוק החדש** (`OfflineBanner`) הוא `role="status"` + `aria-live="polite"` ולא טוסט — מה שגם מספק את הפריט על הכרזת שינויי סטטוס מ-`onSnapshot`.
- **עדיין פתוח**: מעבר Lighthouse ו-NVDA ידני. סריקה אוטומטית תופסת בערך שליש מהבעיות ואינה שופטת אם `alt` משמעותי או אם סדר הפוקוס הגיוני.

### Phase 6.A (2026-09-05) — הפער החוקי נסגר
**המסגרת**: תקנה 35 לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013 — אתר של נותן שירות חייב לעמוד ב-**ת"י 5568 ברמה AA** ולפרסם הצהרת נגישות. התקנה **אינה** מחייבת בר צף; הבר הוא קונבנציה שוקית. לכן סדר העבודה היה: תאימות → הצהרה → בר. ראו `docs/DECISIONS.md` ADR #57.

**שלושה כשלים ברמה A שהסריקה של Phase 6.4 עברה בהצלחה** — הלקח המרכזי כאן הוא על גבולות הבדיקה האוטומטית:
- **לא היה `<main>` בשום עמוד מוגן.** כלל `bypass` של axe מסתפק בקיום כותרות, וכלל `region` מתויג best-practice ולכן מוחרג אצלנו בכוונה.
- **לא היה קישור "דלג לתוכן המרכזי"** (WCAG 2.4.1). קיים כעת כאלמנט הראשון ב-`<body>`, מוצג בפוקוס, ומוביל ל-`#main-content` בכל מסלול.
- **לכל עמוד היה אותו `<title>`** (WCAG 2.4.2). כלל `document-title` בודק רק שהוא אינו ריק. כעת `title.template` בשורש + `metadata` לכל מסלול.

**בר נגישות** (`src/components/a11y/AccessibilityToolbar.tsx`): גודל טקסט 100/115/130/150%, ניגודיות גבוהה, הדגשת קישורים, הדגשת מיקוד מקלדת, עצירת אנימציות, איפוס. פקדי טופס נטיביים בלבד בתוך `fieldset`/`legend` — הרכיב שמיועד למשתמשים עם מוגבלות הוא הרכיב היחיד שאין לו תירוץ ל-widget custom. נשמר ב-`localStorage` ומוחל ע"י סקריפט inline חוסם לפני הציור הראשון.

**`prefers-reduced-motion` מכובד** ברמת `globals.css` גם בלי הגדרה יזומה בבר.

**ניגודיות — ממצא אמיתי**: `--destructive` היה `oklch(0.577 …)`, ו-`text-destructive` על `bg-destructive/10` (ה-variant ההרסני של shadcn) נמדד **3.99:1** — כשל 1.4.3 AA על 14 כפתורי מחיקה/חסימה. עבר ל-`oklch(0.52 0.22 27.325)`: 5.01:1 על הגוון, 6.02:1 על לבן. הפלטה הכהה נמדדה 5.30:1 ולא שונתה. **לא נתפס במשך כל Phase 6 כי על רקע לבן נקי הערך הישן עובר, ולשני העמודים שנסרקו לא היה פקד הרסני.**

**רכיבים מושבתים פטורים** — WCAG 1.4.3 פוטר במפורש רכיבי ממשק לא-פעילים. סריקה שתופסת כפתור באמצע `disabled:opacity-50` מדווחת כשל שאינו קיים; המסקנה היא להמתין לסיום הטעינה לפני הסריקה, לא לשנות את הפלטה.

**כיסוי אוטומטי נוכחי**: 8 מסלולים (`/`, `/accessibility`, `/dashboard`, `/cards`, `/cards/new`, `/settings`, `/chat`, ומצב ניגודיות גבוהה), רובם בשתי ערכות הנושא. `tests/e2e/accessibility.spec.ts` + הסריקות ב-`dashboard.spec.ts`/`public.spec.ts`.

**עדיין פתוח**: מעבר NVDA ידני, Lighthouse מול ה-URL החי, ו-`/admin` (דורש `adminRoles` שאין ל-uid שנוצר בטסטים).

### Phase 6.B (2026-09-05) — ניווט קבוע ומיקום הבר
`docs/DECISIONS.md` ADR #58.

- **עמודי המידע קיבלו כותרת.** `/accessibility`, `/privacy` ו-`/terms` לא כללו תפריט עליון כלל, כך שהקישור שנוסף ב-6.A כדי שההצהרה תהיה נגישה מכל עמוד הוביל למעשה למבוי סתום. עמוד נגיש שאי אפשר לצאת ממנו הוא תיקון חלקי.
- **הכותרת דביקה, אבל מותנית בגובה** — `sticky` רק מ-`min-height: 480px`, ו-`static` מתחת לזה. זו התשובה הישירה לפריט "תפקוד תקין עד zoom 200% ללא אובדן תוכן": ב-zoom גבוה או ב-`--a11y-font-scale: 1.5` כותרת דביקה בולעת נתח קבוע מהמסך, ובדיוק אז הוא הכי יקר.
- **`#main-content { scroll-margin-top: 4rem }`** — קישור הדילוג קופץ לעוגן, וכותרת דביקה הייתה מכסה את היעד. ב-`rem` כדי שיגדל יחד עם סקאלת הפונט.
- **שם ל-landmark הניווט הראשי** (`aria-label="ניווט ראשי"`) — מעכשיו יש שני landmarks של ניווט באותו עמוד, יחד עם "קישורים משפטיים" ב-`SiteFooter`.
- **סריקת axe הורחבה** מ-`/accessibility` בלבד לשלושת עמודי המידע, בשתי ערכות הנושא — כולם קיבלו מרקאפ חדש.
