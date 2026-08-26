# ROADMAP

עדכון בתחילת כל session: מה הושלם, מה הבא. פירוט פיצ'ר-אחר-פיצ'ר ב-`docs/FEATURES.md`.

## Phase 0 — Infrastructure ✅ הושלם (2026-08-25)
- Next.js 16 scaffold (TypeScript strict, App Router, Tailwind v4)
- shadcn/ui init עם `--rtl`, קומפוננטות בסיס (button/input/label/card/dialog/dropdown-menu/sonner/badge/select/popover/calendar/avatar/separator/skeleton)
- Firebase config: `firebase.json`, `.firebaserc` (demo project), `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- `src/lib/firebase/{client,admin}.ts`, `src/lib/auth/{authService,providers,googleProvider}.ts`
- טיפוסים (`src/types/`) + Zod schemas (`src/lib/validation/`) עבור cards/usageLog
- `docs/*.md` + root `CLAUDE.md`
- אימות: `npm run dev`/`typecheck`/`lint` נקיים, `npm --prefix functions run build` נקי
- Eclipse Temurin JRE 21 הותקן (winget), Firestore+Auth+Storage emulators נבדקו ועולים יחד ללא שגיאות קומפילציה ב-`firestore.rules`/`storage.rules`

## Phase 1 — MVP ✅ הושלם (2026-08-25)
- Google Sign-In מלא (popup → ID token → Server Action `createSession` יוצרת session cookie `__session` + `users/{uid}` ב-first login)
- `src/proxy.ts` (לא `middleware.ts` — ראה `docs/DECISIONS.md` #8) מגן על `(protected)` ברמת fast-path, אימות מלא ב-`(protected)/layout.tsx`
- CRUD כרטיסים מלא (create/list/edit/archive) דרך client SDK + Security Rules
- Usage log: `src/actions/usage.ts` (Server Action, Admin SDK transaction) — מונע overdraft, מעדכן `currentBalance` אטומית
- Categories: system defaults, נזרעות דרך `npm run seed:categories`
- Security Rules מלאות + 19 טסטים ב-`tests/rules/firestore.test.ts` (`npm run test:rules`) — כולם עוברים מול Firestore emulator
- Consent banner (חוסם UI עד הסכמה) + Privacy Policy + Terms pages אמיתיים
- Layout רספונסיבי בסיסי (Header + nav + dropdown משתמש)
- אימות: `typecheck`/`lint`/`build` נקיים, dev server + emulators נבדקו יחד (proxy redirect, דפים ציבוריים) ידנית דרך curl

**נשאר לבדוק ידנית (לא אוטומטי עדיין)**: זרימת Google sign-in אמיתית בדפדפן (לא נבדקה עם browser automation — Playwright עדיין לא מותקן, ראו Phase 6/verification gap).

## Phase 2 — Media & Enrichment ✅ הושלם (2026-08-25)
- תמונות כרטיס/קבלות דרך Storage: `src/lib/storage/upload.ts` (`uploadCardImage`/`uploadReceiptImage`), `ImageDropInput`, `CardImageUpload` על עמוד פרטי הכרטיס, thumbnail ברשימת כרטיסים ותמונת קבלה ביומן שימושים. ה-id (כרטיס/רשומת שימוש) נוצר בצד הלקוח (`doc()` ללא כתיבה) לפני ההעלאה, כך שהעלאת הקובץ מתבצעת לפני יצירת המסמך — תואם את עקרון ה-immutability של יומן השימושים (`docs/DECISIONS.md` #3/#4/#10)
- קטגוריות/תגיות מותאמות אישית: `useCategories` (query `ownerId in ["system", uid]`), `CategorySelect` עם יצירה מהירה (`CreateCategoryDialog`), `TagsInput` נגיש, ניהול (עריכה/מחיקה) קטגוריות אישיות ב-`/settings` (`CategoryManager`) — קטגוריות מערכת מוצגות read-only
- שיפור נגישות טפסים: כל שדה חדש עם `Label`/`aria-describedby`/תמונות עם `alt` משמעותי, `TagsInput` נגיש למקלדת עם `aria-live` announcements, אזור יתרת הכרטיס עטוף ב-`aria-live="polite"`
- אימות: `typecheck`/`lint`/`build` נקיים, `test:rules` (19 טסטים) עוברים ללא שינוי — לא נדרש שינוי ב-`firestore.rules`/`storage.rules` (המסלולים כבר היו מוגדרים מ-Phase 0/1)

**נשאר לבדוק ידנית**: Lighthouse Accessibility ו-NVDA על הזרימות החדשות (ראו `docs/ACCESSIBILITY.md`).

## Phase 3 — ניהול כרטיס מתקדם ✅ הושלם (2026-08-26)
- עדכון יתרה ידני: `src/actions/balance.ts` (`updateCardBalance`, Server Action + `runTransaction`), `UpdateBalanceDialog` בעמוד פרטי הכרטיס — לא יוצר רשומת `usageLog`, חריגה מתועדת ב-`docs/DECISIONS.md` #11
- שדה `acceptingRetailersUrl` (URL לרשתות מכבדות) ב-`createCardSchema`/`editCardDetailsSchema`, טופס הוספה/עריכה
- שדה `cvv` (3–4 ספרות) ב-`createCardSchema`/`editCardDetailsSchema`, בסמוך לשדה התוקף בטופס הוספה/עריכה — מאוחסן כמו `barcodeOrCode` (ללא הצפנת application-level, ראו `docs/SECURITY.md`)
- אימות: `typecheck`/`lint`/`build` נקיים, `test:rules` (19 טסטים) עוברים ללא שינוי — לא נדרש שינוי ב-`firestore.rules` (כלל ה-update הקיים על `cards` כבר מתיר כל שדה חוץ מ-`ownerId`, ועדכון היתרה הידני עובר Admin SDK כמו יומן השימושים)

**נשאר לבדוק ידנית**: קליק-דרך בדפדפן (יצירת/עריכת כרטיס עם CVV+URL, עדכון יתרה ידני מקצה לקצה) — Playwright עדיין לא מותקן (ראו gap מ-Phase 1/2).

## Phase 3.1 — ניהול רשימות כרטיסים ✅ הושלם (2026-08-26)
- `cardLists/{listId}` (collection חדש) + שדה חובה `cards.listId` — כל כרטיס שייך לרשימה אחת, נאכף גם ב-`firestore.rules` (`create` דורש `listId` לא ריק)
- `/cards` הפך לעמוד סקירת רשימות (folders + מספר כרטיסים), `/cards/lists/[listId]` (חדש) הוא עמוד ניהול הכרטיסים בתוך רשימה בודדת (כולל שינוי שם ומחיקת רשימה ריקה); `/cards/[cardId]` מקשר בחזרה לרשימה שלו במקום לעמוד הכללי
- `CardForm`: כרטיס ראשון בלי רשימות קיימות → יצירת רשימה ראשונית ("הרשימה שלי") אוטומטית; אחרת שדה רשימה חובה דרך `ListSelect` (כולל "+ רשימה חדשה" באותו pattern כמו `CategorySelect`); `?listId=` ב-`/cards/new` מדלג על הבחירה כשמגיעים מתוך עמוד רשימה קיימת
- אימות: `typecheck`/`lint`/`build` נקיים, `test:rules` — 25/25 עוברים (19 קיימים + 6 חדשים ל-`cardLists`/דרישת `listId`), ראו `docs/DECISIONS.md` #13
- מחיקת כרטיס: `src/actions/card.ts` (`deleteCard`, Server Action + Admin SDK `recursiveDelete` + ניקוי Storage), `DeleteCardButton` בשורת הכרטיס ב-`/cards/lists/[listId]` ובעמוד פרטי הכרטיס (`/cards/[cardId]`, מפנה בחזרה לרשימה אחרי מחיקה) — שני המקומות עם דיאלוג אישור. `firestore.rules` לא שונה (`allow delete` על `cards` כבר היה קיים). ראו `docs/DECISIONS.md` #14
- אימות: `typecheck`/`lint`/`build` נקיים לאחר הוספת מחיקת כרטיס

**נשאר לבדוק ידנית**: קליק-דרך בדפדפן (יצירת כרטיס ראשון עם יצירת רשימה אוטומטית, יצירת כרטיס נוסף עם בחירת/יצירת רשימה, שינוי שם/מחיקת רשימה, מחיקת כרטיס משני המקומות + אישור שה-usageLog/תמונות נמחקו בפועל).

## Phase 3.2 — שיתוף רשימות ✅ הושלם (2026-08-26)
- `cardLists/{listId}/members/{memberUid}` (subcollection חדש) — הרשאה פר-משתמש (`manager`/`viewer`), שנבחרת ומשתנה על ידי בעל הרשימה בלבד. הזמנה לפי אימייל + אישור מהמוזמן: `inviteListMember` (`src/actions/listShare.ts`, Admin SDK) מפענח אימייל ל-uid ויוצר מסמך `status:"pending"`; קבלה/דחייה היא כתיבת client רגילה על ידי המוזמן. ראו `docs/DECISIONS.md` #15
- `firestore.rules`: קריאה על `cards`/`usageLog` נפתחה לכל חבר מאושר ברשימה; יצירה/עדכון/מחיקה על `cards` גם למי שהוא `manager` מאושר. כתיבת `usageLog`/עדכון יתרה/מחיקת כרטיס נשארו אך ורק דרך Server Actions קיימים, שהורחבו לבדוק גם חברות מאושרת (`src/lib/auth/listAccess.ts`)
- UI: `ShareListDialog` (ניהול הזמנות/הרשאות/הסרה, לבעלים בלבד) ב-`/cards/lists/[listId]`, `PendingInvitationsPanel` (קבלה/דחייה) ב-`/cards`, תג "משותפת" לרשימות לא-בבעלות, הסתרת פעולות ניהול (עריכה/מחיקה/הוספת שימוש/עדכון יתרה) מ-"צופה"
- מגבלה מכוונת: העלאת תמונת כרטיס/קבלה נשארה לבעלים בלבד — `storage.rules` לא הורחבו לתמוך במנהלים משותפים (ידרוש `firestore.get()` צולב-שירות שלא נבדק)
- אימות: `typecheck`/`lint`/`build` נקיים, `test:rules` — 40/40 עוברים (25 קיימים + 15 חדשים לשיתוף)

**נשאר לבדוק ידנית**: קליק-דרך בדפדפן עם שני חשבונות אמיתיים (הזמנה, קבלה/דחייה, פעולות מנהל/צופה בפועל על רשימה משותפת).

## Phase 3.3 — תשתית Deploy ו-CI/CD ✅ הושלם (2026-08-27)
Firebase App Hosting (Next.js SSR) + Cloud Functions, פרויקט production יחיד (`shovarim-prod`, region `europe-west4`, backend `shovarim-web`). GitHub Actions: quality gate (typecheck/lint/build/test:rules) על כל PR, deploy אוטומטי ל-Firestore rules/indexes/Storage rules/Functions ב-push ל-main — אומת בפועל (`deploy-rules-and-functions` הצליח על שני ה-push-ים האחרונים ל-main). App Hosting עצמו נפרס אוטומטית דרך Cloud Build (git-integrated), בנפרד מ-GitHub Actions. סוגר את ADR #5 (ראו ADR #16). פרטים מלאים + תוצאות ב-`docs/DEPLOYMENT.md`.
- Rollout ראשון הצליח אחרי תיקון שתי תקלות: (1) משתני Admin SDK היו `RUNTIME`-only ב-`apphosting.yaml` בעוד ש-`next build` צריך אותם גם ב-`BUILD` בגלל init עייז ב-`adminApp.ts`; (2) גרסה ראשונה של סוד `FIREBASE_ADMIN_PRIVATE_KEY` ב-Secret Manager הייתה פגומה (נחתכה בהדבקה אינטראקטיבית) — תוקן ע"י הזרקה מחדש דרך `--data-file` מקובץ ה-service-account המקורי.
- Smoke test אוטומטי (curl: SSR רינדור נכון, הגנת routes, CDN לא cache-ת redirects) + Google Sign-In ידני על ה-URL החי — עברו. תיקון נדרש: הוספת דומיין ה-App Hosting ל-Authorized domains ב-Firebase Auth (לא היה שם כברירת מחדל, גרם ל-`auth/unauthorized-domain` מיידי). פירוט מלא ב-`docs/DEPLOYMENT.md`.
- תרגול rollback אחד (rollback ל-commit קודם + roll-forward) בוצע ואומת בהצלחה, כולל אימות חיצוני דרך GitHub checks.

**נשאר לבדוק ידנית**: קליק-דרך בדפדפן על ה-URL החי עם התחברות אמיתית — יצירת/עריכת/מחיקת כרטיס, יומן שימושים, עדכון יתרה, העלאת תמונה, יצירה+שיתוף רשימה עם חשבון שני. לא בוצע אוטומטית (Playwright עדיין לא מותקן — אותו gap כמו Phase 1/2/3/3.1/3.2).

## Phase 4 — Privacy Hardening
Export מלא, מחיקת חשבון מלאה (grace period), audit log, App Check, security review מקיף, הצפנת שדות רגישים (מספר כרטיס, CVV) בבסיס הנתונים.

## Phase 5 — צ'אטבוט/CLI לשיחה חופשית
שיחה חופשית בשפה טבעית מעל הנתונים (הוספה/עריכה/מחיקה/שאילתה על כרטיסים, יומן שימושים, יתרות, רשימות), חשוף דרך CLI פנימי לבדיקה ובהמשך WhatsApp/Telegram. סוגר החלטה ארכיטקטונית ב-`docs/DECISIONS.md` ADR #17.

- **ממשק כלים ל-LLM: MCP, לא OpenAPI/Swagger ציבורי** — שרת MCP פנימי (`functions/src/mcp/` או package ייעודי) חושף tools (`listCards`, `getCard`, `createCard`, `updateCard`, `deleteCard`, `logUsage`, `deleteUsageEntry`, `updateBalance`, `listCardLists`, `createList`, ...). MCP הוא הפרוטוקול הטבעי לצריכה על ידי LLM עם tool-calling (Claude), ואין צורך חיצוני שמצדיק REST ציבורי מתועד ב-Swagger — הצרכן היחיד הוא שכבת האורקסטרציה שלנו. אפשר לשקול generate OpenAPI spec מאותם Zod schemas בעתיד רק אם ייווסף צרכן חיצוני שאינו MCP-aware (deferred, לא כרגע).
- **שכבת שירות משותפת** — הלוגיקה הקיימת ב-`src/actions/*.ts` (ownership checks, Zod validation, `runTransaction`) מחולצת/מנוצלת מחדש על ידי ה-MCP tools, לא מיושמת פעמיים. שני הנתיבים (Server Actions ל-UI, MCP tools לצ'אטבוט) קוראים לאותה שכבת לוגיקה — כדי שתיקון אבטחה/ולידציה בנתיב אחד לא ישכח מהשני.
- **מנגנון הרשאות — הליבה של הפיצ'ר**: ה-`uid` הפועל **תמיד** נגזר בצד שרת (session cookie מאומת ב-CLI, מיפוי ערוץ→uid מאומת ב-WhatsApp/Telegram) ולעולם לא מתקבל כפרמטר מה-LLM — סכימות ה-input של ה-tools לא כוללות שדה `uid`/`ownerId` בכלל, כדי שאי אפשר יהיה "לשכנע" את המודל (prompt injection או הזיה) לפעול בשם משתמש אחר. כל tool קורא לאותן פונקציות אכיפת בעלות/שיתוף קיימות (`src/lib/auth/listAccess.ts`) — לא מימוש מקביל.
- **אישור מפורש לפעולות הרסניות** — מחיקת כרטיס/רשומת שימוש דרך הצ'אטבוט דורשת סבב אישור בשיחה (המודל שואל, מחכה לתשובה חיובית מפורשת, ורק אז קורא ל-tool) — מפחית סיכון לפירוש שגוי של טקסט חופשי מעורפל שגורם לאובדן נתונים בלתי הפיך.
- **Semantic cache מבודד לפי משתמש** — מפתח ה-cache חייב לכלול `uid`, לעולם לא cache משותף בין משתמשים (התשובות עשויות לכלול נתונים אישיים/פיננסיים). שאילתות שחושפות `cvv`/`barcodeOrCode` לא נשמרות ב-cache כלל.
- **הרחבת audit log** — כל קריאת tool (מי, איזה tool, פרמטרים ללא סודות, תוצאה, ערוץ) נכתבת ל-`auditLog` (collection שכבר קיים ב-`docs/DATA_MODEL.md`, נכתב היום רק בהקשר מחיקת חשבון).
- **Rate limiting per-uid** על שכבת הרצת ה-tools — ערוצי WhatsApp/Telegram הם משטח תקיפה חדש (spoofing של מספר טלפון) בהשוואה לאפליקציית ה-web המאומתת מול Google.
- **קישור ערוץ→משתמש** (WhatsApp/Telegram) — collection חדש (`channelLinks/{channelId}` או שדה ב-`users/{uid}`) שידרוש עדכון `firestore.rules`+`docs/DATA_MODEL.md` בזמן המימוש בפועל (ראו כלל קבוע ב-`CLAUDE.md`). זרימת linking (קוד אימות חד-פעמי מהאפליקציה) לא מתוכננת עדיין ברמת המימוש.
- **App Check + Secret Manager** — טוקני בוט WhatsApp/Telegram ומפתח Anthropic API כ-`secret:` references, לא plaintext, באותו pattern כמו `FIREBASE_ADMIN_PRIVATE_KEY` ב-`apphosting.yaml`/Cloud Functions config.

**נשאר לבדוק בזמן המימוש**: בחירת ה-runtime ל-MCP server (בתוך Cloud Functions מול תהליך נפרד), ולידציית latency של semantic cache, ו-threat-modeling ממוקד ל-prompt injection על קלט חופשי (ראו הרחבה ב-`docs/SECURITY.md`).

## Phase 6 — PWA & Polish
manifest, service worker, offline indicators, ביצועים.
(הערה: החלטת ה-hosting/deploy טופלה מוקדם יותר ב-Phase 3.3 — לא כאן, בניגוד למה שנרמז במקור ב-ADR #5.)

## Phase 7 — Notifications
Cloud Function מתוזמן לתזכורות תפוגה, FCM push, email (Firebase Extension / Resend).

## Phase 8 — Reports & Analytics
דשבורד יתרות/תפוגות/מגמות, אגרגציות מחושבות server-side (לא client-side על datasets גדולים).
