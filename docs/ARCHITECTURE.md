# ARCHITECTURE

## סקירה
Shovarim הוא Next.js App Router app שמדבר עם Firebase. שתי דרכים לגשת לנתונים, בכוונה:

1. **Client SDK** (`src/lib/firebase/client.ts`) — משמש ברכיבי client (`"use client"`) לקריאה/כתיבה בזמן אמת (`onSnapshot`), תמיד תחת Firestore/Storage **Security Rules**. זה נתיב הכתיבה הרגיל למשתמש (יצירת כרטיס, הוספת usage entry).
2. **Admin SDK** (`src/lib/firebase/admin.ts`) — משמש **רק** מ-Server Actions וב-Cloud Functions (`functions/`), עוקף Security Rules לגמרי. שמור לפעולות שדורשות הרשאות מיוחדות: ייצוא/מחיקת נתוני משתמש, כתיבת `auditLog`, ניהול `reminders`/`categories` system-default. אף פעם לא נטען ל-client — מוגן בפועל ע"י `import "server-only"` בראש הקובץ.

Defense in depth: Rules הן קו ההגנה הראשון (חלות תמיד על client SDK), Server Actions הקריטיות מוסיפות ולידציית Zod נוספת לפני קריאה ל-Admin SDK.

## Data Flow — יצירת כרטיס (Client SDK path)
```
Component (client) → react-hook-form + zod (createCardSchema) →
  Firestore addDoc() דרך client SDK → Security Rules בודקות ownerId → מסמך נכתב
```

## Data Flow — מחיקת חשבון (Admin SDK path)
```
Server Action (privacy.ts) → מאמת session → קורא ל-adminDb/adminAuth →
  מוחק subcollections + Storage files + Auth user → כותב auditLog
```

## Auth
`src/lib/auth/` הוא ה-abstraction layer מעל Firebase Auth (ראה `docs/DECISIONS.md` #2). זרימה: כפתור Google (client) → `signInWithRedirect` (ניווט מלא, לא popup — `docs/DECISIONS.md` #34) → חזרה לאותו עמוד → `getRedirectResult` → `user.getIdToken()` → Server Action `createSession` (`src/actions/auth.ts`) מאמתת את ה-token, יוצרת session cookie בשם `__session` (Admin SDK, `docs/DECISIONS.md` #9), ומוודאת קיום `users/{uid}`. `src/proxy.ts` — **לא** `middleware.ts`, ראה `docs/DECISIONS.md` #8 — בודק רק שהעוגייה קיימת (fast path); האימות המלא (`adminAuth.verifySessionCookie`) קורה ב-`app/(protected)/layout.tsx`.

## מבנה תיקיות
```
src/
  app/(public)/       # דף נחיתה, הזמנה לרשימה — נגיש בלי אימות
  app/(public)/(legal)/  # accessibility, privacy, terms — layout שמוסיף Header ציבורי (ADR #58)
  app/(protected)/    # dashboard, cards, reports, settings — מוגן ע"י middleware
  components/ui/      # shadcn/ui generated components (Radix base, RTL logical properties)
  components/{cards,usage,auth,legal,layout}/  # קומפוננטות ספציפיות למוצר
  lib/firebase/       # client.ts, admin.ts, converters.ts
  lib/auth/           # provider abstraction
  lib/validation/      # Zod schemas משותפים
  types/               # טיפוסי TypeScript תואמים ל-DATA_MODEL.md
  actions/             # Server Actions
  hooks/               # useAuth, useCards וכו'
functions/             # Cloud Functions — package נפרד עם package.json/tsconfig משלו
```

## Firebase services בשימוש
Firestore (native mode), Auth, Storage, Cloud Functions (2nd gen), Cloud Messaging (web push), Firebase App Hosting (production, מ-Phase 3.3 — ראה `docs/DEPLOYMENT.md` ו-`docs/DECISIONS.md` #16).

## סביבת פיתוח מקומית
`.env.local` מוגדר כברירת מחדל מול Firebase Emulators בלבד (`demo-shovarim` — project id שמור של Firebase לשימוש emulator-only, לא דורש חשבון GCP אמיתי). לחיבור לפרויקט Firebase אמיתי: למלא את `.env.example` (client config + service account) וליצור `.env.local` חדש, ולהריץ `firebase login && firebase use --add`.

**דרישת סביבה**: Firestore/Storage emulators רצים על JVM — נדרש Java (JRE) מותקן ונגיש ב-PATH. Auth emulator עובד גם בלעדיו.
