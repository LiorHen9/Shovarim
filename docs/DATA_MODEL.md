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
  ownerId: string;              // immutable אחרי create
  name: string;
  categoryId: string | null;
  tags: string[];
  initialBalance: number;
  currentBalance: number;       // מעודכן רק בתוך Firestore Transaction
  currency: string;
  expiryDate: Timestamp | null;
  purchaseDate: Timestamp | null;
  cardImageUrl: string | null;
  barcodeOrCode: string | null;
  status: "active" | "expired" | "depleted" | "archived";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

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
  createdBy: string;              // == ownerId היום; מוכן לעתיד multi-user per card
}
```
**אין update/delete** — ראה `firestore.rules`. תיקון טעות = רשומת correction חדשה, לא עריכה בדיעבד.

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
GDPR consent tracking.
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
Append-only, נכתב רק מ-Admin SDK (Cloud Functions). אירועים: login, export, deletion request/completion, שינוי הרשאות.

## אינדקסים מרוכבים (`firestore.indexes.json`)
- `cards`: `ownerId ASC, expiryDate ASC` — דוחות "עומד לפוג"
- `cards`: `ownerId ASC, status ASC, createdAt DESC` — רשימת כרטיסים לפי סטטוס
- `usageLog` (collection group): `ownerId ASC, date DESC` — יומן שימושים גלובלי למשתמש

## עדכון יתרה
כל כתיבת usage entry חייבת לקרות בתוך `runTransaction`: קריאת `currentBalance` הנוכחי → חישוב → עדכון אטומי + כתיבת ה-entry החדש. מונע race conditions ממספר מכשירים/טאבים בו-זמנית. מיושם ב-`src/actions/usage.ts` (Phase 1).
