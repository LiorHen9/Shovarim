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

**נשאר**: (1) merge → rollout, ואז אימות ב-URL החי שאין `[app-check] ... placeholder` ב-console של הדפדפן; (2) Firebase Console → App Check → Apps → לוודא **verified requests**; (3) **רק אז** Enforce על Firestore/Storage. עד שלב (3), threat #4 ב-`docs/SECURITY.md` (כתיבות ישירות ל-REST API שעוקפות את ה-UI) נשאר פתוח — טוקן שנשלח ואיש לא אוכף אותו לא חוסם כלום.

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
- **קישור ערוץ→משתמש** (WhatsApp/Telegram) — collection חדש (`channelLinks/{channelId}` או שדה ב-`users/{uid}`) שידרוש עדכון `firestore.rules`+`docs/DATA_MODEL.md` בזמן המימוש בפועל (ראו כלל קבוע ב-`CLAUDE.md`). זרימת linking (קוד אימות חד-פעמי מהאפליקציה) לא מתוכננת עדיין ברמת המימוש.
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

## Phase 6 — PWA & Polish
manifest, service worker, offline indicators, ביצועים.
(הערה: החלטת ה-hosting/deploy טופלה מוקדם יותר ב-Phase 3.3 — לא כאן, בניגוד למה שנרמז במקור ב-ADR #5.)

## Phase 7 — Notifications
Cloud Function מתוזמן לתזכורות תפוגה, FCM push, email (Firebase Extension / Resend).

## Phase 8 — Reports & Analytics
דשבורד יתרות/תפוגות/מגמות, אגרגציות מחושבות server-side (לא client-side על datasets גדולים).
