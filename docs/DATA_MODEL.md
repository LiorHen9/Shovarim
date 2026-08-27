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
  email: string;                 // snapshot של המייל שהוזמן, לתצוגה
  role: "manager" | "viewer";
  status: "pending" | "accepted";
  invitedBy: string;             // uid של בעל הרשימה
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```
שיתוף רשימה — ראו `docs/DECISIONS.md` #15. doc id תמיד שווה ל-`memberUid`, נוצר על ידי `inviteListMember` (`src/actions/listShare.ts`, Admin SDK מפענח אימייל ל-uid). "מנהל" מאושר (`status:"accepted"`) יכול לנהל כרטיסים ברשימה כמו הבעלים; "צופה" מאושר יכול רק לקרוא. כרטיסים שנוצרים דרך שיתוף עדיין נכתבים עם `ownerId` של בעל הרשימה (לא של היוצר בפועל) — ראו הערה ב-`cards` למעלה וב-`usageLog.createdBy` למטה.

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
  eventType: "mcp_tool_call" | "login" | "export" | "deletion_request" | "deletion_cancelled" | "deletion_completed" | "permission_change";
  tool: string | null;          // שם ה-MCP tool (למשל "listCards"), null לאירועים שאינם tool call
  channel: "cli" | "web" | "whatsapp" | "telegram" | null;
  paramsSummary: string | null; // תקציר פרמטרים ללא סודות (לא cvv/barcodeOrCode/tokens) — לא ה-input הגולמי
  result: "success" | "error";
  createdAt: Timestamp;
}
```
Append-only, נכתב רק מ-Admin SDK דרך `writeAuditLog` המשותפת (`src/lib/audit/log.ts`) — קרויה גם משרת ה-MCP המקומי ב-`mcp-server/` (`mcp_tool_call`, ראו `docs/ROADMAP.md` שלב 5.1) וגם מ-Server Actions ב-`src/actions/` (`export`/`deletion_request`/`deletion_cancelled`, ראו Phase 4.1/4.2). `deletion_completed` נכתב ישירות מ-`functions/src/accountDeletion.ts` (Admin SDK עצמאי, לא דרך `writeAuditLog` המשותפת — ראו `docs/DECISIONS.md` #24 לגבי הפרדת `functions/` מ-`src/`). `login`/`permission_change` עדיין לא נכתבים על ידי אף קוד קיים — יתווספו בשלבים העתידיים שמפיקים אותם.

## `rateLimits/{uid}`
`src/lib/services/rateLimit.ts` (אין type ייעודי — נגיש רק דרך `checkAndConsumeRateLimit`, לא נקרא ישירות במקום אחר)
```ts
{
  windowStart: Timestamp;
  count: number;
}
```
מכסת קריאות tool קבועה (`RATE_LIMIT_MAX_CALLS`/`RATE_LIMIT_WINDOW_MS`, `src/lib/mcp/config.ts`) פר-`uid`, fixed window, נאכפת בתוך `runTransaction` סביב כל קריאת tool דרך ה-wrapper `withToolExecution` ב-`mcp-server/index.ts` (ראו `docs/ROADMAP.md` שלב 5.3, `docs/DECISIONS.md` ADR #21). מסמך פנימי בלבד — נכתב ונקרא רק מ-Admin SDK, `firestore.rules` חוסם קריאה/כתיבה מ-client לגמרי (אין UI שמציג את המכסה כרגע).

## אינדקסים מרוכבים (`firestore.indexes.json`)
- `cards`: `ownerId ASC, expiryDate ASC` — דוחות "עומד לפוג"
- `cards`: `ownerId ASC, status ASC, createdAt DESC` — רשימת כרטיסים לפי סטטוס
- `cards`: `listId ASC, createdAt DESC` — שליפת כרטיסים לפי הרשימות הנגישות למשתמש (`useCards`, כולל רשימות משותפות), ראו `docs/DECISIONS.md` #15
- `cardLists`: `ownerId ASC, createdAt ASC` — שאילתת רשימות המשתמש (`useCardLists`)
- `members` (collection group): `memberUid ASC, status ASC` — "השיתופים/ההזמנות שלי" על פני רשימות של בעלים שונים (`useCardLists`, `usePendingInvitations`), ראו `docs/DECISIONS.md` #15
- `usageLog` (collection group): `ownerId ASC, date DESC` — יומן שימושים גלובלי למשתמש

**שים לב**: סינון הכרטיסים בתוך רשימה ספציפית (`/cards/lists/[listId]`) נעשה בצד לקוח (`cards.filter(c => c.listId === listId)`) על תוצאות `useCards` הקיים, לא ע"י שאילתת Firestore נוספת עם `where("listId", "==", ...)` — כך נמנע אינדקס מורכב נוסף (`ownerId + listId + createdAt`). סביר להסתמך על כך כל עוד מספר הכרטיסים למשתמש קטן (שימוש אישי); אם זה ישתנה, יש להוסיף את השאילתה+אינדקס בהתאם.

## עדכון יתרה
כל כתיבת usage entry חייבת לקרות בתוך `runTransaction`: קריאת `currentBalance` הנוכחי → חישוב → עדכון אטומי + כתיבת ה-entry החדש. מונע race conditions ממספר מכשירים/טאבים בו-זמנית. מיושם ב-`src/actions/usage.ts` (Phase 1).

עדכון יתרה **ידני** (ללא usage entry, Phase 3) — `src/actions/balance.ts` (`updateCardBalance`): גם הוא `runTransaction` + Server Action (עקביות עם ההחלטה למעלה ועם `docs/DECISIONS.md` #3/#11), אך לא כותב ל-`usageLog` בכלל — מיועד לתיקוני יתרה (למשל אימות מול בית העסק), לא לרישום הוצאה.
