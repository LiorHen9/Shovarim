# FEATURES

מצב נוכחי של פיצ'רי מוצר. עדכן בכל פעם שפיצ'ר זז שלב.

| פיצ'ר | סטטוס | הערות |
|---|---|---|
| תשתית פרויקט (Next.js/Firebase/shadcn) | ✅ הושלם | Phase 0 |
| Security Rules (deny-by-default) | ✅ הושלם ונבדק | Phase 0/1 — 19 טסטים ב-`tests/rules/firestore.test.ts` עוברים |
| Google Sign-In | ✅ הושלם | Phase 1 — `src/components/auth/SignInButtons.tsx` + session cookie |
| CRUD כרטיסים (create/list/edit/archive) | ✅ הושלם | Phase 1 — `/cards`, `/cards/new`, `/cards/[cardId]`. עריכה מוגבלת בכוונה לשם/תוקף/מספר כרטיס/CVV/קישור רשתות מכבדות — מטבע לא ניתן לעריכה כלל, ויתרה רק דרך יומן שימושים או עדכון ידני ייעודי (Phase 3), ראו `docs/DECISIONS.md` #11 |
| יומן שימושים + מטרת שימוש | ✅ הושלם | Phase 1 — `src/actions/usage.ts`, עדכון יתרה אטומי בטרנזקציה, מונע overdraft |
| Consent banner + Privacy Policy | ✅ הושלם | Phase 1 — חוסם UI עד הסכמה, `/privacy` ו-`/terms` עם תוכן אמיתי |
| Categories (system defaults) | ✅ הושלם | Phase 1 — `npm run seed:categories`; קטגוריות מותאמות אישית עדיין ב-Phase 2 |
| תמונות כרטיס/קבלות | ✅ הושלם | Phase 2 — `src/lib/storage/upload.ts`, `CardImageUpload`, `ImageDropInput`; ה-id של הכרטיס/רשומת השימוש נוצר בצד הלקוח לפני ההעלאה כדי לשמור על העלאה לפני כתיבת המסמך |
| קטגוריות/תגיות מותאמות אישית | ✅ הושלם | Phase 2 — `useCategories`, `CategorySelect` (כולל יצירה מהירה), `TagsInput`, ניהול (עריכה/מחיקה) ב-`/settings` דרך `CategoryManager` |
| עדכון יתרה ידני (ללא רשומת שימוש) | ✅ הושלם | Phase 3 — `src/actions/balance.ts` (`updateCardBalance`), `UpdateBalanceDialog` בעמוד פרטי הכרטיס, ראו `docs/DECISIONS.md` #11 |
| URL לרשתות מכבדות בטופס כרטיס | ✅ הושלם | Phase 3 — `acceptingRetailersUrl` ב-`CardForm`/`EditCardDialog` |
| שדה CVV בטופס כרטיס | ✅ הושלם | Phase 3 — `cvv` בסמוך לשדה התוקף ב-`CardForm`/`EditCardDialog`; מאוחסן ללא הצפנת application-level (כמו `barcodeOrCode`), ראו `docs/SECURITY.md` |
| הצגת קישור לרשתות מכבדות בעמוד הכרטיסים ובעמוד כרטיס | ✅ הושלם | Phase 3 — מוצג רק כש-`acceptingRetailersUrl` קיים; אייקון קישור ברשימת `/cards`, קישור טקסטואלי בעמוד `/cards/[cardId]` |
| מחיקת רשומה מיומן השימושים | ✅ הושלם | Phase 3 — `deleteUsageEntry` ב-`src/actions/usage.ts`, `DeleteUsageEntryButton`; דיאלוג שואל אם להחזיר את הסכום ליתרת הכרטיס. חריגה מוגבלת ל-immutability של #4, ראו `docs/DECISIONS.md` #12 |
| ניהול רשימות כרטיסים | ✅ הושלם | Phase 3.1 — כל כרטיס שייך לרשימה אחת (`cardLists`, `cards.listId`). `/cards` מציג את רשימות המשתמש, `/cards/lists/[listId]` מנהל את הכרטיסים של רשימה בודדת (כולל שינוי שם ומחיקת רשימה ריקה). ביצירת כרטיס ראשון בלי רשימות קיימות, `CardForm` יוצר רשימה ראשונית אוטומטית; אחרת נדרשת בחירה דרך `ListSelect` (כולל "+ רשימה חדשה"). ראו `docs/DECISIONS.md` #13 |
| מחיקת כרטיס | ✅ הושלם | Phase 3.1 — `src/actions/card.ts` (`deleteCard`, Admin SDK), `DeleteCardButton` (דיאלוג אישור) בשורת הכרטיס ב-`/cards/lists/[listId]` ובעמוד פרטי הכרטיס. מוחק גם את `usageLog` (recursiveDelete) וגם קבצי Storage (תמונת כרטיס/קבלות). ראו `docs/DECISIONS.md` #14 |
| שיתוף רשימות (מנהל/צופה, הזמנה לפי אימייל+אישור) | ✅ הושלם | Phase 3.2 — `cardLists/{listId}/members`, `src/actions/listShare.ts` (`inviteListMember`), `ShareListDialog` (ניהול שיתוף לבעלים), `PendingInvitationsPanel` (קבלה/דחייה למוזמן) ב-`/cards`. "מנהל" מנהל כרטיסים/שימושים/יתרה כמו הבעלים; "צופה" קריאה בלבד. העלאת תמונת כרטיס/קבלה נשארה לבעלים בלבד (מגבלת Storage Rules). ראו `docs/DECISIONS.md` #15 |
| ייצוא נתונים (GDPR) | ⏳ מתוכנן | Phase 4 |
| מחיקת חשבון מלאה (GDPR) | ⏳ מתוכנן | Phase 4 |
| App Check | ⏳ מתוכנן | Phase 4 |
| הצפנת שדות רגישים (מספר כרטיס, CVV) בבסיס הנתונים | ⏳ מתוכנן | Phase 4 |
| צ'אטבוט/CLI לשיחה חופשית (הוספה/עריכה/מחיקה/שאילתה בשפה טבעית) | ⏳ מתוכנן | Phase 5 — MCP tools, ראו `docs/DECISIONS.md` #17 |
| PWA (installable, offline) | ⏳ מתוכנן | Phase 6 |
| התראות תפוגה (push/email) | ⏳ מתוכנן | Phase 7 |
| דוחות וסטטיסטיקות | ⏳ מתוכנן | Phase 8 |
