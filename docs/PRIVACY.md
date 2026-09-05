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
| `phone` (E.164) | `listInviteCodes` | מזהה ישיר ו**מספר של צד שלישי**, שהוזן על ידי בעל הרשימה על מישהו אחר שאולי אינו משתמש במערכת כלל. נוסף ב-ADR #37, הוסר ב-ADR #38, ו**הוחזר ב-ADR #39** כשער-ההרשאה של ההזמנה. ראו "מספרים של לא-משתמשים" למטה |
| `phone` (E.164) | `cardLists/{listId}/members` | **חשיפה כלפי בעל הרשימה** (ADR #38, נשמרה ב-ADR #39): מספר הווטסאפ של החבר מוצג לבעלים ב-`ShareListDialog` לצד המייל. מה שמצמצם: נשמר רק ברגע שהמוזמן עצמו מאשר במפורש את ההצטרפות; **לא** נשלף מחדש מ-`channelLinks` בזמן תצוגה, כך שניתוק המספר לא חושף אותו שוב. מ-ADR #39 זה כמעט תמיד המספר שהבעלים עצמו הקליד, כלומר החשיפה בפועל היא אישור שהמספר אכן שייך למי שהצטרף. נכלל בייצוא ובמחיקה כמו כל מסמך `members` |

**מחיקה וייצוא**: ה-collections של הערוצים ממופתחים לפי `channelKey` ולא לפי `uid`, ולכן שאילתות הבעלות הקיימות **לא** מגיעות אליהם וצריך מעבר נפרד. `functions/src/accountDeletion.ts` מוחק את כולם דרך שדה `uid`, ומ-ADR #37 גם את `listInviteCodes` דרך `invitedBy`; `buildUserDataExport` מייצא את `channelLinks` ואת `chatSessions` (נוסף ב-5.5.b, `listChatSessionsForUid`). **קודי קישור והזמנות רשימה שלא מומשו לא נכללים בייצוא במכוון** — הם bearer credentials חיים, וקובץ ייצוא הוא בדיוק הדבר שנשלח הלאה במייל.

**מספרים של לא-משתמשים (ADR #37 → נסגר ב-ADR #38 → נפתח מחדש ב-ADR #39)**: `listInviteCodes.phone` הוא המקום היחיד שבו המערכת שומרת PII של אדם ש**אינו** משתמש בה ולא נתן הסכמה — בעל רשימה מקליד מספר של מישהו אחר. ADR #38 הסיר את הקלט הזה, ו-**ADR #39 החזיר אותו במודע**: המספר הוא מה שמונע מלינק שדלף להפוך להצטרפות, כלומר החשיפה הזו היא המחיר של בקרת הגישה. **זהו trade-off פרטיות מול אבטחה שנבחר לטובת האבטחה, ולא פער שנשכח.**

מה שמצמצם: המספר נשמר רק כחלק מהזמנה פעילה (48 שעות), הבעלים יכול לבטל אותה בכל רגע, שיתוף חוזר לאותו מספר דורס את הקודם במקום לצבור, והמסמכים נמחקים עם חשבון הבעלים (`accountDeletion.ts` דרך `invitedBy`). המספר גם לא נחשף לאף אחד מלבד הבעלים שהקליד אותו — למוזמן מוצגות ארבע ספרות אחרונות בלבד (`phoneHint`), ו-`firestore.rules` חוסם קריאה מ-client לחלוטין.

מה שעדיין **לא** מוסדר, וחוזר להיות פתוח עם ADR #39: (א) אין TTL policy בפועל שמוחק את המסמך אחרי הפקיעה (אותה חובה פתוחה כמו `channelLinkCodes`, ראו למטה) — מספר של אדם שלא הצטרף עלול להישאר מאוחסן אחרי שההזמנה כבר חסרת תוקף; (ב) לאותו אדם אין דרך לבקש מחיקה או לדעת שהמספר שלו נשמר, כי אין לו חשבון שדרכו לפנות. שתי הנקודות דורשות התייחסות ב-Privacy Policy לצד סעיף ה-Meta למטה, ו-(א) הפכה לחוב ממשי ולא לזנב מתכלה.

**מזעור נתונים בשיחות (5.5.b)**: שיחה שלא נגעו בה 24 שעות נטענת כריקה ונדרסת בתור הבא, והיסטוריה נגזמת בגבול ~200KB; ניתוק ערוץ או קישורו מחדש לחשבון אחר מוחקים את השיחה מיד. `channelMessages` שומר מזהי הודעות (לא תוכן) לצורך דדופליקציה.

**חובות פתוחות**: (1) להגדיר בקונסולה **TTL policies** בפועל — `chatSessions.updatedAt`, `channelMessages.receivedAt`, `channelLinkCodes.expiresAt`, `listInviteCodes.expiresAt` (האחרון מחזיק מספר טלפון של צד שלישי, ראו למעלה — ולכן הוא הדחוף מביניהם). הלוגיקה לא נשענת עליהן (שיחה ישנה נזרקת בקוד גם אם המסמך קיים), אבל בלעדיהן המסמכים נשארים מאוחסנים. (2) ✅ **נסגר ב-2026-09-05 (Phase 6.C, ADR #59).** החוב היה: תוכן ההודעות **והתשובות** עובר דרך השרתים של Meta — **העברה לצד שלישי** — בלי התייחסות ב-Privacy Policy ובזרימת ה-consent, בזמן ש-WhatsApp כבר חי מקצה לקצה מ-2026-08-30 (`docs/CHATBOT.md`) ומאותו תאריך (ADR #36) התוכן עשוי לכלול `cvv`/`barcodeOrCode` בטקסט גלוי. מה שנעשה: סעיף "העברת מידע לצדדים שלישיים" ב-`privacy/page.tsx` נוקב בשלושת הנמענים — Google (Firebase), **Anthropic** (שלא היה מוצהר כלל, ולא רק Meta) ו-**Meta** (רק בקישור ערוץ יזום, וניתן לניתוק); `ConsentBanner` נוקב בשניים החדשים בגוף הדיאלוג; ו-`PRIVACY_POLICY_VERSION` עלה ל-`2026-09-05`, כלומר כל משתמש קיים נדרש לאשר מחדש.

## אחסון בדפדפן (עוגיות) — אין באנר, ויש סיבה
מופה במלואו ב-`docs/DECISIONS.md` ADR #59 (2026-09-05). בקצרה, זה כל מה שנשמר במכשיר המשתמש:

| מה | איפה | תכלית | דורש הסכמה? |
|---|---|---|---|
| `__session` | עוגיית HttpOnly, המקור שלנו (`src/actions/auth.ts`) | שמירת ההתחברות; נוצרת **רק** בהתחברות | לא — הכרחית |
| `firebaseLocalStorageDb` | IndexedDB של Firebase Auth | שמירת ההתחברות בצד לקוח | לא — הכרחית |
| `A11Y_STORAGE_KEY` | `localStorage` (`src/lib/a11y/preferences.ts`) | העדפות סרגל הנגישות שהמשתמש בחר בעצמו | לא — יזום ע"י המשתמש |
| provider ממתין | `sessionStorage` (`src/components/auth/SignInButtons.tsx`) | שרידות ה-redirect של OAuth | לא — הכרחית |
| `_GRECAPTCHA` | צד שלישי, `google.com`, מ-App Check (`src/lib/firebase/appCheck.ts`) | מניעת הונאה/בוטים; נטען גם למבקר אנונימי | לא — פטור אבטחה |

**אפס אנליטיקס, אפס פרסום, אפס פיקסלים.** Heebo מגיע דרך `next/font/google` (מוריד ב-build, מוגש מהדומיין שלנו) ולא בקריאת runtime ל-Google. אומת אמפירית: `curl -D -` על `/` ועל `/privacy` בפרודקשן מחזיר אפס `Set-Cookie`.

לכן **אין באנר עוגיות, וזו החלטה ולא השמטה** — הכול בתוך פטור ההכרחיות של ePrivacy 5(3). **הטריגר שמשנה את זה הוא GA4** (שכבה 3 של Phase 9.6): ברגע שנכנס אנליטיקס נדרש מנגנון opt-in אמיתי שלא יורה אירוע לפני קליק. אכיפה: `tests/e2e/public.spec.ts` מוודא שמבקר לא-מחובר מקבל אפס עוגיות ואפס בקשות לדומייני מעקב.

## Consent
`components/legal/ConsentBanner.tsx` — חוסם שימוש עד הסכמה מפורשת, כותב ל-`consents/{uid}` (גרסת מדיניות + timestamp). גרסת המדיניות הנוכחית מוגדרת קבוע ב-קוד; שינוי מדיניות מהותי = הגדלת הגרסה + דרישת re-consent. הבאנר עצמו נוקב בשמות נמעני הצד-השלישי (Anthropic, Meta) ולא רק מפנה למדיניות — ראו ADR #59 החלטה 5.

## Privacy Policy & Terms
`app/(public)/(legal)/privacy/page.tsx`, `app/(public)/(legal)/terms/page.tsx` (הועברו לקבוצת המסלולים `(legal)` ב-Phase 6.B) — עמודים סטטיים, גרסתיים. כתובים בעברית וברורים (לא ז'רגון משפטי בלבד — GDPR מחייב שפה נהירה).

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
