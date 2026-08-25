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

## Phase 1 — MVP ✅ הושלם (2026-08-25)
- Google Sign-In מלא (popup → ID token → Server Action `createSession` יוצרת session cookie `__session` + `users/{uid}` ב-first login)
- `src/proxy.ts` (לא `middleware.ts` — ראה `docs/DECISIONS.md` #8) מגן על `(protected)` ברמת fast-path, אימות מלא ב-`(protected)/layout.tsx`
- CRUD כרטיסים מלא (create/list/edit/archive) דרך client SDK + Security Rules
- Usage log: `src/actions/usage.ts` (Server Action, Admin SDK transaction) — מונע overdraft, מעדכן `currentBalance` אטומית
- Categories: system defaults, נזרעות דרך `npm run seed:categories`
- Security Rules מלאות + 19 טסטים ב-`tests/rules/firestore.test.ts` (`npm run test:rules`) — כולם עוברים מול Firestore emulator
- Consent banner (חוסם UI עד הסכמה) + Privacy Policy + Terms pages אמיתיים
- Layout רספונסיבי בסיסי (Header + nav + dropdown משתמש)
- אימות: `typecheck`/`lint`/`build` נקיים, dev server + emulators נבדקו יחד (proxy redirect, דפים ציבוריים) ידנית דרך curl

**נשאר לבדוק ידנית (לא אוטומטי עדיין)**: זרימת Google sign-in אמיתית בדפדפן (לא נבדקה עם browser automation — Playwright עדיין לא מותקן, ראו Phase 6/verification gap).

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
