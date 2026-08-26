# PHASE 2 CONTEXT — Media & Enrichment

תיעוד מפורט של מה שנבנה ב-Phase 2 (תמונות/קטגוריות-תגיות/נגישות טפסים), למי שממשיך מכאן. הסטטוס התמציתי נמצא ב-`docs/ROADMAP.md`/`docs/FEATURES.md` — הקובץ הזה מוסיף את ה-"למה" וה-patterns כדי לא לאבד context.

## מה נבנה

### 1. תמונות כרטיס/קבלות (Firebase Storage)
- `src/lib/storage/upload.ts` — `uploadCardImage(uid, cardId, file)` / `uploadReceiptImage(uid, cardId, entryId, file)`. עולה ל-paths שכבר היו מוגדרים ב-`storage.rules` מ-Phase 0 (`users/{uid}/cards/{cardId}/cardImage`, `.../receipts/{entryId}`) — לא נדרש שינוי ב-rules. ולידציה client-side (סוג/גודל) מראה `storage.rules` `isValidImage()`.
- `src/components/ui/ImageDropInput.tsx` — קומפוננטת input+preview נגישה, "טיפשה" (מחזירה `File` להורה, לא מבצעת upload בעצמה).
- **Pattern מרכזי: pre-generate ID לפני upload.** גם כרטיס וגם רשומת שימוש נוצרים כך: `doc(collection(db, "..."))` יוצר Ref עם id בצד הלקוח בלי כתיבה לרשת, ה-id הזה משמש לנתיב ה-Storage, ה-upload קורה קודם, ורק אז נכתב המסמך (`setDoc`/Server Action) עם ה-URL המוכן. הסיבה: `usageLog` הוא immutable ב-design (`docs/DECISIONS.md` #3/#4/#10) — אי אפשר "לעדכן receiptImageUrl אחרי יצירה", אז ה-upload חייב לקרות *לפני* יצירת המסמך.
  - `CardForm`: `addDoc` הוחלף ב-pre-generated `doc()` + `setDoc`.
  - `AddUsageForm`: מייצר `entryId` בצד לקוח, מעלה קבלה אם נבחרה, ואז קורא ל-`addUsageEntry({..., entryId, receiptImageUrl})`.
  - `src/actions/usage.ts` (`addUsageEntry`): עודכן לקבל `entryId` אופציונלי ולהשתמש בו (`cardRef.collection("usageLog").doc(parsed.entryId)` כשקיים, אחרת `.doc()` רגיל ליצירת id). **שים לב**: Admin SDK של Firestore בודק `arguments.length === 0` כדי להחליט אם ליצור id אוטומטי — קריאה מפורשת עם `undefined` (כמו `.doc(undefined)`) **זורקת שגיאה**, לכן יש תנאי מפורש (`parsed.entryId ? .doc(id) : .doc()`) ולא סתם `.doc(parsed.entryId)`.
  - `createUsageEntrySchema` (`src/lib/validation/usageLog.ts`) קיבל `entryId?`/`receiptImageUrl?` אופציונליים.
- `CardImageUpload.tsx` — קומפוננטה נפרדת בעמוד פרטי הכרטיס (לא בתוך `EditCardDialog`) שמעלה ומעדכנת מיידית עם בחירת קובץ, כי שם ה-cardId כבר קיים ואין צורך לצרף להעריכה של שאר השדות.
- Thumbnails: ברשימת הכרטיסים (`cards/page.tsx`) ובקבלות ביומן השימושים (`cards/[cardId]/page.tsx`).

### 2. קטגוריות/תגיות מותאמות אישית
- `src/lib/validation/category.ts` — Zod schema ליצירה/עריכה (`name` 1–40 תווים).
- `src/hooks/useCategories.ts` — `onSnapshot` על `where("ownerId", "in", ["system", uid])`. חשוב: זה query עם `in` בשני ערכים בלבד — תואם את ה-rule הקיים ב-`firestore.rules` (`resource.data.ownerId == 'system' || isExistingOwner()`) כי כל מסמך שחוזר יהיה system או של המשתמש עצמו. מיון client-side: system קודם, אח"כ אלפביתי.
- `CategorySelect.tsx` — עטיפה ל-`Select` הקיים (shadcn/Radix) + "+ קטגוריה חדשה" כ-sentinel value (`__new__`) שפותח `CreateCategoryDialog` (לא ניווט/בחירה רגילה). `CreateCategoryDialog` כותב ישירות ל-`categories` (`ownerId: uid`) — כבר מותר ב-rules הקיימים, לא נדרש שינוי.
- `TagsInput.tsx` — chips נגישים על בסיס `Badge` הקיים: Enter/פסיק מוסיף, Backspace על שדה ריק מוחק את התגית האחרונה, כפתור הסרה מתויג לכל צ'יפ (`aria-label`), ואזור `aria-live="polite"` (`sr-only`) שמכריז הוספה/הסרה.
- שני אלה חוברו הן ל-`CardForm` (יצירה) והן ל-`EditCardDialog` (עריכה) — `editCardDetailsSchema` הורחב עם `categoryId`/`tags` (אלה לא חלק מהחרגת balance/currency התיעודית ב-ADR, מותר לערוך).
- `CategoryManager.tsx` בעמוד `/settings` — עריכת שם/מחיקה לקטגוריות אישיות בלבד; קטגוריות system מוצגות read-only (התנהגות שכבר אכופה ב-rules, כאן רק UI תואם).

### 3. נגישות טפסים
- כל שדה חדש: `Label`+`htmlFor`, `aria-describedby` לשגיאות, alt משמעותי לתמונות (לא ריק/"image").
- `TagsInput` נגיש למקלדת במלואו (ראה למעלה).
- יתרת הכרטיס בעמוד פרטי כרטיס (`cards/[cardId]/page.tsx`) עטופה כעת ב-`aria-live="polite"` — סוגר gap שהיה מתועד ב-`docs/ACCESSIBILITY.md` אבל לא מומש ב-Phase 1.
- **עדיין לא בוצע**: Lighthouse/NVDA ידני (נשאר מתועד כפער פתוח).

## קבצים חדשים
```
src/lib/storage/upload.ts
src/components/ui/ImageDropInput.tsx
src/components/ui/TagsInput.tsx
src/components/cards/CardImageUpload.tsx
src/lib/validation/category.ts
src/hooks/useCategories.ts
src/components/categories/CategorySelect.tsx
src/components/categories/CreateCategoryDialog.tsx
src/components/categories/CategoryManager.tsx
```

## קבצים ששונו
```
src/components/cards/CardForm.tsx        — addDoc→pre-generated doc()+setDoc, image+category+tags
src/components/cards/EditCardDialog.tsx  — +uid prop, +categoryId/tags
src/lib/validation/cardEdit.ts           — +categoryId/tags
src/components/usage/AddUsageForm.tsx    — +uid prop, entryId pre-generation, receipt upload
src/lib/validation/usageLog.ts           — +entryId?/receiptImageUrl?
src/actions/usage.ts                     — entryId-aware doc ref, כותב receiptImageUrl
src/app/(protected)/cards/[cardId]/page.tsx — תמונה, aria-live על יתרה, receipt thumbnails, +uid props
src/app/(protected)/cards/page.tsx       — thumbnail
src/app/(protected)/settings/page.tsx    — CategoryManager section
docs/FEATURES.md / docs/ROADMAP.md / docs/ACCESSIBILITY.md — עודכנו לשקף Phase 2 ✅
```

## מה לא שונה (בכוונה)
- `firestore.rules` / `storage.rules` — שני אלה כבר תמכו במלוא הצורך מ-Phase 0/1. הבדיקה שהם היו יכולים לתמוך הייתה תנאי מקדים ל-plan (ראו `docs/DECISIONS.md`).
- `tests/rules/firestore.test.ts` — 19 הטסטים עוברים ללא שינוי.

## אימות שבוצע
- `npm run typecheck` / `npm run lint` / `npm run build` — נקיים.
- `npm run test:rules` — 19/19 עוברים (מול emulator שהיה כבר רץ).
- **לא בוצע**: קליק-דרך אמיתי בדפדפן. Playwright לא מותקן בסביבה הזו (תואם את ה-gap שכבר מתועד ב-`docs/ROADMAP.md` לגבי Phase 1), ואין `chromium-cli` זמין. יש לבצע בדיקה ידנית: יצירת כרטיס עם תמונה+קטגוריה+תגיות, הוספת שימוש עם קבלה, `/settings` לניהול קטגוריות.

## Follow-ups אפשריים (לא בוצעו, לא התבקשו)
- אין לינק חוזר/מחיקה של תמונה קיימת (רק החלפה) — אם נדרש "הסרת תמונה" למינימום, יהיה צריך גם למחוק מ-Storage (`deleteObject`).
- `CategoryManager` לא תומך בעריכת icon/color, רק name — השדות קיימים ב-schema/type אבל אין UI.
- התקנת Playwright/`chromium-cli` תאפשר אימות UI אוטומטי אמיתי בעתיד (`/run-skill-generator` יכול לתעד זאת כ-project skill ברגע שמישהו יתקין).
