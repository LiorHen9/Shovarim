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
6. **הענקת/ניצול הרשאת אדמין לא-מורשית (Phase 9, ADR #42)** → `adminRoles/{uid}` הוא `allow read, write: if false` לגמרי — אין נתיב client לכתוב את הרשאת האדמין של עצמו או של אחר; ההענקה היחידה היא `scripts/grant-admin.ts` שרץ ידנית נגד production. כל admin Server Action פותח ב-`requireAdmin()` (זורק אם `adminRoles/{uid}` לא קיים) ולעולם לא סומך על flag שמגיע מה-client. ראו הרחבה למטה.
7. **צ'אטבוט/CLI (Phase 5) פועל בשם משתמש שגוי** — prompt injection או הזיית מודל שמנסה "לבקש" לפעול על נתוני משתמש אחר → נחסם מבנית: ה-`uid` הפועל נגזר תמיד בצד שרת (session cookie / מיפוי ערוץ מאומת) ולעולם אינו שדה בסכימת ה-tool שה-LLM יכול לספק. ראו הרחבה למטה ו-`docs/DECISIONS.md` #17.
8. **משתמש חסום ממשיך לפעול דרך ערוץ ללא Auth token (Phase 9.3, ADR #44)** → Auth `disabled`+`revokeRefreshTokens` חוסם אוטומטית כל נתיב מבוסס-session (`verifySessionCookie(cookie, true)` כבר בודק את שניהם), אבל ב-WhatsApp ה-`uid` נגזר מ-`channelLinks` בלי Auth token בכלל (ADR #29) — שם `assertNotBlocked(uid)` הוא הבדיקה שסוגרת את הפער, מיד לפני כל קריאת Claude. ראו הרחבה למטה.

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
- **אימות מחדש תקופתי (issue #68, ADR #41)**: הקישור בין `channelKey` ל-`uid` היה, עד כה, קבוע לצמיתות — אם מספר טלפון עובר לבעלים חדש (מיחזור מספרים אצל הספק), הבעלים החדש היה מזוהה בשקט כבעלים הקודם, בלי לנסות לקשר שום דבר בעצמו. `resolveUidForChannel` עכשיו דוחה קישור שחצה אחד משני ספים (`CHANNEL_LINK_REVERIFY`, `src/lib/mcp/config.ts`): 30 יום מאז ה-`linkedAt` האחרון **גם אם יש שימוש רציף** (אחרת פעילות מתמדת של הבעלים החדש הייתה מאפסת לנצח שעון חוסר-פעילות), או 14 יום מאז הפעילות האחרונה. קישור שפג נופל לאותה תשובת "לא מקושר" בדיוק כמו קישור שמעולם לא היה — בלי oracle חדש. חידוש דורש אימות מלא מחדש (כניסה בגוגל ב-`/settings` + קוד קישור חדש בווטסאפ), לא מנגנון נפרד.
  ⚠️ **לא מכוסה בכוונה, נשאר בתוקף מ-ADR #40 (issue #75)**: מחזיק חדש שכן **מנסה** לקשר מספר מחדש (פותח חשבון Shovarim משלו ופודה קוד). האישור הנדרש שם לפני דריסת קישור קיים נשאל מהמספר עצמו — כלומר המחזיק החדש יכול פשוט לענות "כן" לעצמו, לא הבעלים הקודם. סגירה מלאה (התראה לבעלים הקודם) דורשת תשתית מייל/push שעדיין לא קיימת (Phase 7) — מתועד ב-`docs/ROADMAP.md`.

### חסימת משתמשים ע"י אדמין (Phase 9.3, ADR #44)
**מנגנון האכיפה הראשי הוא Firebase Auth, לא בדיקת Firestore בכל בקשה**: `blockUser` (`src/lib/services/adminModeration.ts`) קורא ל-`adminAuth.updateUser(uid, {disabled:true})` + `revokeRefreshTokens(uid)`. `getSessionUid()` (`src/lib/auth/session.ts`) כבר קורא ל-`verifySessionCookie(cookie, true)`, שבודק את שניהם — כלומר כל נתיב מבוסס-session (web, `mcp:cli`) נחסם החל מהבקשה הבאה, בלי קוד אכיפה חדש בשכבת ה-session עצמה.
- **הפער היחיד**: WhatsApp. ה-`uid` שם נגזר מ-`channelLinks` בלי Firebase ID token בכלל (ADR #29) — Auth disable לא נוגע בנתיב הזה ישירות. `assertNotBlocked(uid)` (`src/lib/services/moderation.ts`) קורא ל-`userModeration/{uid}` וזורק אם `blocked:true`, נבדק ב-`handleInboundChannelMessage` מיד לפני כל קריאת Claude (חוסך גם עלות API על משתמש חסום). אותה בדיקה חוזרת ב-`POST /api/chat` וב-`scripts/mcp-cli.ts` כהגנת-משנה (defense-in-depth) — לא הכרחית שם היום, אבל סוגרת חלון מירוץ תיאורטי בין ה-disable לתפוגת ה-session.
- **`userModeration/{uid}` נפרד מ-`users/{uid}` בכוונה**: ה-`update` rule הקיים על `users` לא מגביל שדות, אז שדה `blocked` על אותו מסמך היה מאפשר למשתמש חסום לבטל את עצמו בכתיבת client רגילה. `allow read, write: if false` לחלוטין, כולל לאדמין עצמו — אותו פטרן כמו `adminRoles`.
- **`blockedEmails`/`blockedPhones` נבדקים *לפני* שקיים חשבון/קישור**: `createSession` בודק `isEmailBlocked` לפני מתן session cookie (כתובת חסומה לא מקבלת session אפילו בכניסה ראשונה), ו-`redeemLinkCode` בודק `isPhoneBlocked` לפני יצירת `channelLinks` חדש — עם אותה הודעת כישלון גנרית כמו כל דחייה אחרת שם ("קוד הקישור אינו תקין או שפג תוקפו"), כדי ששולח אנונימי לא ילמד אם המספר חסום או שהקוד סתם שגוי (uniform-failure, אותו עיקרון כמו ADR #29). שני ה-collections `allow read, write: if false` — קריאה מ-client הופכת אותם ל-oracle ל"אילו כתובות/מספרים חסומים".
- **הגנה עצמית**: `blockUser`/`blockEmail` דוחים ניסיון של אדמין לחסום את עצמו (uid משלו, או כתובת האימייל של עצמו) — קריטי כשיש אדמין יחיד: חסימה עצמית הייתה מנעלת (lock out) גם מהאתר וגם מהפאנל, בלי דרך חזרה חוץ מגישה ישירה ל-Firebase Console. הבדיקה יושבת בשכבת השירות (`adminModeration.ts`), לא רק ב-Server Action, כדי לכסות כל קורא עתידי (למשל callable function עתידי).
- **`adminAuditLog`**: כל שש הפעולות (block/unblock × uid/email/phone) נכתבות ל-`adminAuditLog` *לפני* המוטציה, אותו סדר "audit לפני פעולה" כמו `deleteUserAccount`.

### הזמנת רשימה לפי מספר טלפון (ADR #37 → #38 → #39, issue #58)
שיתוף רשימה עם מי שאין לו עדיין חשבון. הזרימה מוסיפה credential חדש (`listInviteCodes/{code}`) ולכן גם משטח תקיפה חדש — מה שמחזיק אותו:
- **אישור ההצטרפות דורש שני דברים בלתי-תלויים**: החזקת הקוד (הזמנה הופנתה למספר הזה) **וגם** `channelLinks` שממפה את המספר ל-uid המאשר (המספר באמת שלי). לינק שהועבר הלאה לא מספיק — זו בדיוק ההנחה של ADR #29, שמספר טלפון לבדו אינו הוכחת זהות, מיושמת גם כאן. הבדיקה יושבת ב-`acceptListInvite` (שכבת השירות) ומורצת מחדש בשרת גם אחרי ש-`getListInviteGate` כבר החזיר "מוכן" — ה-gate הוא affordance ל-UI, לא שלב הרשאה.
- **`listInviteCodes` חסום לחלוטין ל-client** (`allow read, write: if false`), כולל קריאה של בעל הרשימה שהנפיק אותו: ה-doc id הוא הסוד שנשלח בהודעה, וקריאה מותרת הייתה מאפשרת למנות הזמנות חיות ולאשר הזמנה של מישהו אחר. נבדק ב-`tests/rules/firestore.test.ts`.
- **12 תווי base32 ולא 8** (בשונה מקוד הקישור): ה-TTL הוא 48 שעות ולא 10 דקות, כלומר חלון ניחוש גדול בסדרי גודל. 32^12 (~10^18) משמר את יחס הבטיחות. `crypto.randomInt`, לא `Math.random`.
- **חד-פעמיות, תקרה וביטול** (נוספו ב-ADR #38 ונשמרו ב-#39, על גבי הכריכה ולא במקומה): הקוד נצרך בשימוש הראשון (`status`/`usedAt`, בטרנזקציה אחת כדי ששתי לחיצות לא ייצרו שני מסמכי חבר), עד 10 לינקים פתוחים לרשימה, וכל לינק ניתן לביטול מיידי על ידי הבעלים. שיתוף חוזר לאותו מספר **דורס** את הלינק הקודם, כך ש"שלח שוב" לא מותיר שני קודים חיים.
- **`whatsAppLinkingAvailable()` אינו fail-open עבור הזמנה כרוכה**: המוצא שמרפה מדרישת הקישור כש-`NEXT_PUBLIC_WHATSAPP_BOT_PHONE` חסר חל **רק** על קודי bearer מחלון ADR #38, שבהם המספר ממילא לא היה הרשאה. עבור הזמנה כרוכה הקישור הוא ההרשאה, ודיפלוימנט עם env var חסר פשוט לא יכול להשלים הזמנה — במקום להוריד בשקט את השער.
- **התצוגה המקדימה ציבורית במכוון, ומצומצמת בהתאם**: מי שמחזיק בקוד רואה את שם הרשימה, ההרשאה, ו-4 הספרות האחרונות של המספר בלבד — לא את המספר המלא ולא דבר מתוכן הרשימה.
- **הבחנה שכן נחשפת, במודע**: "המספר לא מקושר לאף חשבון" (`needs_channel_link`) ו"המספר מקושר לחשבון אחר" (`linked_to_other_number`) מוצגים כשתי הודעות שונות, כי ההוראה למוזמן שונה לגמרי — במקרה השני אין טעם לשלוח הודעת קישור, שתיכשל ממילא. **המחיר**: מי שמחזיק בקוד חי לומד האם המספר הספציפי הזה רשום במערכת. זה oracle צר בכוונה — הוא נוגע במספר יחיד שבעל הרשימה עצמו הקליד, דורש קוד חי בן 48 שעות, ואינו ניתן להרצה על רשימת מספרים. השיקול הרחב יותר (`channelLinks` חסום לקריאה) נשאר בתוקף; זו חריגה נקודתית ממנו לטובת מוזמן שאחרת היה נתקע בלולאה.
- **דחייה דורשת בדיוק את אותה הוכחה כמו אישור** (תוקן 2026-08-31): קודם היא הייתה פתוחה לכל מי שמחזיק בקוד, גם בלי session, בנימוק ש"סירוב אינו טענת זהות". תחת הכריכה של ADR #39 הנימוק מתהפך — זר עם לינק מועבר לא יכול להצטרף אבל כן יכול **לשרוף** את ההזמנה, כלומר DoS על הנמען האמיתי. שתי הפעולות עוברות דרך `assertMayRedeem` אחד כדי שלא יוכלו להיפרד. מי שקיבל לינק בטעות פשוט מתעלם ממנו; הוא פג תוך 48 שעות, ובעל הרשימה יכול לבטל אותו מיד.
- **ההזמנה אינה יוצרת חשבון**: הרשמה נשארת Google Sign-In בלבד (ADR #37 החלטה 1), כך שלא נוצר נתיב חשבון מבוסס-טלפון שעוקף את ספק האימות.

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

## פאנל ניהול (Phase 9, ADR #42) — מודל הרשאות

**מקור האמת הוא Firestore, לא Firebase Auth custom claims**: `adminRoles/{uid}` (`docs/DATA_MODEL.md`), נבדק דרך `exists()` (`isAdmin()` ב-`firestore.rules`, `isAdminUid()`/`requireAdmin()` בצד שרת) — לא custom claim, כדי להימנע מעיכוב ריענון טוקן (עד שעה) שהיה דורש UX/תיעוד נפרד. `adminRoles` עצמו `allow read, write: if false` לחלוטין, כולל לאדמין עצמו — אין שום נתיב client לכתוב אליו, כדי שלא תיפתח אפשרות self-grant. ההענקה היחידה היום היא `scripts/grant-admin.ts`, מריצים ידנית נגד production (Admin SDK מקומי).

**כל admin Server Action/Cloud Function מאמת הרשאה בעצמו, בצד שרת** — `requireAdmin()` (זורק `ActionError`, לא `Error` רגיל — ראו ADR #18) בתחילת כל Server Action; כשיתווסף Cloud Function `onCall` למחיקה מיידית (שלב עתידי, ADR #42 מפרט את האילוץ), הוא יבדוק את `adminRoles/{caller uid}` בעצמו ולא יסתמך על כך ש-UI הוא הבודק היחיד — callable functions הם endpoint ציבורי.

**`/admin` הוא שכבת הגנה שנייה מעל `(protected)`**: `app/(protected)/admin/layout.tsx` דורש גם session תקין וגם `isAdminUid()`, ומפנה (לא error) למי שלא אדמין. אין שינוי ב-`src/proxy.ts` — הנתיב כבר מכוסה ב-fast-path הקיים (בדיקת cookie בלבד), הבדיקה המלאה קורית ב-layout (ADR #8).

**`adminAuditLog`** (נפרד מ-`auditLog` הקיים) מתעד כל פעולת אדמין **לפני** שהיא מתבצעת — אותו סדר "audit לפני mutation" כמו `deleteUserAccount`. גם הוא `allow read, write: if false` לגמרי.

## Testing
`@firebase/rules-unit-testing` מול Firestore Emulator (דורש Java מותקן מקומית — ראה `docs/ARCHITECTURE.md`). טסטים נדרשים לפני Phase 1 sign-off:
- משתמש A לא יכול read/write על מסמכי משתמש B (בכל collection)
- לא ניתן לכתוב `usageLog` update/delete
- לא ניתן ליצור מסמך עם `ownerId` שונה מה-uid המאומת
- `categories` עם `ownerId="system"` לא ניתן לכתיבה מ-client
