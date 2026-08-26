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
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | GitHub Actions secret | מזהה תצורה, לא סוד קריטי בפני עצמו |
| `GCP_SERVICE_ACCOUNT_EMAIL` | GitHub Actions secret | מזהה |
| `FIREBASE_PROJECT_ID` | GitHub Actions secret | מזהה הפרויקט לפקודת ה-deploy |

אין כרגע secrets ל-FCM/Resend — Phase 4 טרם מומש (ראו `docs/ROADMAP.md`).

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

9. **Rollout ראשון** — קורה אוטומטית אחרי מיזוג ל-`main`, או ידנית:
   ```powershell
   npx firebase apphosting:rollouts:create --project shovarim-prod --backend <backend-id>
   ```

## זרימת deploy שוטפת

Push ל-`main` מפעיל **שני צינורות עצמאיים** באותו רגע:
1. App Hosting (Cloud Build, לא GitHub Actions) בונה ופורס את אפליקציית ה-Next.js.
2. GitHub Actions מריץ quality gate, ואם עובר — פורס Firestore rules/indexes, Storage rules, ו-Functions.

## Rollback

- **אפליקציה**: `firebase apphosting:rollouts:list --backend <id>` לראות rollouts קודמים, `firebase apphosting:rollouts:create --git-commit <sha-קודם>` לחזור אליהם.
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
