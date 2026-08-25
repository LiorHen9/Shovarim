# DECISIONS (ADR log)

בדוק כאן לפני שינוי החלטה ארכיטקטונית קיימת. פורמט: תאריך, החלטה, נימוק, אלטרנטיבות שנשקלו.

## 1. Top-level collections עם `ownerId`, לא `/users/{uid}/cards/...`
**תאריך**: 2026-08-25
**החלטה**: `cards`, `usageLog` (כ-subcollection של card, לא top-level), `categories` וכו' הם top-level collections עם שדה `ownerId`, לא מקוננים תחת `/users/{uid}/`.
**נימוק**: מאפשר collection-group queries עתידיות (dashboard admin, ניתוח cross-user בעתיד) בלי restructuring. עלות: Security Rules חייבות לבדוק `ownerId` בכל מסמך במקום להסתמך על מבנה הנתיב.
**אלטרנטיבה שנשקלה**: nested collections תחת `/users/{uid}/` — יותר "טבעי" ל-isolation אבל נועל את המבנה.

## 2. Auth provider abstraction layer
**תאריך**: 2026-08-25
**החלטה**: `src/lib/auth/authService.ts` עוטף Firebase Auth; `SUPPORTED_PROVIDERS` (`providers.ts`) קובע אילו providers מוצגים ב-UI. היום: `["google"]` בלבד.
**נימוק**: המשתמש רוצה Google+Apple, אבל אין עדיין Apple Developer Account ($99/שנה). הפתרון: לתכנן את ה-abstraction עכשיו כדי שהוספת Apple בעתיד (Phase 7) לא תדרוש refactor — רק מימוש `appleProvider.ts` + הוספה למערך.
**אלטרנטיבה שנדחתה**: לחכות עם כל ה-auth work עד שיש Apple account — נדחה כי זה יגרום ל-refactor מיותר בהמשך.

## 3. עדכון יתרה תמיד בתוך Firestore Transaction
**תאריך**: 2026-08-25
**החלטה**: כל כתיבת `usageLog` entry מעדכנת `cards.currentBalance` בתוך `runTransaction` יחיד (קריאה+חישוב+כתיבה אטומית), לא בשתי כתיבות נפרדות.
**נימוק**: מונע race condition אם המשתמש כותב מכמה מכשירים/טאבים בו-זמנית — יתרה היא הנתון הכי קריטי לנכונות באפליקציה כזו.

## 4. `usageLog` immutable — אין update/delete
**תאריך**: 2026-08-25
**החלטה**: Security Rules אוסרות `update`/`delete` על usage entries קיימים. תיקון טעות = רשומת correction חדשה.
**נימוק**: יומן שימושים הוא audit trail פיננסי במהותו — שמירה על שלמות ההיסטוריה עדיפה על נוחות עריכה.

## 5. Hosting/Deployment strategy — נדחה במפורש
**תאריך**: 2026-08-25
**החלטה**: `firebase.json` לא כולל כרגע config ל-`hosting` — הוסר מה-scaffold הראשוני.
**נימוק**: Server Actions דורשים SSR runtime, לא static export. שתי אופציות תקפות ל-Next.js על Firebase: (א) Firebase App Hosting (מודרני, git-based, מיועד ל-Next.js SSR) או (ב) Firebase Hosting + web frameworks integration (Cloud Functions/Cloud Run מתחת למכסה). ההחלטה בין השתיים נדחית ל-Phase 6 (Deploy/Polish) כשיהיה קוד אמיתי לבדוק מולו — לא לקבע config שעלול להיות שגוי.

## 6. GDPR + חוק הגנת הפרטיות הישראלי — baseline מהיום הראשון
**תאריך**: 2026-08-25
**החלטה**: Consent, Privacy Policy, data export/deletion flows נבנים כבר ב-Phase 1/5, לא נדחים ל"אחרי שיהיו הרבה משתמשים".
**נימוק**: בקשה מפורשת של המשתמש — האפליקציה נבנית מהיום הראשון מפרספקטיבת שימוש רחב, גם אם השימוש הראשוני אישי.

## 7. `.env.local` דיפולטיבי מול Firebase Emulators (`demo-shovarim`)
**תאריך**: 2026-08-25
**החלטה**: הפרויקט מגיע עם `.env.local` מוכן מראש שמצביע על "demo-shovarim" (project id שמור של Firebase ל-emulator-only), לא על פרויקט GCP אמיתי.
**נימוק**: מאפשר `npm run dev` + emulators לעבוד מיד בלי שהמשתמש יצטרך לחבר קודם חשבון Firebase אמיתי. חיבור לפרויקט אמיתי הוא צעד מודע נפרד (`firebase login && firebase use --add` + מילוי `.env.example`).
