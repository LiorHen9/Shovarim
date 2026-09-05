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

## אימות מחדש תקופתי לקישור WhatsApp (issue #68) ✅ הושלם (2026-08-31)
`docs/DECISIONS.md` ADR #41. סוגר את הפריט שנדחה בפריט הקודם: קישור `channelLinks/{channelKey}→uid` היה קבוע לצמיתות — מספר טלפון שעובר לבעלים חדש (מיחזור מספרים) היה ממשיך לזהות אותו כבעלים הקודם, בלי שהבעלים החדש צריך לנסות לקשר שום דבר.

- **שני ספים בלתי-תלויים** (`CHANNEL_LINK_REVERIFY`, `src/lib/mcp/config.ts`, ליד `RATE_LIMITS`): 30 יום מאז ה-`linkedAt` האחרון כתקרה מוחלטת (גם עם שימוש רציף — אחרת בעלים חדש שממשיך "לדבר" עם הבוט היה מאפס לנצח את שעון חוסר-הפעילות), ו-14 יום מאז הפעילות האחרונה (`lastMessageAt`) כספה קצר יותר. מי שמגיע ראשון דורש אימות מחדש מלא (כניסה בגוגל + קוד קישור חדש בווטסאפ) — הזרימה הקיימת, בלי מנגנון נפרד.
- **נגזר, לא נשמר**: אין שדה Firestore חדש, אין Cloud Function מתוזמן. `src/lib/services/channelLinkExpiry.ts` (מבודד מ-`firebase-admin`, טסטבילי כמו `fieldEncryptionCore.ts`) מחשב תוקף lazy מתוך `linkedAt`/`lastMessageAt` הקיימים. `resolveUidForChannel` מחזיר `null` לקישור שפג בדיוק כמו לקישור שלא קיים (אותה תשובת "לא מקושר", בלי oracle חדש), ו-`createLinkCodeForUid` מפסיק לחסום הנפקת קוד חדש כשהקישור הקיים פג (`status !== "active"`). חידוש עצמי כבר עבד בלי שינוי — `redeemLinkCode` תמיד דורס ומאפס `linkedAt` בטרנזקציה אחת, גם היום.
- **UI**: `ChannelLinksSection` (`/settings`) מציג עכשיו `lastMessageAt` ("פעילות אחרונה") ודדליין אימות מחדש נגזר (`ChannelLinkSummary.status`/`reverifyBy`), וכפתור "חיבור WhatsApp" חוזר להיות זמין ברגע שהקישור הקיים פג.
- אימות: `typecheck`/`lint`/`build` נקיים. `test:unit` — 67 (61 קיימים + 6 חדשים ל-`isChannelLinkStale`/`channelLinkReverifyDeadlineMs`). `test:rules` — 50/50 ללא שינוי (אין שינוי ב-`firestore.rules`). E2E — כל 18 הטסטים הרלוונטיים (`settings.spec.ts`, `whatsapp.spec.ts`, `listInvite.spec.ts`) עוברים ב-`--workers=1`, כולל שתי בדיקות סטטוס חדשות בטסט הקישור הקיים.

**נשאר פתוח, במפורש מחוץ לסקופ**: תרחיש שני, קשור אך שונה — מחזיק חדש שכן פותח חשבון Shovarim משלו ומנסה **לקשר** את המספר מחדש. ADR #40 (issue #75) כבר דורש אישור כן/לא לפני הדריסה, אבל האישור נשאל מהמספר עצמו — כלומר המחזיק החדש יכול פשוט לענות "כן" לעצמו, לא הבעלים הקודם, שלעולם לא מקבל התראה. סגירה מלאה (למשל מייל לבעלים הקודם) דורשת תשתית מייל/push שעדיין לא קיימת — ראו Phase 7 למטה. `issue #68` נשאר רלוונטי לחלק הזה עד שהתשתית הזו תיבנה.

## Phase 6 — PWA & Polish
manifest, service worker, offline indicators, ביצועים.
(הערה: החלטת ה-hosting/deploy טופלה מוקדם יותר ב-Phase 3.3 — לא כאן, בניגוד למה שנרמז במקור ב-ADR #5.)

**שינוי בהיקף הפאזה (2026-09-05):** בבדיקה מול `node_modules` התברר ש-Next 16.3.2 כבר מספק שניים משלושת הפריטים בשורה למעלה **בלי Service Worker**: `experimental.useOffline` (`node_modules/next/offline.js`, מדריך ב-`node_modules/next/dist/docs/01-app/02-guides/offline-support.md`) ו-`unstable_isUnrecognizedActionError` (תופס בדיוק את `x-nextjs-action-not-found: 1`, הכותרת של תקלת ADR #32). במקביל, ה-SW הוא הארטיפקט היחיד בסטאק ש-`firebase apphosting:rollouts:create` **לא** יכול לבטל — הוא מותקן בלקוח ושורד כל rollout. לכן הפאזה מסתיימת ב-6.4, וה-SW נדחה במפורש ב-ADR #56 (לא נשמט). ראו ADR #51.

### שלב 6.0 — סמל ופס ייצור אייקונים ✅ הושלם (2026-09-05)
`src/app/favicon.ico` היה עדיין הלוגו של Next.js מיום ה-scaffold, כלומר בפרודקשן כל טאב וכל סימנייה הציגו את המשולש של Vercel — באג מיתוג חי, בלתי-תלוי ב-PWA. הסמל (צורת שובר/כרטיס עם חריצים) נכתב ידנית כ-SVG של `<path>` בלבד ב-`assets/brand/` — **בלי `<text>` ובלי פונט חיצוני**, כי librsvg מרסטר טקסט עם הפונטים של המערכת ואות עברית הייתה מפיקה PNG שונה בכל מכונה, בשקט. `scripts/generate-icons.ts` (`npm run icons:generate`, אותה קונבנציה כמו `scripts/seed-categories.ts`) מייצר את כל הגדלים; `sharp`/`png-to-ico` הם devDependencies והפלטים מחויבים ל-git — App Hosting בונה בקונטיינר נקי בכל push, ואין טעם להעמיס עליו כלי תמונה נייטיב עבור נכסים שמשתנים כמעט לעולם. בנוסף נמחקו חמשת ה-SVG של create-next-app מ-`public/`. ראו ADR #51 החלטות 1–2.
- אימות: הרצה כפולה של `npm run icons:generate` נתנה פלט זהה בית-בבית (sha256 על כל חמשת הקבצים); אומת ויזואלית שהווריאנט ה-maskable יושב בתוך אזור הבטחון (80% פנימיים).

### שלב 6.1 — התקנה (manifest + viewport + OG) ✅ הושלם (2026-09-05)
`src/app/manifest.ts` (קובץ TypeScript ולא `public/manifest.webmanifest` — `npm run typecheck` תופס טעות ב-`purpose`/`display` שאחרת הייתה מורידה בשקט את ההתקנה באנדרואיד): `id: "/"` מקובע, `lang: "he"`/`dir: "rtl"`, `start_url: "/dashboard"` (משתמש מותקן הוא משתמש חוזר; כשה-cookie פג `src/proxy.ts` כבר מפנה ל-`/?next=/dashboard`), `scope: "/"` כדי ש-`signInWithRedirect` יישאר בחלון המותקן, ושלושה `shortcuts`. `viewport` ב-`src/app/layout.tsx` עם זוג `themeColor` שנגזר מהטוקנים ב-`globals.css` (`#ffffff`/`#0a0a0a`) — ו**בלי** `maximumScale`/`userScalable`, שהיו מפירים את דרישת ה-zoom 200% ב-`docs/ACCESSIBILITY.md`. תגי Open Graph סטטיים ושורשיים (ערוץ השיתוף העיקרי הוא WhatsApp, ADR #37/#39), אחרי אימות ש-`GET /invite/[code]` לסקרייפר אנונימי הוא קריאה בלבד. ראו ADR #51 החלטות 3–7.
- אימות: `typecheck`/`lint`/`build` נקיים. `test:unit` 72/72, `test:rules` 60/60 (ללא שינוי — הפאזה לא מכניסה שום collection). E2E חדש: `tests/e2e/pwa.spec.ts`, 5 טסטים — מבנה המניפסט, שכל אייקון שהוא מפרסם באמת נפתר, שיעדי ה-shortcuts אינם 404, תגי ה-`<head>`, ושה-zoom לא נעול. אומת גם ידנית מול `next start`: `/manifest.webmanifest` מוגש כ-`application/manifest+json`, וכל שבעת נתיבי האייקונים/OG מחזירים 200 עם ה-content-type הנכון.
- **נשאר לבדוק ידנית לפני שחרור רחב**: התקנה ב-Android Chrome (שהאייקון ה-maskable לא נחתך לעיגול), הוספה למסך הבית ב-iOS Safari, ו**התחברות עם Google מתוך PWA מותקן טרי ב-iOS** — ההתקנה משנה מהותית את הסביבה ש-ADR #34/#35 נכתבו עבורה (מחיצת אחסון והיסטוריה נפרדות), וזו בדיוק הזרימה שכבר נשברה פעם ב-Safari.

### שלב 6.2 — גבולות מסלול והודעת גרסה חדשה ✅ הושלם (2026-09-05)
`src/lib/actions/clientErrors.ts` (`reportActionError`) מזהה `unstable_isUnrecognizedActionError` ומציג טוסט מתמיד עם כפתור רענון — סוגר את תקלת ADR #32, שעד היום התחזתה להודעת כשל גנרית. החיווט מצומצם לקומפוננטות שבאמת מריצות Server Action. `global-error.tsx` (נטול-תלויות, סגנונות inline, כדי שלא ייכשל מאותה סיבה שהאפליקציה נכשלה), `error.tsx` ל-`(protected)` ול-`admin` בנפרד (ADR #48/#50 הם הנימוק), `not-found.tsx` בעברית במקום ברירת המחדל האנגלית של Next, ושישה `loading.tsx` עם שלדים משותפים (`src/components/skeletons/PageSkeletons.tsx`) כדי שרינדור השרת ומצב ה-hook יציירו אותה צורה. ראו ADR #52.
- אימות: `typecheck`/`lint`/`build` נקיים, `test:unit` 72/72, `test:rules` 60/60 (ללא שינוי). E2E חדש ל-404 בעברית.
- **שני שינויים בתשתית הטסטים שהשלב הזה כפה:**
  - `playwright.config.ts` מריץ `next start` תחת CI. **לא** שיפור אופציונלי: ברגע ש-`/settings` קיבל `loading.tsx`, Next מזרים את המקטע ו-dev mode משאיר את אירוע ה-`load` תלוי עד שכל חמשת טסטי `settings.spec.ts` נופלים בטיימאאוט. אותם טסטים עוברים מול build עם אותו קובץ. אין עלות: ה-CI כבר מריץ `npm run build` לפני Playwright.
  - `tests/e2e/helpers/auth.ts` חיכה 3 שניות בלבד למודל ההסכמה ולא חיכה כלל לניתוקו אחרי הלחיצה. `useConsent` מתחיל ב-`"loading"`, אז עבור ה-uid הטרי שכל טסט יוצר המודל **תמיד** מופיע — פשוט לא תמיד תוך 3 שניות, ואז ה-overlay שלו חסם בשקט כל לחיצה עד לטיימאאוט. זה היה מקור ה-flakiness המקומי מזה זמן.

### שלב 6.3 — חיווי offline ✅ הושלם (2026-09-05)
`experimental.useOffline` ב-`next.config.ts` כאות הראשי (עדיף על `navigator.onLine` — הוא נופל גם על fetch כושל של ה-framework, כלומר תופס captive portal), ו-`snapshot.metadata.fromCache` שנחשף מ-`useUserProfile` כאות המשני והאמיתי יותר: 100% מה-UI המוגן מגיע מ-`onSnapshot`, וה-stream של Firestore יכול להיות מת בזמן ש-HTTP תקין לגמרי (App Check שפג, טוקן שנשלל). `OfflineBanner` הוא פס סטטי עם `role="status"`/`aria-live="polite"` ב-`(protected)/layout.tsx` ליד `DeletionPendingBanner` — לא טוסט, כי קישוריות היא מצב ולא אירוע. `WaitingForConnection` ב-`loading.tsx` מסביר שלד שלא ייפתר. ראו ADR #53, ו-ADR #54 לדחיית ה-persistence המקומי של Firestore.
- אימות: `typecheck`/`lint`/`build` נקיים, `test:unit` 72/72, `test:rules` 60/60. E2E חדש `tests/e2e/offline.spec.ts` (3 טסטים: הבאנר מופיע ב-`setOffline(true)` ונעלם בחזרה, הוא live region ולא טוסט, ואין באנר בעמוד הציבורי) — עובר מול build.
- **בסיס להשוואה**: הרצת E2E מלאה מול build זהה בקומיט של 6.1 נתנה 6 נכשלים / 24 עוברים; אחרי 6.2+6.3 — 4 נכשלים / 30 עוברים. הנכשלים הנותרים הם כולם ב-`listInvite.spec.ts` ומשתנים מהרצה להרצה (flakiness של ריצה מקבילה במכונה המקומית; ה-CI מריץ `workers: 1` עם `retries: 2`).

### שלב 6.4 — dark mode, ביצועים, וסליס נגישות ✅ הושלם (2026-09-05)
`ThemeProvider` הורכב סוף-סוף (next-themes היה dependency ו-`globals.css` נשא את כל טוקני ה-`.dark` מאז ה-scaffold, אבל בלי provider — כלומר dark mode היה קוד מת ו-`useTheme()` ב-`sonner.tsx` החזיר `undefined` בשקט), עם מתג מסתובב system → light → dark בתפריט המשתמש הקיים. `@axe-core/playwright` ו-`eslint-plugin-jsx-a11y` מפורש — הבדיקה האוטומטית הראשונה אי-פעם מול ה-checklist ב-`docs/ACCESSIBILITY.md`, ושתי הסריקות (light + dark) עוברות נקי. ראו ADR #55, ו-ADR #56 לדחיית ה-Service Worker שסוגרת את הפאזה.
- אימות: `typecheck`/`lint`/`build` נקיים, `test:unit` 72/72, `test:rules` 60/60. E2E חדש: `tests/e2e/theme.spec.ts` (מעבר ערכת נושא ושמירתה בין רענונים, וכיבוד `prefers-color-scheme`), ובדיקות axe ב-`dashboard.spec.ts` ו-`public.spec.ts`.
- **שתי הערכות שהמדידה הפריכה, ומתועדות ככאלה**: (1) לא היה CLS לתקן — שלושת תגי ה-`img` כבר נשאו מידות קבועות ב-Tailwind; מה שחסר היה `loading="lazy"` בתצוגות הרשימתיות. (2) `next/dynamic` על פאנל הצ'אט לא היה עוזר: מדידת התוצר בפועל (Next 16 כבר לא מדפיס First Load JS) הראתה שה-chunk הגדול הוא 680KB של Firebase/Firestore, שנטען בכל עמוד מוגן כי הכל `onSnapshot`. המנוף האמיתי ארכיטקטוני ומחוץ להיקף.
- **נשאר לבדוק ידנית לפני שחרור רחב**: Lighthouse (PWA + Accessibility + Performance) מול ה-URL החי, ומעבר NVDA על באנר הניתוק ועמודי השגיאה החדשים — זה מה שיסגור את החוב המוצהר ב-`docs/ACCESSIBILITY.md`.

## Phase 6.A — נגישות (חובה חוקית, issue #40) ✅ הושלם (2026-09-05)
מסלול אחות ל-Phase 6, אחרי 6.4 ולא בתוכו. המסגרת החוקית: תקנה 35 לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013, המחייבת אתר של נותן שירות לעמוד ב-**ת"י 5568 ברמה AA** ולפרסם הצהרת נגישות — ו**אינה** מחייבת בר צף. ההבחנה הזו קבעה את סדר העבודה. ראו `docs/DECISIONS.md` ADR #57.

### שלב 6.A.0 — סגירת פערי רמה A ✅ הושלם (2026-09-05)
שלושה כשלים אמיתיים ברמה A שהסריקה האוטומטית של 6.4 עברה בהצלחה, כי אף אחד מהם אינו בתחום שכלל axe יכול לשפוט: (1) לא היה `<main>` בשום עמוד מוגן — `(protected)/layout.tsx` עטף את התוכן ב-`div`; (2) לא היה קישור "דלג לתוכן המרכזי"; (3) לכל עמוד באפליקציה היה אותו `<title>` — "שוברים" (WCAG 2.4.2). התיקונים: `SkipLink` כאלמנט הראשון ב-`<body>`, `<main id="main-content">` בלייאאוט המוגן ובכל עמוד ציבורי, `title.template` בשורש עם `metadata` לכל מסלול (שישה `layout.tsx` מינימליים לעמודים שהם Client Components — Client Component לא יכול לייצא `metadata`), ו-`SiteFooter` בשורש כדי שההצהרה תהיה נגישה מכל עמוד.
- אימות: `tests/e2e/accessibility.spec.ts` — הקישור ראשון בסדר ה-Tab ומוביל ל-`#main-content`, קיום `main#main-content` בכל מסלול, וייחודיות ה-titles.

### שלב 6.A.1 — הצהרת נגישות ✅ הושלם (2026-09-05)
`/accessibility` בתבנית `privacy`/`terms`, עם `ACCESSIBILITY_STATEMENT_VERSION` ו-`ACCESSIBILITY_CONTACT_EMAIL` ב-`src/lib/legal/constants.ts`. **מצהירה במפורש מה טרם נבדק** — NVDA ידני, תיאורי תמונות שמשתמשים מעלים, ותוכן שמפיק מודל שפה ב-`/chat`. הצהרה שמתיימרת לתאימות שלא הודגמה גרועה מהיעדר הצהרה.

### שלב 6.A.2 — בר הנגישות ✅ הושלם (2026-09-05)
נבנה בבית ולא הותקן כ-widget (ADR #57, החלטה 1). כפתור צף בפינה התחתונה, ובתוכו פקדי טופס נטיביים בלבד בתוך `fieldset`/`legend`: גודל טקסט (100/115/130/150% דרך `--a11y-font-scale`, עובד כי Tailwind מודד ב-rem), ניגודיות גבוהה, הדגשת קישורים, הדגשת מיקוד מקלדת, ועצירת אנימציות. ההעדפות נשמרות ב-`localStorage` ומוחלות ע"י סקריפט inline חוסם לפני הציור הראשון. `prefers-reduced-motion` של מערכת ההפעלה מכובד גם בלי הגדרה יזומה.
- אימות: הבר עצמו נסרק פתוח ב-axe בשתי ערכות הנושא, וכך גם מצב הניגודיות הגבוהה.

### שלב 6.A.3 — הרחבת הסריקה האוטומטית ✅ הושלם (2026-09-05)
מ-2 עמודים ל-8 (`/`, `/accessibility`, `/cards`, `/cards/new`, `/settings`, `/chat`, `/dashboard`, ומצב ניגודיות גבוהה), בשתי ערכות הנושא. `tests/e2e/helpers/a11y.ts` מדווח כעת גם את `failureSummary` של axe — הסלקטור לבדו לא היה בר-פעולה, וזה מה שהפך את הממצא הראשון מניחוש לתיקון שורה אחת.
- **ממצא אמיתי שנחשף מיד**: `--destructive` נמדד **3.99:1** על `bg-destructive/10` — כשל AA על כל כפתור מחיקה/חסימה באפליקציה (14 שימושים), שלא נתפס קודם כי על לבן נקי הוא עובר ולשני העמודים שנסרקו לא היה פקד הרסני. הוערך מחדש ל-5.01:1.
- **ממצא שנדחה במכוון**: 3.69:1 על כפתור מושבת ב-`/settings`. WCAG 1.4.3 פוטר רכיבים לא-פעילים; התיקון היה בטסט (המתנה לסיום טעינה), לא בפלטה.
- אימות: `typecheck`/`lint`/`build` נקיים, `test:unit` 72/72, `test:rules` 60/60 (ללא שינוי — אין collection חדש), E2E **50/50 מול build פרודקשן בלי retries**.

**נשאר לבדוק ידנית**: מעבר NVDA, Lighthouse מול ה-URL החי, ו-`/admin` שאינו מכוסה בסריקה כי הוא דורש `adminRoles` שאין ל-uid שנוצר בטסטים. החלטה על מינוי רכז נגישות תלויה בסיווג העסקי ואינה שאלה הנדסית.

## Phase 6.B — כותרת קבועה ומיקום הבר ✅ הושלם (2026-09-05)
שני ליקויים שעלו מבדיקה ידנית של תוצרי 6.A, שאחד מהם נוצר דווקא ע"י התיקון של 6.A. ראו `docs/DECISIONS.md` ADR #58.

**הליקוי המהותי**: ה-`SiteFooter` של 6.A.0 הפך את `/accessibility`, `/privacy` ו-`/terms` לנגישים מכל עמוד — אבל שלושתם ישבו תחת `(public)/` שאין לו layout, בעוד `<Header />` מורכב רק ב-`(protected)/layout.tsx`. כלומר המשתמש הגיע לעמוד ההצהרה בלי שום דרך חזרה מלבד כפתור ה-back. התיקון: route group `(legal)` עם layout שמרנדר `<Header context="public" />`. `Header` קיבל prop אחד במקום קומפוננטה מקבילה — `context="app"` מרנדר בדיוק את המרקאפ הקודם, `context="public"` מסתעף לפי `useAuth()` (מחובר → ניווט מלא, לא מחובר → לוגו + "התחברות"). הענף נפתר **בלקוח ולא ב-`getSessionUid()`**, כדי ששלושת העמודים יישארו `○ (Static)` ולא יוסיפו `verifySessionCookie` לכל בקשה.

**הכותרת דביקה בכל האתר** — `sticky top-0 z-40` עם `bg-background`, אבל **רק מ-`min-height: 480px`**: כותרת דביקה גוזלת גובה קבוע וב-zoom 400% או ב-`--a11y-font-scale: 1.5` היא פוגעת בדיוק בפריט ה-reflow ש-`ACCESSIBILITY.md` עוקב אחריו. נוסף `#main-content { scroll-margin-top: 4rem }` כדי שקפיצת קישור הדילוג לא תנחת מתחת לכותרת.

**הבר עבר למרכז האנכי** (`fixed end-4 top-1/2 -translate-y-1/2`), והפאנל נפתח על הציר האופקי במקום כלפי מטה — עם מפעיל ממורכז, `side="bottom"` היה משאיר לפאנל בן ~340px רק חצי מסך. `side` ב-Radix פיזי ולא לוגי (אומת ב-popper 1.3.7), ולכן תחת `dir="rtl"` הערך הוא `"right"`.
- אימות: `typecheck`/`lint`/`build` נקיים, `test:unit` 72/72, `test:rules` 60/60 (ללא שינוי), E2E **54/54 מול build פרודקשן בלי retries**, פעמיים ברצף. ארבעה טסטים חדשים, וסריקת axe הורחבה מ-`/accessibility` בלבד לשלושת עמודי המידע.

**נשאר לבדוק ידנית**: איך הבר הממורכז נראה בפועל ואם הוא מכסה תוכן ב-viewport צר, והחפיפה שלו עם `ConsentBanner` (`fixed inset-0 z-50`).

## Phase 6.C — גילוי נאות: עוגיות, אחסון בדפדפן וצדדים שלישיים ✅ הושלם (2026-09-05)
התחיל משאלה על חוק העוגיות, והסתיים במשהו אחר. הבדיקה מצאה שהאתר **אינו** זקוק לבאנר — עוגייה אחת בלבד (`__session`, נוצרת רק בהתחברות), אפס אנליטיקס, ואפס `Set-Cookie` למבקר אנונימי בפרודקשן — אבל שמדיניות הפרטיות לא הזכירה **שום** אחסון במכשיר, ומעל זה לא הזכירה **שני נמעני צד-שלישי חיים**: Anthropic (תוכן הצ'אט, שלא היה מוצהר כלל) ו-Meta (WhatsApp, שהיה מסומן ב-`docs/PRIVACY.md` כ"פעיל בפרודקשן בלי שהוסדר"). ראו `docs/DECISIONS.md` ADR #59.

נוספו ל-`privacy/page.tsx` הסעיפים "עוגיות ואחסון בדפדפן" ו"העברת מידע לצדדים שלישיים"; `ConsentBanner` נוקב בשני הנמענים בגוף הדיאלוג ולא רק מפנה לקישור; ו-`PRIVACY_POLICY_VERSION` עלה ל-`2026-09-05` — כלומר **re-consent לכל משתמש קיים**, כפי ש-`PRIVACY.md` דורש בתוספת נמען. תוקן גם סעיף "הזכויות שלכם", שעדיין דיבר בלשון עתיד על ייצוא ומחיקה שמומשו ב-Phase 4.
- אימות: `typecheck`/`lint`/`build` נקיים, שלושת עמודי המידע נשארו `○ (Static)`. שני טסטי E2E חדשים, שהחשוב שבהם מוודא שמבקר לא-מחובר מקבל אפס עוגיות ואפס בקשות לדומייני מעקב — ההחלטה שלא לשים באנר הופכת שם מנייר לאכיפה.

## Phase 7 — Notifications
Cloud Function מתוזמן לתזכורות תפוגה, FCM push, email (Firebase Extension / Resend).

## Phase 8 — Reports & Analytics
דשבורד יתרות/תפוגות/מגמות, אגרגציות מחושבות server-side (לא client-side על datasets גדולים).

## Phase 9 — פאנל ניהול (Admin Panel)
`docs/DECISIONS.md` ADR #42. צפייה במשתמשים, חסימה (uid/email/טלפון), מחיקה (מתוזמנת/מיידית) יזומה ע"י אדמין, מעקב שימוש/עלות Claude API, אנליטיקס. חד-אדמין כרגע (המשתמש עצמו), מעוצב להרחבה עתידית ל-RBAC בלי re-architecture.

### שלב 9.1 — יסודות (הרשאות + shell) ✅ הושלם (2026-09-01)
`adminRoles/{uid}` (Firestore doc, לא custom claim — נמנע מעיכוב ריענון טוקן; `exists()` באותו פטרן כמו `isAcceptedListMember`), `allow read, write: if false` לחלוטין (כולל לאדמין עצמו — אין נתיב client, גם לא ל-self-grant). הענקה ראשונה ויחידה דרך `scripts/grant-admin.ts` (`npm run grant-admin -- <uid>`, אותו pattern כמו סקריפטי Admin SDK קיימים). `isAdminUid()`/`requireAdmin()` ב-`src/lib/auth/session.ts` (לצד `requireUid()`; `requireAdmin` זורק `ActionError` כמו ADR #18). `app/(protected)/admin/layout.tsx` — שכבת הגנה שנייה מעל `(protected)` (session + admin, מפנה ל-`/dashboard` ולא error), `app/(protected)/admin/page.tsx` — placeholder. `adminAuditLog/{entryId}` (נפרד מ-`auditLog` הקיים — לדג'ר ייעודי לפעולות אדמין, נכתב לפני כל mutation, שורד מחיקת המשתמש). `firestore.rules`: helper `isAdmin()` + שני match blocks חדשים (`if false`).
- אימות: `typecheck`/`lint` נקיים. `test:rules` — טסטים חדשים ל-`adminRoles`/`adminAuditLog` (client נדחה תמיד, כולל לאדמין עצמו וללא אימות).

**בוצע (2026-09-01)**: מסמך `adminRoles/{uid}` נוצר ידנית ב-Firestore Console נגד production (לא דרך `grant-admin.ts` — נמנע מהעברת מפתח ה-service account של production למכונה מקומית לצורך כתיבה חד-פעמית של מסמך יחיד), עם `role: "super_admin"`, `grantedBy: "system"`. אומת ניווט ל-`/admin` בפרודקשן עם המשתמש האמיתי.

### שלב 9.2 — צפייה במשתמשים ✅ הושלם (2026-09-01)
`/admin/users`: רשימה עם pagination בסמן (Server Component, `listUsersPage()` ב-`src/lib/services/adminUsers.ts` — `orderBy("createdAt","desc")` + `startAfter(docSnapshot)`, סמן = `uid` של המסמך האחרון בעמוד הקודם, מועבר ב-`?cursor=`). חיפוש בשדה חופשי אחד ב-`?q=` (זוהה client-side לפי "@" — אימייל דרך `adminAuth.getUserByEmail`, אחרת `uid`, `UserSearchForm.tsx`). עמוד פרטי משתמש `/admin/users/[uid]` (`getUserDetail()`): פרופיל, `disabled`/`emailVerified`/כניסה אחרונה מ-`adminAuth.getUser`, ספירת כרטיסים/רשימות דרך Firestore `count()` aggregation (`where("ownerId","==",uid)` — שדה בודד, לא נדרש אינדקס מרוכב חדש), סטטוס מחיקה קיים (`deletionRequestedAt`). קריאה בלבד — אין mutation, אין collection Firestore חדש, ולכן אין שינוי ב-`firestore.rules`/טסטים חדשים ב-`test:rules`; ההגנה על הנתיב היא `app/(protected)/admin/layout.tsx` הקיים (Phase 9.1). ראו `docs/DECISIONS.md` ADR #43.
- אימות: `typecheck`/`lint`/`build` נקיים. נבדק ידנית מול Firebase Emulators + Playwright (לא נשמר כטסט קבוע): אדמין רואה רשימה/חיפוש/עמוד פרטים עם ספירות נכונות, ומשתמש לא-אדמין מופנה מ-`/admin/users` ל-`/dashboard`. **אומת גם בפרודקשן (2026-09-01)** לאחר סגירת שלב 9.1: מסמך `adminRoles/{uid}` אמיתי, ניווט מוצלח ל-`/admin/users` עם המשתמש האמיתי.

### שלב 9.3 — חסימה ✅ הושלם (2026-09-01)
`userModeration/{uid}` (נפרד מ-`users/{uid}` בכוונה — ה-update rule הקיים על `users` לא מגביל שדות, אז שדה חסימה שם היה מאפשר למשתמש חסום לבטל את עצמו). מנגנון אכיפה ראשי: `adminAuth.updateUser(uid, {disabled:true})` + `revokeRefreshTokens` (OOTB — `verifySessionCookie(cookie, true)` הקיים כבר בודק disabled/revocation). הגנת-משנה ל-WhatsApp (uid נגזר מ-`channelLinks` בלי Auth token בכלל): `assertNotBlocked` (`src/lib/services/moderation.ts`) ב-3 נקודות הכניסה ל-`runAgentTurn` (`channelChat.ts`, `POST /api/chat`, `mcp-cli.ts`). `blockedEmails`/`blockedPhones` לחסימה פרואקטיבית לפני שקיים חשבון/קישור, נבדקים ב-`createSession`/`redeemLinkCode` בהתאמה, עם אותה הודעת כישלון גנרית שהפדיון כבר משתמש בה. מוטציות (`src/lib/services/adminModeration.ts`, נקרא דרך `src/actions/adminModeration.ts`) כוללות הגנה עצמית (אדמין לא יכול לחסום uid/email של עצמו) וכתיבת `adminAuditLog` לפני כל פעולה. UI: `UserModerationSection` ב-`/admin/users/[uid]` — דיאלוג אישור+סיבה לחסימת uid, פעולה חד-לחיצתית לחסימת email/phone נקודתית. `firestore.rules`: שלושה match blocks חדשים (`if false`). ראו `docs/DECISIONS.md` ADR #44.
- אימות: `typecheck`/`lint`/`build` נקיים. `test:rules` — 5 טסטים חדשים ל-3 ה-collections (client נדחה תמיד, כולל למשתמש חסום שמנסה לקרוא/לשנות את המסמך של עצמו). אימות פונקציונלי נגד Firebase Emulators (Firestore+Auth) דרך סקריפט חד-פעמי: חסימה/שחרור uid (כולל בדיקת `disabled` בפועל ב-Auth ו-`assertNotBlocked` זורק/לא-זורק בהתאם), חסימת email שמשביתה גם חשבון קיים, הגנה עצמית (uid/email), וחסימת טלפון שגורמת ל-`redeemLinkCode` לדחות קוד תקין — לא נשמר כטסט קבוע.

### שלב 9.4 — מחיקה ע"י אדמין ✅ הושלם (2026-09-01)
מתוזמנת: `adminScheduleUserDeletionAction`/`adminCancelUserDeletionAction` (`src/actions/adminDeletion.ts` → `src/lib/services/adminDeletion.ts`) — שימוש חוזר מלא במנגנון ה-grace-period הקיים (`deletionRequestedAt`, Phase 4.2), Server Action בלבד, לא מנגנון מקביל. מיידית: Cloud Function `onCall` חדש (`functions/src/adminActions.ts`, `adminDeleteUserNow`) שקורא ישירות ל-`deleteUserAccount()` הקיים ב-`accountDeletion.ts` — נדרש כי `functions/tsconfig.json`'s `rootDir` מונע מ-`src/actions/` לייבא מ-`functions/src/` (ADR #24). לוגיקת ההרשאה מופרדת מה-`onCall` wrapper (`adminDeleteUserNowHandler`) כדי שתהיה בדיקה ישירה. מאמת הרשאת אדמין בעצמו בצד שרת (`adminRoles/{caller uid}` — callable הוא endpoint ציבורי, לא מוגן ע"י `firestore.rules`/`admin/layout.tsx`), מכוסה ע"י `enforceAppCheck: true` ברמת הפונקציה (לא Console-level Enforce, שחל רק על Firestore/Storage). הגנה עצמית בשני הנתיבים (אדמין לא יכול לתזמן/למחוק את עצמו). UI: `UserDeletionSection.tsx` — כפתור חד-לחיצתי לתזמון/ביטול, type-to-confirm (אימייל) למחיקה מיידית. ראו `docs/DECISIONS.md` ADR #45.
- אימות: `typecheck`/`lint`/`build` נקיים (גם ב-`functions/`). `test:rules` — 59/59, ללא שינוי (אין collection/rule חדשים בשלב זה). אימות פונקציונלי נגד Firebase Emulators (Firestore+Auth+Functions+Storage) דרך סקריפט חד-פעמי: תזמון/ביטול מחיקה + הגנה עצמית + `adminAuditLog`, ואז 4 בדיקות ישירות על `adminDeleteUserNowHandler` (לא-מאומת, לא-אדמין, self-delete, מחיקה בפועל כולל cascade על כרטיס וחשבון Auth) + בדיקת transport אחת דרך `httpsCallable` שמאמתת ש-`enforceAppCheck` אכן חוסם קריאה בלי טוקן App Check — לא נשמר כטסט קבוע.

**באג בפרודקשן (2026-09-01)**: "מחיקה מיידית" ראשונה בפועל נכשלה ב-500 — `storage.bucket()` בתוך `deleteUserAccount()` נשען על משתנה סביבה שקיים רק ב-App Hosting, לא ב-Cloud Functions. תוקן (`functions/.env.shovarim-prod`), אומת בבידוד תהליך אמיתי (בדיקת העשן הקודמת נתנה false positive). ראו `docs/DECISIONS.md` ADR #46 ופוסט-מורטם מלא ב-`docs/DEPLOYMENT.md`.

**באג המשך (2026-09-01)**: `deleteUserAccount()` תיעד את עצמו כ-idempotent אבל `auth.deleteUser` לא באמת היה, ו-`adminAuth.getUser` הבלתי-מטופל היה מפיל את `/admin/users/[uid]` עבור משתמש עם Auth חסר. שני המקומות תוקנו לטפל ב-`auth/user-not-found` בפועל. ראו `docs/DECISIONS.md` ADR #47.

**באג המשך #2 (2026-09-02)**: התיקון הקודם לא פתר את הקריסה בפועל ב-`/admin/users/[uid]` עבור `liorh@hms.co.il` — הסיבה האמיתית הייתה לא קשורה ל-Auth כלל: `deletionRequestedAt` (Firestore `Timestamp`, מופע class) הועבר כ-prop משרת ל-`UserDeletionSection` (`"use client"`), שאסור ב-React Server Components. תוקן בהמרה ל-ISO string לפני חציית הגבול. ראו `docs/DECISIONS.md` ADR #48.

### שלב 9.5 — מעקב שימוש/עלות Claude API ✅ הושלם (2026-09-02)
`claudeUsageLog/{entryId}` (`src/types/claudeUsageLog.ts`) — רשומה אחת לכל קריאת `messages.create()` (לא לכל הודעת משתמש), נכתבת מנקודה משותפת יחידה בתוך `runAgentTurn` (`src/lib/mcp/agentLoop.ts`, `logClaudeUsage` ב-`src/lib/mcp/claudeUsageLog.ts`) — כל שלושת/ארבעת הקוראים (`channelChat.ts`/`route.ts`/`mcp-cli.ts`/`run-chat-scenario.ts`) עברו רק להעביר `uid`/`channel`, בלי שכפול לוגיקה. `docs/DECISIONS.md` ADR #49 מתעד את הדיון המלא לפני המימוש, כולל:
- **נבדק ונדחה קודם**: הישענות על ה-Admin API הרשמי של Anthropic לפילוח פר-משתמש — אומת (WebFetch על התיעוד הרשמי) שהוא **לא רואה את ה-`uid` שלנו בכלל** (ממדי הסינון שם הם `api_key_id`/`workspace_id`/`model` וכו', לא תיוג מותאם), וגם ה-FAQ הרשמי שם מפנה לפתרון API-key-per-user שלא מתאים לארכיטקטורת WIF של הפרויקט (ADR #20).
- **latency**: הכתיבה מופעלת (לא `await`-ת) מיד אחרי כל תשובת מודל כדי לא לעכב טקסט שכבר זורם ל-`/api/chat`'s NDJSON stream, ונאספת ב-`Promise.all` שרץ ב-`finally` (כל נתיב יציאה, כולל שגיאה) לפני שהפונקציה חוזרת — קריטי לנתיב ה-webhook, סביבת Cloud Function serverless שעלולה להקפיא תהליך אחרי שהתשובה כבר נשלחה.
- **כתיבה לעולם לא זורקת** (בניגוד ל-`writeAuditLog` הקיים) — לדג'ר חשבונאי, לא ביטחוני, ותקלת רישום לא אמורה להפיל שיחה עם משתמש.
- `estimatedCostUsd` הוא הערכה מטבלת תמחור סטטית (`src/lib/mcp/pricing.ts`) + מכפילי cache read/write מתועדים — טוקנים גולמיים הם מקור האמת.
- תצוגת אדמין: הרחבת הכרטיס הקיים "שימוש" ב-`/admin/users/[uid]` (לא עמוד נפרד) עם `count()`+`sum()` aggregation (`src/lib/services/adminClaudeUsage.ts`), אותו עיקרון כמו ספירת כרטיסים/רשימות הקיימת (ADR #43).
- `firestore.rules`: `allow read, write: if false` לחלוטין — כולל לבעלים, בשונה מ-`auditLog`.

אימות: `typecheck`/`lint`/`build` נקיים. `test:rules` — 60/60 (59 קיימים + 1 חדש). `test:unit` — 72 (67 קיימים + 5 חדשים ל-`estimateCostUsd`). אימות מקצה-לקצה אמיתי מול Firestore/Auth emulators + קריאת Claude API אמיתית (סקריפט חד-פעמי, לא נשמר): סבב שיחה יחיד כתב בדיוק רשומה אחת עם טוקנים תואמים בפועל (כולל `cacheCreationInputTokens`), ו-`getClaudeUsageSummaryForUid` החזיר סיכום תואם.

### שלב 9.6 — אנליטיקס בקנה מידה
שכבתי: (1) Firestore aggregation queries (`count()`/`sum()`) לטייל-ים בסיסיים בדשבורד — אפס תשתית חדשה; (2) Firebase Extension הרשמי "Stream Firestore to BigQuery" כשנפח גדל — אפס קוד ETL; (3) GA4 (`src/lib/firebase/analytics.ts`, אותו pattern כמו `appCheck.ts`) לאנליטיקס מוצר סטנדרטי (DAU/MAU, funnels) — נצפה ב-GA4/Firebase Console, לא משוכפל ב-UI.

> ⚠️ **שכבה 3 היא השער המשפטי, לא רק עוד אינטגרציה.** היום אין באתר באנר עוגיות **במכוון** (ADR #59): כל אחסון קיים הוא הכרחי או יזום ע"י המשתמש, כלומר בתוך פטור ePrivacy 5(3). GA4 הוא הדבר הראשון שייצא מהפטור הזה, ומאותו רגע נדרש מנגנון **opt-in** אמיתי — בלי ירי אירוע אחד לפני קליק, עם אפשרות חזרה. שני דברים שיישברו וטוב שכך: `tests/e2e/public.spec.ts` ("מבקר שלא התחבר מקבל אפס עוגיות ואפס trackers") ייכשל, וסעיף "עוגיות ואחסון בדפדפן" ב-`/privacy` יהפוך לא נכון ויחייב העלאת `PRIVACY_POLICY_VERSION`. לקרוא את ADR #59 לפני שכותבים שורה.

**שכבה 1 ✅ הושלמה (2026-09-05)** — מסך הבית של האדמין (`/admin`) הפך ל-`async` Server Component ומציג ארבעה כרטיסי צריכת Claude: 24 שעות אחרונות, 7 ימים אחרונים, החודש הנוכחי (מתחילת חודש הלוח ב-UTC), ומאז ומתמיד. כל כרטיס = עלות מוערכת + מספר קריאות, מ-`getClaudeUsageOverview` (`src/lib/services/adminClaudeUsage.ts`) — ארבע aggregations `count()`+`sum("estimatedCostUsd")` ב-`Promise.all`, אותה צורה בדיוק כמו הסיכום הפר-משתמש הקיים, רק מסוננות לפי `createdAt`. מתחתם פאנל יתרת **בנק קרדיטים** (`CLAUDE_CREDIT_BANK_USD` + `CLAUDE_CREDIT_BALANCE_USD`/`BALANCE_AT`) — קרדיט משולם מראש שלא מתאפס בכל חודש, לא תקציב חודשי. היתרה מחושבת מקריאה אמיתית של ה-Console פחות מה שנרשם מאז, כי `claudeUsageLog` לא מכסה ניצול שקדם ל-Phase 9.5; קריאה מחדש ועדכון שני הערכים מאפסים את הסטייה. תצוגה בלבד, לא תקרה נאכפת — לא מוצג כלל כשהמשתנים חסרים. כל חלון נתפס ב-`try/catch` בנפרד ומציג "לא זמין" בכשל, במקום להפיל את כל הדף כמו שקרה ב-`/admin/users/[uid]` ב-2026-09-05. אינדקס חדש: `claudeUsageLog`: `createdAt ASC, estimatedCostUsd ASC`. ראו `docs/DECISIONS.md` ADR #50.
- אימות: `typecheck`/`lint`/`build` נקיים. `test:rules` — ללא שינוי (אין collection חדש). אימות ידני מול Firebase Emulators: ארבעת הכרטיסים, פס התקציב עם/בלי המשתנה, וערך לא-מספרי שלא מפיל את הדף.

**המלצות להמשך (נשקלו ונדחו במודע בשכבה 1, לפי סדר עלות/תועלת):**
1. **פירוק טוקנים** (input / output / cache-write / cache-read) בכרטיס נפרד — מראה כמה prompt caching באמת חוסך, ומאפשר לזהות רגרסיה ב-cache hit rate. עלות: כל שדה מסוכם נוסף דורש אינדקס מרוכב משלו (`createdAt ASC, <field> ASC`), ואגרגציה מוגבלת ל-5 aggregates לשאילתה.
2. **פילוח לפי ערוץ** (web / whatsapp / telegram / cli) — עונה על "מאיפה מגיעה ההוצאה". עלות: אינדקס `channel ASC, estimatedCostUsd ASC` ושאילתה לכל ערוץ.
3. **טופ-N משתמשים יקרים** — הכי שימושי לזיהוי חריגים, והכי יקר: Firestore לא תומך ב-group-by, אז זה מחייב סריקה מלאה של `claudeUsageLog` (read לכל מסמך) או מסמכי rollup פר-uid שנכתבים ב-`logClaudeUsage`. זה הטריגר הטבעי למעבר לשכבה (2).
4. **גרף מגמה יומי/שבועי** — אותה מגבלה כמו (3) בלי rollup יומי; שייך לשכבה (2), BigQuery.
5. **התראה בחריגת תקציב** (FCM/מייל לאדמין) — דורש Cloud Function מתוזמנת שמריצה את אותה aggregation; היום פס התקציב הוא pull בלבד ומחייב שמישהו יפתח את הדף.
6. **משיכת העלות בפועל מ-Usage & Cost Admin API של Anthropic** — נבדק מול התיעוד הרשמי (2026-09-05, WebFetch על `platform.claude.com/docs/en/manage-claude/usage-cost-api`) ו**לא מומש בכוונה** בשלב הזה. זו שאלה **שונה** מזו שנדחתה ב-ADR #49: שם נבדק פילוח פר-משתמש (בלתי אפשרי — אין ל-Anthropic מושג של ה-`uid` שלנו, וזה לא השתנה), וכאן מדובר בסכום כלל-ארגוני, שכן נגיש.
   - **מה קיים**: `GET /v1/organizations/cost_report` מחזיר עלות אמיתית ב-USD, **גרנולריות יומית בלבד** (`1d`), עם `group_by` על `workspace_id`/`description` (ממנו נגזרים `model`/`inference_geo`). נתונים מופיעים ~5 דקות אחרי הבקשה. Polling מותר פעם בדקה. **אין SDK** — raw HTTP בלבד (לא ב-`@anthropic-ai/sdk`). ה-usage report תומך גם ב-`1h`/`1m`, אבל מחזיר טוקנים ולא דולרים.
   - **אין מושג של תקציב ב-API הזה בכלל.** spend limits קיימים רק ל-Claude Enterprise (ארגוני claude.ai), לא לארגוני Console. כלומר גם עם המימוש הזה, ה-**מכנה** נשאר `CLAUDE_CREDIT_BANK_USD` שלנו — ה-API יכול להחליף רק את המונה (הוצאה בפועל). מנגד, הוא כן היה מייתר את התחזוקה הידנית של `CLAUDE_CREDIT_BALANCE_USD`/`BALANCE_AT`: אם יש עלות אמיתית יומית מ-Anthropic, אין צורך לעגן ליתרה שנקראה ידנית. זו התועלת הגדולה ביותר של המהלך הזה, ושווה לשקול אותה מחדש אם התחזוקה הידנית תתחיל להעיק.
   - **חסם ההרשאות הוא השיקול המרכזי.** ה-credential הנוכחי הוא WIF מוגבל ל-workspace (`ANTHROPIC_WORKSPACE_ID`), ומפתחות workspace-scoped **נדחים במפורש** על ה-endpoints האלה. שתי אפשרויות: (א) `org:admin` (OAuth או federation rule) — עובד, אבל מעניק גישה לכל הארגון בלי קשר ל-workspace, כלומר ה-backend יוכל למחוק חברים ומפתחות API; הסלמה משמעותית מ"יודע לקרוא ל-Messages בלבד". (ב) מפתח service-account שאינו workspace-scoped, ב-`organization_role: billing` (playground + ניהול חיובים, בלי ניהול משתמשים) — ה-least-privilege הסביר, אבל מפתח סטטי, בדיוק מה ש-ADR #20 נמנע ממנו לנתיב ה-Messages.
   - **מה לבדוק לפני שנכתבת שורת קוד** (curl אחד): האם מפתח service-account בתפקיד `billing`, לא workspace-scoped, באמת עובר את `cost_report`. התיעוד אומר "אותן הרשאות כמו החשבון המקושר" אבל לא מפרט איזה role שומר על ה-endpoint. אם `billing` מספיק — התכנון סביר. אם נדרש `org:admin` מלא — לא שווה את הסלמת ההרשאות בשביל טייל אחד.
   - **תכנון מומלץ אם וכאשר**: טייל **נוסף** ("עלות בפועל") לצד ההערכה, לא במקומה — הערך האמיתי הוא ה**דלתא**, כי `src/lib/mcp/pricing.ts` היא טבלה קשיחה שתשקר בשקט ברגע ש-`MODEL_ID` משתנה או ש-Anthropic משנה מחיר, ואין היום שום דבר בקוד שיתפוס את זה. לא על נתיב הבקשה של הדף — Cloud Function מתוזמנת יומית שכותבת מסמך rollup ש-`/admin` קורא ממנו (גם בגלל ה-credential, גם כי הנתון יומי ממילא). הטייל של 24 שעות נשאר על ההערכה שלנו — ה-cost API לא יורד מתחת ליום, ושני מקורות עם מספרים שונים על אותו מסך הם מלכודת UX. לסנן לפי `workspace_id` שלנו, אחרת המספר כולל גם playground ואת workspace ה-dev.
