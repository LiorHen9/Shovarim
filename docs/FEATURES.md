# FEATURES

מצב נוכחי של פיצ'רי מוצר. עדכן בכל פעם שפיצ'ר זז שלב.

| פיצ'ר | סטטוס | הערות |
|---|---|---|
| תשתית פרויקט (Next.js/Firebase/shadcn) | ✅ הושלם | Phase 0 |
| Security Rules (deny-by-default) | ✅ הושלם ונבדק | Phase 0/1 — 19 טסטים ב-`tests/rules/firestore.test.ts` עוברים |
| Google Sign-In | ✅ הושלם | Phase 1 — `src/components/auth/SignInButtons.tsx` + session cookie |
| Apple Sign-In | ⏳ מתוכנן, ממתין ל-Developer Account | Phase 7 — ה-abstraction layer מוכן (`src/lib/auth/`) |
| CRUD כרטיסים (create/list/edit/archive) | ✅ הושלם | Phase 1 — `/cards`, `/cards/new`, `/cards/[cardId]`. עריכה מוגבלת בכוונה לשם/תוקף/מספר כרטיס — יתרה/מטבע לא ניתנים לעריכה ישירה (רק דרך יומן שימושים), ראו `docs/DECISIONS.md` |
| יומן שימושים + מטרת שימוש | ✅ הושלם | Phase 1 — `src/actions/usage.ts`, עדכון יתרה אטומי בטרנזקציה, מונע overdraft |
| Consent banner + Privacy Policy | ✅ הושלם | Phase 1 — חוסם UI עד הסכמה, `/privacy` ו-`/terms` עם תוכן אמיתי |
| Categories (system defaults) | ✅ הושלם | Phase 1 — `npm run seed:categories`; קטגוריות מותאמות אישית עדיין ב-Phase 2 |
| תמונות כרטיס/קבלות | ⏳ מתוכנן | Phase 2 |
| קטגוריות/תגיות מותאמות אישית | ⏳ מתוכנן | Phase 2 |
| התראות תפוגה (push/email) | ⏳ מתוכנן | Phase 3 |
| דוחות וסטטיסטיקות | ⏳ מתוכנן | Phase 4 |
| ייצוא נתונים (GDPR) | ⏳ מתוכנן | Phase 5 |
| מחיקת חשבון מלאה (GDPR) | ⏳ מתוכנן | Phase 5 |
| App Check | ⏳ מתוכנן | Phase 5 |
| PWA (installable, offline) | ⏳ מתוכנן | Phase 6 |
