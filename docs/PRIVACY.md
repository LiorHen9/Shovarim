# PRIVACY — GDPR + חוק הגנת הפרטיות (ישראל)

## עקרון
תשתית פרטיות נבנית מ-Phase 1, לא נדחית — זו דרישת compliance, לא "feature נחמד שיבוא בהמשך".

## מיפוי PII (נתונים אישיים)
| שדה | Collection | רגישות |
|---|---|---|
| `email`, `displayName`, `photoURL` | `users` | זהות בסיסית, מגיע מ-Google/Apple auth |
| `barcodeOrCode` | `cards` | פוטנציאלית רגיש — מספר כרטיס אמיתי, ראה `docs/SECURITY.md`. מ-2026-08-30 (`docs/DECISIONS.md` ADR #36) ניתן להזין/לעדכן גם דרך הצ'אט (web+WhatsApp) — ראה השורה על `history` למטה |
| `cvv` | `cards` | רגיש מאוד — יחד עם `barcodeOrCode` מאפשר שימוש בכרטיס, ראה `docs/SECURITY.md`. אותה הערה: ניתן להזין/לעדכן דרך הצ'אט מ-ADR #36 |
| `cardImageUrl`, `receiptImageUrl` | `cards`, `usageLog` | תמונות עשויות להכיל מידע מזהה נוסף (למשל בקבלה) |
| `location`, `purpose` | `usageLog` | התנהגות/הרגלי צריכה — נחשב profiling data תחת GDPR |
| `fcmTokens` | `users` | מזהה מכשיר |
| `ip` | `consents` | אופציונלי, לתיעוד הסכמה בלבד |
| `externalId` (מספר טלפון E.164), `channelKey` | `channelLinks`, `channelLinkCodes` | מזהה ישיר — מספר טלפון הוא PII בפני עצמו וגם מקשר את החשבון לזהות מחוץ למערכת. נוסף ב-Phase 5.5.a |
| `paramsSummary` של `channel_linked`/`channel_unlinked` | `auditLog` | מכיל `channelKey`, כלומר **מספר הטלפון** — לא סוד, אבל כן PII שנשאר ב-audit trail |
| `history` (טקסט שיחה מלא) | `chatSessions` | תוכן ההודעות בפרוזה חופשית, כלומר נתונים פיננסיים והרגלי צריכה — **ומ-ADR #36 גם `cvv`/`barcodeOrCode` בטקסט גלוי**, אם המשתמש/ת בחר/ה להזין אותם דרך הצ'אט. נכתב מ-5.5.b |

**מחיקה וייצוא**: ה-collections של הערוצים ממופתחים לפי `channelKey` ולא לפי `uid`, ולכן שאילתות הבעלות הקיימות **לא** מגיעות אליהם וצריך מעבר נפרד. `functions/src/accountDeletion.ts` מוחק את כולם דרך שדה `uid`; `buildUserDataExport` מייצא את `channelLinks` ואת `chatSessions` (נוסף ב-5.5.b, `listChatSessionsForUid`). **קודי קישור שלא מומשו לא נכללים בייצוא במכוון** — הם bearer credentials חיים, וקובץ ייצוא הוא בדיוק הדבר שנשלח הלאה במייל.

**מזעור נתונים בשיחות (5.5.b)**: שיחה שלא נגעו בה 24 שעות נטענת כריקה ונדרסת בתור הבא, והיסטוריה נגזמת בגבול ~200KB; ניתוק ערוץ או קישורו מחדש לחשבון אחר מוחקים את השיחה מיד. `channelMessages` שומר מזהי הודעות (לא תוכן) לצורך דדופליקציה.

**חובות פתוחות**: (1) להגדיר בקונסולה **TTL policies** בפועל — `chatSessions.updatedAt`, `channelMessages.receivedAt`, `channelLinkCodes.expiresAt`. הלוגיקה לא נשענת עליהן (שיחה ישנה נזרקת בקוד גם אם המסמך קיים), אבל בלעדיהן המסמכים נשארים מאוחסנים. (2) תוכן ההודעות **והתשובות** עובר דרך השרתים של Meta — **העברה לצד שלישי** — ודורש התייחסות מפורשת ב-Privacy Policy ובזרימת ה-consent, כולל העלאת גרסת המדיניות ודרישת re-consent, **לפני** הפעלה בפרודקשן. **סעיף זה דחוף כעת**: WhatsApp חי מקצה לקצה מ-2026-08-30 (`docs/CHATBOT.md`), ומאותו תאריך (ADR #36) התוכן שעובר דרך Meta עשוי לכלול גם `cvv`/`barcodeOrCode` בטקסט גלוי, לא רק יתרות/שמות כרטיסים — כלומר החוב הזה גדל מ"נדרש לפני production" ל"פעיל בפרודקשן בלי שהוסדר".

## Consent
`components/legal/ConsentBanner.tsx` — חוסם שימוש עד הסכמה מפורשת, כותב ל-`consents/{uid}` (גרסת מדיניות + timestamp). גרסת המדיניות הנוכחית מוגדרת קבוע ב-קוד; שינוי מדיניות מהותי = הגדלת הגרסה + דרישת re-consent.

## Privacy Policy & Terms
`app/(public)/privacy/page.tsx`, `app/(public)/terms/page.tsx` — עמודים סטטיים, גרסתיים. כתובים בעברית וברורים (לא ז'רגון משפטי בלבד — GDPR מחייב שפה נהירה).

## זכות גישה/ייצוא (Right to Access/Portability)
✅ הושלם (Phase 4.1, 2026-08-27). Server Action `exportUserData()` (`src/actions/privacy.ts`, Admin SDK, ללא פרמטר `uid` — נגזר מה-session) קוראת ל-`buildUserDataExport(uid)` (`src/lib/services/export.ts`) שאוספת `users/{uid}`, `consents/{uid}`, `cardLists`+`members` בבעלות המשתמש, חברויות ברשימות של אחרים, `cards`+`usageLog` בבעלות המשתמש ו-`categories` בבעלות המשתמש ל-JSON אחד. `ExportDataButton` ב-`/settings` מפעילה הורדה בדפדפן. כל קריאה נכתבת ל-`auditLog` (`eventType:"export"`).

## זכות מחיקה (Right to Erasure)
✅ הושלם (Phase 4.2, 2026-08-27). זרימה דו-שלבית:
1. משתמש מבקש מחיקה מ-`/settings` (`DeleteAccountSection`) → Server Action `requestAccountDeletion` (`src/actions/privacy.ts`, Admin SDK, ללא פרמטר `uid`) כותבת `deletionRequestedAt` ב-`users/{uid}` (idempotent — בקשה חוזרת לא דוחה את המועד) וכותבת `auditLog` (`eventType:"deletion_request"`). הפיך לחלוטין דרך `cancelAccountDeletion` (מנקה את השדה, כותבת `deletion_cancelled`) עד שה-Cloud Function רץ. באנר גלובלי לא-חוסם (`DeletionPendingBanner`, בכל עמוד מוגן) וגם כרטיס ב-`/settings` מציגים את התאריך הצפוי ומאפשרים ביטול.
2. Cloud Function מתוזמן (`functions/src/index.ts`, `deleteExpiredAccounts`, יומי, `firebase-functions/v2/scheduler`) סורק `users` שחלף עליהם חלון grace של **30 יום** (`GRACE_PERIOD_DAYS`) ומוחק בפועל: `cardLists`/`cards` (כולל `members`/`usageLog` subcollections), `categories`, `consents`, מסמכי חברות ברשימות משותפות של אחרים, קבצי Storage, מסמך `users/{uid}`, ולבסוף את משתמש ה-Auth (בסדר הזה, כדי שכשל חלקי לא ישאיר משתמש תקוע). הפעולה נכתבת ל-`auditLog` (`deletion_completed`) לפני שמתחילים למחוק — audit trail נשאר. פרטים מלאים ב-`docs/DECISIONS.md` #24.

## Data Minimization
- `barcodeOrCode`, `cvv`, `location`, `acceptingRetailersUrl` — אופציונליים בלבד, לא נאספים אם המשתמש לא מזין.
- אין איסוף מיקום GPS אוטומטי — רק טקסט חופשי שהמשתמש מקליד.
- `fcmTokens` נמחקים בעת sign-out/uninstall (לא נשמרים ללא צורך).

## Audit Log
`auditLog` collection — נכתב רק מ-Admin SDK (Cloud Functions, Server Actions, שכבת השירות). אירועים: login, data export, deletion request/completion, קריאות MCP tool, וקישור/ניתוק ערוץ (Phase 5.5). משתמש רואה רק את הרשומות שלו. `paramsSummary` של `channel_linked`/`channel_unlinked` מכיל את ה-`channelKey`, כלומר מספר טלפון — ה-audit trail הוא append-only ו-`deleteUserAccount` **אינו** מוחק רשומות `auditLog` (בכוונה — התיעוד שהמחיקה בוצעה חייב לשרוד אותה), ולכן מספר הטלפון נשאר ב-audit גם אחרי ניתוק הערוץ וגם אחרי מחיקת החשבון. אם זה ייחשב מוגזם ביחס לתכלית, האיזון הנכון הוא לכתוב `channelKey` מגובב/מקוצץ ב-`paramsSummary` במקום לגעת ב-append-only — לא הוכרע.

## דרישות ישראליות ספציפיות (חוק הגנת הפרטיות, תיקון 13)
- מאגר מידע: יש למפות אם האפליקציה (גם בשימוש אישי כרגע) עשויה להיחשב "מאגר מידע" הדורש רישום — רלוונטי בעיקר כשהיקף המשתמשים גדל. לתעד את ההחלטה ב-`docs/DECISIONS.md` כשמתקבלת.
- הודעת פרטיות חייבת לפרט: מטרת האיסוף, האם חובה למסור מידע, למי מועבר המידע (אם בכלל — Firebase/Google Cloud כמעבד).
