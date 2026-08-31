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

**נשאר לבדוק ידנית**: זרימת ה-popup של Google sign-in עצמה (Google חוסם דפדפנים אוטומטיים) — הזרימה שאחריה (session cookie, יצירת `users/{uid}`, redirect ל-dashboard) כן אוטומטית כעת דרך Playwright, ראו תשתית E2E למטה.

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

**נשאר לבדוק ידנית**: עריכת כרטיס קיים (כולל CVV+URL) ועדכון יתרה ידני מקצה לקצה — יצירת כרטיס בסיסית (שם + יתרה) כבר מכוסה אוטומטית ב-`tests/e2e/cards.spec.ts`, ראו תשתית E2E למטה.

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

**נשאר לבדוק ידנית**: קליק-דרך בדפדפן על ה-URL החי עם התחברות Google אמיתית — יצירת/עריכת/מחיקת כרטיס, יומן שימושים, עדכון יתרה, העלאת תמונה, יצירה+שיתוף רשימה עם חשבון שני. Playwright (ראו תשתית E2E למטה) מכסה אוטומטית זרימות מקבילות מול ה-emulator המקומי/CI בלבד — לא מריץ מול ה-URL החי, ולא יכול לדמות את ה-popup של Google עצמו.

## תשתית E2E (Playwright) ✅ הושלם (2026-08-27)
- `@playwright/test` (chromium בלבד כרגע) מותקן, `npx playwright test` / `npm run test:e2e`; קונפיג ב-`playwright.config.ts` — `webServer` מריץ `npm run dev` מול Firebase Emulators (`.env.local`), אף פעם לא מול פרויקט אמיתי
- כניסה אוטומטית ל-E2E ללא Google popup אמיתי (חסום לדפדפנים אוטומטיים): עמוד בדיקה בלבד `src/app/(public)/e2e/sign-in/page.tsx` + Server Action `src/actions/testAuth.ts` (`mintTestCustomToken`, נעול ל-`FIREBASE_USE_EMULATOR=true` בלבד) — עובר באותו נתיב `signInWithCustomToken` → `createSession` כמו כניסה אמיתית. ראו `docs/DECISIONS.md` #23
- כיסוי נוכחי: `tests/e2e/public.spec.ts` (עמוד נחיתה, redirect למי שלא מחובר, terms/privacy), `tests/e2e/dashboard.spec.ts` (dashboard ריק למשתמש חדש), `tests/e2e/cards.spec.ts` (יצירת כרטיס בסיסית מקצה לקצה)
- CI: `.github/workflows/ci.yml` מתקין chromium (`playwright install --with-deps`) ומריץ `test:rules && test:e2e` יחד בתוך אותו `firebase emulators:exec`; דוח HTML מועלה כ-artifact בכישלון
- **נשאר**: הרחבת כיסוי לעריכת כרטיס/עדכון יתרה/שיתוף רשימות (ראו ה"נשאר לבדוק ידנית" בפאזות למעלה), ולא מכסה ולא יכול לכסות את ה-popup האמיתי של Google או את ה-URL החי ב-production
- **תוקן**: `/e2e/sign-in` נכשל בבנייה (`useSearchParams()` בלי Suspense boundary) — תוקן ע"י עטיפה ב-`<Suspense>`, ה-branch מוזג עם `main` העדכני (כולל שלב 5.2) ופתר קונפליקטים ב-`docs/DECISIONS.md` (מספור ADR — E2E הפך ל-#23) וב-`package.json`

## Phase 4 — Privacy Hardening

### שלב 4.1 — ייצוא נתונים (Right to Access/Portability) ✅ הושלם (2026-08-27)
`src/lib/services/export.ts` (`buildUserDataExport(uid)`) — אוסף `users/{uid}`, `consents/{uid}`, `cardLists` בבעלות המשתמש (כולל `members` subcollection), חברויות ברשימות של אחרים (`members` collection-group על `memberUid`), `cards` בבעלות המשתמש (כולל `usageLog` subcollection) ו-`categories` בבעלות המשתמש, ל-JSON אחד עם timestamps כ-ISO strings. Server Action `exportUserData` (`src/actions/privacy.ts`, ללא פרמטר `uid` — נגזר מה-session בלבד) כותבת `auditLog` עם `eventType:"export"`. `ExportDataButton` (`src/components/settings/ExportDataButton.tsx`) ב-`/settings` מפעילה הורדת קובץ בדפדפן. בשונה מסריאליזציה ל-LLM (`mcp-server/index.ts`), `cvv`/`barcodeOrCode` **כן** נכללים — זה המידע האישי של המשתמש חוזר אליו, לא נחשף למודל.
- **שכבת audit log משותפת**: `src/lib/audit/log.ts` (`writeAuditLog`) חולצה מ-`mcp-server/index.ts` (שהשתמשה בה בעצמה קודם רק ל-`mcp_tool_call`) כדי ששני הנתיבים (Server Actions, MCP) יכתבו באותו פורמט.
- **טווח מכוון**: לא כולל את הנתונים של כרטיסים/רשומות שימוש ברשימות משותפות שהמשתמש רק צופה/מנהל בהן (אלה נתוני משתמש אחר, לא שלו) — ראו הבחנה דומה ב-`docs/SECURITY.md`.
- אימות: `typecheck`/`lint`/`build` נקיים, `test:rules` — 40/40 עוברים ללא שינוי (לא נדרש שינוי ב-`firestore.rules`, הכל דרך Admin SDK). E2E חדש: `tests/e2e/settings.spec.ts` (יצירת כרטיס → ייצוא → אימות תוכן הקובץ שהורד) — עבר מול ה-emulator.
- **תיקון פרודקשן (2026-08-30, ADR #32)**: הייצוא נכשל בפרודקשן — קודם 404 ואז 500 — משתי סיבות שאינן קשורות זו לזו: מסמך כרטיס שנכתב לפני שהשדות `cvv`/`barcodeOrCode` נוספו הפיל את `decryptNullableField` על `undefined.split`, ומזהי ה-Server Actions התחלפו בכל rollout. תוקן ב-`fieldEncryptionCore.ts` (נרמול `undefined`), בקיבוע `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, ובהצגת ה-`digest` בלקוח במקום toast גנרי. אגב זה: `requireUid()` עבר ל-`ActionError` (session שפג החזיר 500), וקטגוריות שהמשתמש יצר מיוצאות עכשיו עם ה-doc id שלהן. כיסוי חדש: `tests/unit/fieldEncryption.test.ts` + E2E שמוחק את שני השדות דרך REST של ה-emulator (שניהם נכשלים בלי התיקון — נבדק).
- **תיקון פרודקשן (2026-08-30, ADR #33) — הסיבה האמיתית**: אחרי ה-rollout של #32 הייצוא עדיין נכשל, גם למשתמש ללא כרטיסים. ה-`digest` שנוסף ב-#32 הוביל לשורת הלוג: `FAILED_PRECONDITION — requires a COLLECTION_GROUP_ASC index for collection members and field memberUid`. הייצוא הוא הצרכן היחיד שמריץ `where("memberUid","==",uid)` בלי `status` (כדי לכלול הזמנות pending), ו-Firestore לא יוצר אינדקס single-field ב-collection-group באופן אוטומטי. תוקן ב-`fieldOverrides` ב-`firestore.indexes.json`. אותו תיקון סוגר באג חבוי זהה ב-`functions/src/accountDeletion.ts` (שלב 4.2). הבאג של #32 היה אמיתי אך חבוי — שאילתת האינדקס רצה לפניו ב-`Promise.all` ולכן פרודקשן מעולם לא הגיע אליו. **אין E2E חדש בכוונה**: האמולטור בונה אינדקס לכל שאילתה ולכן עיוור לכשל הזה.

### שלב 4.2 — מחיקת חשבון מלאה (Right to Erasure, grace period) ✅ הושלם (2026-08-27)
זרימה דו-שלבית לפי `docs/PRIVACY.md`: (1) `requestAccountDeletion`/`cancelAccountDeletion` (`src/actions/privacy.ts`, Server Actions, Admin SDK) קובעות/מאפסות `users/{uid}.deletionRequestedAt` — idempotent, הפיך לחלוטין עד שה-sweep רץ. UI: `DeleteAccountSection` ב-`/settings` (דיאלוג אישור לבקשה, כרטיס inline לביטול) + `DeletionPendingBanner` — באנר גלובלי לא-חוסם ב-`(protected)/layout.tsx` (לצד `ConsentBanner`), כדי שבקשה פתוחה תהיה גלויה בכל עמוד ולא רק ב-Settings. (2) ה-Cloud Function המתוזמן **הראשון** בפרויקט: `functions/src/index.ts` (`deleteExpiredAccounts`, `onSchedule("0 3 * * *", ...)`, region `europe-west4` תואם ל-App Hosting) קורא ל-`functions/src/accountDeletion.ts` (`sweepExpiredAccountDeletions`) שסורק משתמשים שחלף עליהם חלון grace של 30 יום ומוחק אותם בפועל (`deleteUserAccount`: Firestore/Storage לפני Auth, `auditLog` נכתב לפני שמתחילים) — ראו `docs/DECISIONS.md` #24 לפירוט המלא כולל למה `functions/` נשאר עצמאי (לא משתף קוד עם `src/`) וסקריפט האימות הידני (`scripts/sweep-account-deletions.ts`, `npm run sweep:account-deletions -- <uid>`) שמריץ את קוד ה-production האמיתי דרך `tsx` בלי לשכפל אותו.
- אימות: `typecheck`/`lint`/`build` (גם באפליקציה וגם ב-`functions/`) נקיים, `test:rules` — 40/40 עוברים ללא שינוי (לא נדרש שינוי ב-`firestore.rules`). E2E חדש: `tests/e2e/settings.spec.ts` (בקשת מחיקה → אימות תאריך בבאנר הגלובלי ובעמוד ה-settings → ביטול) — עבר מול ה-emulator.

**נשאר לבדוק ידנית**: הרצת `npm run sweep:account-deletions -- <uid>` על משתמש עם נתונים אמיתיים (כרטיסים/רשימות/יומן שימושים/תמונות) מול ה-emulator, לאימות שה-cascade deletion המלא (Firestore+Storage+Auth) עובד מקצה לקצה — לא ניתן לבדוק את זה אוטומטית ב-Playwright (לא ניתן "לקפוץ" 30 יום, וה-scheduled trigger עצמו לא ניתן לדימוי מהימן ב-Firebase emulators).

### שלב 4.3 — הצפנת שדות רגישים ✅ הושלם (2026-08-27)
`src/lib/crypto/{fieldEncryptionCore,fieldEncryption}.ts` (AES-256-GCM, מפתח `CARD_FIELD_ENCRYPTION_KEY`) — `cvv`/`barcodeOrCode` מוצפנים לפני כתיבה ל-Firestore ומפוענחים רק על-פי דרישה. יצירה/עריכה של כרטיס (רק שני השדות הרגישים, לא שאר ה-CRUD) עברו מ-client SDK ישיר ל-Server Actions חדשים (`createCard`/`updateCardDetails`/`getCardSecrets` ב-`src/actions/card.ts`) כדי שהמפתח לעולם לא יגיע ל-client — ראו `docs/DECISIONS.md` #25 לפירוט המלא כולל השלכות על `EditCardDialog`/`buildUserDataExport`. סקריפט מיגרציה חד-פעמי אידמפוטנטי: `scripts/migrate-encrypt-sensitive-fields.ts` (`npm run migrate:encrypt-fields`).
- אימות: `typecheck`/`lint`/`build` נקיים, `test:rules` — 40/40 עוברים ללא שינוי (לא נדרש שינוי ב-`firestore.rules`, תוכן השדה לא נבדק שם).

**בוצע (2026-08-29)**: `npm run migrate:encrypt-fields` הורץ מול production על ידי המשתמש.

**נשאר לבדוק ידנית**: קליק-דרך בדפדפן על יצירת/עריכת כרטיס עם CVV/מספר כרטיס, לאימות שהערך חוזר נכון בעריכה ובייצוא נתונים.

### שלב 4.4 — Firebase App Check ✅ קוד הושלם (2026-08-27), הקמת Console נשארה ידנית
`src/lib/firebase/appCheck.ts` (מאותחל מ-`src/lib/firebase/client.ts`) + מצב debug ל-dev/CI מול emulators (`NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG`, מוגדר כברירת מחדל ב-`.env.local`). ראו `docs/DECISIONS.md` #26. **עודכן 2026-08-29**: ה-provider הוחלף מ-reCAPTCHA v3 קלאסי ל-**reCAPTCHA Enterprise** (`ReCaptchaEnterpriseProvider`) אחרי ש-Firebase Console סימן את v3 כ-deprecated ל-App Check — ראו ADR #28.
**בוצע (2026-08-29)**: מפתח reCAPTCHA Enterprise נוצר ב-Google Cloud Console עבור `shovarim-web--shovarim-prod.europe-west4.hosted.app`, נרשם ב-Firebase Console, ומולא ב-`apphosting.yaml` (`6LcPWZ4t...`). רישום ב-Console **לבדו לא הספיק** — הערך נצרב ל-bundle בזמן build ומגיע רק מה-YAML, וזו הסיבה ש-App Check היה כבוי בשקט עד כה.

**הושלם במלואו (2026-08-29)**: אחרי ה-merge וה-rollout אומת ב-URL החי שאין `[app-check] ... placeholder` ב-console של הדפדפן, אומתו **verified requests** ב-Firebase Console, ורק אז הופעל **Enforce** על Firestore ו-Storage (על ידי המשתמש, ידנית). threat #4 ב-`docs/SECURITY.md` — כתיבות ישירות ל-REST API שעוקפות את ה-UI — **סגור**. שלב 4.4 סגור לחלוטין, קוד והקמה כאחד.

### שלב 4.5 — Security review מקיף ✅ הושלם (2026-08-27)
סקירה עם ה-skill `security-review` (סוכן מבודד, מוגבל לשינויים ב-branch הזה) על שלבים 4.3/4.4 — מצאה פרצה אמיתית: `createCard`/`updateCardDetails`/`getCardSecrets` קיבלו `cardId`/`listId` ללא הגבלת תווים, ומכיוון ש-Server Actions ניתנים לקריאה ישירה עם payload שרירותי (לא רק דרך ה-UI) ו-`firebase-admin`'s `.doc()` מפרש `/` כמפריד path, `cardId` מעוצב כמו `"<victimId>/usageLog/<injected>"` יצר מסמך בתת-אוסף של כרטיס אחר בלי בדיקת בעלות — אומת בפועל מול ה-emulator לפני התיקון. **תוקן**: `firestoreIdSchema` חדש (`src/lib/validation/card.ts`) אוכף `^[A-Za-z0-9_-]+$`. ראו `docs/DECISIONS.md` #25 ו-`docs/SECURITY.md` לפירוט המלא.
- אימות אחרי התיקון: `typecheck`/`lint`/`build`/`test:rules` (40/40) נקיים, E2E מלא (8/8, כולל טסט הצפנה חדש) עובר במצב serial (תואם ל-worker count של CI).

## Phase 5 — צ'אטבוט/CLI לשיחה חופשית
שיחה חופשית בשפה טבעית מעל הנתונים (הוספה/עריכה/מחיקה/שאילתה על כרטיסים, יומן שימושים, יתרות, רשימות), חשוף דרך CLI פנימי לבדיקה ובהמשך WhatsApp/Telegram. סוגר החלטה ארכיטקטונית ב-`docs/DECISIONS.md` ADR #17.

- **ממשק כלים ל-LLM: MCP, לא OpenAPI/Swagger ציבורי** — שרת MCP פנימי (`functions/src/mcp/` או package ייעודי) חושף tools (`listCards`, `getCard`, `createCard`, `updateCard`, `deleteCard`, `logUsage`, `deleteUsageEntry`, `updateBalance`, `listCardLists`, `createList`, ...). MCP הוא הפרוטוקול הטבעי לצריכה על ידי LLM עם tool-calling (Claude), ואין צורך חיצוני שמצדיק REST ציבורי מתועד ב-Swagger — הצרכן היחיד הוא שכבת האורקסטרציה שלנו. אפשר לשקול generate OpenAPI spec מאותם Zod schemas בעתיד רק אם ייווסף צרכן חיצוני שאינו MCP-aware (deferred, לא כרגע).
- **שכבת שירות משותפת** — הלוגיקה הקיימת ב-`src/actions/*.ts` (ownership checks, Zod validation, `runTransaction`) מחולצת/מנוצלת מחדש על ידי ה-MCP tools, לא מיושמת פעמיים. שני הנתיבים (Server Actions ל-UI, MCP tools לצ'אטבוט) קוראים לאותה שכבת לוגיקה — כדי שתיקון אבטחה/ולידציה בנתיב אחד לא ישכח מהשני.
- **מנגנון הרשאות — הליבה של הפיצ'ר**: ה-`uid` הפועל **תמיד** נגזר בצד שרת (session cookie מאומת ב-CLI, מיפוי ערוץ→uid מאומת ב-WhatsApp/Telegram) ולעולם לא מתקבל כפרמטר מה-LLM — סכימות ה-input של ה-tools לא כוללות שדה `uid`/`ownerId` בכלל, כדי שאי אפשר יהיה "לשכנע" את המודל (prompt injection או הזיה) לפעול בשם משתמש אחר. כל tool קורא לאותן פונקציות אכיפת בעלות/שיתוף קיימות (`src/lib/auth/listAccess.ts`) — לא מימוש מקביל.
- **אישור מפורש לפעולות הרסניות** — מחיקת כרטיס/רשומת שימוש דרך הצ'אטבוט דורשת סבב אישור בשיחה (המודל שואל, מחכה לתשובה חיובית מפורשת, ורק אז קורא ל-tool) — מפחית סיכון לפירוש שגוי של טקסט חופשי מעורפל שגורם לאובדן נתונים בלתי הפיך.
- **Semantic cache מבודד לפי משתמש** — מפתח ה-cache חייב לכלול `uid`, לעולם לא cache משותף בין משתמשים (התשובות עשויות לכלול נתונים אישיים/פיננסיים). שאילתות שחושפות `cvv`/`barcodeOrCode` לא נשמרות ב-cache כלל.
- **הרחבת audit log** — כל קריאת tool (מי, איזה tool, פרמטרים ללא סודות, תוצאה, ערוץ) נכתבת ל-`auditLog` (collection שכבר קיים ב-`docs/DATA_MODEL.md`, נכתב היום רק בהקשר מחיקת חשבון).
- **Rate limiting per-uid** על שכבת הרצת ה-tools — ערוצי WhatsApp/Telegram הם משטח תקיפה חדש (spoofing של מספר טלפון) בהשוואה לאפליקציית ה-web המאומתת מול Google.
- **קישור ערוץ→משתמש** (WhatsApp/Telegram) — collection חדש (`channelLinks/{channelId}` או שדה ב-`users/{uid}`) שידרוש עדכון `firestore.rules`+`docs/DATA_MODEL.md` בזמן המימוש בפועל (ראו כלל קבוע ב-`CLAUDE.md`). ~~זרימת linking (קוד אימות חד-פעמי מהאפליקציה) לא מתוכננת עדיין ברמת המימוש.~~ **הוכרע בשלב 5.5.a (ADR #29)**: `channelLinks/{channel}:{externalId}` + `channelLinkCodes/{code}`, קוד base32 בן 8 תווים ל-10 דקות שנוצר בזמן שהמשתמש מאומת.
- **App Check + Secret Manager** — טוקני בוט WhatsApp/Telegram ומפתח Anthropic API כ-`secret:` references, לא plaintext, באותו pattern כמו `FIREBASE_ADMIN_PRIVATE_KEY` ב-`apphosting.yaml`/Cloud Functions config.

**נשאר לבדוק בזמן המימוש**: ולידציית latency של semantic cache, ו-threat-modeling ממוקד ל-prompt injection על קלט חופשי (ראו הרחבה ב-`docs/SECURITY.md`). בחירת ה-runtime ל-MCP server הוכרעה לשלב 5.1 (ראו מטה, סוגר ADR #19) — תיבחן מחדש כשמתווספים ערוצי webhook.

### שלב 5.1 — Walking skeleton (tool קריאה יחיד, בביצוע)
מטרה: להוכיח מקצה לקצה שמודל האבטחה (uid נגזר בצד שרת, שכבת שירות משותפת, audit log) עובד בפועל — לפני בניית כל משטח ה-tools. סוגר את החלטת ה-runtime שנשארה פתוחה למעלה, ADR #19.

- **Runtime**: תהליך Node מקומי (`mcp-server/`, stdio transport) — לא Cloud Function. CLI (`scripts/mcp-cli.ts`) מקבל uid כארגומנט, מנפיק לו custom token דרך Admin SDK (`adminAuth.createCustomToken` — האפליקציה תומכת רק ב-Google, אין נתיב סיסמה ל-CLI לנהוג בו) ומחליף אותו client-side ל-ID token אמיתי, שהשרת מאמת עם `adminAuth.verifyIdToken` ונועל uid בסגירה — לא flag/env קבוע.
- **Tool יחיד**: `listCards`, סכימת input ריקה (`z.object({})`) — בכוונה, כדי לאכוף מבנית שאין דרך למודל "להעביר" uid.
- **שכבת שירות חדשה**: `src/lib/services/cards.ts` (`listCardsForUid`) — מקביל בצד Admin SDK ללוגיקת `useCards`/`useCardLists` הקיימת (client-only כרגע). לא extraction מ-Server Action קיים — הקוד השרתי הראשון לקריאת כרטיסים, כדי שגם tools עתידיים וגם Server Actions עתידיים ישתמשו בו במקום לשכפל.
- **Audit log**: כל קריאת tool נכתבת ל-`auditLog` (`src/types/auditLog.ts` — type חדש, ראה `docs/DATA_MODEL.md`).
- **נדחה במפורש** (לא נשכח — צעדים הבאים): tools כותבים/הרסניים + אישור מפורש בשיחה, ערוצי WhatsApp/Telegram (`channelLinks`), semantic cache, rate limiting per-uid, App Check/Secret Manager (מספיק `.env.local` ב-dev).

### שלב 5.2 — מודל+עלות+הפרדת קרדיטים DEV/PROD (קוד הושלם 2026-08-27, הקמת Console/apphosting.yaml נשארה ידנית)
סוגר את ADR #20. `src/lib/mcp/{config,anthropicClient,agentLoop}.ts` (חדשים) — מודל `claude-sonnet-5` (הוחלף מ-`claude-opus-5` הקבוע-קשיח שהיה הגורם המרכזי לעלות ~0.03$/שאלה), prompt caching (`cache_control` על בלוק ה-system, מכסה גם את סכימות ה-tools), compaction (beta) שפותר היסטוריה שגדלה בלי גבול. `agentLoop.ts` מחולץ מ-`scripts/mcp-cli.ts` כדי ש-Route Handler עתידי (שלב 5.4) ישתמש באותה לוגיקה, לא ישכפל. `anthropicClient.ts` מבדיל DEV (`ANTHROPIC_API_KEY` רגיל) מ-PROD (Anthropic-native Workload Identity Federation דרך GCP metadata server — **לא** Firebase, **לא** Vertex AI, ר' ההבהרה ב-ADR #20). `scripts/mcp-cli.ts` עודכן לצרוך את המודולים החדשים; אומת מקצה לקצה מול ה-emulator (tool call, תשובה נכונה, בידוד למשתמש חדש).
**עדכון (2026-08-27)**: הקמת ה-Console (issuer `gcp-workloads`, service account, federation rule matched על `claims.email`+`claims.sub` של `firebase-app-hosting-compute@shovarim-prod.iam.gserviceaccount.com`) ומילוי 4 המשתנים ב-`apphosting.yaml` הושלמו. **נשאר**: אימות בפועל — ה-token exchange לא ניתן לבדיקה עד ש-`apphosting.yaml` יגיע ל-rollout אמיתי (merge ל-`main`), כי רק אז ה-backend החי קורא בפועל ל-metadata server. לבדוק אחרי rollout: `Claude Console → Settings → Workload identity → history` מראה החלפה מוצלחת, וקריאת Claude אמיתית מ-production מצליחה בלי `ANTHROPIC_API_KEY` מוגדר (ר' `docs/DEPLOYMENT.md`).

### שלב 5.3 — Rate limiting per-uid ✅ הושלם (2026-08-28)
`rateLimits/{uid}` + Firestore transaction (`checkAndConsumeRateLimit`, `src/lib/services/rateLimit.ts`), fixed window (30 קריאות/5 דקות, `src/lib/mcp/config.ts`), מרוכז ב-`withToolExecution` wrapper חדש בתוך `mcp-server/index.ts` — `listCards` עבר להשתמש בו במקום try/catch ידני. חסימה מוחזרת כ-tool error רגיל (`isError: true`), לא זריקה — `runAgentTurn` הקיים כבר מעביר את זה למודל כ-`tool_result` עם `is_error:true`. `firestore.rules`: `rateLimits/{uid}` חדש עם `allow read, write: if false` מפורש. סוגר ADR #21.
- אימות: `typecheck`/`lint`/`build` נקיים, `test:rules` — 41/41 עוברים (40 קיימים + טסט חדש ל-`rateLimits`).

אומת ישירות מול ה-emulator: 31 קריאות רצופות ל-`checkAndConsumeRateLimit` על אותו uid — 30 הצליחו, ה-31 נדחתה עם `RateLimitExceededError` ("חרגת ממכסת הבקשות המותרת. נסה שוב בעוד 300 שניות."), מסמך `rateLimits/{uid}` הכיל `count:30` בדיוק.

**נשאר לבדוק ידנית**: הרצת `npm run mcp:cli` בפועל עם 31 קריאות רצופות ל-`listCards` (דורש קריאות Claude אמיתיות), לאימות שההודעה חוזרת דרך המודל בשיחה בפועל ולא מפילה את ה-CLI — הלוגיקה הליבתית (`checkAndConsumeRateLimit`) כן אומתה ישירות למעלה.

### שלב 5.4 — צ'אטבוט ב-UI + סט tools מלא ✅ הושלם (2026-08-28)
Route Handler ראשון באפליקציה (`src/app/api/chat/route.ts`, streaming NDJSON), עמוד `/chat` (`ChatPanel.tsx`), ותשעה MCP tools חדשים (`getCard`, `createCard`, `updateCard`, `deleteCard`, `logUsage`, `deleteUsageEntry`, `updateBalance`, `listCardLists`, `createList`) לצד `listCards` הקיים — 10 סה"כ. סוגר ADR #22, פירוט מלא שם: שכבת שירות משותפת חדשה (`src/lib/services/{cards,usage,balance,cardLists}.ts`, `src/actions/*.ts` הפכו לעטיפות דקות), פיצול `mcp-server/index.ts` לבנייה טהורה (`src/lib/mcp/mcpServer.ts`, `createMcpServer(uid, channel)`) + transport in-process (`InMemoryTransport`) ל-web מול stdio subprocess ל-CLI, אישור מפורש להרסניות (`deleteCard`/`deleteUsageEntry`) דרך system prompt משותף (`src/lib/mcp/systemPrompt.ts`) + שדה `confirmed` בסכימה — לא code-level interception. `paramsSummary` באודיט לוג מאוכלס עכשיו (לא `null` תמיד כמו קודם), בלי סודות. `src/proxy.ts` הורחב עם `/chat` בלבד — **לא** `/api/chat`: redirect של endpoint JSON לדף HTML שובר את הקוראים שלו (ה-`fetch` עוקב אחרי ה-307 בשקט, מקבל 200 עם HTML, ו-`ChatPanel` נכשל בפענוח כ-NDJSON ומדווח "שגיאת חיבור" על מה שהוא בעצם session שפג). ה-Route Handler מחזיר 401 JSON דרך `requireUid()` במקום. אותר ותוקן ב-2026-08-29 אחרי אימות מול ה-URL החי.
- אימות: `typecheck`/`lint`/`build` נקיים, `test:rules` — 41/41 ללא שינוי (אין שינוי ב-`firestore.rules`). זרימה מלאה מול ה-emulator עם קריאות Claude אמיתיות דרך בדיוק מנגנון ה-in-process ש-Route Handler משתמש בו: `createList`→`createCard`→`logUsage`→`getCard`→`deleteCard` כולל זרימת אישור מלאה (סירוב ראשון — לא נמחק, אישור שני — נמחק). `npm run mcp:cli` נבדק בנפרד מול ה-emulator ואישר שה-CLI (stdio) עדיין עובד אחרי הפיצול ל-`mcpServer.ts`.

**נשאר לבדוק ידנית**: קליק-דרך בדפדפן אמיתי על `/chat` עם כניסה אמיתית (Google/`/e2e/sign-in`) — לא בוצע בסבב הזה (אין כלי דפדפן זמין לסוכן; אומת דרך סקריפט שמחבר ל-MCP server באותו מנגנון in-process בדיוק, ולא דרך ה-HTTP+cookie+streaming המלא של ה-Route Handler עצמו). אין Playwright E2E חדש לצ'אט (streaming אמיתי + קריאות LLM אמיתיות = השקעת בדיקה אוטומטית לא טריוויאלית) — לשקול בעתיד אם ייבנה mock ל-Anthropic API.

### שלב 5.5 — ערוץ WhatsApp
מטרה: להנגיש את יכולות הצ'אט הקיימות דרך WhatsApp. סוגר את הפריט הפתוח האחרון של ADR #17. ההחלטות הארכיטקטוניות המלאות ב-`docs/DECISIONS.md` ADR #29.

#### 5.5.a — מודל נתונים + זרימת קישור ✅ הושלם (2026-08-29)
זרימת הקישור מקצה לקצה **בלי לערב ספק חיצוני בכלל** — קודם להוכיח שהקישור עובד, אחר כך לחבר את Meta.
- **Firestore**: שלושה collections חדשים (`channelLinks/{channelKey}`, `channelLinkCodes/{code}`, `chatSessions/{channelKey}`), כולם `allow read, write: if false` — `firestore.rules` ו-`docs/DATA_MODEL.md` עודכנו קודם, לפי הכלל הקבוע ב-`CLAUDE.md`. `chatSessions` מוגדר כבר עכשיו אבל ייכתב רק ב-5.5.b.
- **קוד**: `src/types/channelLink.ts`, `src/lib/validation/channelLink.ts` (נרמול E.164, קוד base32), `src/lib/services/channelLinks.ts` (`createLinkCodeForUid`/`redeemLinkCode`/`resolveUidForChannel`/`listChannelLinksForUid`/`unlinkChannel`), `src/actions/channelLink.ts` (עטיפות דקות, uid מ-`requireUid()` בלבד), ו-`ChannelLinksSection.tsx` ב-`/settings`. `auditLog` קיבל `channel_linked`/`channel_unlinked`, שנכתבים **בשירות** ולא ב-Server Action — כי `redeemLinkCode` ייקרא ב-5.5.b מה-webhook, שלא עובר דרך `src/actions/`.
- **אימות**: `typecheck`/`lint`/`build` נקיים. `test:rules` — 46/46 (41 קיימים + 5 חדשים: קריאה/כתיבה לשלושת ה-collections נדחית גם לבעלים המאומת, גם בזיוף uid, וגם ללא אימות). E2E — 10/10, כולל שני טסטים חדשים ב-`tests/e2e/settings.spec.ts`: קישור מלא (יצירת קוד → פדיון כאנונימי → הופעה ב-UI → ניתוק), וקוד שכבר מומש לא נפדה שוב עם מספר אחר.
- **stand-in ל-webhook**: `src/actions/testChannelLink.ts` + `src/app/(public)/e2e/redeem-link/page.tsx`, נעולים ל-emulator באותו pattern כמו `mintTestCustomToken` (ADR #18). הם פודים קוד **בלי** `requireUid()` — בדיוק כמו שהוובהוק יעשה — ולכן הנעילה ל-emulator שם היא חובה ולא נוחות.

**נבדק ידנית ועבר (2026-08-29)**: קליק-דרך בדפדפן על `/settings` בוצע על ידי המשתמש — זרימת הקישור (הפקת קוד, פדיון, רשימת ערוצים, ניתוק) תקינה גם ב-RTL, מעבר לאימות ה-Playwright מול ה-emulators. שלב 5.5.a סגור לחלוטין.

#### 5.5.b — ה-webhook ✅ הושלם (2026-08-29)
`src/app/api/whatsapp/webhook/route.ts` (Route Handler שני באפליקציה, והראשון שנגיש לקורא לא מאומת): `GET` handshake מול `WHATSAPP_VERIFY_TOKEN`, `POST` עם אימות `X-Hub-Signature-256` על הגוף הגולמי **לפני כל פרסור**, דדופליקציה ב-`channelMessages` (collection רביעי), ואז `handleInboundChannelMessage` ושליחת התשובה דרך Graph API. **`src/proxy.ts` לא שונה** — ה-matcher מונה prefixes של עמודים בלבד ו-`/api/*` לא נכנס אליו (המלכודת מקומיט `ff99bb8`). ההחלטות המלאות ב-`docs/DECISIONS.md` ADR #30.
- **שכבה ניטרלית לספק**: `src/lib/services/channelChat.ts` (`handleInboundChannelMessage`) מחזיק פדיון קוד → rate limit → היסטוריה → agent turn, בלי שום ידע על Meta; ה-route מחזיק חתימות/payload/Graph. `src/lib/whatsapp/{config,signature,graph}.ts` + `src/lib/validation/whatsapp.ts` הם הצד הספציפי ל-WhatsApp.
- **`turns` bucket ל-rate limit** (`RATE_LIMITS` ב-`src/lib/mcp/config.ts`, 12 ל-5 דקות) נצרך על כל הודעה נכנסת — סוגר את הפער שתועד ב-`docs/CHATBOT.md` (המגבלה חלה עד כה על קריאות tool בלבד). הודעה ממספר שאינו מקושר נמדדת לפי `channelKey` במקום uid, כי שם נמצא משטח ניחוש קודי הקישור.
- **היסטוריה בצד שרת**: `src/lib/services/chatSessions.ts` — 24 שעות אי-פעילות מאפסות שיחה, גזימה בגבול ~200KB רק על גבול הודעת משתמש (`src/lib/mcp/historyLimits.ts`), והשיחה נמחקת בניתוק ערוץ ובקישור מחדש. `buildUserDataExport` כולל אותה עכשיו (ה-TODO שהיה כתוב ב-`export.ts` מ-4.1).
- **סודות**: `apphosting.yaml` לא שונה בכוונה — הקוד נפרס ומחזיר 503 עד שההקמה ב-5.5.c תזריק את הסודות (הוספת `secret:` בלי הזרקה בפועל מפילה rollout, ראו הפוסט-מורטם ב-`docs/DEPLOYMENT.md`).
- **כלי אימות ידני חדש**: `npm run whatsapp:sim -- code <uid>` / `send <phone> <text>` (`scripts/whatsapp-sim.ts`) מריץ את קוד ה-production האמיתי בלי Meta.
- אימות: `typecheck`/`lint`/`build` נקיים. `test:unit` — 47 (27 קיימים + 20 חדשים: חתימה, פרסור payload, `trimHistory`). `test:rules` — 47/47 (46 + `channelMessages`). E2E — 14/14 ב-`--workers=1` (כמו CI), כולל `tests/e2e/whatsapp.spec.ts` החדש: handshake, דחיית חתימה שגויה/חסרה בלי שום שינוי בנתונים, קישור דרך delivery חתום, והתעלמות מ-`messageId` חוזר.

**אומת מול ה-emulator עם קריאות Claude אמיתיות** (דרך `whatsapp:sim`, כלומר בדיוק הפונקציה שה-route קורא לה): מספר לא מקושר → הודעת הסבר; קוד שגוי → "קוד לא תקין"; קוד אמיתי → קישור; "צור לי רשימה ... והוסף כרטיס ..." → נוצרו בפועל; "כמה נשאר בו?" בהודעה נפרדת → נענה נכון, כלומר ההיסטוריה בצד השרת אכן נטענה. `rateLimits/{uid}` הכיל את שני ה-buckets בנפרד, ו-13 הודעות רצופות ממספר לא מקושר החזירו חסימה בהודעה ה-13.

**נשאר לבדוק ידנית**: אין דרך לבדוק את החיבור האמיתי ל-Meta לפני 5.5.c (אין app, אין מספר, ואין סודות) — ה-handshake, החתימה והדדופליקציה נבדקו מול payload-ים שנבנו ונחתמו מקומית, לא מול Meta עצמה. שליחת התשובה דרך Graph API (`sendWhatsAppText`) היא **הנתיב היחיד שלא הורץ מעולם** — בכל הבדיקות אין credentials יוצאים והוא מדלג עם warning.

#### 5.5.c — הקמה ופרודקשן ✅ הושלם (2026-08-30)
Meta app + מספר עסקי, סודות ב-Secret Manager (`WHATSAPP_APP_SECRET`/`WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_VERIFY_TOKEN`, כולם `[RUNTIME]` בלבד) עם סקריפט בדפוס `Set-AppHosting-CardEncryptionKey.ps1`, ותיעוד ב-`DEPLOYMENT`/`CHATBOT`/`SECURITY`/`PRIVACY`.

**סדר הפעולות** — הרישום של ה-webhook מול Meta **חייב** לבוא אחרי rollout שכולל את הסודות: Meta עושה `GET` עם `hub.verify_token`, ו-`getInboundConfig()` מחזיר `null` כל עוד הסודות ריקים, כלומר 503 והרישום נכשל. לכן: לאסוף את כל הערכים מ-Meta → PR הסודות + rollout → ורק אז לרשום webhook.

**הושלם (2026-08-29)**: Meta app (Business) + WABA, מספר טסט של Meta, ו-**אימות מלא של נתיב השליחה** — ראו למטה. הערכים הלא-סודיים: `WHATSAPP_PHONE_NUMBER_ID=963623680178719`, WABA ID `952548457144312` (האחרון לא בשימוש בקוד — נחוץ רק לשיוך assets ל-System User).

**✅ `sendWhatsAppText` הורץ מול Meta בפעם הראשונה (2026-08-29)** — הנתיב היחיד בשרשרת שמעולם לא רץ, וש-5.5.b סימן במפורש כלא-מאומת. אומת דרך סקריפט חד-פעמי שייבא את `src/lib/whatsapp/graph.ts` האמיתי (לא חיקוי), עם ה-temp token של Meta. שלוש תוצאות:
1. `GET /v23.0/{phoneNumberId}` החזיר `verified_name:"Test Number"`, `platform_type:"CLOUD_API"`, `quality_rating:"GREEN"` — כלומר **Graph `v23.0` המקובע ב-`src/lib/whatsapp/config.ts` עדיין נתמך**, ולא נדרש `WHATSAPP_GRAPH_BASE_URL`.
2. שליחה ראשונה **נכשלה** ב-`131047 Re-engagement message` — ראו הממצא למטה.
3. אחרי שהמשתמש השיב מהטלפון, שליחה חוזרת נמסרה בפועל למכשיר.

**ממצא: חלון 24 השעות נאכף בפועל** — שגיאה `131047` הפכה את ההנחה ש"הבוט רק עונה ואף פעם לא יוזם" (`docs/CHATBOT.md`) מהחלטת עיצוב לאילוץ מאומת של הספק. שתי השלכות:
- **Phase 7 (התראות יזומות)** — תזכורות תפוגה ב-WhatsApp ייחסמו בדיוק ככה. הן דורשות **message templates מאושרים מראש** מ-Meta, תהליך אישור נפרד לגמרי. לא הרחבה של מה שקיים.
- **מקרה קצה ידוע ב-webhook** — אם עיבוד הודעה מתארך מעבר לחלון (או ב-retry מאוחר של Meta), `sendWhatsAppText` ייכשל ב-`131047` ו-`route.ts` יבלע את זה ללוג בלבד, אחרי שהפעולה **כבר בוצעה** (כרטיס נוצר, יתרה עודכנה). מהצד של המשתמש זה נראה כמו בוט שותק. נדיר בפרודקשן (הבוט עונה בשניות), לא נחסם, ומתועד כאן כדי שלא יאובחן שוב מאפס.

**✅ inbound אמיתי מקצה לקצה (2026-08-30)** — הודעה חתומה מ-Meta הגיעה ל-`route.ts`, קוד הקישור נפדה, והמשתמש קיבל תשובה בווטסאפ. עם זה כל חוליה בשרשרת הורצה לפחות פעם אחת מול Meta האמיתית: handshake, חתימה, דדופליקציה, פדיון, agent turn ושליחה.

**הושלם בדרך**: permanent access token (System User עם האפליקציה **וגם** ה-WABA כ-assets), verify token, `Set-AppHosting-WhatsAppSecrets.ps1`, ארבע רשומות ב-`apphosting.yaml` (PR #23), ורישום ה-webhook.

**ממצא: שני מנויים נפרדים, ואף אחד לא מדווח על כישלון** — זה מה שעיכב את ה-inbound, ולא שום דבר בקוד. כדי ש-delivery יישלח בכלל צריך גם סימון `messages` תחת Webhook fields **וגם** רשומה ב-`{WABA_ID}/subscribed_apps` שקובעת **איזו אפליקציה** מקבלת. במקרה שלנו אפליקציה ישנה החזיקה את המנוי, האפליקציה החדשה לא ירשה אותו, וההודעות הלכו אליה — בלי שגיאה, בלי לוג, בלי אינדיקציה בשום מסך. האבחון: `GET {WABA_ID}/subscribed_apps` ב-Graph API Explorer, ואז `DELETE` לישנה ו-`POST` לחדשה. מתועד במלואו ב-`docs/DEPLOYMENT.md`.

**ממצא נלווה**: החלפת Meta app מבטלת את ה-App Secret (סוד ברמת האפליקציה) אבל **לא** את ה-Phone Number ID / WABA ID כשהאפליקציה החדשה מחוברת לאותו WABA — כלומר אין שינוי קוד, רק `secrets:set` + rollout. וללא ה-rollout הסוד החדש כלל לא נכנס לתוקף: משתני הסביבה מוזרקים בעליית ה-instance.

**נשאר לפאזות הבאות**: מספר טלפון אמיתי במקום מספר הטסט (מוגבל ל-~5 נמענים מאושרים), ו-message templates אם וכאשר יידרשו התראות יזומות (ADR #31).

## שיתוף רשימה עם משתמש שאינו רשום ✅ הושלם (2026-08-31)
issue #58, `docs/DECISIONS.md` ADR #37. משלים את שיתוף הרשימות של Phase 3.2, שעבד רק מול משתמש קיים (`adminAuth.getUserByEmail`).
- **מודל נתונים**: `listInviteCodes/{code}` — קוד bearer בן 12 תווים, TTL 14 יום, `allow read, write: if false` (אותה מחלקת אמון כמו `channelLinkCodes`). `firestore.rules` ו-`docs/DATA_MODEL.md` עודכנו לפני הקוד, לפי הכלל הקבוע.
- **הבעלים**: מצב שני ב-`ShareListDialog` — מספר טלפון במקום אימייל, ובתמורה קישור `wa.me/?text=...` **בלי מספר יעד** (הבעלים בוחר את איש הקשר), עם שני נוסחי הודעה לפי האם המספר כבר מוכר למערכת. כולל רשימת הזמנות ממתינות וביטול.
- **המוזמן**: עמוד ציבורי `/invite/[code]` (`src/components/lists/InvitePanel.tsx`). תצוגה מקדימה בלי אימות (הקוד הוא הסוד), התחברות דרך `?next=` הקיים (בלי שינוי ב-`proxy.ts`/`SignInButtons`), ואם המספר לא מקושר — אותה זרימת קישור בדיוק שב-`/settings` (`createLinkCodeForUid` + `buildWhatsAppLinkCodeUrl`), לא מנגנון מקביל.
- **הליבה האבטחתית**: `acceptListInvite` דורש קוד **וגם** `channelLinks` שממפה את המספר ל-uid המאשר, ומריץ את שתי הבדיקות מחדש בשרת (ה-gate של ה-UI אינו שלב הרשאה). דחייה לא דורשת קישור. מסמך ה-member נכתב ישירות כ-`accepted` — אין שלב `pending`, כי האישור המפורש כבר קרה בעמוד.
- **`NEXT_PUBLIC_APP_URL` חדש** (`.env.example`, `apphosting.yaml`, `src/lib/appUrl.ts`): הלינק נשלח בהודעת וואטסאפ ולכן חייב להיות אבסולוטי — הצורך הראשון כזה באפליקציה.
- **GDPR**: `accountDeletion.ts` מוחק הזמנות לפי `invitedBy` (אינדקס אוטומטי — collection רגיל, לא collection-group); הייצוא **לא** כולל הזמנות פתוחות (bearer credentials, כמו קודי הקישור). `docs/PRIVACY.md` מסמן חוב חדש: זו הפעם הראשונה שנשמר PII של אדם שאינו משתמש ולא נתן הסכמה.
- אימות: `typecheck`/`lint`/`build` נקיים, `functions` build נקי. `test:rules` — 50/50 (47 + 3 חדשים: גם הבעלים המנפיק לא יכול לקרוא את הקוד, ומוזמן לא יכול לסמן `accepted` מה-client). `test:unit` — 54 ללא שינוי. E2E — 20/20 ב-`--workers=1`, כולל `tests/e2e/listInvite.spec.ts` החדש: הצטרפות מלאה דרך webhook חתום אמיתי, **דחיית אישור כשמקושר מספר אחר**, תצוגה מקדימה + `?next=` למשתמש מנותק, ודחייה שאינה הפיכה.

**נשאר לבדוק ידנית**: קליק-דרך עם שני חשבונות Google אמיתיים ומכשיר וואטסאפ אמיתי — ה-E2E מדמה את ההודעה הנכנסת דרך webhook חתום מקומית, לא דרך Meta. בנוסף: `NEXT_PUBLIC_APP_URL` בפרודקשן נכנס לתוקף רק אחרי rollout (נצרב ל-bundle ב-build), ולכן יש לוודא שהלינק בהודעה מצביע לדומיין הנכון ולא ל-localhost.

## שיתוף רשימה — מלינק bearer וחזרה לכריכה למספר ✅ הושלם (2026-08-31)
`docs/DECISIONS.md` ADR #38 ואז #39, מעל התשתית של ADR #37. שני שינויים ברצף על אותה זרימה, ולכן מתועדים יחד.

- **ADR #38 (בוטל חלקית)**: הוסיר את הזנת המספר לטובת כפתור ווטסאפ יחיד; הלינק הפך ל-bearer credential, ומסלול ההזמנה באימייל (ADR #15) הוסר כנקודת כניסה. נשאר בתוקף: הסרת מסלול האימייל, וארבעת הגבולות — חד-פעמיות, TTL 48 שעות (במקום 14 יום), תקרת 10 לינקים פתוחים, וביטול על ידי הבעלים.
- **ADR #39 (המצב הנוכחי)**: הכריכה למספר חזרה. הבעלים מזין מספר ישראלי מקומי בן 10 ספרות (`ilPhoneSchema` ב-`src/lib/validation/channelLink.ts`, מנרמל ל-E.164 שזהה ל-`channelKey`), והלחיצה פותחת **ישירות** את הצ'אט של אותו נמען (`wa.me/<ספרות>?text=...`) — בלי בורר אנשי קשר, ולכן בלי אפשרות לשלוח לכמה נמענים. אישור ההצטרפות דורש שוב **שתי עובדות**: הקוד ו-`channelLinks` שממפה את המספר ל-uid המאשר.

**למה חזרנו**: (א) אין פרמטר URL שמגביל את בורר אנשי הקשר של ווטסאפ לנמען יחיד — ה-Click to Chat API מתעד רק `phone` ו-`text` — כך שלינק חד-פעמי אחד היה יכול להישלח לשלושה אנשים ורק הראשון היה מצטרף; (ב) כל דליפה של לינק bearer היא הצטרפות מלאה. הפתרון לשניהם הוא אותו דבר: לנקוב במספר ולא להגיע לבורר בכלל.

- **חוזר מ-ADR #37**: `getListInviteGate`/`acceptListInvite` מול `resolveUidForChannel`, dedupe של `(listId, phone)` (שיתוף חוזר **דורס** לינק קיים), ו-`phoneHint` בתצוגה המקדימה.
- **תאימות לאחור ללא מיגרציה**: קודי bearer מחלון ADR #38 נושאים `phone: null`, ממשיכים להיאכף בתנאיהם החלשים עד שיפוגו (48 שעות), וכל ענף מתפצל על `invite.phone === null`. `whatsAppLinkingAvailable()` — המוצא כש-`NEXT_PUBLIC_WHATSAPP_BOT_PHONE` חסר — צומצם **רק** אליהם, כדי שלא ייווצר fail-open על הזמנה כרוכה.
- **`react-hook-form` לא בשימוש בשדה הזה במכוון**: `handleSubmit` פותר promise לפני שהוא קורא ל-handler, וזה היה מציב את `window.open` מעבר ל-await — היישר לתוך חוסם החלונות הקופצים של Safari/iOS. הסכמה המשותפת של Zod (`createListInviteSchema`, ש-`safeParse` שלה סינכרוני) נשארה מקור האמת היחיד, וה-action מפרסר אותה מחדש בשרת (ADR #25).
- **פרטיות**: `listInviteCodes.phone` שב לאחסן PII של אדם שאינו משתמש ולא נתן הסכמה. `docs/PRIVACY.md` עודכן — זה trade-off מודע (המספר הוא מה שמונע מלינק שדלף להפוך להצטרפות), והחוב הפתוח של TTL policy בפועל חזר להיות ממשי ולא זנב מתכלה.
- **`docs/SECURITY.md` תוקן**: הסעיף טען ש"המספר לא מקושר" ו"המספר מקושר לחשבון אחר" מוצגים כאותה חסימה — הקוד מעולם לא עשה זאת. עכשיו מתועדת ההבחנה בפועל, ה-oracle הצר שהיא יוצרת, ולמה היא נבחרה בכל זאת.

**אימות**: `typecheck`/`lint` נקיים. `test:rules` — 50/50 ללא שינוי (`firestore.rules` שונה בהערות בלבד). E2E `listInvite.spec.ts` — 6/6 ב-`--workers=1`, כולל שתי בדיקות חדשות: **לינק שמגיע לחשבון עם מספר אחר אינו ניתן למימוש** (והקוד שורד את הניסיון, כך שהנמען האמיתי עדיין יכול לממש אותו), ו**שיתוף חוזר לאותו מספר דורס את הקודם**. ה-helper קורא את הלינק מתוך ה-popup ולא מרשימת הלינקים בדיאלוג, ומאמת שה-`pathname` הוא מספר הנמען — כלומר שאין מסך בחירה בדרך.

**נשאר לבדוק ידנית**: קליק-דרך עם שני חשבונות Google אמיתיים ומכשיר ווטסאפ אמיתי — ה-E2E מדמה את ההודעה הנכנסת דרך webhook חתום מקומית, לא דרך Meta. בפרט: שהלחיצה על "שיתוף" ב-Safari/iOS באמת פותחת את הצ'אט הנכון בלחיצה אחת (זו הנקודה שבה חוסם החלונות הקופצים מתגלה).

## חסימת שיתוף כפול בדיאלוג (front) ✅ הושלם (2026-08-31)
issue #69. הבקשה בקשה לחסום שיתוף עם מספר שכבר חבר ברשימה **וגם** עם מספר שיש לו לינק פתוח ממתין — אבל המקרה השני מתנגש עם ה-dedupe המכוון של ADR #37/#39 ("שיתוף חוזר דורס לינק קיים"), שהתאשר פעמיים באותו יום שה-issue נפתח. הוחלט (עם המשתמש) לשמר את ה-supersede כפי שהוא ולהוסיף רק אזהרה לא-חוסמת לפניו; רק המקרה הראשון הפך לחסימה אמיתית.

- **מספר שכבר חבר ברשימה**: `createListInvite` כבר חסם את זה בשרת (`listInvites.ts`); מה שנוסף הוא בדיקה מקבילה בצד ה-client ב-`ShareListDialog` — משווה את המספר המנורמל (`ilPhoneSchema`, אותו נרמול שהשרת מפעיל) מול `member.phone` של כל החברים הטעונים כבר בדיאלוג. שגיאת inline (`"הרשימה כבר משותפת עם המספר הזה"`) וכפתור "שיתוף בוואטסאפ" מנוטרל — לפני קריאת שרת, לא רק אחריה כ-toast. **false negative מכוון**: `member.phone` נשמר רק מרגע ADR #37 ואילך (חברים ישנים יותר אין להם את השדה), אז הבדיקה בצד הלקוח יכולה לפספס ולתת מעבר לשרת שעדיין יחסום — לא ההפך.
- **מספר עם לינק פתוח קיים**: לא נחסם. הודעה לא-חוסמת מוצגת מתחת לשדה כשהמספר תואם `invite.phone` בדיאלוג ("כבר יש לינק פתוח למספר הזה... שיתוף ישלח לינק חדש במקומו") — מסבירה מראש מה ה-supersede הקיים עומד לעשות, בלי לשנות את ההתנהגות עצמה.

**אימות**: `typecheck`/`lint`/`build` נקיים. `test:rules` — 50/50 ללא שינוי (אין שינוי ב-Rules). E2E `listInvite.spec.ts` — 8/8 ב-`--workers=1`, כולל שתי בדיקות חדשות: הכפתור מנוטרל ושגיאת ה-inline מוצגת כשהמספר כבר חבר, וההודעה הלא-חוסמת מוצגת (והכפתור נשאר פעיל) כשיש לינק פתוח לאותו מספר.

## תיקוני זרימת ההזמנה אחרי דיווח מפרודקשן ✅ הושלם (2026-08-31)
`docs/DECISIONS.md` ADR #39, סעיף "תיקון". שני פערים שנמצאו כשההזמנה האמיתית הראשונה יצאה.

- **מבוי סתום**: `getListInviteGate` בדק רק אם המספר המוזמן מקושר, ולא אם למבקר כבר מקושר מספר. מוזמן עם מספר משלו קיבל `needs_channel_link`, `createLinkCodeForUid` סירב להנפיק קוד שני, והפאנל נתקע על "מכינים את הקישור..." בלי הודעה. עכשיו מוחזר `linked_to_other_number` (הטקסט שלו כבר נכון), `InvitePanel` מציג שגיאה במקום להיתקע, ו"בדיקה מחדש" יצא מהתנאי כדי שלא ייווצר מסך בלי פעולה אפשרית.
- **דחייה הייתה פתוחה לכל מחזיק קוד**, גם ללא session — כלומר DoS על הנמען האמיתי. עכשיו `requireUid()` + אותה הוכחה כמו אישור, דרך `assertMayRedeem` המשותף. הכפתור העצמאי ב-`InvitePanel` הוסר; "דחייה" קיים רק בדיאלוג שנפתח ב-`gate === "ready"`. נוספה בדיקת פקיעה שחסרה בדחייה.

**אימות**: `typecheck`/`lint`/`build` נקיים · `test:rules` 50/50 · E2E 24/25, כולל בדיקת רגרסיה חדשה למבוי הסתום ואימות שזר לא יכול לדחות. הכישלון היחיד (`cards.spec.ts:6`) הוא flake של dev server קר — עובר בהרצה חוזרת על שרת חם, ולא נוגע בזרימה הזו.

**נשאר פתוח**: `cards.spec.ts` רץ ללא `test.describe.configure`, והבדיקה הראשונה שם לוקחת ~29 שניות גם על שרת חם — קרוב מדי ל-timeout ברירת המחדל של 30 שניות. לא שונה כאן כי זה מחוץ לתחום התיקון, אבל זה יחזור.

## אישור לפני מעבר בעלות על מספר WhatsApp מקושר ✅ הושלם (2026-08-31)
issue #75, `docs/DECISIONS.md` ADR #40. `redeemLinkCode` (ADR #29) דרס בלי אזהרה קישור קיים גם כשהוא שייך לחשבון **אחר** לגמרי — לא רק "מעבר לגיטימי בין חשבונות שלי". מכיוון שהעברה כזו גם מוחקת אוטומטית (`deleteChannelHistory`) את היסטוריית השיחה של הבעלים הקודם, זו הייתה השתלטות שקטה על חשבון.

- **זיהוי בתוך הטרנזקציה של `redeemLinkCode`**: `tx.get(linkRef)` נוסף לפני ה-writes הקיימים. קישור קיים ל-uid שונה מ-`codeDoc.uid` זורק `RelinkConfirmationRequiredError(existingUid)` אלא אם `options.confirmed === true` — בלי peek נפרד לפני הטרנזקציה, כדי לא לפתוח חלון race.
- **מצב-ביניים**: `channelRelinkConfirmations/{channelKey}` (Admin SDK בלבד, `if false` ב-Rules, TTL של 10 דקות כמו `channelLinkCodes`) — `src/lib/services/channelRelinkConfirmations.ts`.
- **שכבה דטרמיניסטית לפני ה-LLM**: `handleInboundChannelMessage` בודק אישור ממתין **לפני** בדיקת קוד קישור. כל עוד יש אישור ממתין, ההודעה מתפרשת רק כ-"כן"/"לא" (`parseYesNo`) — לא כקוד, לא נכנסת ללולאת ה-agent.
- **כפתורי reply אמיתיים של WhatsApp**: `sendWhatsAppReplyButtons` חדש (`interactive.type:"button"`, ליד `sendWhatsAppCtaUrl` של issue #66), כותרות "כן"/"לא" בדיוק. `extractInboundMessages` הורחב לחלץ `interactive.button_reply.title` כ-`text`, כך שלחיצה וטקסט חופשי עוברים דרך אותה בדיקה בדיוק — אין כפילות לוגיקה.
- **מיסוך**: `src/lib/utils/mask.ts` חדש — `maskEmail`/`maskPhone`, כוכביות מפורשות (שונה מ-`toPhoneHint` הקיים ב-`listInvites.ts`, שנועד למטרה אחרת).
- **Audit log**: `channel_relink_requested`/`channel_relink_cancelled` נוספו ל-`AuditLogEventType`, נכתבים תחת `existingUid`. אישור מוצלח ממשיך להירשם כ-`channel_linked` הקיים.

**אימות**: `typecheck`/`lint`/`build` נקיים. `tests/unit/mask.test.ts` חדש; `tests/unit/whatsappWebhook.test.ts` הורחב ל-payload עם `interactive.button_reply` (כולל fallback ל-`text: null` לסוגי interactive אחרים). `test:rules` — 50/50 (Rules נוסף בלבד, שום קיים לא שונה). סימולציה קצה-לקצה מול Firestore/Auth emulators דרך `npm run whatsapp:sim`: קישור מספר לחשבון A → קוד של חשבון B מאותו מספר → הודעת אישור עם מייל/טלפון ממוסכים של A + לא נדרס כלום עדיין → "לא" מבטל (הקישור נשאר אצל A, נבדק ישירות ב-Firestore) → אותו תרחיש עם "כן" מעביר בפועל את הקישור ל-B ומוחק את מסמך ה-pending.

**נדחה**: re-verification תקופתי/step-up authentication כללי (זה threat שונה — מיחזור מספרים, issue #68, נשאר פתוח); חסימה מוחלטת של relink כשיש קישור אחר (הייתה שוברת את תרחיש ה"מעבר הלגיטימי" של ADR #29).

## Phase 6 — PWA & Polish
manifest, service worker, offline indicators, ביצועים.
(הערה: החלטת ה-hosting/deploy טופלה מוקדם יותר ב-Phase 3.3 — לא כאן, בניגוד למה שנרמז במקור ב-ADR #5.)

## Phase 7 — Notifications
Cloud Function מתוזמן לתזכורות תפוגה, FCM push, email (Firebase Extension / Resend).

## Phase 8 — Reports & Analytics
דשבורד יתרות/תפוגות/מגמות, אגרגציות מחושבות server-side (לא client-side על datasets גדולים).
