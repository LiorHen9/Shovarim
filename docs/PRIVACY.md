# PRIVACY — GDPR + חוק הגנת הפרטיות (ישראל)

## עקרון
תשתית פרטיות נבנית מ-Phase 1, לא נדחית — זו דרישת compliance, לא "feature נחמד שיבוא בהמשך".

## מיפוי PII (נתונים אישיים)
| שדה | Collection | רגישות |
|---|---|---|
| `email`, `displayName`, `photoURL` | `users` | זהות בסיסית, מגיע מ-Google/Apple auth |
| `barcodeOrCode` | `cards` | פוטנציאלית רגיש — מספר כרטיס אמיתי, ראה `docs/SECURITY.md` |
| `cvv` | `cards` | רגיש מאוד — יחד עם `barcodeOrCode` מאפשר שימוש בכרטיס, ראה `docs/SECURITY.md` |
| `cardImageUrl`, `receiptImageUrl` | `cards`, `usageLog` | תמונות עשויות להכיל מידע מזהה נוסף (למשל בקבלה) |
| `location`, `purpose` | `usageLog` | התנהגות/הרגלי צריכה — נחשב profiling data תחת GDPR |
| `fcmTokens` | `users` | מזהה מכשיר |
| `ip` | `consents` | אופציונלי, לתיעוד הסכמה בלבד |

## Consent
`components/legal/ConsentBanner.tsx` — חוסם שימוש עד הסכמה מפורשת, כותב ל-`consents/{uid}` (גרסת מדיניות + timestamp). גרסת המדיניות הנוכחית מוגדרת קבוע ב-קוד; שינוי מדיניות מהותי = הגדלת הגרסה + דרישת re-consent.

## Privacy Policy & Terms
`app/(public)/privacy/page.tsx`, `app/(public)/terms/page.tsx` — עמודים סטטיים, גרסתיים. כתובים בעברית וברורים (לא ז'רגון משפטי בלבד — GDPR מחייב שפה נהירה).

## זכות גישה/ייצוא (Right to Access/Portability)
✅ הושלם (Phase 4.1, 2026-08-27). Server Action `exportUserData()` (`src/actions/privacy.ts`, Admin SDK, ללא פרמטר `uid` — נגזר מה-session) קוראת ל-`buildUserDataExport(uid)` (`src/lib/services/export.ts`) שאוספת `users/{uid}`, `consents/{uid}`, `cardLists`+`members` בבעלות המשתמש, חברויות ברשימות של אחרים, `cards`+`usageLog` בבעלות המשתמש ו-`categories` בבעלות המשתמש ל-JSON אחד. `ExportDataButton` ב-`/settings` מפעילה הורדה בדפדפן. כל קריאה נכתבת ל-`auditLog` (`eventType:"export"`).

## זכות מחיקה (Right to Erasure)
זרימה דו-שלבית:
1. משתמש מבקש מחיקה → נכתב `deletionRequestedAt` ב-`users/{uid}` (הפיכה — ניתן לבטל בחלון ה-grace period, למשל 30 יום).
2. Cloud Function (scheduled) מוחקת בפועל אחרי חלון ה-grace: כל subcollections, קבצי Storage, ואת משתמש ה-Auth עצמו. הפעולה נכתבת ל-`auditLog` (לפני שהמשתמש נמחק — audit trail נשאר).
Phase 5.

## Data Minimization
- `barcodeOrCode`, `cvv`, `location`, `acceptingRetailersUrl` — אופציונליים בלבד, לא נאספים אם המשתמש לא מזין.
- אין איסוף מיקום GPS אוטומטי — רק טקסט חופשי שהמשתמש מקליד.
- `fcmTokens` נמחקים בעת sign-out/uninstall (לא נשמרים ללא צורך).

## Audit Log
`auditLog` collection — נכתב רק מ-Cloud Functions (Admin SDK). אירועים: login, data export, deletion request/completion. משתמש רואה רק את הרשומות שלו.

## דרישות ישראליות ספציפיות (חוק הגנת הפרטיות, תיקון 13)
- מאגר מידע: יש למפות אם האפליקציה (גם בשימוש אישי כרגע) עשויה להיחשב "מאגר מידע" הדורש רישום — רלוונטי בעיקר כשהיקף המשתמשים גדל. לתעד את ההחלטה ב-`docs/DECISIONS.md` כשמתקבלת.
- הודעת פרטיות חייבת לפרט: מטרת האיסוף, האם חובה למסור מידע, למי מועבר המידע (אם בכלל — Firebase/Google Cloud כמעבד).
