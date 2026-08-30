# SECURITY

## עקרון על
Deny-by-default בכל מקום. `firestore.rules` פותח עם `match /{document=**} { allow read, write: if false; }`, וכל collection מקבל חריגה מפורשת וממוקדת. אותו עיקרון ב-`storage.rules`.

## Firestore Rules — עקרונות מיושמים
- **Per-user isolation**: `request.auth.uid == resource.data.ownerId` לקריאה/עדכון/מחיקה, `request.auth.uid == request.resource.data.ownerId` ליצירה.
- **`ownerId` immutable**: ב-`update` על `cards`, נבדק ש-`request.resource.data.ownerId == resource.data.ownerId` (אי אפשר "להעביר בעלות" על כרטיס דרך כתיבת client).
- **`usageLog` immutable**: `allow update, delete: if false` — יומן שימושים הוא audit trail, לא ניתן לעריכה. תיקון = רשומה חדשה.
- **`categories` עם `ownerId == "system"`**: קריאה לכל משתמש מחובר, כתיבה אף פעם לא מ-client (רק Admin SDK).
- **שיתוף רשימות** (`docs/DECISIONS.md` #15): גישה לכרטיסי רשימה משותפת נבדקת דרך `get()` על `cardLists/{listId}/members/{uid}` בתוך ה-Rules עצמן (`isAcceptedListMember`/`isManagerOfList`) — לא הרחבה של `ownerId`. הזמנה נפתרת מאימייל ל-uid רק דרך Admin SDK (`inviteListMember`), כדי לא לחשוף client-side lookup שמאפשר לבדוק אילו כתובות מייל רשומות במערכת.
- **`reminders`, `auditLog`**: `allow write: if false` לגמרי — נכתבים רק מ-Cloud Functions דרך Admin SDK, ש-Rules לא חלות עליו.
- ולידציית שדות בסיסית ב-Rules עצמן (למשל `usageLog.amount > 0`) כשכבה נוספת מעבר לוולידציית client — client-side Zod יכול לעקוף, Rules לא.
- **מזהי מסמכים ב-Server Actions מחייבים ולידציית תווים, לא רק `min(1)`**: Server Action הוא endpoint שניתן לקרוא לו ישירות עם payload שרירותי, לא רק דרך ה-UI. Admin SDK (`firebase-admin`) מפרש `/` בתוך `.doc(id)` כמפריד path — `cardId`/`listId` לא-מוגבלים אפשרו ליצור מסמך בתת-אוסף של כרטיס אחר לגמרי (`victimId/usageLog/injected`) בלי בדיקת בעלות עליו (התגלה ותוקן ב-Phase 4.5, ראו `docs/DECISIONS.md` #25). `firestoreIdSchema` (`src/lib/validation/card.ts`) אוכף `^[A-Za-z0-9_-]+$` על כל שדה מזהה כזה.

## מודל איומים עיקרי
1. **משתמש A מנסה לגשת/לשנות נתוני משתמש B** → נחסם ע"י `isOwner`/`isExistingOwner` checks בכל collection.
2. **כתיבת שדות לא צפויים / privilege escalation דרך client** (למשל שינוי `ownerId`, כתיבה ל-`auditLog`) → נחסם ע"י immutability checks ו-`allow write: if false` על collections מנוהלות-שרת.
3. **גישה לא מאומתת** → כל rule דורש `request.auth != null` (דרך `isSignedIn()`/`isOwner()`).
4. **Abuse/spam על כתיבות** (יצירת אלפי כרטיסים/entries) → Firebase App Check (`src/lib/firebase/appCheck.ts`, Phase 4) + GCP quotas מובנות על Cloud Functions. ✅ **נסגר 2026-08-29**: הקוד (provider: reCAPTCHA Enterprise, ADR #28) והמפתח ב-`apphosting.yaml` חיים בפרודקשן, verified requests אומתו בקונסולה, ו-**Enforce הופעל על Firestore ו-Storage**. כתיבה ישירה ל-REST API בלי טוקן App Check תקין נדחית עכשיו ברמת השירות, לפני `firestore.rules`. הסדר המחייב שהוביל לכאן (rollout → אימות verified requests → Enforce) מתועד ב-`docs/DEPLOYMENT.md`.
   ⚠️ **מה שה-Enforce לא מכסה**: Server Actions ו-Route Handlers (`/api/chat`, ובהמשך `/api/whatsapp/webhook`) פועלים דרך Admin SDK, שעוקף גם את הכללים וגם את App Check. משטח התקיפה שם נאכף בנפרד — session cookie/חתימת webhook + rate limiting (`src/lib/services/rateLimit.ts`), ראו #6 למטה.
5. **דליפת Admin credentials** → Admin SDK תמיד server-only (`import "server-only"` ב-`admin.ts`), secrets ב-Secret Manager/`.env.local` שלא מחובר לגיט.
6. **צ'אטבוט/CLI (Phase 5) פועל בשם משתמש שגוי** — prompt injection או הזיית מודל שמנסה "לבקש" לפעול על נתוני משתמש אחר → נחסם מבנית: ה-`uid` הפועל נגזר תמיד בצד שרת (session cookie / מיפוי ערוץ מאומת) ולעולם אינו שדה בסכימת ה-tool שה-LLM יכול לספק. ראו הרחבה למטה ו-`docs/DECISIONS.md` #17.

## הצפנה
- Firestore/Storage: הצפנה at-rest כברירת מחדל של Google Cloud — מספיקה לרוב השדות.
- `barcodeOrCode` (מספר כרטיס בפועל) ו-`cvv` — שני השדות הרגישים ביותר: **מוצפנים גם ב-application level** (AES-256-GCM, `src/lib/crypto/fieldEncryption.ts`), מעבר להצפנת at-rest. המפתח (`CARD_FIELD_ENCRYPTION_KEY`, base64 32 בייט) חי ב-`.env.local` בפיתוח וב-Secret Manager בפרודקשן (`secret:` reference ב-`apphosting.yaml`, ראו `docs/DEPLOYMENT.md`) — לעולם לא מגיע ללקוח.
- **כתיבה/קריאה עוברות תמיד דרך Server Actions (Admin SDK)**, לא client SDK ישיר: `createCard`/`updateCardDetails`/`getCardSecrets` (`src/actions/card.ts`) הם המקומות היחידים שמצפינים/מפענחים מהאתר. שאר שדות הכרטיס ממשיכים להיכתב ישירות מה-client (`CardForm`/`EditCardDialog` עדיין כותבים ישירות ל-`cardLists` ומעלים תמונות ל-Storage) — רק שני השדות הרגישים עברו ל-server-side, כדי לא להרחיב את ה-scope של השינוי מעבר לנדרש.
- **מ-2026-08-30 (ADR #36) גם ה-MCP tools (`createCard`/`updateCard`) יכולים לכתוב את שני השדות** — אותה שכבת שירות בדיוק (`createCardForUid`/`updateCardDetailsForUid` ב-`src/lib/services/cards.ts`), אותה הצפנה, אותו Admin SDK. השינוי האמיתי הוא **מקור הערך**: עכשיו הוא יכול להגיע מטקסט חופשי שהמשתמש הקליד לצ'אט, לא רק מטופס. ראו סעיף "צ'אטבוט/CLI" למטה להשלכות.
- `useCard`/`useCards` (client `onSnapshot`) ממשיכים לקבל את `cards/{cardId}` המלא כולל `cvv`/`barcodeOrCode` — אבל כערך מוצפן (`v1:...`), לא כטקסט גלוי. פענוח קורה רק על-פי דרישה מפורשת (`getCardSecrets`, כשמשתמש עם הרשאת ניהול פותח את דיאלוג העריכה) ובייצוא נתונים (`buildUserDataExport`) — לא נשמר ב-state של הדפדפן מעבר לכך.
- כרטיסים שנוצרו/נערכו **לפני** השדרוג הזה עדיין מכילים `cvv`/`barcodeOrCode` בטקסט גלוי עד הרצת `npm run migrate:encrypt-fields` (חד-פעמי, אידמפוטנטי) — `decryptSensitiveField` מזהה ומחזיר ערכים לא-מוצפנים כמו שהם (backward-compat למעבר), ראו הערה בקוד.

## ניהול Secrets
- Firebase **client** config (`NEXT_PUBLIC_FIREBASE_*`) — לא סוד אמיתי, מותר לחשוף ב-bundle. מוגן ע"י Security Rules, לא ע"י הסתרת ה-config.
- Firebase **Admin** service account (`FIREBASE_ADMIN_*`) — סוד אמיתי. `.env.local` בפיתוח (gitignored), Google Secret Manager בפרודקשן. אף פעם לא ב-`NEXT_PUBLIC_*`.

### Secrets ב-CI/CD (ראו `docs/DEPLOYMENT.md` להרצה מלאה)
- ה-deploy job ב-GitHub Actions מתחבר ל-GCP דרך **Workload Identity Federation** ולא מפתח service-account JSON ארוך-טווח — כלומר אין חומר סוד סטטי שיושב ב-GitHub secrets בר-גניבה/דליפה. ה-provider מוגבל (`attribute-condition`) לריפו הספציפי `LiorHen9/Shovarim` בלבד, כך שגם אם ה-OIDC token ידלוף מהקשר אחר הוא לא יתקבל.
- `FIREBASE_ADMIN_PRIVATE_KEY` הוא המשתנה היחיד שחייב להיות `secret:` reference ב-`apphosting.yaml` (Secret Manager) — כל שאר משתני ה-App Hosting הם plain env vars, כולל `FIREBASE_ADMIN_CLIENT_EMAIL` (מזהה, לא חומר קריפטוגרפי).
- חלופת מפתח service-account מתועדת ב-`docs/DEPLOYMENT.md` כ-fallback מהיר יותר להקמה, עם המלצה מפורשת נגד שימוש בה לאורך זמן בהתחשב בכך שהאפליקציה מאחסנת מספרי כרטיס/CVV.

## צ'אטבוט/CLI לשיחה חופשית (Phase 5) — בידוד הרשאות
פיצ'ר עתידי, ראו `docs/ROADMAP.md` Phase 5 ו-`docs/DECISIONS.md` ADR #17. הסיכון המרכזי אינו שונה במהות מהאיום ב-#1 למעלה (משתמש A ניגש לנתוני משתמש B) — אבל וקטור התקיפה חדש: קלט חופשי מהמשתמש (או prompt injection דרך תוכן חיצוני שה-LLM קורא) שמנסה "לשכנע" את המודל לפעול על נתוני משתמש אחר, במקום ניסיון תקיפה ישיר על ה-API.
- **`uid` לעולם לא שדה גלוי ל-LLM**: כל MCP tool מקבל את ה-`uid` מהקונטקסט של הרצת השרת (session cookie מאומת, או מיפוי ערוץ WhatsApp/Telegram→uid מאומת מראש) — לא כפרמטר בסכימת ה-tool. גם אם המודל "יחליט" להעביר `uid` אחר בטקסט חופשי, אין לו ערוץ להשפיע על הערך שבו תרוץ הפעולה בפועל.
- **שימוש חוזר בשכבת האכיפה הקיימת**: ה-tools קוראים לאותן פונקציות `src/lib/auth/listAccess.ts`/ownership checks שכבר משמשות את ה-Server Actions — לא נכתבת שכבת הרשאות מקבילה שעלולה לסטות מהמקור עם הזמן.
- **אישור מפורש לפני מחיקה**: המודל חייב לשאול ולקבל תשובה חיובית מפורשת לפני קריאה ל-`deleteCard`/`deleteUsageEntry` — מקטין את הסיכון לאובדן נתונים מפרשנות שגויה של טקסט מעורפל.
- **Semantic cache מבודד לפי `uid`**: אין שיתוף cache בין משתמשים; שאילתות שחושפות `cvv`/`barcodeOrCode` לא נשמרות ב-cache כלל, כדי לצמצם את משטח הנזק של באג cache עתידי.
- **Audit log מורחב**: כל קריאת tool (מבצע, tool, פרמטרים ללא סודות, ערוץ, תוצאה) נכתבת ל-`auditLog` (`docs/DATA_MODEL.md`).
- **Rate limiting per-uid**: ערוצי WhatsApp/Telegram חושפים משטח spoofing (מספר טלפון) שלא קיים באפליקציית ה-web המאומתת מול Google — מטופל ברמת הרצת ה-tools, לא ברמת Firestore Rules בלבד.
- **`cvv`/`barcodeOrCode` דרך הצ'אט (ADR #36, 2026-08-30)**: `createCard`/`updateCard` מקבלים כעת את שני השדות — חריגה מכוונת ומצומצמת מהעיצוב המקורי ("אף פעם לא tool-schema field"), לבקשת המשתמש. הערך שהוקלד עובר בפועל דרך קונטקסט המודל (Anthropic API) ובהיסטוריית השיחה, עד לאיפוס/דחיסה שלה. **לא** מכוסה ע"י prompt caching — `cache_control: ephemeral` יושב אך ורק על בלוק ה-system (`agentLoop.ts`), לא על ה-messages. בווב ההיסטוריה חיה רק ב-state של הדפדפן (ADR #22); **בוואטסאפ** היא עוברת דרך שרתי Meta ונשמרת ב-`chatSessions/{channelKey}` בצד שרת עד 24 שעות אי-פעילות (ADR #29/#30) — ראו "קישור ערוץ→משתמש" למטה וגם `docs/PRIVACY.md`. ההצפנה עצמה, נתיב הכתיבה (Admin SDK בלבד) והסתרתם מכלי הקריאה (`getCard`/`listCards`) לא השתנו.

### קישור ערוץ→משתמש (Phase 5.5.a, ADR #29)
**ההנחה שכל השאר נשען עליה**: מספר טלפון ב-payload נכנס הוא **לא** credential — כל אחד יכול לשלוח payload עם מספר של מישהו אחר. לכן:
- ה-`uid` נגזר אך ורק מ-lookup ב-`channelLinks/{channel}:{externalId}`, לעולם לא מתוכן ההודעה. משם הוא נכנס ל-`createMcpServer(uid, "whatsapp")` ונעול בסגירה, בדיוק כמו בנתיב הווב.
- **הקישור עצמו** נוצר רק דרך קוד חד-פעמי שהופק בזמן שהמשתמש מאומת (`requireUid()`), בן 8 תווי base32, TTL 10 דקות, שימוש יחיד, ופדיון בטרנזקציה אחת. 6 ספרות היו מרחב סריקה סביר לבוט ששולח הודעות; 32^8 אינו.
- **שלושת ה-collections חסומים לחלוטין ל-client** (`allow read, write: if false`), כולל קריאה של הבעלים: אוסף שממופתח לפי מספר טלפון עם קריאה מותרת הוא oracle ל-"האם המספר רשום", וקוד לא-מומש שניתן לקריאה הוא credential גנוב. ה-UI קורא דרך Server Action.
- **הודעות כישלון אחידות בפדיון** — הצד השולח אנונימי, ואסור שיבחין בין "אין קוד" ל-"פג תוקף".
- **נעילת ה-stand-in לאמולטור**: `src/actions/testChannelLink.ts` פודה קוד **בלי** `requireUid()` — כמו שהוובהוק יעשה — ולכן `FIREBASE_USE_EMULATOR !== "true"` שם הוא חסם אבטחה, לא נוחות בדיקה (אותו pattern כמו `mintTestCustomToken`).

### ה-webhook של WhatsApp (Phase 5.5.b, ADR #30)
`POST /api/whatsapp/webhook` הוא **ה-endpoint הראשון באפליקציה שנגיש לקורא לא מאומת** — לכל השאר יש session cookie או Firestore Rules מאחוריו. גבול האמון היחיד שלו:
- **`X-Hub-Signature-256` (HMAC-SHA256 עם `WHATSAPP_APP_SECRET`) על הגוף הגולמי, לפני כל פרסור.** הבדיקה על `request.text()` ולא על JSON שסורסר מחדש — סריאליזציה חוזרת משנה סדר מפתחות ורווחים וה-digest לעולם לא יתאים. השוואה ב-`timingSafeEqual`, עם בדיקת אורך לפניה כדי שכותרת קטומה תיפסל ולא תזרוק. חתימה שגויה/חסרה → 401, בלי שום גישה ל-Firestore.
- **אחרי החתימה, ה-payload מהימן מבחינה מבנית בלבד — לא מבחינת זהות.** המספר בהודעה עדיין אינו credential, וה-`uid` נגזר מ-`channelLinks` בדיוק כמו קודם.
- **דדופליקציה לפני עיבוד** (`channelMessages`): retry של Meta לא מריץ פעמיים כלים כותבים. מפתח המסמך הוא hash ולא ה-`wamid` הגולמי, כי `wamid` עשוי להכיל `/` — path injection דרך `.doc()`, אותה מחלקה שנסגרה ב-ADR #25.
- **rate limit על turns**, ולמספר שאינו מקושר לפי `channelKey` — זהו משטח ניחוש קודי הקישור, ו-12 ניסיונות ל-5 דקות הופכים סריקה של 32^8 לחסרת משמעות גם אם Meta הייתה מוכנה להעביר אותה.
- **`WHATSAPP_PHONE_NUMBER_ID`** מסנן deliveries של מספרים אחרים תחת אותו Meta app.
- **fail-closed לפני ההקמה**: בלי `WHATSAPP_APP_SECRET`/`WHATSAPP_VERIFY_TOKEN` ה-endpoint מחזיר 503 ואינו מעבד דבר — כלומר הקוד יכול להיפרס לפרודקשן לפני 5.5.c בלי לפתוח משטח תקיפה.
- **`src/proxy.ts` לא מגן על `/api/*` ואסור שיגן**: redirect של endpoint JSON לדף HTML שובר את הקוראים שלו (המלכודת מקומיט `ff99bb8`). ההגנה כאן היא החתימה, לא ה-proxy.

**מה שנשאר פתוח**: תוכן ההודעות והתשובות עובר דרך שרתי Meta (ראו `docs/PRIVACY.md`) — כולל `cvv`/`barcodeOrCode` עצמם מ-ADR #36 אם המשתמש/ת בוחר/ת להזין אותם דרך וואטסאפ — ואין עדיין מגננה ייעודית ל-prompt injection על טקסט חופשי מעבר להפרדה המבנית של ה-`uid`.

## Testing
`@firebase/rules-unit-testing` מול Firestore Emulator (דורש Java מותקן מקומית — ראה `docs/ARCHITECTURE.md`). טסטים נדרשים לפני Phase 1 sign-off:
- משתמש A לא יכול read/write על מסמכי משתמש B (בכל collection)
- לא ניתן לכתוב `usageLog` update/delete
- לא ניתן ליצור מסמך עם `ownerId` שונה מה-uid המאומת
- `categories` עם `ownerId="system"` לא ניתן לכתיבה מ-client
