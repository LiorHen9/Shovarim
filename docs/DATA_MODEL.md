# DATA MODEL — Firestore

Top-level collections, כל מסמך נושא `ownerId` (=Firebase Auth uid), לא nested תחת `/users/{uid}/...` — כדי לאפשר collection-group queries עתידיות (ראה `docs/DECISIONS.md` #1). טיפוסי TypeScript תואמים ב-`src/types/`, Zod schemas תואמים ב-`src/lib/validation/`.

## `users/{uid}`
`src/types/user.ts`
```ts
{
  uid: string;                 // == doc id == auth uid
  email: string;
  displayName: string;
  photoURL: string | null;
  authProvider: "google" | "apple";
  createdAt: Timestamp;
  locale: "he" | "en";
  currency: string;            // ברירת מחדל, e.g. "ILS"
  notificationPrefs: {
    email: boolean;
    push: boolean;
    reminderDaysBefore: number[]; // e.g. [30, 7, 1]
  };
  fcmTokens: string[];
  deletionRequestedAt: Timestamp | null;  // GDPR right-to-erasure
}
```
נוצר ב-first login (Server Action, לא client — כדי להבטיח שדות ברירת מחדל עקביים).

## `cards/{cardId}`
`src/types/card.ts`
```ts
{
  id: string;
  ownerId: string;              // immutable אחרי create; תמיד ownerId של הרשימה, גם כשמנהל משותף יוצר את הכרטיס
  listId: string;               // ראו cardLists/{listId} למטה — כל כרטיס שייך לרשימה אחת
  name: string;
  categoryId: string | null;
  tags: string[];
  initialBalance: number;
  currentBalance: number;       // מעודכן רק בתוך Firestore Transaction
  currency: string;
  expiryDate: Timestamp | null;
  purchaseDate: Timestamp | null;
  cardImageUrl: string | null;
  barcodeOrCode: string | null;      // מוצפן (AES-256-GCM), ראה docs/SECURITY.md — לא טקסט גלוי ב-Firestore
  cvv: string | null;                // מוצפן (AES-256-GCM), ראה docs/SECURITY.md — לא טקסט גלוי ב-Firestore
  acceptingRetailersUrl: string | null;
  notes: string | null;
  status: "active" | "expired" | "depleted" | "archived";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```
מחיקת כרטיס (`DeleteCardButton` → `deleteCard` ב-`src/actions/card.ts`) היא מחיקה מלאה, לא ארכוב (`status: "archived"` הוא פעולה נפרדת) — מוחקת גם את תת-האוסף `usageLog` (recursiveDelete) וגם קבצי Storage תחת `users/{uid}/cards/{cardId}/`, ראו `docs/DECISIONS.md` #14.

## `cardLists/{listId}`
`src/types/cardList.ts`
```ts
{
  id: string;
  ownerId: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```
כל כרטיס (`cards.listId`) שייך לרשימה אחת בדיוק — שדה חובה, נאכף גם ב-`firestore.rules` (`create` דורש `listId` לא ריק). כשמשתמש מוסיף את הכרטיס הראשון שלו ואין לו עדיין אף רשימה, `CardForm` יוצר אוטומטית רשימה ראשונית ("הרשימה שלי") ומשייך אליה — ראו `docs/DECISIONS.md` #13. מחיקת רשימה מותרת מה-UI רק כשהיא ריקה (0 כרטיסים ו-0 חברים משותפים), כדי למנוע כרטיסים/שיתופים "יתומים".

## `cardLists/{listId}/members/{memberUid}` (subcollection)
`src/types/cardListMember.ts`
```ts
{
  id: string;                    // == memberUid
  listId: string;
  memberUid: string;
  email: string;                 // snapshot של המייל, לתצוגה
  phone?: string | null;         // מספר הווטסאפ שהיה מקושר ברגע ההצטרפות (ADR #38)
  role: "manager" | "viewer";
  status: "pending" | "accepted";
  invitedBy: string;             // uid של בעל הרשימה
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```
שיתוף רשימה — ראו `docs/DECISIONS.md` #15 ו-#38. doc id תמיד שווה ל-`memberUid`, נוצר על ידי `acceptListInvite` (`src/lib/services/listInvites.ts`) כשהמוזמן מאשר. "מנהל" מאושר (`status:"accepted"`) יכול לנהל כרטיסים ברשימה כמו הבעלים; "צופה" מאושר יכול רק לקרוא. כרטיסים שנוצרים דרך שיתוף עדיין נכתבים עם `ownerId` של בעל הרשימה (לא של היוצר בפועל) — ראו הערה ב-`cards` למעלה וב-`usageLog.createdBy` למטה.

`phone` **אופציונלי** (ולא `string | null`) כי `useListMembers` עושה cast גולמי על ה-snapshot: מסמכים שנכתבו לפני ADR #38 לא מכילים את המפתח כלל. הוא נכתב פעם אחת בלבד, ברגע שהמוזמן מאשר את ההצטרפות — **לא** נשלף מחדש מ-`channelLinks` בזמן תצוגה, מה שהיה חושף בפני הבעלים מספר שהחבר אולי ניתק מאז (`docs/PRIVACY.md`). `status:"pending"` נוצר רק על ידי מסלול האימייל שהוסר ב-ADR #38; מסמכים כאלה שנוצרו בעבר ממשיכים להיות ניתנים לאישור מ-`/cards`.

## `cards/{cardId}/usageLog/{entryId}` (subcollection, immutable)
`src/types/usageLog.ts`
```ts
{
  id: string;
  ownerId: string;               // כפול מ-card, כדי לפשט Security Rules
  cardId: string;
  amount: number;                // positive = ניכוי
  date: Timestamp;
  purpose: string;
  location: string | null;
  receiptImageUrl: string | null;
  balanceAfter: number;          // snapshot לצורך audit/דוחות מהירים
  createdAt: Timestamp;
  createdBy: string;              // uid של מי שביצע בפועל — בעל הרשימה או מנהל משותף (docs/DECISIONS.md #15)
}
```
**אין update, ואין delete מצד הלקוח** — ראה `firestore.rules`. מחיקה כן אפשרית, אך רק דרך Server Action ייעודי (`deleteUsageEntry` ב-`src/actions/usage.ts`, Admin SDK) שמאפשר גם להחזיר את הסכום ליתרת הכרטיס באותה טרנזקציה — ראה `docs/DECISIONS.md` #12. עריכה בדיעבד עדיין לא נתמכת; תיקון טעות שאינו מחיקה = רשומת correction חדשה.

## `categories/{categoryId}`
`src/types/category.ts`
```ts
{
  id: string;
  ownerId: string | "system";   // "system" = ברירות מחדל, read-only לכולם, נכתב רק ע"י Admin SDK
  name: string;
  icon: string | null;
  color: string | null;
  isSystemDefault: boolean;
}
```

## `reminders/{reminderId}`
מנוהל ע"י Cloud Function מתוזמן (Phase 3), read-only ל-client.
```ts
{
  id: string;
  ownerId: string;
  cardId: string;
  triggerDate: Timestamp;
  daysBeforeExpiry: number;
  status: "pending" | "sent" | "cancelled";
  channel: "email" | "push";
}
```

## `consents/{uid}`
`src/types/consent.ts`. GDPR consent tracking.
```ts
{
  uid: string;
  privacyPolicyVersion: string;
  acceptedAt: Timestamp;
  marketingConsent: boolean;
  ip: string | null;   // אופציונלי, לתיעוד בלבד
}
```

## `auditLog/{entryId}`
`src/types/auditLog.ts`
```ts
{
  id: string;
  uid: string;                  // המשתמש שביצע את הפעולה
  eventType: "mcp_tool_call" | "login" | "export" | "deletion_request" | "deletion_cancelled" | "deletion_completed" | "permission_change" | "channel_linked" | "channel_unlinked";
  tool: string | null;          // שם ה-MCP tool (למשל "listCards"), null לאירועים שאינם tool call
  channel: "cli" | "web" | "whatsapp" | "telegram" | null;
  paramsSummary: string | null; // תקציר פרמטרים ללא סודות (לא cvv/barcodeOrCode/tokens) — לא ה-input הגולמי
  result: "success" | "error";
  createdAt: Timestamp;
}
```
Append-only, נכתב רק מ-Admin SDK דרך `writeAuditLog` המשותפת (`src/lib/audit/log.ts`) — קרויה גם משרת ה-MCP המקומי ב-`mcp-server/` (`mcp_tool_call`, ראו `docs/ROADMAP.md` שלב 5.1) וגם מ-Server Actions ב-`src/actions/` (`export`/`deletion_request`/`deletion_cancelled`, ראו Phase 4.1/4.2). `deletion_completed` נכתב ישירות מ-`functions/src/accountDeletion.ts` (Admin SDK עצמאי, לא דרך `writeAuditLog` המשותפת — ראו `docs/DECISIONS.md` #24 לגבי הפרדת `functions/` מ-`src/`). `channel_linked`/`channel_unlinked` נכתבים מ-`src/lib/services/channelLinks.ts` (Phase 5.5) — בשירות ולא ב-Server Action, כי `redeemLinkCode` נקרא גם מה-webhook שאינו עובר דרך `src/actions/`. `paramsSummary` שם הוא ה-`channelKey`, כלומר **כולל מספר טלפון** — ראו `docs/PRIVACY.md`. `login`/`permission_change` עדיין לא נכתבים על ידי אף קוד קיים — יתווספו בשלבים העתידיים שמפיקים אותם.

## `rateLimits/{subjectId}`
`src/lib/services/rateLimit.ts` (אין type ייעודי — נגיש רק דרך `checkAndConsumeRateLimit`, לא נקרא ישירות במקום אחר)
```ts
{
  tools?: { windowStart: Timestamp; count: number };
  turns?: { windowStart: Timestamp; count: number };
}
```
מכסות fixed-window (`RATE_LIMITS`, `src/lib/mcp/config.ts`), נאכפות בתוך `runTransaction` (ראו `docs/ROADMAP.md` שלב 5.3/5.5.b, `docs/DECISIONS.md` ADR #21/#30). שני buckets בלתי-תלויים על אותו מסמך:
- **`tools`** (30 ל-5 דקות) — נצרך על כל קריאת tool ב-`withToolExecution` (`src/lib/mcp/mcpServer.ts`).
- **`turns`** (12 ל-5 דקות) — נצרך על כל הודעה נכנסת בערוץ webhook (`handleInboundChannelMessage`), גם כשלא נקרא אף tool. סוגר את הפער שבו שיחת טקסט ארוכה בלי קריאות tool לא הייתה מוגבלת בכלל.

**`subjectId` הוא `uid` בכל מסלול מאומת**, למעט הודעה נכנסת ממספר שעדיין לא מקושר — שם אין uid לחייב, ודווקא ההודעות האלה הן משטח הניחוש של קודי הקישור, ולכן הן מוגבלות לפי `channelKey`. מסמכים שנכתבו לפני 5.5.b (עם `windowStart`/`count` בשורש) נקראים פשוט כ"אין עדיין bucket" — לא נדרשה מיגרציה למכסה שפגה ממילא כל 5 דקות.

מסמך פנימי בלבד — נכתב ונקרא רק מ-Admin SDK, `firestore.rules` חוסם קריאה/כתיבה מ-client לגמרי (אין UI שמציג את המכסה).

## `channelLinks/{channelKey}`
`src/types/channelLink.ts`, נגיש דרך `src/lib/services/channelLinks.ts`
```ts
{
  channelKey: string;   // "<channel>:<externalId>", זהה ל-doc id
  uid: string;          // המשתמש שאליו הערוץ קשור
  channel: "whatsapp";  // AuditLogChannel חוץ מ-"web"/"cli"; כרגע whatsapp בלבד
  externalId: string;   // מזהה הערוץ החיצוני — E.164 מנורמל ב-WhatsApp
  linkedAt: Timestamp;
  lastMessageAt: Timestamp | null;
}
```
המיפוי ערוץ→משתמש שעליו נשענת כל הרשאה בערוצי webhook (`docs/ROADMAP.md` שלב 5.5, `docs/DECISIONS.md` ADR #29). **ה-doc id הוא `channelKey` ולא `uid` בכוונה**: ה-webhook מקבל מספר טלפון ותו לא, וחייב להיות מסוגל לגזור ממנו lookup ישיר (`get`, לא query) — הפוך מכל שאר ה-collections כאן שממופתחים לפי בעלות. `uid` נגזר **רק** מהמסמך הזה, לעולם לא מתוכן ההודעה.

מסמך פנימי בלבד: `firestore.rules` חוסם קריאה וכתיבה מ-client לגמרי. ה-UI ב-`/settings` קורא את הערוצים של המשתמש דרך Server Action (`listMyChannelLinks`), לא דרך client SDK — אחרת היה צריך `allow read: if isExistingOwner()`, ואוסף שממופתח לפי מספר טלפון עם קריאה מותרת הוא oracle שמאשר "האם המספר הזה רשום במערכת".

אין אינדקס מרוכב: `listChannelLinksForUid` שולף `where("uid","==",uid)` בלבד וממיין בזיכרון (מספר ערוצים למשתמש הוא חד-ספרתי).

**אימות מחדש תקופתי (issue #68, `docs/DECISIONS.md` ADR #41)**: אין שדה Firestore נפרד לתפוגה. `status`/`reverifyBy` ב-`ChannelLinkSummary` (מה שחוצה את גבול ה-Server Action ללקוח) הם **נגזרים** בכל קריאה מ-`linkedAt`/`lastMessageAt` הקיימים דרך `src/lib/services/channelLinkExpiry.ts`, מול שני ספים ב-`CHANNEL_LINK_REVERIFY` (`src/lib/mcp/config.ts` — המקום היחיד לעדכן אותם): `maxAgeDays` (30, תקרה מוחלטת מאז ה-`linkedAt` האחרון, גם עם פעילות רציפה) ו-`inactivityDays` (14, מאז `lastMessageAt`, או `linkedAt` אם עוד לא הייתה פעילות). קישור שחצה אחד מהשניים "פג" — `resolveUidForChannel` מחזיר `null` בדיוק כמו קישור שלא קיים בכלל (אותה הודעת "לא מקושר", בלי oracle חדש), ו-`createLinkCodeForUid` מפסיק לחסום הנפקת קוד חדש לאותו ערוץ (חידוש עצמי דרך `/settings`, לא מנגנון נפרד).

## `channelLinkCodes/{code}`
`src/types/channelLink.ts`, נגיש דרך `src/lib/services/channelLinks.ts`
```ts
{
  code: string;         // base32 (Crockford) בן 8 תווים, זהה ל-doc id
  uid: string;
  channel: "whatsapp";
  createdAt: Timestamp;
  expiresAt: Timestamp; // createdAt + 10 דקות
  usedAt: Timestamp | null;
}
```
קוד קישור חד-פעמי שנוצר באפליקציה **בזמן שהמשתמש מאומת** — זו הנקודה היחידה בזרימה שבה יש הוכחת בעלות על החשבון. המימוש (`redeemLinkCode`) קורא, מוודא לא-פג ולא-מומש, כותב `channelLinks` ומסמן `usedAt` — הכל בטרנזקציה אחת, כדי ששני webhook events מקבילים עם אותו קוד לא יקשרו שני מספרים.

**8 תווי base32 ולא 6 ספרות**: הצד המנחש כאן הוא בוט ששולח הודעות, לא טופס ווב עם CAPTCHA. 10^6 מול 32^8 (~10^12) הוא ההבדל בין מרחב שאפשר לסרוק לבין מרחב שאי אפשר. נוצר מ-`crypto.randomInt` (CSPRNG), לא מ-`Math.random`.

יצירת קוד חדש מבטלת קודים קודמים שלא מומשו של אותו משתמש (`usedAt` מסומן) — כך שאף פעם לא תלוי באוויר יותר מ-credential אחד. `where("uid","==",uid)` בלבד, סינון בזיכרון, בלי אינדקס מרוכב.

**קוד לא מונפק כלל למשתמש שכבר יש לו קישור פעיל (`status:"active"`) באותו ערוץ** (issue #26): `createLinkCodeForUid` בודק `listChannelLinksForUid` לפני כל כתיבה ודוחה. הדרך לקשר מספר אחר היא ניתוק הקישור הקיים תחילה — כלומר גם **אין כיום שני מספרי WhatsApp על אותו חשבון**. הבדיקה יושבת בשכבת השירות ולא רק ב-UI כי ה-Server Action ניתן ל-POST ישיר (ADR #25). זרימת "מעבר מספר בין חשבונות" (ADR #29, `redeemLinkCode`) לא מושפעת: שם הקוד מונפק ע"י החשבון ה**אחר**, שאין לו קישור. קישור **שפג** (`status:"expired"`, issue #68) לא נחסם — זה בדיוק החידוש העצמי, וה-uid זהה כך ש-`redeemLinkCode` דורס בלי צורך באישור relink (ADR #40 חל רק על uid שונה).

מומלץ להגדיר **TTL policy** על `expiresAt` (Firestore → TTL) כדי שמסמכים פגי-תוקף יימחקו אוטומטית; הלוגיקה לא נשענת על זה (קוד פג נדחה בקוד גם אם המסמך עדיין קיים) — זו היגיינת אחסון בלבד.

## `channelRelinkConfirmations/{channelKey}`
`src/types/channelLink.ts`, נגיש דרך `src/lib/services/channelRelinkConfirmations.ts` (issue #75, `docs/DECISIONS.md` ADR #40)
```ts
{
  channelKey: string;
  channel: "whatsapp";
  externalId: string;
  code: string;         // הקוד שטרם מומש, ממתין לאישור
  existingUid: string;  // הבעלים הנוכחי שעומד להיות מוחלף (למיסוך בהודעה + audit)
  createdAt: Timestamp;
  expiresAt: Timestamp; // createdAt + 10 דקות, אותו LINK_CODE_TTL_MS כמו channelLinkCodes
}
```
מצב-ביניים כש-`redeemLinkCode` מזהה שקוד עומד לדרוס קישור קיים ל-uid **אחר** מזה שהנפיק את הקוד: לפני שהמעבר קורה בפועל, הערוץ צריך לאשר "כן"/"לא" (טקסט חופשי או כפתור reply אמיתי של WhatsApp — שניהם מתאחדים לאותה בדיקה דטרמיניסטית ב-`channelChat.ts`, לפני ה-LLM). doc id = `channelKey`, בדיוק כמו `channelLinks`/`channelLinkCodes` — לכל היותר אישור ממתין אחד למספר בכל רגע.

**מחלקת אמון זהה ל-`channelLinks`**: מסמך פנימי לחלוטין, `firestore.rules` חוסם קריאה וכתיבה מ-client לגמרי — לקוח שיכול היה לקרוא/לכתוב אותו יכול היה לזייף או לדלוף מצב אישור relink. נכתב/נמחק אך ורק דרך `handleInboundChannelMessage`.

מומלץ להגדיר **TTL policy** על `expiresAt`, כמו ב-`channelLinkCodes` — הלוגיקה לא נשענת על זה (`getPendingRelink` דוחה מסמך פג-תוקף גם אם הוא עדיין קיים).

## `chatSessions/{channelKey}`
`src/types/channelLink.ts`, נגיש דרך `src/lib/services/chatSessions.ts` (נכתב מ-5.5.b)
```ts
{
  channelKey: string;
  uid: string;
  history: string;      // JSON של BetaMessageParam[] (Anthropic SDK)
  updatedAt: Timestamp;
}
```
היסטוריית שיחה בצד שרת, נדרשת רק לערוצים שאין להם לקוח שיחזיק אותה. בווב ההיסטוריה נשמרת ב-state של הדפדפן ונשלחת מלאה בכל בקשה (`docs/DECISIONS.md` ADR #22) — ב-WhatsApp אין מקבילה. מכיל טקסט הודעות מלא, כלומר PII פיננסי בפרוזה חופשית; ראו `docs/PRIVACY.md`.

**`history` הוא מחרוזת JSON ולא מערך** (שינוי מול הסכימה שנרשמה כאן ב-5.5.a): `BetaMessageParam[]` הוא מבנה של ה-SDK שלא נכתב על ידינו — הוא מכיל שדות `undefined` (ש-Firestore זורק עליהם) וייצוגים מקוננים שעלולים להיתקל באיסור על מערך בתוך מערך. סריאליזציה אחת ל-JSON מבטיחה round-trip זהה לביט ומנתקת את הסכימה ב-Firestore מגרסת ה-SDK.

**גבולות שמירה** (`src/lib/services/chatSessions.ts`): שיחה שלא נגעו בה 24 שעות נטענת כריקה (תואם גם את חלון השירות של WhatsApp), והיסטוריה שעוברת ~200KB נגזמת מההתחלה — תמיד עד גבול של הודעת משתמש אמיתית, אף פעם לא באמצע צמד `tool_use`/`tool_result` (גזימה כזו הייתה מייצרת בקשה לא חוקית ל-API). מומלץ להגדיר **TTL policy** על `updatedAt` כדי שהמסמכים יימחקו בפועל ולא רק יתאפסו לוגית.

## `channelMessages/{claimId}`
`src/lib/services/channelMessages.ts` (אין type ייעודי — נגיש רק דרך `claimInboundMessage`)
```ts
{
  channelKey: string;
  messageId: string;    // מזהה ההודעה הגולמי של הספק (wamid), לדיבוג
  receivedAt: Timestamp;
}
```
תביעת דדופליקציה להודעה נכנסת (Phase 5.5.b). **עצם קיום המסמך** הוא המנגנון: `claimInboundMessage` משתמש ב-`create()`, שנכשל ב-`ALREADY_EXISTS` אם ההודעה כבר טופלה, ולכן retry של Meta (שקורה על כל timeout או 5xx) הופך ל-no-op במקום לחייב קריאת LLM נוספת ולהריץ פעמיים כלים כותבים.

ה-doc id הוא `sha256("<channelKey> <messageId>")` ו**לא** ה-`messageId` עצמו: `wamid` הוא base64-ish ועשוי להכיל `/`, ש-`.doc()` של firebase-admin מפרש כמפריד path — בדיוק מחלקת ה-path injection שתוקנה ב-ADR #25. hash נותן מרחב תווים ואורך קבועים ונשאר דטרמיניסטי, וזה כל מה שנדרש ממפתח דדופליקציה.

התביעה נעשית **לפני** העיבוד ולא אחריו: ריצה כפולה של `logUsage`/`deleteCard` גרועה יותר מתשובה שאבדה. המחיר המכוון — אם העיבוד נכשל באמצע, ה-retry לא ינסה שוב והמשתמש לא יקבל מענה להודעה הזו (ישלח שוב).

מסמך פנימי בלבד: `firestore.rules` חוסם קריאה/כתיבה מ-client לחלוטין — לקוח שיכול היה ליצור מסמך כזה מראש היה משתיק את הבוט להודעה מסוימת. מומלץ TTL policy על `receivedAt` (המסמכים חסרי ערך אחרי חלון ה-retry של Meta).

## `listInviteCodes/{code}`
`src/types/listInvite.ts`, נגיש דרך `src/lib/services/listInvites.ts`
```ts
{
  code: string;         // base32 (Crockford) בן 12 תווים, זהה ל-doc id
  listId: string;
  role: "manager" | "viewer";   // תמיד "viewer" ביצירה מאז ADR #38
  phone: string | null; // E.164 — המספר שההזמנה נכרכה אליו (ADR #39). null = קוד bearer מתקופת ADR #38
  invitedBy: string;    // uid של בעל הרשימה שיצר את ההזמנה
  status: "pending" | "accepted" | "declined";
  createdAt: Timestamp;
  expiresAt: Timestamp; // createdAt + 48 שעות
  usedAt: Timestamp | null;
}
```
לינק שיתוף רשימה (`docs/DECISIONS.md` ADR #39, שהחזיר את הכריכה של ADR #37 אחרי ADR #38) — הנתיב היחיד לשיתוף רשימה, כולל עם מי שעדיין אין לו חשבון. מסלול האימייל (ADR #15) הוסר כנקודת כניסה ב-ADR #38 ולא חזר; מסמכי `members` שנוצרו דרכו נשארים.

**למה collection נפרד ולא מסמך `members` עם `status:"pending"`**: מסמך member ממופתח לפי `memberUid`, וברגע היצירה אין uid בכלל — הבעלים יודע רק מספר טלפון, ומי שמאחוריו אולי עדיין לא נרשם. מסמך ה-member נוצר רק ברגע האישור, ואז ישירות כ-`status:"accepted"` (דילוג על שלב ה-pending, שאין בו צורך כאן — האישור המפורש כבר התרחש בעמוד ההזמנה).

**מחלקת אמון זהה ל-`channelLinkCodes`**: ה-doc id הוא הסוד שנשלח בהודעת הוואטסאפ, ולכן `firestore.rules` חוסם קריאה וכתיבה מ-client לחלוטין. גם תצוגת הלינקים הפתוחים של הבעלים וגם התצוגה המקדימה של המוזמן עוברות דרך Server Actions. **12 תווים ולא 8** (בשונה מ-`channelLinkCodes`): הקוד חי 48 שעות ולא 10 דקות, ומאז ADR #38 הוא ה-credential כולו — 32^12 (~10^18) שומר על יחס בטיחות שמרני. נוצר מ-`crypto.randomInt` כמו קוד הקישור, ולא מוקלד ידנית אלא נלחץ כלינק, ולכן האורך אינו עלות UX.

**`phone` לא-null — הקוד הוא חצי מה-credential** (ADR #39): `acceptListInvite` מוודא שה-uid המאשר הוא בדיוק זה שאליו `channelLinks` ממפה את המספר, כך שלינק שדלף שווה כלום בידי חשבון אחר. על גבי זה נשמרים הגבולות שהוסיף ADR #38: חד-פעמיות (`status`/`usedAt`), TTL של 48 שעות, תקרה של 10 לינקים פתוחים לרשימה, וביטול על ידי הבעלים. שיתוף חוזר לאותו `(listId, phone)` **דורס** לינק פתוח קיים במקום להוסיף עליו. `phone: null` הוא קוד bearer מחלון ADR #38, שממשיך להיאכף בתנאיו החלשים עד שיפוג. ללא מיגרציה: כל ענף מתפצל על `invite.phone === null`.

**אין אינדקס מרוכב**: כל השאילתות על ה-collection הן `where("listId","==",…)` על שדה בודד, והסינון ל"פתוח" (`status` + `expiresAt`) נעשה בזיכרון — לרשימה יש לכל היותר `MAX_OPEN_INVITES` הזמנות חיות.

יצירת הזמנה חדשה לאותה `(listId, phone)` מבטלת הזמנה קודמת שטרם מומשה (`usedAt` מסומן), באותו דפוס כמו `createLinkCodeForUid` — לא נשאר יותר מ-credential חי אחד לאותו יעד. `where("listId","==",...)` בלבד וסינון בזיכרון, בלי אינדקס מרוכב.

מומלץ להגדיר **TTL policy** על `expiresAt` (כמו ב-`channelLinkCodes`) — הלוגיקה לא נשענת על זה, קוד פג נדחה בקוד גם אם המסמך קיים.

## `adminRoles/{uid}`
`src/types/adminRole.ts`, נגיש דרך `isAdminUid`/`requireAdmin` (`src/lib/auth/session.ts`), `docs/DECISIONS.md` ADR #42
```ts
{
  uid: string;
  role: "super_admin";   // עתידי: "support" | "read_only" — RBAC, לא בשימוש עדיין
  grantedBy: string;     // uid של המעניק, "system" ל-bootstrap
  grantedAt: Timestamp;
}
```
מסמך פנימי בלבד: `firestore.rules` חוסם קריאה וכתיבה מ-client לחלוטין, **כולל לאדמין עצמו** — אין נתיב client לכתוב אליו בכלל (כתיבת client הייתה מאפשרת self-grant). הענקה ראשונה (ולעת עתה יחידה) נעשית דרך `scripts/grant-admin.ts` (`npm run grant-admin -- <uid>`, Admin SDK). `isAdminUid(uid)` ב-`src/lib/auth/session.ts` עושה `get()` על doc זה — לא custom claim, כדי להימנע מעיכוב ריענון טוקן; ראו ADR #42 לרציונל המלא. `firestore.rules` כולל helper `isAdmin()` (`exists()` על doc זה) לשימוש עתידי, לא נצרך עדיין בשום match block אחר.

## `adminAuditLog/{entryId}`
`src/types/adminAuditLog.ts`, נכתב דרך `writeAdminAuditLog` (`src/lib/audit/adminLog.ts`), `docs/DECISIONS.md` ADR #42
```ts
{
  id: string;
  adminUid: string;
  targetUid: string | null;
  action: "role_grant" | "role_revoke" | "block" | "unblock" | "delete_scheduled" | "delete_immediate";
  reason: string | null;
  createdAt: Timestamp;
}
```
Append-only, נכתב רק מ-Admin SDK. נפרד במכוון מ-`auditLog` הקיים למעלה: `auditLog` הוא per-user (מיוצא עם המשתמש, נשאר גם אחרי מחיקתו) ולא בנוי לשאילתות חוצות-משתמשים; `adminAuditLog` הוא הלדג'ר הייעודי לפעולות שאדמין מבצע **על** משתמשים — נכתב לפני כל mutation (כמו `deleteUserAccount` הקיים). `firestore.rules` חוסם קריאה וכתיבה מ-client לחלוטין, כולל לאדמין (תצוגה עתידית בפאנל תעבור דרך Server Action).

## `userModeration/{uid}`
`src/types/userModeration.ts`, נגיש דרך `src/lib/services/moderation.ts` (קריאה/אכיפה) ו-`src/lib/services/adminModeration.ts` (מוטציות), `docs/DECISIONS.md` ADR #44
```ts
{
  uid: string;
  blocked: boolean;
  blockedReason: string | null;
  blockedAt: Timestamp | null;
  blockedBy: string | null;   // uid של האדמין שביצע את הפעולה האחרונה
  updatedAt: Timestamp;
}
```
נפרד במכוון מ-`users/{uid}`: ה-`update` rule הקיים על `users` לא מגביל שדות (`allow update: if isOwner(uid)`), אז שדה `blocked` שם היה מאפשר למשתמש חסום לבטל את עצמו בכתיבת client רגילה. `allow read, write: if false` לחלוטין, כולל לאדמין עצמו. מנגנון האכיפה הראשי הוא ברמת Firebase Auth (`adminAuth.updateUser(uid, {disabled:true})` + `revokeRefreshTokens`) — `verifySessionCookie(cookie, true)` הקיים (`src/lib/auth/session.ts`) כבר בודק `disabled`/revocation, כך שכל נתיב מבוסס-session (web, `mcp:cli`) נחסם אוטומטית ברגע החסימה. מסמך זה הוא ה-fallback לערוץ WhatsApp, שבו ה-`uid` נגזר מ-`channelLinks` בלי Firebase ID token בכלל (ADR #29) — `assertNotBlocked(uid)` נבדק שם (וגם ב-`POST /api/chat`/`mcp-cli.ts`, כהגנת-משנה) מיד לפני כל קריאת Claude.

## `blockedEmails/{email}`
`src/types/blockedEmail.ts`, נגיש דרך `src/lib/services/moderation.ts`/`adminModeration.ts`, `docs/DECISIONS.md` ADR #44
```ts
{
  email: string;        // lowercased, doc id זהה
  blockedReason: string | null;
  blockedAt: Timestamp;
  blockedBy: string;
}
```
חסימה פרואקטיבית של כתובת — לפני שקיים חשבון בכלל בשבילה. נבדק ב-`createSession` (`src/actions/auth.ts`) לפני מתן session cookie, כך שכתובת חסומה לא יכולה לקבל session אפילו בכניסה ראשונה. `allow read, write: if false` — קריאה מ-client הייתה הופכת את ה-collection ל-oracle ל"אילו כתובות חסומות". חסימת אימייל לחשבון קיים גם מבצעת עליו `disabled:true`+`revokeRefreshTokens` (superset שחוסם גם את החשבון הקיים).

## `blockedPhones/{e164}`
`src/types/blockedPhone.ts`, נגיש דרך `src/lib/services/moderation.ts`/`adminModeration.ts`, `docs/DECISIONS.md` ADR #44
```ts
{
  phone: string;         // E.164, doc id זהה — אותה צורה כמו channelLinks.externalId
  blockedReason: string | null;
  blockedAt: Timestamp;
  blockedBy: string;
}
```
חסימה פרואקטיבית של מספר — נבדק ב-`redeemLinkCode` (`src/lib/services/channelLinks.ts`) לפני יצירת קישור חדש, עם אותה הודעת כישלון גנרית כמו כל דחייה אחרת בפונקציה הזו (uniform-failure — שולח אנונימי לא יכול להבחין "קוד לא תקין" מ"מספר חסום"). `allow read, write: if false`. לא נוגע בחשבון Auth קיים — מספר טלפון לבדו אינו מזהה חשבון (ADR #29), רק `channelLinks` עושה זאת.

## `claudeUsageLog/{entryId}`
`src/types/claudeUsageLog.ts`, נכתב דרך `logClaudeUsage` (`src/lib/mcp/claudeUsageLog.ts`), `docs/DECISIONS.md` ADR #49
```ts
{
  id: string;
  uid: string;
  channel: "cli" | "web" | "whatsapp" | "telegram";  // AuditLogChannel
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  estimatedCostUsd: number;   // תמיד נגזר-מחדש-ניתן מהטוקנים — ראו למטה
  createdAt: Timestamp;
}
```
Append-only, **רשומה אחת לכל קריאת `messages.create()`** — לא רשומה אחת לכל הודעת משתמש: סבב עם tool calls מבצע כמה קריאות מודל בתוך אותו לולאת `runAgentTurn` (`src/lib/mcp/agentLoop.ts`), וכל אחת מהן מחויבת בנפרד. נכתב מנקודה משותפת יחידה בתוך `runAgentTurn` עצמו (לא משוכפל בשלושת קוראיו — `channelChat.ts`/`route.ts`/`mcp-cli.ts`), אותו עיקרון כמו `withToolExecution` ל-audit log של tool calls.

**למה בכלל — Anthropic לא רואה את ה-`uid` שלנו**: ה-Admin API הרשמי של Anthropic (Usage & Cost reports) שובר לפי `api_key_id`/`workspace_id`/`model`, לא לפי מזהה אפליקטיבי מותאם — ואומת ישירות מול המסמכים הרשמיים לפני המימוש. הפרויקט ניגש ל-Claude דרך WIF (service account אחד, לא API key per user — ADR #20), כך שגם אין שם "פרוקסי" של key-per-user לנצל. פילוח פר-`uid` חייב תיעוד עצמי בצד שלנו; אין דרך לקבל אותו מ-Anthropic בשום צורה.

**`estimatedCostUsd` הוא הערכה, לא חשבונית**: מחושב ב-`src/lib/mcp/pricing.ts` מטבלת תמחור סטטית (מחיר ל-1M טוקן לפי המודל, `MODEL_ID`) + מכפילי cache read/write מתועדים (~0.1x / ~1.25x ממחיר ה-input) — קירוב שמתועד ככזה, לא תעריף רשמי פר-מודל. שדות הטוקנים הגולמיים הם מקור האמת; `estimatedCostUsd` הוא תמונת מצב שנחשבה בזמן הכתיבה ועלולה לסטות אם התמחור ישתנה — לא לסמוך עליה למשהו מעבר לקריאה מהירה. הצלבה מול העלות האמיתית (אם נדרש) עוברת דרך ה-Admin API הרשמי של Anthropic (curl-only, לא ב-SDK), לא דרך המספר הזה.

**כתיבה שלעולם לא זורקת**: `logClaudeUsage` בולעת שגיאות כתיבה (`console.error` בלבד) — בניגוד ל-`writeAuditLog` הקיים, שהכישלון שלו כן מפיל את קריאת ה-tool שקראה לו. זהו לדג'ר חשבונאי, לא לדג'ר אבטחה/ציות; הפסקת שיחה עם משתמש בגלל תקלת רישום עלות היא עלות גבוהה יותר מרשומת עלות חסרה.

**כתיבה לא-חוסמת ביחס לתשובה למשתמש**: הכתיבה **מופעלת** (לא `await`-ת) מיד אחרי כל `response = await client.beta.messages.create()`, לפני `onText`/המשך הלולאה — כך שהיא לא מעכבת את הטקסט שמגיע למשתמש (רלוונטי בעיקר ב-`/api/chat`, ששולח כל בלוק טקסט ל-NDJSON stream ברגע שהוא זמין). כל הכתיבות הממתינות נאספות ו-`await`-ות יחד ב-`finally` של `runAgentTurn`, לפני שהפונקציה חוזרת — גם בנתיב שגיאה — כדי שכתיבה לא תיזרק "בשקט" ברקע בסביבת serverless (Cloud Functions ל-webhook הוואטסאפ) שעלולה להקפיא את התהליך ברגע שהתשובה כבר נשלחה.

`firestore.rules`: `allow read, write: if false` לחלוטין — כולל לבעלים, בשונה מ-`auditLog` (`allow read: if isExistingOwner()`) — אין כרגע פיצ'ר משתמש שצריך לראות את זה, ותצוגת האדמין עוברת Admin SDK ממילא.

**דורש אינדקס מרוכב** `uid ASC, estimatedCostUsd ASC`: `getClaudeUsageSummaryForUid` (`src/lib/services/adminClaudeUsage.ts`) עושה `where("uid","==",uid)` עם `aggregate()` (`count()`+`sum("estimatedCostUsd")`). בניגוד ל-`count()`, אגרגציית `sum()`/`average()` חייבת לקרוא את השדה המסוכם מתוך האינדקס עצמו — ולכן האינדקס האוטומטי על `uid` לבדו **לא** מספיק ברגע שמשלבים `where()` עם `sum()`. הצהרה מקורית שגויה כאן ("מכוסה אוטומטית") הפילה את דף המשתמש באדמין ב-500 בפרודקשן; ראו את הפוסט-מורטם ב-`docs/DEPLOYMENT.md`.

## מחיקה יזומה ע"י אדמין (Phase 9.4, ADR #45)
אין collection חדש. מחיקה מתוזמנת (`src/lib/services/adminDeletion.ts`, `scheduleUserDeletion`/`cancelUserDeletion`) כותבת לאותו שדה קיים `users/{uid}.deletionRequestedAt` (Phase 4.2, ראו למעלה) דרך ה-Admin SDK — אותו grace period, אותו `deleteExpiredAccounts` sweep, בלי מנגנון תזמון מקביל. מחיקה מיידית קוראת ישירות ל-`deleteUserAccount()` הקיים (`functions/src/accountDeletion.ts`) מתוך Cloud Function `onCall` חדש (`functions/src/adminActions.ts`, `adminDeleteUserNow`) — שני נתיבי המחיקה (sweep מתוזמן ומחיקה מיידית ע"י אדמין) מתכנסים לאותה פונקציית cascade-delete יחידה, בלי שכפול לוגיקה. שלוש הפעולות (`delete_scheduled`/`delete_cancelled`/`delete_immediate`) נכתבות ל-`adminAuditLog` לפני הפעולה עצמה.

## אינדקסים מרוכבים (`firestore.indexes.json`)
- `cards`: `ownerId ASC, expiryDate ASC` — דוחות "עומד לפוג"
- `cards`: `ownerId ASC, status ASC, createdAt DESC` — רשימת כרטיסים לפי סטטוס
- `cards`: `listId ASC, createdAt DESC` — שליפת כרטיסים לפי הרשימות הנגישות למשתמש (`useCards`, כולל רשימות משותפות), ראו `docs/DECISIONS.md` #15
- `cardLists`: `ownerId ASC, createdAt ASC` — שאילתת רשימות המשתמש (`useCardLists`)
- `members` (collection group): `memberUid ASC, status ASC` — "השיתופים/ההזמנות שלי" על פני רשימות של בעלים שונים (`useCardLists`, `usePendingInvitations`), ראו `docs/DECISIONS.md` #15
- `usageLog` (collection group): `ownerId ASC, date DESC` — יומן שימושים גלובלי למשתמש
- `claudeUsageLog`: `uid ASC, estimatedCostUsd ASC` — אגרגציית `count()`+`sum()` לעלות Claude פר-משתמש בפאנל הניהול (`getClaudeUsageSummaryForUid`)

## אינדקסי שדה־בודד ב-collection group (`fieldOverrides`)
Firestore יוצר אינדקס single-field אוטומטי לכל שדה — **אבל רק ב-collection scope**. שאילתת `collectionGroup` על שדה בודד (בלי `where` שני שמפעיל אינדקס מרוכב) דורשת הצהרה מפורשת, אחרת היא נכשלת ב-`FAILED_PRECONDITION` בפרודקשן. ראו `docs/DECISIONS.md` #33.

- `members.memberUid` — `COLLECTION_GROUP ASC`, בשביל `where("memberUid","==",uid)` **בלי** `status`. שני צרכנים: `buildUserDataExport` (ייצוא חייב לכלול גם הזמנות pending) ו-`functions/src/accountDeletion.ts` (מחיקה חייבת למחוק גם אותן). כל שאר השאילתות על `members` מסננות `status` ולכן מוגשות ע"י האינדקס המרוכב שלמעלה.

**חשוב**: `fieldOverride` **מחליף** את האינדוקס האוטומטי של אותו שדה, ולא מתווסף אליו. לכן הרשומה מצהירה במפורש גם על `COLLECTION ASC/DESC` — השמטתם הייתה שוברת דווקא את השאילתות שכן עבדו. אימות אחרי הפריסה (`gcloud firestore indexes fields list`) הראה את שלושת האינדקסים במצב `CREATING`, כולל השניים שהיו קודם מכוסים ע"י ה-wildcard `__default__` — כלומר ההחלפה אכן מתרחשת, לא תוספת.

ברירת המחדל של ה-wildcard כוללת גם `arrayConfig: CONTAINS`, ו-**הרשומה הזו משמיטה אותו במכוון**: `memberUid` הוא uid, לעולם לא מערך, ו-`array-contains` עליו חסר משמעות. אם אי פעם ישתנה לשדה מערך — צריך להוסיף אותו לרשומה, אחרת השאילתה תיכשל בדיוק כמו זו שה-ADR הזה מתאר.

**האמולטור לא יתפוס חוסר כזה**: הוא בונה אינדקס לכל שאילתה שמגיעה אליו, ולכן `npm run test:e2e` יעבור גם כשהאינדקס חסר בפרודקשן. הבדיקה היחידה שתופסת את זה היא לוודא שלכל `collectionGroup(` בקוד יש התאמה כאן — נכון להיום יש שש כאלה (`useCardLists`, `usePendingInvitations`, `cardLists.ts`, `cards.ts`, `export.ts`, `accountDeletion.ts`).

**שים לב**: סינון הכרטיסים בתוך רשימה ספציפית (`/cards/lists/[listId]`) נעשה בצד לקוח (`cards.filter(c => c.listId === listId)`) על תוצאות `useCards` הקיים, לא ע"י שאילתת Firestore נוספת עם `where("listId", "==", ...)` — כך נמנע אינדקס מורכב נוסף (`ownerId + listId + createdAt`). סביר להסתמך על כך כל עוד מספר הכרטיסים למשתמש קטן (שימוש אישי); אם זה ישתנה, יש להוסיף את השאילתה+אינדקס בהתאם.

## עדכון יתרה
כל כתיבת usage entry חייבת לקרות בתוך `runTransaction`: קריאת `currentBalance` הנוכחי → חישוב → עדכון אטומי + כתיבת ה-entry החדש. מונע race conditions ממספר מכשירים/טאבים בו-זמנית. מיושם ב-`src/actions/usage.ts` (Phase 1).

עדכון יתרה **ידני** (ללא usage entry, Phase 3) — `src/actions/balance.ts` (`updateCardBalance`): גם הוא `runTransaction` + Server Action (עקביות עם ההחלטה למעלה ועם `docs/DECISIONS.md` #3/#11), אך לא כותב ל-`usageLog` בכלל — מיועד לתיקוני יתרה (למשל אימות מול בית העסק), לא לרישום הוצאה.
