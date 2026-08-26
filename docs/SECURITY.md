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

## מודל איומים עיקרי
1. **משתמש A מנסה לגשת/לשנות נתוני משתמש B** → נחסם ע"י `isOwner`/`isExistingOwner` checks בכל collection.
2. **כתיבת שדות לא צפויים / privilege escalation דרך client** (למשל שינוי `ownerId`, כתיבה ל-`auditLog`) → נחסם ע"י immutability checks ו-`allow write: if false` על collections מנוהלות-שרת.
3. **גישה לא מאומתת** → כל rule דורש `request.auth != null` (דרך `isSignedIn()`/`isOwner()`).
4. **Abuse/spam על כתיבות** (יצירת אלפי כרטיסים/entries) → Firebase App Check (Phase 4) + GCP quotas מובנות על Cloud Functions.
5. **דליפת Admin credentials** → Admin SDK תמיד server-only (`import "server-only"` ב-`admin.ts`), secrets ב-Secret Manager/`.env.local` שלא מחובר לגיט.
6. **צ'אטבוט/CLI (Phase 5) פועל בשם משתמש שגוי** — prompt injection או הזיית מודל שמנסה "לבקש" לפעול על נתוני משתמש אחר → נחסם מבנית: ה-`uid` הפועל נגזר תמיד בצד שרת (session cookie / מיפוי ערוץ מאומת) ולעולם אינו שדה בסכימת ה-tool שה-LLM יכול לספק. ראו הרחבה למטה ו-`docs/DECISIONS.md` #17.

## הצפנה
- Firestore/Storage: הצפנה at-rest כברירת מחדל של Google Cloud — מספיקה לרוב השדות.
- `barcodeOrCode` (מספר כרטיס בפועל) ו-`cvv` (Phase 3) — שני השדות הרגישים ביותר: כברירת מחדל נסמכים על הצפנת at-rest. שכבת הצפנת application-level נוספת (AES-256 עם מפתח מ-Secret Manager, מוצפן/מפוענח רק ב-Server Action) היא upgrade עתידי מתועד ב-`docs/ROADMAP.md` Phase 4 — לא מיושם עדיין.

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
