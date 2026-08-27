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
4. **Abuse/spam על כתיבות** (יצירת אלפי כרטיסים/entries) → Firebase App Check (`src/lib/firebase/appCheck.ts`, Phase 4 — קוד הושלם, "Enforce" בקונסולה נשאר צעד ידני אחרון לפני שהוא בפועל חוסם, ראו `docs/DEPLOYMENT.md`) + GCP quotas מובנות על Cloud Functions.
5. **דליפת Admin credentials** → Admin SDK תמיד server-only (`import "server-only"` ב-`admin.ts`), secrets ב-Secret Manager/`.env.local` שלא מחובר לגיט.
6. **צ'אטבוט/CLI (Phase 5) פועל בשם משתמש שגוי** — prompt injection או הזיית מודל שמנסה "לבקש" לפעול על נתוני משתמש אחר → נחסם מבנית: ה-`uid` הפועל נגזר תמיד בצד שרת (session cookie / מיפוי ערוץ מאומת) ולעולם אינו שדה בסכימת ה-tool שה-LLM יכול לספק. ראו הרחבה למטה ו-`docs/DECISIONS.md` #17.

## הצפנה
- Firestore/Storage: הצפנה at-rest כברירת מחדל של Google Cloud — מספיקה לרוב השדות.
- `barcodeOrCode` (מספר כרטיס בפועל) ו-`cvv` — שני השדות הרגישים ביותר: **מוצפנים גם ב-application level** (AES-256-GCM, `src/lib/crypto/fieldEncryption.ts`), מעבר להצפנת at-rest. המפתח (`CARD_FIELD_ENCRYPTION_KEY`, base64 32 בייט) חי ב-`.env.local` בפיתוח וב-Secret Manager בפרודקשן (`secret:` reference ב-`apphosting.yaml`, ראו `docs/DEPLOYMENT.md`) — לעולם לא מגיע ללקוח.
- **כתיבה/קריאה עוברות תמיד דרך Server Actions (Admin SDK)**, לא client SDK ישיר: `createCard`/`updateCardDetails`/`getCardSecrets` (`src/actions/card.ts`) הם המקומות היחידים שמצפינים/מפענחים. שאר שדות הכרטיס ממשיכים להיכתב ישירות מה-client (`CardForm`/`EditCardDialog` עדיין כותבים ישירות ל-`cardLists` ומעלים תמונות ל-Storage) — רק שני השדות הרגישים עברו ל-server-side, כדי לא להרחיב את ה-scope של השינוי מעבר לנדרש.
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

## Testing
`@firebase/rules-unit-testing` מול Firestore Emulator (דורש Java מותקן מקומית — ראה `docs/ARCHITECTURE.md`). טסטים נדרשים לפני Phase 1 sign-off:
- משתמש A לא יכול read/write על מסמכי משתמש B (בכל collection)
- לא ניתן לכתוב `usageLog` update/delete
- לא ניתן ליצור מסמך עם `ownerId` שונה מה-uid המאומת
- `categories` עם `ownerId="system"` לא ניתן לכתיבה מ-client
