# ROADMAP

עדכון בתחילת כל session: מה הושלם, מה הבא. פירוט פיצ'ר-אחר-פיצ'ר ב-`docs/FEATURES.md`.

## Phase 0 — Infrastructure ✅ הושלם (2026-08-25)
- Next.js 16 scaffold (TypeScript strict, App Router, Tailwind v4)
- shadcn/ui init עם `--rtl`, קומפוננטות בסיס (button/input/label/card/dialog/dropdown-menu/sonner/badge/select/popover/calendar/avatar/separator/skeleton)
- Firebase config: `firebase.json`, `.firebaserc` (demo project), `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- `src/lib/firebase/{client,admin}.ts`, `src/lib/auth/{authService,providers,googleProvider}.ts`
- טיפוסים (`src/types/`) + Zod schemas (`src/lib/validation/`) עבור cards/usageLog
- `docs/*.md` + root `CLAUDE.md`
- אימות: `npm run dev`/`typecheck`/`lint` נקיים, `npm --prefix functions run build` נקי
- Eclipse Temurin JRE 21 הותקן (winget), Firestore+Auth+Storage emulators נבדקו ועולים יחד ללא שגיאות קומפילציה ב-`firestore.rules`/`storage.rules`

**Still open before Phase 1 sign-off**: `@firebase/rules-unit-testing` טסטים אוטומטיים (isolation בין משתמשים, immutability של usageLog) עדיין לא נכתבו — רק נבדק שה-rules עולות בלי שגיאת syntax.

## Phase 1 — MVP (הבא)
- Google Sign-In מלא (popup + session cookie + middleware הגנה על `(protected)`)
- יצירת `users/{uid}` ב-first login
- CRUD כרטיסים מלא (create/list/edit/archive)
- Usage log: הוספת שימוש עם עדכון `currentBalance` אטומי (Firestore Transaction)
- Categories: system defaults בלבד
- Security Rules מלאות + rules-unit-testing (תלוי בהתקנת Java)
- Consent banner + Privacy Policy page (בסיסי אך אמיתי)
- Layout רספונסיבי בסיסי

## Phase 2 — Media & Enrichment
תמונות כרטיס/קבלות (Storage), custom categories/tags, שיפור נגישות טפסים.

## Phase 3 — Notifications
Cloud Function מתוזמן לתזכורות תפוגה, FCM push, email (Firebase Extension / Resend).

## Phase 4 — Reports & Analytics
דשבורד יתרות/תפוגות/מגמות, אגרגציות מחושבות server-side (לא client-side על datasets גדולים).

## Phase 5 — Privacy Hardening
Export מלא, מחיקת חשבון מלאה (grace period), audit log, App Check, security review מקיף.

## Phase 6 — PWA & Polish
manifest, service worker, offline indicators, ביצועים.

## Phase 7 — Apple Sign-In
כש-Apple Developer Account זמין: `appleProvider.ts` + הוספה ל-`SUPPORTED_PROVIDERS`. שאר הקוד לא אמור להשתנות.
