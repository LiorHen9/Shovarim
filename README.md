# Shovarim — ניהול שוברים וכרטיסי מתנה

אפליקציית ווב לניהול כרטיסי מתנה ושוברים: יתרה, תוקף, יומן שימושים, קטגוריות, התראות תפוגה, דוחות. Next.js + Firebase.

לתיעוד מלא (ארכיטקטורה, מודל נתונים, אבטחה, פרטיות, roadmap) ראו [`CLAUDE.md`](./CLAUDE.md) ותיקיית [`docs/`](./docs).

## התחלה מהירה

```bash
npm install
npm run dev
```

האפליקציה עולה מול Firebase Emulators כברירת מחדל (`.env.local`, project id `demo-shovarim`) — לא נדרש חשבון Firebase אמיתי לפיתוח מקומי.

להרצת ה-emulators (Firestore/Storage דורשים Java מותקן):

```bash
npx firebase emulators:start
```

לחיבור לפרויקט Firebase אמיתי: מלאו `.env.example` והריצו `firebase login && firebase use --add`.

## פקודות עיקריות

| פקודה | מטרה |
|---|---|
| `npm run dev` | dev server |
| `npm run typecheck` | בדיקת טיפוסים |
| `npm run lint` | ESLint |
| `npm run build` | build לפרודקשן |
