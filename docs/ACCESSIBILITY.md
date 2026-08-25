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
Phase 1: טפסי כרטיס/שימוש/עריכה (`CardForm`, `AddUsageForm`, `EditCardDialog`) בנויים עם `Label`+`htmlFor`, שגיאות עם `role="alert"` ו-`aria-describedby`. `ConsentBanner` עם `role="alertdialog"`/`aria-modal`/`aria-labelledby`. עדיין לא בוצעה בדיקת Lighthouse/NVDA בפועל — יש לבצע לפני שחרור רחב.
