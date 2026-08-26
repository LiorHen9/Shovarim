@AGENTS.md

# Shovarim — ניהול שוברים וכרטיסי מתנה

Entry point ל-context של הפרויקט. טען קבצים נוספים מ-`docs/` רק כשרלוונטי למשימה — כל קובץ ממוקד בנושא אחד כדי לחסוך טוקנים.

## Stack
Next.js 16 (App Router, React 19, TypeScript strict) + Firebase (Firestore, Auth, Storage, Cloud Functions, FCM) + shadcn/ui (Radix base) + Tailwind v4 + Zod + react-hook-form. RTL/עברית כברירת מחדל (`dir="rtl"`, `lang="he"`, פונט Heebo).

## פקודות
| פקודה | מטרה |
|---|---|
| `npm run dev` | dev server (Turbopack), `http://localhost:3000` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | production build |
| `npx firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data` | Firestore/Auth/Storage/Functions emulators עם שמירת דאטה בין הרצות — דורש Java (JRE), כבר מותקן |
| `npm run test:rules` | 19 Security Rules unit tests (`tests/rules/`) — **דורש Firestore emulator רץ** (`firebase emulators:start --only firestore`) |
| `npm run seed:categories` | זריעת קטגוריות ברירת מחדל (Admin SDK, נגד emulator לפי `.env.local`) |
| `npm --prefix functions run build` | קומפילציית Cloud Functions |

## מיפוי docs/
- `docs/ARCHITECTURE.md` — data flow, client vs Admin SDK, מבנה תיקיות. טען לשינויים מבניים.
- `docs/DATA_MODEL.md` — schema מלא של Firestore collections, אינדקסים. טען לעבודה על queries/schema.
- `docs/SECURITY.md` — Security Rules, threat model, secrets. טען לעבודה על Rules/הרשאות.
- `docs/PRIVACY.md` — GDPR/פרטיות, PII mapping, consent/export/deletion flows. טען לעבודה על legal/privacy features.
- `docs/FEATURES.md` — סטטוס פיצ'רים (ממומש/מתוכנן).
- `docs/ROADMAP.md` — שלבי עבודה, מה הושלם. טען בתחילת session כדי לדעת "איפה אנחנו".
- `docs/DECISIONS.md` — ADR log. **בדוק לפני החלטה ארכיטקטונית חדשה** אם כבר הוחלט.
- `docs/ACCESSIBILITY.md` — checklist WCAG 2.1 AA ספציפי לפרויקט.

## עקרונות עבודה קבועים
- **Next.js 16 שינה מוסכמות מ-training data** (ראה `AGENTS.md` בשורש) — לדוגמה `middleware.ts` הוחלף ב-`src/proxy.ts` (פונקציה `proxy`, לא `middleware`). לפני שימוש ב-API של Next שלא נבדק כאן, לבדוק מול `node_modules/next/dist/docs/`.
- כל שינוי ארכיטקטוני/פיצ'ר משמעותי → לעדכן את קובץ ה-`docs/` הרלוונטי (במיוחד `DECISIONS.md`, `FEATURES.md`, `ROADMAP.md`) כדי שהתיעוד לא יתיישן.
- Admin SDK (`src/lib/firebase/admin.ts`) — רק בקוד server-side (Server Actions, Cloud Functions). לעולם לא import מ-Client Component (מוגן ב-`server-only`).
- כל collection/subcollection חדש ב-Firestore → קודם לעדכן `firestore.rules` (deny-by-default) ו-`docs/DATA_MODEL.md`.
- הוספת auth provider (כמו Apple) → דרך `src/lib/auth/` בלבד (ראה abstraction ב-`authService.ts`/`providers.ts`), ללא שינוי בקוד UI.
- טפסים חדשים → Zod schema משותף ב-`src/lib/validation/` (client + server), react-hook-form, נגישות מלאה (label מקושר, שגיאות עם `aria-describedby`).
