# DEPLOYMENT

תשתית ה-deploy וה-CI/CD של Shovarim. סוגר את `docs/DECISIONS.md` ADR #5 — ראו ADR #16 שם להחלטה ולנימוק המלא.

## ארכיטקטורה

- **Firebase App Hosting** — מריץ את אפליקציית ה-Next.js (SSR, Server Actions). רץ בפועל על Cloud Run מתחת למכסה. מחובר ישירות ל-GitHub repo (`LiorHen9/Shovarim`, branch `main`) — **כל push ל-main מפעיל rollout אוטומטי דרך Cloud Build, בנפרד לגמרי מ-GitHub Actions**.
- **Cloud Functions for Firebase** (`functions/`) — מיועד ל-webhooks (WhatsApp/Telegram לצ'אטבוט העתידי, Phase 5) ולעבודות רקע/מתוזמנות (Phase 7: תזכורות תפוגה). ריק כרגע (`functions/src/index.ts`).
- **Firestore, Auth, Storage** — משותפים בין App Hosting ל-Cloud Functions, אותו פרויקט Firebase.
- **סביבה אחת בלבד**: production. אין staging נפרד כרגע.
- **GitHub Actions** לא פורס את האפליקציה עצמה (App Hosting עושה זאת אוטומטית) — תפקידו: (א) quality gate על כל PR/push, (ב) פריסת Firestore rules/indexes, Storage rules, ו-Cloud Functions — אלה **לא** מנוהלים על ידי App Hosting.

**חשוב**: שתי הצינורות (App Hosting rollout ו-GitHub Actions deploy job) עצמאיים לגמרי ומופעלים על ידי אותו push ל-main. אל תוסיפו קריאה ל-`firebase apphosting:rollouts:create` מתוך GitHub Actions — זה ייצור deploy כפול/מתחרה.

## מלאי משתני סביבה / secrets

| שם | היכן חי בפרודקשן | רגישות |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apphosting.yaml` (plain) | לא סוד — מוגן ע"י Security Rules |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `apphosting.yaml` (plain) | לא סוד |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `apphosting.yaml` (plain) | לא סוד |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `apphosting.yaml` (plain) | לא סוד |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `apphosting.yaml` (plain) | לא סוד |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `apphosting.yaml` (plain) | לא סוד |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` | `apphosting.yaml` (plain, `"false"`) | לא סוד |
| `FIREBASE_USE_EMULATOR` | `apphosting.yaml` (plain, `"false"`) | לא סוד |
| `FIREBASE_ADMIN_PROJECT_ID` | `apphosting.yaml` (plain) | לא סוד |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | `apphosting.yaml` (plain) | לא סוד (מזהה, לא מפתח) |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Secret Manager, מוזרק דרך `secret:` reference ב-`apphosting.yaml` | **סוד אמיתי** — לעולם לא plaintext |
| `CARD_FIELD_ENCRYPTION_KEY` | Secret Manager, מוזרק דרך `secret:` reference ב-`apphosting.yaml` | **סוד אמיתי** — מפתח AES-256 להצפנת `cvv`/`barcodeOrCode`, ראו למטה |
| `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` | `apphosting.yaml` (plain) | לא סוד — מזהה site ל-reCAPTCHA |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Secret Manager, מוזרק דרך `secret:` reference ב-`apphosting.yaml` | **סוד אמיתי** — מקבע את מזהי ה-Server Actions בין builds, ראו למטה |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | GitHub Actions secret | מזהה תצורה, לא סוד קריטי בפני עצמו |
| `GCP_SERVICE_ACCOUNT_EMAIL` | GitHub Actions secret | מזהה |
| `FIREBASE_PROJECT_ID` | GitHub Actions secret | מזהה הפרויקט לפקודת ה-deploy |
| `ANTHROPIC_FEDERATION_RULE_ID` / `ANTHROPIC_ORGANIZATION_ID` / `ANTHROPIC_SERVICE_ACCOUNT_ID` / `ANTHROPIC_WORKSPACE_ID` | `apphosting.yaml` (plain, לאחר הקמת WIF — ראו למטה) | מזהי קונפיגורציה, לא סוד — אין `ANTHROPIC_API_KEY` בפרודקשן כלל |
| `CLAUDE_MONTHLY_BUDGET_USD` | `apphosting.yaml` (plain, `RUNTIME` בלבד) | **אופציונלי**, לא סוד — יעד הוצאה חודשי ב-USD שמולו מוצג פס הניצול ב-`/admin`. **לא תקרה נאכפת** — שום דבר לא נחסם בחריגה (הבלימה בפועל היא `RATE_LIMITS` ב-`src/lib/mcp/config.ts`). חסר/לא-מספרי → הפס פשוט לא מוצג. שינוי הערך מחייב rollout (ADR #50) |

אין כרגע secrets ל-FCM/Resend — Phase 4 טרם מומש (ראו `docs/ROADMAP.md`).

## Anthropic Claude API — WIF ל-PROD, מפתח נפרד ל-DEV (ADR #20)

נפרד לגמרי מ-WIF ה-GitHub Actions למעלה — זה על האימות מול ה-Claude API עצמו (platform.claude.com), לא מול GCP. **DEV**: `ANTHROPIC_API_KEY` רגיל ב-`.env.local`, מ-workspace "dev" נפרד ב-Anthropic Console. **PROD**: בלי מפתח סטטי בכלל — App Hosting (שרץ על Cloud Run) ממנפק בעצמו Google-signed identity token מה-service account המחובר אליו, ו-Anthropic מחליף אותו ב-access token זמני. `src/lib/mcp/anthropicClient.ts` בוחר אוטומטית לפי קיום `ANTHROPIC_FEDERATION_RULE_ID`.

**הקמה חד-פעמית (Claude Console, `Settings → Workload identity → Connect workload → Google Cloud`)**:
1. **Federation issuer**: `issuer_url: https://accounts.google.com`, `jwks: discovery` — לשימוש חוזר, לא ספציפי לפרויקט הזה.
2. **מציאת ה-service account המחובר ל-backend**: כברירת מחדל `firebase-app-hosting-compute@shovarim-prod.iam.gserviceaccount.com` — לאמת ב-Console. Unique ID: `gcloud iam service-accounts describe SA_EMAIL --format='value(uniqueId)'`.
3. **Anthropic service account** חדש, חבר ב-workspace **"prod"** נפרד (ולא ה-"dev" הקיים).
4. **Federation rule**: match על `audience: "https://api.anthropic.com"` + `claims.sub` (numeric unique ID — **לא** `subject_prefix`, ר' אזהרת Anthropic נגד prefix על Google `sub`) + `claims.email`. `oauth_scope: "workspace:inference"` (Messages API בלבד).
5. להעתיק את `fdrl_...` (federation rule id), `svac_...` (service account id), ה-org UUID, וה-`wrkspc_...` (workspace id) ל-4 המשתנים ב-`apphosting.yaml` (ראו טבלת ה-secrets למעלה) — **בלי** להוסיף `ANTHROPIC_API_KEY` שם בכלל.

**בדיקה אחרי הקמה**: לוודא ב-`Settings → Workload identity → history` ב-Claude Console שהחלפת token מוצלחת מגיעה מ-production, ושקריאת Claude אמיתית מצליחה מה-backend החי בלי `ANTHROPIC_API_KEY` מוגדר.

## App Check + הצפנת שדות רגישים — הקמה חד-פעמית (Phase 4)

קוד שני הפיצ'רים הושלם (`src/lib/firebase/appCheck.ts`, `src/lib/crypto/fieldEncryption.ts`) — הצעדים הבאים הם הקמת Console/secret שנשארה ידנית, באותו pattern כמו הקמת ה-WIF ל-Anthropic למעלה.

**App Check** (provider: reCAPTCHA **Enterprise** — לא v3 הקלאסי, ראו `docs/DECISIONS.md` ADR #28. הקונסולה מסמנת את v3 כ-deprecated עבור App Check):

**סטטוס: ✅ הושלם — כל השלבים (0–5) בוצעו ב-2026-08-29**, כולל אימות verified requests בקונסולה ו-Enforce בפועל על Firestore ו-Storage. אין כאן עבודה פתוחה; השלבים נשארים מתועדים כ-runbook להקמה מחדש / לדומיין מותאם אישית.

0. לוודא שה-API מופעל בפרויקט: Google Cloud Console → APIs & Services → Enable APIs → `reCAPTCHA Enterprise API` (`recaptchaenterprise.googleapis.com`), פרויקט `shovarim-prod`. בלי זה יצירת המפתח בשלב 1 תיכשל.
1. **יצירת המפתח** — Google Cloud Console → Security → reCAPTCHA (**לא** `google.com/recaptcha/admin`, זו הקונסולה של v3 הקלאסי):
   - Key type: **Website**
   - Domains: `shovarim-web--shovarim-prod.europe-west4.hosted.app` — hostname בלבד, בלי `https://` ובלי `/` בסוף. אין לרשום `hosted.app` לבדו (דומיין ציבורי משותף). דומיין מותאם אישית עתידי יידרש להתווסף כאן.
   - Use checkbox challenge: **כבוי** (score-based) — App Check מצפה ל-invisible/score-based, לא ל-challenge.
   - התוצאה היא **key id** יחיד. ל-Enterprise **אין secret key** — אם קיבלת זוג site+secret, יצרת מפתח v3 קלאסי בקונסולה הלא נכונה.
2. **רישום ב-Firebase** — Firebase Console → App Check → לשונית Apps → אפליקציית ה-web → Register → provider **reCAPTCHA Enterprise** → להדביק את ה-key id משלב 1.
3. להחליף את ה-`REPLACE_ME` של `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` ב-`apphosting.yaml` באותו key id. **בוצע** — המפתח `6LcPWZ4t...` נכנס ב-branch `chore/app-check-and-docs`. הדומיין שעליו נרשם אומת חיצונית: קריאה ל-`recaptcha/enterprise/anchor` עם ה-origin של App Hosting לא מחזירה שגיאה, ובלעדיו מחזירה `Invalid domain for site key`.

   ⚠️ **שלבים 1–2 לבדם לא מפעילים כלום.** ה-key id הוא משתנה `NEXT_PUBLIC_*` שנצרב לתוך ה-bundle של הלקוח ב-**זמן build**, והמקור היחיד שלו ב-App Hosting הוא `apphosting.yaml`. כל עוד כתוב שם `REPLACE_ME`, `isConfiguredSiteKey` (`src/lib/firebase/appCheck.ts`) מזהה placeholder ומדלג על `initializeAppCheck` לגמרי — האפליקציה החיה לא שולחת טוקן App Check כלל, לא משנה מה מוגדר בקונסולה. הסימן בדפדפן: `[app-check] ... placeholder — App Check disabled` ב-console.

   ⚠️ מפתחות Enterprise ומפתחות v3 קלאסיים **שניהם** מתחילים ב-`6L`, וה-guard בקוד לא מבחין ביניהם — מפתח מהסוג הלא נכון יעבור בשקט וייכשל רק מול reCAPTCHA ב-runtime. **גם מבחוץ אי אפשר להבדיל**: `recaptcha/api2/anchor` ו-`recaptcha/enterprise/anchor` שניהם מגישים את המפתח בלי תלונה (נבדק ב-2026-08-29). הדרך היחידה לוודא היא בקונסולה שבה נוצר — Google Cloud → Security → reCAPTCHA (Enterprise) מול `google.com/recaptcha/admin` (v3). סימן עקיף: v3 מנפיק זוג site+secret, ל-Enterprise אין secret כלל.
4. **רק אחרי** ש-rollout עם הקוד+ה-key id כבר חי בפרודקשן ומייצר טוקנים תקינים (לוודא ב-Console → App Check → Apps שיש "verified requests" מהאפליקציה) — להפעיל **Enforce** על Firestore ו-Storage (Console → App Check → APIs). לא לפני כן: enforce מוקדם מדי (לפני שלקוחות אמיתיים כבר שולחים טוקן) חוסם את כל הגישה לאפליקציה. **בוצע 2026-08-29** (על ידי המשתמש, ידנית): ה-URL החי נבדק ללא הודעת ה-placeholder ב-console, verified requests אומתו, ורק אז הופעל Enforce על שני השירותים. סוגר את threat #4 ב-`docs/SECURITY.md`.
5. מפתח debug (`NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG=true`, מוגדר כברירת מחדל ב-`.env.local`) משמש רק ב-dev/CI מול emulators — **לעולם לא** ב-`apphosting.yaml`/production.

**הצפנת שדות רגישים** (`cvv`/`barcodeOrCode`):
1. ליצור מפתח: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — **שונה** מהמפתח שב-`.env.local` (זה ל-dev/emulator בלבד, לא לשימוש בפרודקשן).
2. `.\Set-AppHosting-CardEncryptionKey.ps1` (אחרי שה-backend כבר קיים, כמו שלב 8 ב-runbook למטה) — ירוץ `apphosting:secrets:set` (יבקש להדביק את המפתח) ואז `grantaccess`. **בוצע בפועל: 2026-08-29** (version 1) — עד אז ה-secret לא היה קיים כלל וכל rollout נכשל, ראו הפוסט-מורטם למטה.
   - בשאלה `Would you like to add this secret to apphosting.yaml?` לענות **n** — הרשומה כבר קיימת שם מ-PR #14, ותשובת `Y` הייתה מוסיפה כפילות עם `availability: [BUILD, RUNTIME]` במקום ה-`[RUNTIME]` המכוון (המפתח נטען lazily, `next build` לא צריך אותו — ראו ההערה ב-`apphosting.yaml` ואת הפוסט-מורטם של Phase 3.3).
   - **גיבוי**: המפתח הוא הדבר היחיד שמפענח `cvv`/`barcodeOrCode` בפרודקשן. אובדן/רוטציה שלו הופכים את הערכים המוצפנים (`v1:` prefix) לבלתי ניתנים לשחזור.
3. אחרי ה-rollout הראשון שכולל את הקוד: `npm run migrate:encrypt-fields` (מול production — יש להריץ עם משתני `FIREBASE_ADMIN_*`/`NEXT_PUBLIC_FIREBASE_PROJECT_ID` אמיתיים ב-env, לא `.env.local` שמצביע ל-emulator) כדי להצפין כרטיסים קיימים שנוצרו לפני השדרוג. אידמפוטנטי — בטוח להריץ שוב. **הורץ מול production ב-2026-08-29** (על ידי המשתמש, ידנית).

## `authDomain` עובר לדומיין של האפליקציה עצמה — הקמה חד-פעמית (ADR #35)

קוד הפיצ'ר הושלם (`next.config.ts` rewrites + `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` ב-`apphosting.yaml`) — הצעד היחיד שנשאר ידני הוא ב-Google Cloud Console, **וחייב לקרות לפני** שה-rollout עם ה-`apphosting.yaml` המעודכן יוצא לפרודקשן. סדר הפוך שובר Google Sign-In לגמרי, בכל דפדפן, לא רק Safari.

**סטטוס: ⚠️ ממתין לביצוע ידני** — הקוד מוכן על ה-branch, טרם מוזג ל-`main`.

1. **לפני המיזוג ל-main**: Google Cloud Console → APIs & Services → Credentials → פרויקט `shovarim-prod` → תחת "OAuth 2.0 Client IDs" ה-client שנוצר אוטומטית עבור Firebase Auth (בדרך כלל בשם דומה ל-"Web client (auto created by Google Service)") → Authorized redirect URIs → להוסיף:
   ```
   https://shovarim-web--shovarim-prod.europe-west4.hosted.app/__/auth/handler
   ```
   **לא למחוק** את ה-URI הקיים של `shovarim-prod.firebaseapp.com/__/auth/handler` — הוא עדיין נחוץ כי ה-reverse proxy (`next.config.ts`) עצמו קורא לאותו handler מתחת למכסה.
2. הדומיין `shovarim-web--shovarim-prod.europe-west4.hosted.app` **כבר** ברשימת Firebase Console → Authentication → Settings → Authorized domains (נוסף קודם עבור תקלת `auth/unauthorized-domain`, ראו "Smoke test ראשון" למטה) — אין צעד נוסף שם.
3. רק אחרי ששלב 1 בוצע: למזג את ה-PR ל-`main` ולתת ל-rollout לצאת כרגיל.
4. **אימות אחרי ה-rollout**: להתחבר עם Google בדפדפן שחסם את הזרימה קודם (Safari, בעיקר בנייד) ולוודא שהחזרה מ-Google בפועל יוצרת session — לא רק שהניווט חוזר לעמוד הבית. `GET /__/auth/handler` דרך ה-domain של האפליקציה עצמה אמור להחזיר תוכן (לא 404) — סימן שה-rewrite פעיל.
5. **Rollback**: אם הצעד הידני (1) לא בוצע ו-Google Sign-In שבר לגמרי — `firebase apphosting:rollouts:create shovarim-web --project shovarim-prod --git-commit <sha-קודם-ל-authDomain>` (ראו "Rollback" למטה) חוזר מיד ל-`authDomain` הישן שעדיין עובד.

**נימוק מלא, כולל האבחון של הכשל השקט ב-Safari, ב-`docs/DECISIONS.md` ADR #35.**

## מפתח ה-Server Actions — למה כל deploy שבר טאבים פתוחים (ADR #32)

**התסמין**: אחרי כל rollout, כל טאב שכבר היה פתוח מקבל **404** על `POST` לעמוד הנוכחי (למשל `/settings`) ברגע שלוחצים על משהו. גוף התשובה `Server action not found`, כותרת `x-nextjs-action-not-found: 1`. רענון קשיח פותר — וזה בדיוק מה שמסווה את הבעיה כתקלה נקודתית.

**הסיבה**: מזהי ה-Server Actions נגזרים ממפתח שנוצר **אקראית** ב-`next build` כשאין cache חם (`loadOrGenerateKey` ב-`node_modules/next/dist/server/app-render/encryption-utils-server.js`), ונצרב גם ל-bundle של הלקוח וגם ל-`.next/server/server-reference-manifest.json` בשרת. שני הצדדים תמיד מסונכרנים **בתוך** אותו build, אבל לקוח מ-build קודם מול שרת חדש אינו — הוא שולח מזהה שהשרת לא מכיר, ו-Next מחזיר 404. כל rollout של App Hosting בונה בקונטיינר נקי, ולכן זה חל על **כל** פעולה באפליקציה ועל **כל** rollout, כולל כזה שנגע רק ב-docs.

⚠️ **מקומית זה נראה כאילו אין בעיה**: Next שומר את המפתח ב-`.next/cache/.rscinfo` ומשתמש בו מחדש, אז שני builds מקומיים כן מסכימים — עד תפוגה של 14 יום, `rm -rf .next`, או קונטיינר CI בלי ה-cache הזה. **נמדד** (2026-08-30): שני builds נקיים עם המפתח מקובע נתנו מזהים זהים בית-בבית; בלעדיו שרדו **0 מתוך 18** מזהים.

**התיקון**: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` מקובע כ-secret ב-`apphosting.yaml` עם `availability: [BUILD, RUNTIME]`. ה-BUILD הוא הקריטי — הערך נצרב למניפסט בזמן ה-build; RUNTIME נשמר עבור ה-Edge runtime שקורא אותו מהסביבה.

**הקמה** (חד-פעמית):
1. ליצור מפתח base64 באורך 32 בתים — אותו פורמט ש-Next מייצר לעצמו:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
2. `.\Set-AppHosting-ActionsEncryptionKey.ps1` — `secrets:set` (מדביקים את הערך בפרומפט) ואז `grantaccess`. לשאלה `Would you like to add this secret to apphosting.yaml?` לענות **n**: הרשומה כבר שם בכתב יד עם ה-availability הנכון.
3. חייב לרוץ **לפני** שה-`secret:` מגיע ל-`main` — rollout שמפנה ל-secret שאינו קיים נכשל ולא מנסה שוב (הפוסט-מורטם למטה).

⚠️ **רוטציה של המפתח הזה שקולה להיעדרו**: היא מחליפה את כל המזהים ושוברת כל לקוח פתוח עד שירענן. הוא נוצר פעם אחת ונשמר. הוא לא מגן על מידע של משתמשים — הוא מצפין ארגומנטים שנסגרים (closure) בתוך Server Actions — אבל הוא כן סוד: מי שמחזיק בו יכול לזייף/לפענח את אותם ארגומנטים.

## ערוץ WhatsApp — הקמה חד-פעמית (Phase 5.5.c) — ✅ הושלם (2026-08-30)

**עודכן 2026-08-30**: ההקמה הושלמה ואומתה מקצה לקצה — הודעה חתומה מ-Meta נכנסה, הקישור נפדה, והתשובה נמסרה למכשיר. הסעיף נשאר כאן כ-runbook להקמה חוזרת (מספר חדש, אפליקציה חדשה, פרויקט אחר).

**מה שעיכב בפועל לא היה בקוד** אלא שני המנויים בצד Meta — ראו "שני המנויים" למטה. זו הקריאה הראשונה המומלצת אם משהו שקט.

⚠️ **סדר הפעולות — הרישום של ה-webhook אחרון.** התיעוד למטה ממוספר 1–4, אבל צעד 3 (רישום ה-webhook) **חייב** לבוא אחרי rollout שכולל את הסודות: Meta מאמתת בעזרת `GET` שנושא `hub.verify_token`, ו-`getInboundConfig()` מחזיר `null` כל עוד `WHATSAPP_APP_SECRET`/`WHATSAPP_VERIFY_TOKEN` ריקים — כלומר 503 והרישום נכשל. הסדר הנכון: לאסוף את כל 4 הערכים → PR הסודות + `secrets:set` + rollout → ורק אז לרשום.

**סטטוס: הקוד מוכן (5.5.b הושלם 2026-08-29), ההקמה מול Meta לא הושלמה.** ה-webhook קיים ב-`src/app/api/whatsapp/webhook/route.ts` ומחזיר **503** כל עוד `WHATSAPP_APP_SECRET`/`WHATSAPP_VERIFY_TOKEN` ריקים — כלומר הוא כבר בפרודקשן ולא פתוח כמשטח תקיפה (ADR #30). התנאי שנכתב כאן מראש ("אין להתחיל בהקמה לפני שהוובהוק קיים בקוד") **מתקיים עכשיו**, ואפשר לבצע את הצעדים הבאים.

**לפני שנוגעים ב-Meta**: `npm run whatsapp:sim -- code <uid>` ואז `npm run whatsapp:sim -- send <phone> <text>` מריצים את אותו קוד בדיוק מול ה-emulator, בלי ספק חיצוני — הדרך המהירה לוודא שהצד שלנו תקין לפני שמאשימים את ההקמה. שים לב שהסימולטור מכסה רק מ-`handleInboundChannelMessage` והלאה; את **השליחה** הוא לא מכסה, ראו למטה.

### אימות נתיב השליחה בלי deploy (2026-08-29 — בוצע ועבר)
`sendWhatsAppText` היה עד 2026-08-29 הנתיב היחיד בשרשרת שמעולם לא הורץ מול Meta — לא ב-unit, לא ב-E2E ולא בסימולטור, שכולם מדלגים עליו עם warning כשאין credentials יוצאים. אפשר לאמת אותו **לפני** רישום webhook ולפני כל deploy, כי הכיוון היוצא צריך רק `WHATSAPP_ACCESS_TOKEN`+`WHATSAPP_PHONE_NUMBER_ID` — ה-app secret וה-verify token נוגעים רק לכיוון הנכנס.

איך זה נעשה, אם צריך לחזור על זה (למשל אחרי החלפת מספר):
- סקריפט חד-פעמי **מחוץ לריפו** שמייבא את `src/lib/whatsapp/graph.ts` האמיתי, כדי שמה שנבדק יהיה קוד הפרודקשן ולא חיקוי של ה-`fetch`.
- מריצים עם **`tsx --conditions=react-server`**. בלי זה `import "server-only"` בראש `graph.ts`/`config.ts` **זורק לפני שהקוד שלנו רץ בכלל** — `node_modules/server-only` ממפה את התנאי `react-server` ל-stub ריק, וכל שאר התנאים ל-`index.js` שכל תוכנו `throw`. זו הסיבה ש-`channelChat.ts` נמנע מ-`server-only` בכוונה.
- את הסודות מחזיקים בקובץ env נפרד, **לא ב-`.env.local`**: הכנסת ה-`WHATSAPP_PHONE_NUMBER_ID` האמיתי לשם תגרום ל-`route.ts` לסנן את payloads ה-E2E (שנושאים `phone_number_id: "E2E_PHONE_ID"`) ו-`tests/e2e/whatsapp.spec.ts` ייפול.

בדיקת שפיות זולה לפני שליחה בכלל, שמאמתת טוקן + phone number ID + הרשאות בלי לגעת באף נמען:
```bash
curl -s "https://graph.facebook.com/v23.0/<PHONE_NUMBER_ID>?fields=display_phone_number,verified_name,quality_rating,platform_type" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**תוצאות בפועל**: הקריאה החזירה `verified_name:"Test Number"`, `platform_type:"CLOUD_API"`, `quality_rating:"GREEN"` — כלומר **Graph `v23.0` המקובע ב-`src/lib/whatsapp/config.ts` עדיין נתמך**. השליחה עצמה נמסרה למכשיר בפועל, אחרי כישלון ראשון שמתועד מיד למטה.

### ⚠️ חלון 24 השעות — `131047 Re-engagement message`
השליחה הראשונה **נכשלה** ב-`131047` ("more than 24 hours have passed since the customer last replied"). זו לא תקלת הקמה: WhatsApp מתיר טקסט חופשי רק בתוך חלון שירות של 24 שעות מההודעה האחרונה של הלקוח. אחרי שהנמען שלח הודעה למספר הבוט, אותה שליחה בדיוק עברה.

המשמעות המעשית:
- **בדיקת שליחה ידנית דורשת שהנמען ישלח קודם הודעה למספר הבוט.** אחרת תקבל `131047` ותחשוב שההקמה שבורה.
- `131030` (recipient not in allowed list) היא שגיאה **אחרת** — היא אומרת שהמספר לא נוסף לרשימת הנמענים של מספר הטסט. אל תבלבל ביניהן: `131047` דווקא מוכיחה שהנמען מאושר.
- ההנחה בכל התכנון ש**הבוט רק עונה ואף פעם לא יוזם** אינה העדפה אלא אילוץ אכיף של הספק. Phase 7 (תזכורות תפוגה יזומות) ידרוש **message templates מאושרים מראש**, תהליך אישור נפרד מול Meta.
- **מקרה קצה ידוע**: אם עיבוד הודעה חורג מהחלון (או ב-retry מאוחר של Meta), `sendWhatsAppText` ייכשל ב-`131047` ו-`route.ts` יבלע את זה ללוג בלבד — אחרי שהפעולה כבר בוצעה בפועל. מהצד של המשתמש: בוט שותק שכן שינה נתונים. נדיר, לא נחסם, מתועד כדי שלא יאובחן מאפס.

### תלויות שאתה צריך לספק (ידני, Meta for Developers)
1. ✅ **Meta app** (סוג Business) + **WhatsApp Business Account** מקושר אליו. בטופס יצירת האפליקציה חובה לבחור **Business portfolio** — בלעדיו אי אפשר ליצור System User בצעד 4, וצריך לחזור אחורה.
2. ✅ **מספר טלפון ייעודי לבוט** — שייך למערכת, לא למשתמש. שתי מלכודות:
   - מספר שכבר רשום ב-WhatsApp רגיל או באפליקציית WhatsApp Business **אינו זמין** ל-Cloud API; צריך לנתק אותו קודם או להשתמש במספר נפרד. לא להשתמש במספר האישי.
   - לפיתוח Meta מספקת **מספר טסט חינמי**, שיכול לשלוח רק לרשימה קטנה של נמענים מאושרים מראש (סדר גודל של 5). מספיק לאימות מלא של 5.5.b לפני רכישת מספר אמיתי.
   - **ה-`Phone number ID` הוא לא מספר הטלפון** — זה מזהה בן 15–16 ספרות שמופיע מתחת למספר במסך API Setup. הקוד שלנו משתמש **רק** בו (`{graphBaseUrl}/{phoneNumberId}/messages`) ולעולם לא במספר עצמו.
3. ✅ **Webhook**: `https://<app-hosting-url>/api/whatsapp/webhook` + verify token שאנחנו בוחרים, ו-subscribe לאירוע `messages` בלבד. **אחרון בסדר** (ראו האזהרה בראש הסעיף), ו-**חובה לסמן `messages` במפורש** תחת Webhook fields — בלי זה ה-URL רשום אבל לא נשלחות אליו הודעות כלל. את **Attach a client certificate** להשאיר **לא מסומן**: זה mTLS שדורש proxy שמאמת תעודות לקוח, App Hosting לא מספק שכבה כזו, והאימות שלנו הוא ה-HMAC בגוף הבקשה.
4. ✅ **Permanent access token** + **app secret** של האפליקציה.
   - ה-app secret: App settings → Basic → Show.
   - הטוקן הקבוע **לא** נוצר במסך WhatsApp אלא ב-Business Portfolio → Users → **System users** → Generate new token: לשייך ל-System User גם את **האפליקציה** וגם את **ה-WABA** כ-assets, לסמן `whatsapp_business_messaging` + `whatsapp_business_management`, ו-expiration **Never**. הטוקן מוצג פעם אחת בלבד.
   - **תסמין של שיוך assets חסר**: מסך ההנפקה מציג `No permissions available — Assign an app role to the system user or select another app to continue`, בלי רשימת הרשאות לסמן. התיקון: Add Assets → לשונית **Apps** → האפליקציה → הרשאת **Develop app**; ובנפרד Add Assets → **WhatsApp accounts** → ה-WABA → Full control. רק אז ההרשאות מופיעות.
   - ה-**temporary token** שבמסך API Setup תקף 24 שעות. מצוין לאימות ידני, **אסור** להזרקה ל-Secret Manager: כשהוא יפוג הבוט ימשיך לקבל הודעות ולהריץ tools, אבל כל תשובה תיזרק ב-`route.ts` עם לוג בלבד — מבחוץ זה נראה כמו בוט מת.

**ערכים לא-סודיים של ההקמה הנוכחית** (2026-08-29): `WHATSAPP_PHONE_NUMBER_ID=963623680178719`, WABA ID `952548457144312`, מספר טסט `+1 555-184-5212`. ה-WABA ID **לא בשימוש בקוד** — הוא נחוץ רק לשיוך assets ל-System User בצעד 4.

**לאמת בקונסולה בזמן ההקמה** (השתנה כמה פעמים ולא לסמוך על מה שכתוב כאן): תמחור, מכסות, ומדיניות חלון השירות של 24 שעות. הבוט שלנו **רק עונה ואף פעם לא יוזם**, ולכן הוא אמור להישאר בתוך חלון השירות שבו מותר טקסט חופשי — בלי צורך ב-message templates מאושרים מראש. אם אי פעם יתווספו התראות יזומות (Phase 7), ההנחה הזו נשברת.

### ⚠️ שני המנויים — למה הכל שקט (2026-08-30)
כדי ש-Meta תשלח delivery בכלל צריך **שני** מנויים נפרדים. אף אחד מהם לא מדווח על כישלון, ושניהם נראים תקינים במסך שבו מגדירים את השני:

1. **Webhook field** — סימון `messages` תחת Webhook fields. ה-handshake עובר גם בלעדיו (הוא בודק רק URL + verify token), כך שה-webhook מוצג כמאומת ופשוט לא מקבל כלום.
2. **מנוי האפליקציה ל-WABA** — רשומה נפרדת ב-`{WABA_ID}/subscribed_apps`, שקובעת **איזו אפליקציה** מקבלת את ההודעות של המספר. **היא לא עוברת לאפליקציה חדשה.**

**מה שקרה אצלנו**: אחרי מעבר לאפליקציה חדשה, המנוי נשאר רשום על הישנה. ההודעות נמסרו אליה, והחדשה לא קיבלה דבר — בלי שגיאה, בלי לוג, ובלי סימן בשום מסך של Meta.

אבחון ותיקון ב-[Graph API Explorer](https://developers.facebook.com/tools/explorer) (בוחרים את האפליקציה בתפריט Meta App, מנפיקים User Token עם `whatsapp_business_management`):
```
GET    <WABA_ID>/subscribed_apps    # מי רשום כרגע
DELETE <WABA_ID>/subscribed_apps    # הסרה — אחרי בחירת האפליקציה הישנה ב-Meta App
POST   <WABA_ID>/subscribed_apps    # רישום האפליקציה שנבחרה כרגע
```

**הסחת דעת מתועדת**: הבאנר `Apps will only be able to receive test webhooks... unless the app has been published` הוא גנרי לכל פלטפורמת Meta, וזרימת ה-Quickstart של WhatsApp כן מוסרת הודעות ממספר טסט לנמען מאושר במצב Development. **לא להיכנס ל-App Review / Business Verification** (תהליך של ימים שדורש עסק רשום) לפני שמיצו את `subscribed_apps` ואת לוג הבקשות — אצלנו זו הייתה התשובה.

### אבחון: מה לבדוק כשאין תשובה בווטסאפ
מתחילים תמיד מ**לוג הבקשות של Cloud Run**, לא מלוג האפליקציה: מסלול ההצלחה ומסלול הדילוג לא כותבים כלום, ולכן היעדר שורות `[whatsapp]` אינו ראיה. השאלה הראשונה היא תמיד "האם הגיע POST בכלל":

```
https://console.cloud.google.com/logs/query;query=httpRequest.requestUrl%3A%22whatsapp%22;duration=P1D?project=shovarim-prod
```

| מה רואים | המשמעות | התיקון |
|---|---|---|
| אין `POST` כלל | Meta לא שולחת | שני המנויים למעלה |
| `POST` → 401 | ה-app secret בשרת שונה מזה של האפליקציה ששלחה | `secrets:set` **+ rollout**. חשוד ראשון אחרי החלפת אפליקציה |
| `GET` → 403 | verify token לא תואם | להשוות תו-בתו (רווח נגרר מספיק) |
| 503 | סוד חסר ב-runtime | לוודא שכל הסודות קיימים ושבוצע rollout |
| `POST` → 200 בלי תשובה | הגיע ונזרק בשקט | `phone_number_id` לא תואם, dedup של retry, או כשל שליחה (`[whatsapp] failed to send reply`) |
| `131047` / `131030` | חלון 24 השעות / נמען לא מאושר | ראו הסעיף על חלון 24 השעות |

**בקרת ביקורת חיובית**: `curl` ידני ל-webhook עם ערכים שגויים בכוונה משאיר בלוג `403`/`401` בזמן ידוע. אם הם מופיעים ובקשות מ-Meta לא — הצינור עובד ופשוט לא נשלח אליו כלום. בקשות אמיתיות מ-Meta נושאות User-Agent שמכיל `facebookexternalua`.

### סודות (Secret Manager, בדפוס `FIREBASE_ADMIN_PRIVATE_KEY`)
סקריפט `Set-AppHosting-WhatsAppSecrets.ps1` (נכתב 2026-08-29), במתכונת `Set-AppHosting-CardEncryptionKey.ps1`. כל `secrets:set` מבקש את הערך ב-prompt — מדביקים שם, כך שהסוד לא נוגע בקובץ, ב-git ולא ב-shell history:

| משתנה | סוג | הערה |
|---|---|---|
| `WHATSAPP_APP_SECRET` | `secret:` | לאימות `X-Hub-Signature-256` |
| `WHATSAPP_ACCESS_TOKEN` | `secret:` | permanent token לשליחה דרך Graph API |
| `WHATSAPP_VERIFY_TOKEN` | `secret:` | מחרוזת אקראית שאנחנו בוחרים, ל-handshake של ה-`GET` |
| `WHATSAPP_PHONE_NUMBER_ID` | plain | מזהה, לא חומר סוד. גם מסנן deliveries של מספרים אחרים תחת אותו Meta app |
| `NEXT_PUBLIC_WHATSAPP_BOT_PHONE` | plain | לא הפקת webhook — המספר הפומבי לתצוגה, לבניית קישור ה-`wa.me` ב-`/settings` (issue #39, `src/lib/whatsapp/deepLink.ts`). שונה מ-`WHATSAPP_PHONE_NUMBER_ID`, שהוא מזהה פרטי של ה-Graph API. `[BUILD, RUNTIME]` כי מוזרק לבאנדל הלקוח |

- **`apphosting.yaml` מכיל את ארבעתם מ-5.5.c** (שם הסוד ב-Secret Manager: `whatsapp-app-secret` / `whatsapp-access-token` / `whatsapp-verify-token`). 5.5.b נמנע מזה בכוונה עד שהסודות יוזרקו בפועל — ולכן **חובה להריץ את הסקריפט לפני שה-PR מגיע ל-`main`**, ראו האזהרה למטה.
- כולם `availability: [RUNTIME]` **בלבד** — נקראים lazily בתוך ה-handler (`src/lib/whatsapp/config.ts`), `next build` לא צריך אותם (בניגוד ל-`adminApp.ts`; ראו ההערה ב-`apphosting.yaml`).
- אפשר גם `WHATSAPP_GRAPH_BASE_URL` (plain, אופציונלי) כדי לנעוץ גרסת Graph אחרת. ברירת המחדל בקוד היא `https://graph.facebook.com/v23.0` — **לאמת בקונסולה שהגרסה עדיין נתמכת** בזמן ההקמה.
- ב-CI וב-`.env.local` מוגדרים `WHATSAPP_APP_SECRET`/`WHATSAPP_VERIFY_TOKEN` דמה קבועים, כדי ש-`tests/e2e/whatsapp.spec.ts` יוכל לחתום delivery כמו Meta. הסודות היוצאים (`ACCESS_TOKEN`/`PHONE_NUMBER_ID`) **לא** מוגדרים שם, ולכן שליחת התשובה מדלגת עם warning במקום לפנות ל-`graph.facebook.com` מתוך בדיקות.
- **הרצה בפועל (2026-08-29)**: שלושת הסודות נוצרו (`whatsapp-app-secret`, `whatsapp-access-token`, `whatsapp-verify-token`), גרסה 1 `ENABLED`, וההרשאה ניתנה ל-backend `shovarim-web`. אימות: `npx firebase apphosting:secrets:describe <name> --project shovarim-prod`.
- ⚠️ **מלכודת CLI**: `apphosting:secrets:grantaccess` דורש היום `--backend <id>` (או `--emails`) ובלעדיו נכשל ב-`Error: Missing required flag --backend or --emails`. **הצורה החשופה ב-`Set-AppHosting-AdminKey.ps1` וב-`Set-AppHosting-CardEncryptionKey.ps1` מיושנת ותיכשל אם יריצו אותם היום** — הן נכתבו מול גרסת CLI מוקדמת יותר. הכישלון הזה **אינו** מסוכן: ה-prompt האינטראקטיבי בתוך `secrets:set` כבר שואל "grant access now?" ומבצע את ההרשאה, כך שהפקודה הנפרדת היא רק גיבוי. עדיין — שווה לתקן לפני ההרצה הבאה.
- שני ה-prompts של `secrets:set`: "grant access now?" → **Yes**; "add this secret to apphosting.yaml?" → **No**, כי הרשומות כבר בקובץ ידנית עם `[RUNTIME]` וההערות; הוספה אוטומטית תיצור משתנה כפול.
- ⚠️ **עדכון סוד קיים לא נכנס לתוקף בלי rollout.** `secrets:set` יוצר גרסה חדשה ב-Secret Manager, אבל ה-instance שרץ קיבל את משתני הסביבה שלו בעלייה וימשיך עם הערך הישן. אחרי כל החלפת סוד (למשל app secret אחרי מעבר לאפליקציית Meta חדשה):
  ```powershell
  npx firebase apphosting:rollouts:create shovarim-web --git-branch main --project shovarim-prod
  ```
  בלי זה ממשיכים לקבל 401 על סוד שלכאורה תוקן — וזה נראה בדיוק כמו תיקון שלא עבד.
- ⚠️ **כל הוספת `secret:` חייבת להיות באותו PR עם הרצת `secrets:set`+`grantaccess` בפועל** — אחרת ה-rollout נכשל ולא מנסה שוב לבד. זו בדיוק התקלה שהפילה את הפרודקשן ליומיים ב-Phase 4.3, ראו הפוסט-מורטם למטה.

## First-deploy runbook (סדר מדויק)

צעדים 1–5 הם חד-פעמיים, אינטראקטיביים, ולא ניתנים ל-scripting (billing/OAuth consent). מבוצעים ידנית על ידך.

1. **יצירת פרויקט Firebase אמיתי** — Firebase Console → Add project. שם מוצע: `shovarim-prod` (אם תבחר שם אחר, עדכן את כל המקומות שמכילים `shovarim-prod`: שלושת סקריפטי ה-PowerShell, `.github/workflows/ci.yml` דרך ה-secret `FIREBASE_PROJECT_ID`, ו-`apphosting.yaml`).
2. **שדרוג לתוכנית Blaze** (pay-as-you-go) — נדרש ל-Cloud Functions ו-App Hosting. Console בלבד (חיבור אמצעי תשלום).
3. **בחירת region ל-Firestore** — לא ניתן לשינוי אחר כך. מוצע: `europe-west1` (הקרוב ביותר לישראל מבין ה-regions הנפוצים) — **ודא ברשימת ה-regions העדכנית בקונסולה ברגע ההקמה**, ייתכן שהזמינות השתנתה. השתמש באותו region גם ל-App Hosting ול-Cloud Functions (`setGlobalOptions` ב-`functions/src/index.ts`) כדי למנוע latency בין-אזורי.
4. **הגדרת Workload Identity Federation** (חד-פעמי, מריצים ידנית/מ-Cloud Shell — לא סקריפט עיוור בגלל הרגישות):

   ```bash
   PROJECT_ID=shovarim-prod
   PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

   gcloud iam workload-identity-pools create "github-pool" \
     --project="$PROJECT_ID" --location="global" --display-name="GitHub Actions"

   gcloud iam workload-identity-pools providers create-oidc "github-provider" \
     --project="$PROJECT_ID" --location="global" \
     --workload-identity-pool="github-pool" \
     --display-name="GitHub OIDC" \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
     --attribute-condition="assertion.repository=='LiorHen9/Shovarim'" \
     --issuer-uri="https://token.actions.githubusercontent.com"

   gcloud iam service-accounts create github-deploy \
     --project="$PROJECT_ID" --display-name="GitHub Actions deploy"

   # roles/editor + firebaserules.admin: פרגמטי ל-MVP. firebase deploy --only
   # functions דורש הרשאות רחבות על פני Cloud Build/Functions/Artifact
   # Registry/Pub/Sub/Run שמסורבל למנות במדויק. לכווץ בהמשך (מתאים ל-Phase 4
   # privacy hardening) אם רוצים least-privilege עכשיו במקום מאוחר יותר.
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:github-deploy@${PROJECT_ID}.iam.gserviceaccount.com" \
     --role="roles/editor"
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:github-deploy@${PROJECT_ID}.iam.gserviceaccount.com" \
     --role="roles/firebaserules.admin"
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:github-deploy@${PROJECT_ID}.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountUser"

   gcloud iam service-accounts add-iam-policy-binding \
     "github-deploy@${PROJECT_ID}.iam.gserviceaccount.com" \
     --project="$PROJECT_ID" \
     --role="roles/iam.workloadIdentityUser" \
     --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/LiorHen9/Shovarim"
   ```

   **חלופה מהירה יותר (פחות מאובטחת)**: מפתח service-account JSON ארוך-טווח במקום WIF — `gcloud iam service-accounts keys create key.json --iam-account=github-deploy@shovarim-prod.iam.gserviceaccount.com`, ואז secret בשם `GCP_SA_KEY` עם תוכן הקובץ, והחלפת שלב ה-`auth` ב-`ci.yml` ל-`credentials_json: ${{ secrets.GCP_SA_KEY }}` במקום `workload_identity_provider`/`service_account`. אם משתמשים בזה — לסובב את המפתח מדי פעם. מומלץ WIF בגלל שהאפליקציה מחזיקה נתונים פיננסיים (מספרי כרטיס/CVV).

5. **הוספת GitHub repository secrets** (Settings → Secrets and variables → Actions, או `gh secret set` אם מותקן `gh` CLI):
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` = `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
   - `GCP_SERVICE_ACCOUNT_EMAIL` = `github-deploy@shovarim-prod.iam.gserviceaccount.com`
   - `FIREBASE_PROJECT_ID` = `shovarim-prod`

6. **מילוי `apphosting.yaml`** — להחליף את כל ה-`REPLACE_ME` בערכים האמיתיים מ-Firebase Console → Project settings.

7. **יצירת App Hosting backend** (אחרי ש-`apphosting.yaml` כבר ב-`main`):
   ```powershell
   npx firebase apphosting:backends:create --project shovarim-prod
   ```
   אינטראקטיבי — יבקש region, חיבור ל-GitHub repo (מפעיל התקנת GitHub App ל-Cloud Build בפעם הראשונה — מסך הרשאות בדפדפן), live branch (`main`), root directory (`/`).

8. **הגדרת ה-secret של Admin SDK**:
   ```powershell
   .\Set-AppHosting-AdminKey.ps1
   ```
   ירוץ אחרי שה-backend קיים (ה-`grantaccess` צריך backend id).

8ב. **שאר ה-secrets** — אותו שלב, אותה דרישה (backend קיים), וכולם **לפני** שההפניות ב-`apphosting.yaml` מגיעות ל-`main`:
   ```powershell
   .\Set-AppHosting-CardEncryptionKey.ps1        # cvv/barcodeOrCode
   .\Set-AppHosting-ActionsEncryptionKey.ps1     # מזהי Server Actions, ראו למעלה
   .\Set-AppHosting-WhatsAppSecrets.ps1          # ערוץ WhatsApp
   ```

9. **Rollout ראשון** — קורה אוטומטית אחרי מיזוג ל-`main`, או ידנית:
   ```powershell
   npx firebase apphosting:rollouts:create shovarim-web --project shovarim-prod --git-branch main
   ```
   `backendId` הוא ארגומנט **פוזיציוני**, לא `--backend` (הגרסה הקודמת של השורה הזו כאן הייתה שגויה ונכשלה עם `error: unknown option '--backend'`). אפשר `--git-commit <sha>` במקום `--git-branch`, ו-`-f` לדילוג על אישור.

## CI (GitHub Actions) — `.github/workflows/ci.yml`

workflow אחד בשם `CI`, שלוש jobs, שני טריגרים:

```
on: pull_request        →  quality ‖ functions                      (deploy מדולג)
on: push [branches:main] →  quality ‖ functions  →  deploy-rules-and-functions
```

### למה `quality` ו-`functions` מופרדים

הם רצים **במקביל, בלי תלות ביניהם**. הפיצול הוא לפי **עץ תלויות**, לא לפי גרסת node (שניהם node 22 — `.nvmrc` מול `engines.node` ב-`functions/package.json`): השורש ו-`functions/` הם שני פרויקטי npm עם `package-lock.json` ו-`tsconfig` נפרדים.

- **cache נפרד** לכל אחד (`cache-dependency-path: functions/package-lock.json` ב-job השני).
- **feedback מהיר יותר** — `functions` הוא job קליל (`npm ci` → `typecheck` → `build`, כדקה), בזמן ש-`quality` כבד: מתקין Java 21 ל-emulators, Chromium ל-Playwright, ומריץ build מלא. שגיאת טיפוס ב-Cloud Functions צפה מיד במקום להיקבר מתחת ל-build של Next.
- אם/כשיתווסף deploy נפרד ל-Functions, הגבול כבר קיים.

### סדר הצעדים ב-`quality` — fail-fast מהזול ליקר

`npm ci` → `typecheck` → `lint` → `build` → `playwright install chromium` → `emulators:exec` (rules tests + E2E באותה הרצת emulator אחת). שגיאת טיפוס נופלת תוך שניות ולא אחרי שהותקן דפדפן והורמו emulators. `playwright-report/` נשמר כ-artifact **רק על כישלון** (`if: failure()`, 7 ימים).

ה-job כולו רץ ב-**emulator mode עם ערכי Firebase דמה** ומפתח `CARD_FIELD_ENCRYPTION_KEY` קבוע (ראו טבלת ה-secrets למעלה ואת מיפוי ה-emulator למטה). זו לא רק נוחות — **ל-CI על PR אין שום גישה ל-production**, וזה חשוב במיוחד כי PR יכול להגיע מ-fork.

### למה ה-deploy job לא רץ על PR

הוא לא "אופציונלי" — הוא **מדולג בתנאי**, ומופיע אפור (skipped) בבדיקות ה-PR:

```yaml
needs: [quality, functions]
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

שני מנעולים נפרדים:
1. **`needs`** — לא נפרס כלום אם אחד משני ה-gates נכשל.
2. **`if`** — push ל-`main` בלבד.

הרציונל: Firestore rules, indexes, Storage rules ו-Functions הם משאבים **גלובליים בפרויקט אחד**, ואין staging (ADR #16). branch שהיה יכול לפרוס rules היה דורס את ה-rules של production. `permissions: id-token: write` ב-job הזה נדרש ל-Workload Identity Federation — הוא ה-job היחיד שמקבל credentials אמיתיים.

ה-job בונה מחדש את `functions/` במקום לצרוך artifact מה-job `functions` — כפילות מכוונת, פשוטה יותר מהעברת artifacts בין jobs עבור build בן דקה.

### למה `quality` רץ שוב אחרי merge

ריצת ה-PR בדקה את **מיזוג ה-PR head לתוך main כפי שהיה אז**. `main` יכול היה לזוז מאז (שינוי שמתנגש סמנטית, לא טקסטואלית). הריצה על `main` היא ה-gate שקודם ל-deploy בפועל, על העץ שבאמת ייפרס.

### מגבלה קיימת: `main` לא מוגן

נכון ל-2026-08-29 אין branch protection על `main` (`GET /branches/main/protection` → 404). כלומר ה-CI הוא **ייעוץ, לא שער**: אפשר למזג PR עם checks אדומים, ואפשר לדחוף ישירות ל-`main` ולעקוף PR לגמרי. שיפור מתבקש: להפוך את `quality` ו-`functions` ל-required status checks.

## זרימת deploy שוטפת

Push ל-`main` מפעיל **שני צינורות עצמאיים** באותו רגע:
1. App Hosting (Cloud Build, לא GitHub Actions) בונה ופורס את אפליקציית ה-Next.js.
2. GitHub Actions מריץ quality gate, ואם עובר — פורס Firestore rules/indexes, Storage rules, ו-Functions.

| | מי מריץ | מה נפרס | טריגר | מדווח כ-check? |
|---|---|---|---|---|
| צינור א' | GitHub Actions (`deploy-rules-and-functions`, WIF ל-GCP) | Firestore rules + indexes, Storage rules, Cloud Functions | push ל-`main`, אחרי quality+functions | ✅ תמיד |
| צינור ב' | Firebase App Hosting → Cloud Build | אפליקציית ה-Next.js עצמה | push ל-`main` (ה-backend מחובר ישירות ל-repo) | ⚠️ לא אמין — ראו אזהרה |

**אין ביניהם סנכרון או סדר מובטח** — הם מתחילים יחד ומסתיימים בזמנים שונים. שינוי שדורש שה-rules יהיו במקום לפני שהקוד החדש עולה (או להפך) יעבור חלון קצר של חוסר עקביות. במקרה כזה לפצל לשני merges: קודם השינוי המתירני, ואחריו זה שנשען עליו.

### האם צריך להריץ rollout ידנית?

**לא, לא בזרימה הרגילה.** ה-backend `shovarim-web` מחובר ישירות ל-repo ול-branch `main`, וכל push ל-`main` מייצר rollout אוטומטי דרך Cloud Build. אין צורך לגעת ב-`apphosting:rollouts:create` אחרי merge רגיל.

rollout ידני (שלב 9 ב-runbook למעלה) נדרש רק ב-שלושה מקרים:
1. **rollback / roll-forward** ל-commit ספציפי — `--git-commit <sha>` (ראו סעיף Rollback).
2. **תיקון שלא ייצר commit** — למשל secret שנוצר/עודכן ב-Secret Manager, או הרשאה שתוקנה בקונסולה. ה-rollout הכושל **לא מנסה שוב לבד** ואין commit חדש שיפעיל אותו.
3. ה-deploy הראשון סביב יצירת ה-backend.

> **אזהרה — שני הצינורות נכשלים בנפרד, ורק אחד מהם מדווח.** GitHub Actions מציג ✅/❌ על ה-PR; כישלון של App Hosting **לא** מופיע שם בכלל. אפשר לראות "כל ה-checks ירוקים" בזמן שהאפליקציה החיה תקועה על build ישן. ראו הפוסט-מורטם למטה (2026-08-29).

## פוסט-מורטם: secret חסר → 4 rollouts כושלים בשקט (2026-08-28/29)

**מה קרה**: PR #14 (Phase 4) הוסיף ל-`apphosting.yaml` הפניה ל-secret `card-field-encryption-key`, אבל שלב ה-`Set-AppHosting-CardEncryptionKey.ps1` מה-runbook מעולם לא הורץ — ה-secret לא נוצר ב-Secret Manager כלל. כל rollout מאז נכשל עם `Misconfigured secret / Error resolving secret version ... versions/latest`.

**למה זה לא נתפס במשך יומיים**: כל ה-GitHub Actions checks המשיכו לעבור (הם לא נוגעים ב-App Hosting), אז ה-PR-ים נראו ירוקים לגמרי. ארבעה merges רצופים (#14, #15, docs, #16) "הצליחו" בזמן שה-URL החי המשיך להגיש את ה-build של #13 מ-2026-08-27 17:45.

**ההשלכה החמורה**: תיקון האבטחה של Phase 4.5 (`firestoreIdSchema`, חוסם path injection ב-`cardId`/`listId` דרך Server Actions — ראו ADR #25) היה בתוך #14, ולכן **לא היה בפרודקשן** מרגע גילויו ועד התיקון כאן. פער בין "מוזג" ל-"פרוס" הוא פער אבטחה אמיתי, לא רק אי-נוחות.

**איך לאבחן** (ה-CLI המותקן מוגבל — אין `apphosting:rollouts:list` בגרסה הזו, ו-`backends:get` מחזיר רק טבלת סיכום בלי מידע על builds):
```powershell
npx firebase apphosting:secrets:describe <secret-name> --project shovarim-prod
```
404 = ה-secret לא קיים בכלל (צריך `secrets:set`, לא רק `grantaccess` — הודעת השגיאה של App Hosting מציעה `grantaccess` ומטעה במקרה הזה). טבלת versions = קיים, ואז הבעיה היא באמת הרשאות.

**כללים שנגזרים מזה**:
- כל הוספת `secret:` ל-`apphosting.yaml` חייבת להיות באותו PR עם הרצת `secrets:set`+`grantaccess` בפועל, או לכל הפחות עם בדיקה ידנית של ה-URL החי אחרי המיזוג. **לא להסתמך על ✅ של GitHub Actions כאישור שה-deploy עבר.**
- אחרי כל merge ל-`main` שמשנה `apphosting.yaml` או מוסיף route חדש — לוודא בפועל מול ה-URL החי (למשל `curl -o /dev/null -w '%{http_code}' <url>/<route-חדש>`; 404 על route שאמור להתקיים = ה-rollout לא עבר).
- כשמתקנים secret חסר, ה-rollout הכושל **לא מנסה שוב לבד** ואין commit חדש שיפעיל אותו — חייבים `apphosting:rollouts:create` ידני (שלב 9 למעלה).

**זנב של התקלה הזו (2026-08-29)**: ברגע שהרולאאוט תוקן, ארבעה PR-ים נחתו באוויר בבת אחת — וביניהם באג ש**נכתב** ב-#14 אבל **התפוצץ** רק ביום שהדeploy עבר: `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` עם הערך `REPLACE_ME` הפיל את Google Sign-In בספארי נייד (ADR #27). לקח: אחרי חלון של rollouts כושלים, ה-deploy הראשון שמצליח הוא **לא** deploy רגיל — הוא שחרור מצטבר של כל מה שהצטבר, וצריך לבדוק אותו ככזה. `curl` על route חדש מוודא שהרולאאוט עבר; הוא לא מוודא שהאפליקציה עובדת. לפחות smoke test ידני אחד של התחברות, בנייד ובדסקטופ.

### איפה רואים כשלי התחברות בלוגים

מאז ADR #27 כשל התחברות בצד הלקוח מדווח ל-`POST /api/auth-errors` ונרשם ל-Cloud Logging. שאילתה:

```
resource.type="cloud_run_revision"
jsonPayload.event="auth_sign_in_failed"
```

השדות: `stage` (`provider-sign-in` = הפופאפ של גוגל נכשל / `create-session` = מינטינג ה-session cookie נכשל), `code` (קוד Firebase, למשל `auth/popup-blocked`), `providerId`.

**מה עדיין לא נרשם**: כשלי התחברות בצד Firebase Auth עצמו. הקונסולה מציגה רק התחברויות מוצלחות; לרישום ניסיונות כושלים ברמת השירות צריך להפעיל Cloud Audit Logs (Data Access) ל-Identity Toolkit API ב-GCP — opt-in, עולה כסף, ובעל השלכות PII שצריך להצליב מול `docs/PRIVACY.md` לפני שמפעילים.

## פוסט-מורטם: `storage.bucket()` נופל ב-Cloud Functions — env var שחי רק ב-App Hosting (2026-09-01, ADR #46)

**מה קרה**: אדמין ניסה "מחיקה מיידית" של משתמש (`adminDeleteUserNow`, Phase 9.4) וקיבל שגיאת 500. הלוגים (`firebase functions:log --project shovarim-prod`) הראו `FirebaseError: Bucket name not specified or invalid` בתוך `deleteUserAccount()`, ב-`Storage.bucket()`.

**הסיבה**: `functions/src/firebaseAdmin.ts` אתחל את ה-Admin SDK עם `storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`. המשתנה הזה **קיים רק ב-App Hosting** — `apphosting.yaml` מגדיר אותו עם `availability: [BUILD, RUNTIME]`, אבל זה חל אך ורק על ה-backend של Next.js. Cloud Functions הוא compute environment נפרד לגמרי; שום מנגנון לא מעביר אליו משתני `apphosting.yaml`. `GCLOUD_PROJECT` כן מוגדר אוטומטית ע"י ריצת ה-function עצמה (ולכן `projectId` תמיד עבד), אבל אין מקבילה אוטומטית לשם ה-bucket.

**למה זה לא נתפס קודם**: `deleteUserAccount()` (Phase 4.2, ADR #24) קיים מזמן, אבל עד עכשיו אף אחד לא באמת קרא לו בפרודקשן — ה-sweep המתוזמן (`deleteExpiredAccounts`) דורש 30 יום grace period שעדיין לא חלפו על אף משתמש. `adminDeleteUserNow` (Phase 9.4) הוא קטע הקוד הראשון שבאמת הפעיל את הפונקציה בפרודקשן, וחשף באג ישן.

**השלכה חמורה — מחיקה חלקית, לא רק כישלון**: הסדר בתוך `deleteUserAccount()` הוא: מחיקת מסמכי Firestore (כרטיסים/רשימות/חברויות/קישורי ערוץ/הזמנות) ← מחיקת קבצי Storage (**כאן זרק**) ← מחיקת `users/{uid}` ← מחיקת חשבון ה-Auth. כלומר קריאה שנכשלת כאן משאירה את המשתמש במצב ביניים: הנתונים שבבעלותו כבר נמחקו, אבל הפרופיל וחשבון ה-Auth עדיין קיימים. בגלל ש-`deleteUserAccount()` idempotent-safe מטבעו (כל שלב פשוט לא עושה כלום אם הנתונים כבר נעלמו), התיקון הנכון הוא לתקן את הבאג ולנסות שוב את אותה פעולה — לא לבנות ניקוי ידני נפרד.

**התיקון**: `functions/src/firebaseAdmin.ts` קורא קודם ל-`process.env.STORAGE_BUCKET`, ורק אם הוא ריק נופל חזרה ל-`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (לתאימות עם אמולטור/סקריפטים מקומיים). `STORAGE_BUCKET` מוגדר ב-`functions/.env.shovarim-prod` — קובץ env-file לפי המוסכמה של Firebase Functions Gen 2 (`functions/.env.<project-id>`, נטען אוטומטית ונארז לתוך ה-deploy רק לפרויקט התואם). לא סוד — אותו ערך שכבר גלוי ב-`apphosting.yaml`.

**אימות**: בדיקת בידוד (`storage.bucket()` נקרא בתוך תהליך Node טרי שמייבא **רק** את `functions/src/firebaseAdmin.ts`, בלי `src/lib/firebase/adminApp.ts`) — כי בדיקת עשן קודמת (Phase 9.4) עברה בטעות: היא ייבאה גם את `adminApp.ts` (ל-`adminAuth`/`adminDb`) **וגם** ישירות את ה-handler מ-`functions/src/adminActions.ts` **באותו תהליך**, כך ש-`getApps()[0]` ב-`firebaseAdmin.ts` מצא את ה-app שכבר אותחל ע"י `adminApp.ts` (עם bucket תקין מ-`.env.local`) ומעולם לא ניסה לאתחל בעצמו — false positive. לקח: כשבודקים קוד ש-`functions/` מייבא, לוודא בידוד תהליך אמיתי, לא רק ש"זה עבד באמולטור".

## פוסט-מורטם: `sum()` באגרגציה דורש אינדקס מרוכב — דף המשתמש באדמין נפל ב-500 (2026-09-05)

**מה קרה**: כניסה ל-`/admin/users/<uid>` בפרודקשן החזירה `This page couldn't load — A server error occurred` עם `ERROR 1810316195` (ה-digest של Next, לא קוד שגיאה אמיתי). הלוגים:

```
gcloud logging read 'resource.type="cloud_run_revision" AND (logName:"stderr" OR logName:"stdout")'   --project=shovarim-prod --freshness=2d --limit=40 --format='value(timestamp,textPayload)'
```

הראו `Error: 9 FAILED_PRECONDITION: The query requires an index` עם אותו `digest: '1810316195'`, והלינק ליצירת האינדקס הצביע על `claudeUsageLog` עם `uid` + `estimatedCostUsd`.

**הסיבה**: `getClaudeUsageSummaryForUid` (Phase 9.5, ADR #49) מריצה `where("uid","==",uid).aggregate({ count(), sum("estimatedCostUsd") })`. ההנחה שתועדה ב-PR הייתה "פילטר שוויון על שדה בודד — האינדקס האוטומטי מספיק". זה נכון ל-`count()` אבל **לא** ל-`sum()`/`average()`: אגרגציה על ערך מספרי חייבת לקרוא את השדה המסוכם מתוך האינדקס עצמו, ולכן הצירוף `where(uid)` + `sum(estimatedCostUsd)` דורש אינדקס מרוכב `uid ASC, estimatedCostUsd ASC`.

**למה זה לא נתפס קודם**: אותה סיבה כמו ב-ADR #33 — האמולטור בונה אינדקס לכל שאילתה שמגיעה אליו, ולכן `npm run test:e2e` וכל בדיקה מקומית עוברים גם כשהאינדקס חסר בפרודקשן. בנוסף, הדף נשבר רק אחרי הפריסה כי לפני Phase 9.5 הוא בכלל לא נגע ב-`claudeUsageLog`.

**השלכה**: הדף כולו נפל, לא רק המספר — `getUserDetail` מריצה את האגרגציה בתוך אותו `Promise.all` עם שאר נתוני המשתמש, כך שכשל בקריאת טלמטריית עלות חסם גם מודרציה, מחיקה וקישורי ערוצים.

**התיקון**: הוספת האינדקס ל-`firestore.indexes.json` (נפרס אוטומטית ב-`deploy-rules-and-functions` בדחיפה ל-`main`). בניית האינדקס אינה מיידית — עד שהוא ב-`READY` הדף ימשיך ליפול. מעקב: `gcloud firestore indexes composite list --project shovarim-prod`.

**לקח**: כל `aggregate()` חדש עם `sum()`/`average()` — לוודא אינדקס מרוכב `(<שדות ה-where>, <השדה המסוכם>)` ידנית ב-`firestore.indexes.json`; "עבר באמולטור" לא מוכיח כלום לגבי אינדקסים.

## Rollback

- **אפליקציה**: `firebase apphosting:rollouts:create shovarim-web --project shovarim-prod --git-commit <sha-קודם>` (backendId פוזיציוני). שימו לב: ל-CLI המותקן **אין** `apphosting:rollouts:list` — רשימת ה-rollouts הקודמים זמינה רק ב-Firebase Console → App Hosting → Rollouts, או ב-Cloud Build history.
- **Firestore/Storage rules**: אין פקודת rollback ייעודית — `git checkout <commit-קודם> -- firestore.rules` (או storage.rules) ואז `.\Deploy-Firestore-Rules.ps1`.
- **Functions**: לחזור ל-commit קודם ולהריץ `.\Deploy-Functions.ps1`.

## מיפוי local emulator ↔ production

| | Local (emulator) | Production |
|---|---|---|
| `FIREBASE_USE_EMULATOR` | `true` | `false` |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` | `true` | `false` |
| Admin SDK creds | לא נדרשים (auto-detect emulator hosts) | Secret Manager (`FIREBASE_ADMIN_PRIVATE_KEY`) |
| Firebase project | `demo-shovarim` (placeholder) | `shovarim-prod` (או השם שנבחר) |

ה-job `quality` ב-CI רץ במצב emulator בדיוק מהסיבה הזו — `next build` לא צריך credentials אמיתיים.

## Smoke test ראשון — תוצאות (2026-08-27)

Backend: `shovarim-web`, region `europe-west4`, URL: `https://shovarim-web--shovarim-prod.europe-west4.hosted.app`.

**אוטומטי (נבדק דרך curl, לא דורש דפדפן/אימות)**:
- `GET /` → 200, HTML מרונדר server-side נכון (`<html lang="he" dir="rtl">`, `<title>שוברים</title>`) — מוודא שה-SSR pipeline של Next.js על App Hosting עובד בפועל, לא רק שה-build עבר.
- `GET /dashboard`, `/cards`, `/settings` ללא session cookie → 307 ל-`/?next=<path>` — `src/proxy.ts` fast-path עובד זהה לפיתוח מקומי.
- תגובות ה-redirect האלה **אינן** מקבלות `Cache-Control`/`Cdn-Cache-Status: hit` (נבדק בפועל: `miss`) — כלומר שכבת ה-CDN של App Hosting לא cache-ת את ההחלטה "מוגן/לא מוגן", מה שהיה יכול לגרום לדליפת redirect שגוי בין משתמשים. דפי ה-marketing הציבוריים (`/`) כן מקבלים `s-maxage`/cache HIT, כצפוי לדף לא-אישי.
- `GET /privacy`, `/terms` → 200.
- `GET /nonexistent-route` → 404 תקין.

**ידני, אושר בפועל על ידי המשתמש**:
- Google Sign-In על ה-URL החי — נכשל בהתחלה עם "ההתחברות נכשלה, נסו שוב" (מיידי, בלי לפתוח פופאפ גוגל) → אובחן כ-`auth/unauthorized-domain`: דומיין App Hosting לא היה ברשימת Authorized domains של Firebase Auth (ברירת המחדל כוללת רק `*.firebaseapp.com`/`*.web.app`). **תוקן** בהוספת `shovarim-web--shovarim-prod.europe-west4.hosted.app` ל-Authorized domains בקונסולה (Authentication → Settings) — הגדרת runtime, לא דורשת rollout חדש. אושר בפועל שההתחברות עובדת אחרי התיקון.

**נשאר לבדוק ידנית (קליק-דרך בדפדפן, לא בוצע ע"י Claude — אין כלי browser automation בסביבה הזו, ראה caveat דומה בכל Phase קודם ב-`docs/ROADMAP.md`)**:
- ריענון עמוד אחרי התחברות ווידוא שה-session cookie (`__session`, ADR #9) שורד — App Hosting לא עובר דרך שכבת ה-rewrite של Firebase Hosting הקלאסי, אז שם העוגייה כבר לא באמת "כפוי" מבחינה טכנית, אבל אין סיבה טכנית שהוא לא יעבוד; לא אומת בפועל ב-round-trip מלא.
- יצירת/עריכת/מחיקת כרטיס, יומן שימושים, עדכון יתרה, העלאת תמונת כרטיס/קבלה, יצירה+שיתוף רשימה עם חשבון שני אמיתי — כל אלה עובדים מול ה-emulator בפיתוח, אך טרם נבדקו קליק-דרך על נתוני production אמיתיים.

## Rollback drill — בוצע ואומת (2026-08-27)

תרגול מכוון אחד, על מנת לוודא שנתיב ה-rollback עובד לפני שסומכים עליו ב-אירוע אמיתי:
1. `firebase apphosting:rollouts:create shovarim-web --git-commit c9f328a --project shovarim-prod` — קביעת baseline (ה-commit העדכני ביותר ב-`main` באותו רגע).
2. `firebase apphosting:rollouts:create shovarim-web --git-commit fba6f0d --project shovarim-prod` (**rollback** ל-commit קודם) → הצליח, `curl` ל-`/` אחרי ה-rollout החזיר 200 עם ה-HTML הצפוי, `/dashboard` המשיך להפנות נכון.
3. `firebase apphosting:rollouts:create shovarim-web --git-commit c9f328a --project shovarim-prod` (roll-forward בחזרה) → הצליח, `curl` אימת 200.

שני ה-rollouts גם קיבלו GitHub check עצמאי בשם `App Hosting - Rollout (...)` על ה-commit המתאים (`conclusion: success`) — אימות חיצוני נוסף מעבר לפלט ה-CLI. מסקנה: נתיב ה-rollback (`firebase apphosting:rollouts:create --git-commit <sha>`) עובד כמתועד, בהנחה שה-commit שאליו חוזרים היה בעצמו build תקין (חזרה ל-commit עם config שבור, כמו זה שלפני ADR #16/#5, הייתה נכשלת בשלב ה-build ולא בהחלפת התנועה בפועל — App Hosting לא מחליף תנועה על build כושל).
