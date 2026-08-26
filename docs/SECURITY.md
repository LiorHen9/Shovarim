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
4. **Abuse/spam על כתיבות** (יצירת אלפי כרטיסים/entries) → Firebase App Check (Phase 5) + GCP quotas מובנות על Cloud Functions.
5. **דליפת Admin credentials** → Admin SDK תמיד server-only (`import "server-only"` ב-`admin.ts`), secrets ב-Secret Manager/`.env.local` שלא מחובר לגיט.

## הצפנה
- Firestore/Storage: הצפנה at-rest כברירת מחדל של Google Cloud — מספיקה לרוב השדות.
- `barcodeOrCode` (מספר כרטיס בפועל) ו-`cvv` (Phase 3) — שני השדות הרגישים ביותר: כברירת מחדל נסמכים על הצפנת at-rest. שכבת הצפנת application-level נוספת (AES-256 עם מפתח מ-Secret Manager, מוצפן/מפוענח רק ב-Server Action) היא upgrade עתידי מתועד ב-`docs/ROADMAP.md` Phase 5 — לא מיושם עדיין.

## ניהול Secrets
- Firebase **client** config (`NEXT_PUBLIC_FIREBASE_*`) — לא סוד אמיתי, מותר לחשוף ב-bundle. מוגן ע"י Security Rules, לא ע"י הסתרת ה-config.
- Firebase **Admin** service account (`FIREBASE_ADMIN_*`) — סוד אמיתי. `.env.local` בפיתוח (gitignored), Google Secret Manager בפרודקשן. אף פעם לא ב-`NEXT_PUBLIC_*`.

### Secrets ב-CI/CD (ראו `docs/DEPLOYMENT.md` להרצה מלאה)
- ה-deploy job ב-GitHub Actions מתחבר ל-GCP דרך **Workload Identity Federation** ולא מפתח service-account JSON ארוך-טווח — כלומר אין חומר סוד סטטי שיושב ב-GitHub secrets בר-גניבה/דליפה. ה-provider מוגבל (`attribute-condition`) לריפו הספציפי `LiorHen9/Shovarim` בלבד, כך שגם אם ה-OIDC token ידלוף מהקשר אחר הוא לא יתקבל.
- `FIREBASE_ADMIN_PRIVATE_KEY` הוא המשתנה היחיד שחייב להיות `secret:` reference ב-`apphosting.yaml` (Secret Manager) — כל שאר משתני ה-App Hosting הם plain env vars, כולל `FIREBASE_ADMIN_CLIENT_EMAIL` (מזהה, לא חומר קריפטוגרפי).
- חלופת מפתח service-account מתועדת ב-`docs/DEPLOYMENT.md` כ-fallback מהיר יותר להקמה, עם המלצה מפורשת נגד שימוש בה לאורך זמן בהתחשב בכך שהאפליקציה מאחסנת מספרי כרטיס/CVV.

## Testing
`@firebase/rules-unit-testing` מול Firestore Emulator (דורש Java מותקן מקומית — ראה `docs/ARCHITECTURE.md`). טסטים נדרשים לפני Phase 1 sign-off:
- משתמש A לא יכול read/write על מסמכי משתמש B (בכל collection)
- לא ניתן לכתוב `usageLog` update/delete
- לא ניתן ליצור מסמך עם `ownerId` שונה מה-uid המאומת
- `categories` עם `ownerId="system"` לא ניתן לכתיבה מ-client
