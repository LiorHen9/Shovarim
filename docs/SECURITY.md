# SECURITY

## עקרון על
Deny-by-default בכל מקום. `firestore.rules` פותח עם `match /{document=**} { allow read, write: if false; }`, וכל collection מקבל חריגה מפורשת וממוקדת. אותו עיקרון ב-`storage.rules`.

## Firestore Rules — עקרונות מיושמים
- **Per-user isolation**: `request.auth.uid == resource.data.ownerId` לקריאה/עדכון/מחיקה, `request.auth.uid == request.resource.data.ownerId` ליצירה.
- **`ownerId` immutable**: ב-`update` על `cards`, נבדק ש-`request.resource.data.ownerId == resource.data.ownerId` (אי אפשר "להעביר בעלות" על כרטיס דרך כתיבת client).
- **`usageLog` immutable**: `allow update, delete: if false` — יומן שימושים הוא audit trail, לא ניתן לעריכה. תיקון = רשומה חדשה.
- **`categories` עם `ownerId == "system"`**: קריאה לכל משתמש מחובר, כתיבה אף פעם לא מ-client (רק Admin SDK).
- **`reminders`, `auditLog`**: `allow write: if false` לגמרי — נכתבים רק מ-Cloud Functions דרך Admin SDK, ש-Rules לא חלות עליו.
- ולידציית שדות בסיסית ב-Rules עצמן (למשל `usageLog.amount > 0`) כשכבה נוספת מעבר לוולידציית client — client-side Zod יכול לעקוף, Rules לא.

## מודל איומים עיקרי
1. **משתמש A מנסה לגשת/לשנות נתוני משתמש B** → נחסם ע"י `isOwner`/`isExistingOwner` checks בכל collection.
2. **כתיבת שדות לא צפויים / privilege escalation דרך client** (למשל שינוי `ownerId`, כתיבה ל-`auditLog`) → נחסם ע"י immutability checks ו-`allow write: if false` על collections מנוהלות-שרת.
3. **גישה לא מאומתת** → כל rule דורש `request.auth != null` (דרך `isSignedIn()`/`isOwner()`).
4. **Abuse/spam על כתיבות** (יצירת אלפי כרטיסים/entries) → Firebase App Check (Phase 5) + GCP quotas מובנות על Cloud Functions.
5. **דליפת Admin credentials** → Admin SDK תמיד server-only (`import "server-only"` ב-`admin.ts`), secrets ב-Secret Manager/`.env.local` שלא מחובר לגיט.

## הצפנה
- Firestore/Storage: הצפנה at-rest כברירת מחדל של Google Cloud — מספיקה לרוב השדות.
- `barcodeOrCode` (מספר כרטיס בפועל, השדה הרגיש ביותר): כברירת מחדל נסמכים על הצפנת at-rest. שכבת הצפנת application-level נוספת (AES-256 עם מפתח מ-Secret Manager, מוצפן/מפוענח רק ב-Server Action) היא upgrade עתידי מתועד — לא מיושם ב-MVP.

## ניהול Secrets
- Firebase **client** config (`NEXT_PUBLIC_FIREBASE_*`) — לא סוד אמיתי, מותר לחשוף ב-bundle. מוגן ע"י Security Rules, לא ע"י הסתרת ה-config.
- Firebase **Admin** service account (`FIREBASE_ADMIN_*`) — סוד אמיתי. `.env.local` בפיתוח (gitignored), Google Secret Manager בפרודקשן. אף פעם לא ב-`NEXT_PUBLIC_*`.

## Testing
`@firebase/rules-unit-testing` מול Firestore Emulator (דורש Java מותקן מקומית — ראה `docs/ARCHITECTURE.md`). טסטים נדרשים לפני Phase 1 sign-off:
- משתמש A לא יכול read/write על מסמכי משתמש B (בכל collection)
- לא ניתן לכתוב `usageLog` update/delete
- לא ניתן ליצור מסמך עם `ownerId` שונה מה-uid המאומת
- `categories` עם `ownerId="system"` לא ניתן לכתיבה מ-client
