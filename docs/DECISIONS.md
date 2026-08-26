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

## 8. `proxy.ts` במקום `middleware.ts` (Next.js 16 breaking change)
**תאריך**: 2026-08-25
**החלטה**: הגנת routes מוגדרת ב-`src/proxy.ts` (פונקציה `proxy`), לא `src/middleware.ts`.
**נימוק**: Next.js 16 שינה את השם (deprecation, לא רק תוספת) — `middleware.ts` עדיין "עובד" אבל מדפיס אזהרת deprecation ב-build. הקובץ שנוצר על ידי `create-next-app` (`AGENTS.md`) מזהיר במפורש שזו גרסת Next.js עם breaking changes מול training data — ראינו זאת בפועל כאן. Proxy גם ברירת המחדל שלו היא Node.js runtime (לא Edge כמו middleware הישן), מה שהיה יכול לפשט העברת אימות מלא ל-proxy עצמו — נשארנו עם הפיצול המתועד (fast-path ב-proxy, אימות מלא ב-`(protected)/layout.tsx`) כדי לשמור על עקביות עם `docs/ARCHITECTURE.md` ולא להוסיף תלות ב-Admin SDK על כל בקשה.

## 9. Session cookie (`__session`) + provider-agnostic first-login bootstrap
**תאריך**: 2026-08-25
**החלטה**: התחברות client-side (Google popup) → `user.getIdToken()` → Server Action `createSession` שמאמת את ה-token, יוצרת session cookie בשם `__session` (14 יום, httpOnly), ויוצרת `users/{uid}` אם לא קיים (`ensureUserProfile`, לפי `decoded.firebase.sign_in_provider`).
**נימוק**: `__session` הוא שם העוגייה היחיד ש-Firebase Hosting מעביר ל-backend — אימוץ מוקדם למרות ש-Hosting נדחה (החלטה #5), כדי לא להצטרך migration של cookie name בעתיד. יצירת הפרופיל דרך `sign_in_provider` (לא פרמטר נפרד) עובדת אוטומטית גם עבור Apple כשיתווסף (Phase 7) בלי שינוי בקוד ה-bootstrap.

## 10. `usageLog` נכתב דרך Server Action (Admin SDK), לא client SDK
**תאריך**: 2026-08-25
**החלטה**: `src/actions/usage.ts` (`addUsageEntry`) הוא הנתיב היחיד להוספת שימוש — לא כתיבת client SDK ישירה כמו ביצירת כרטיס.
**נימוק**: מימוש בפועל של החלטה #3 — הטרנזקציה קוראת/מעדכנת `currentBalance` ומוסיפה entry באטומיות תוך אימות ownership ומניעת overdraft (`amount > currentBalance` נדחה), הכל בצד שרת עם Zod validation נוספת. Firestore Rules על `usageLog` (immutability, `amount > 0`) עדיין קיימות כהגנת defense-in-depth למקרה של נתיב client עתידי, אך אינן הנתיב הראשי היום.

## 11. עדכון יתרה ידני (Phase 3) — חריגה מפורשת ומצומצמת ל-#3/#4
**תאריך**: 2026-08-26
**החלטה**: נוסף נתיב שני, נפרד, לשינוי `cards.currentBalance`: `updateCardBalance` (`src/actions/balance.ts`) — Server Action עם `runTransaction`, אך **לא** יוצר רשומת `usageLog`. זמין מה-UI דרך `UpdateBalanceDialog` בעמוד פרטי הכרטיס, בנפרד מ-`AddUsageForm`.
**נימוק**: לפעמים היתרה בפועל אצל בית העסק שונה מהיתרה במערכת (למשל אחרי בירור טלפוני, או טעות הקלדה ביתרה ההתחלתית) בלי שהתרחשה "הוצאה" אמיתית שמצדיקה רשומת audit. כפיית רשומת usageLog מלאכותית לכל תיקון כזה הייתה פוגעת במשמעות ה-audit trail (החלטה #4) יותר משהייתה משמרת אותו.
**שמירה על העיקרון המקורי**: הנתיב עדיין Server Action בלבד (לא client SDK ישיר) עם `runTransaction` ובדיקת ownership/סטטוס archived — אותם invariants כמו ב-`addUsageEntry` (החלטה #10) — כדי שלא תיפתח דרך עוקפת פחות מאובטחת. ה-UI ממוקם בנפרד מטופס "הוספת שימוש" כדי שהמשתמש לא יבלבל בין השניים.
**אלטרנטיבה שנדחתה**: לאפשר עדכון יתרה כחלק מ-`editCardDetailsSchema` (טופס "עריכת פרטי כרטיס") — נדחה כי זה היה הופך שינוי פיננסי לפעולת עריכה "רגילה" לצד שם/תוקף, מטשטש את החשיבות שלו.

## 12. מחיקת רשומת `usageLog` — חריגה מפורשת ומצומצמת ל-#4
**תאריך**: 2026-08-26
**החלטה**: נוסף `deleteUsageEntry` (`src/actions/usage.ts`) — Server Action עם `runTransaction` היחיד שמורשה למחוק מסמך `usageLog`. מקבל `restoreBalance: boolean`; אם `true`, מחזיר את `entry.amount` ל-`currentBalance` של הכרטיס באותה טרנזקציה (ומעדכן `status` בחזרה מ-`depleted` ל-`active` לפי הצורך, כמו ב-`updateCardBalance`/#11). Firestore Rules על `usageLog` נשארות `allow update, delete: if false` — הן עדיין חוסמות כל נתיב client-side; ה-Server Action משתמש ב-Admin SDK שעוקף את ה-Rules, כמו בהחלטה #10.
**נימוק**: בקשה מפורשת של המשתמש למחוק שורות שגויות מיומן השימושים, כולל אפשרות לבחור אם למחוק גם עם החזרת הסכום ליתרה. שמירה על עקרון #4 (audit trail) הייתה חוסמת יכולת סבירה למשתמש למחוק טעות הקלדה; הפתרון שומר את העיקרון החשוב יותר (שהיתרה תמיד נכונה ומתעדכנת רק בטרנזקציה מאובטחת בצד שרת) תוך פתיחת חריגה מוגבלת וברורה, באותו דפוס כמו #11.
**אלטרנטיבה שנדחתה**: "מחיקה רכה" (soft delete, סימון `deleted: true` בלי מחיקה בפועל) — נדחה כרגע כי המשתמש ביקש מחיקה בפועל מהיומן, לא הסתרה; ניתן לשקול מחדש אם יידרש audit trail מלא בעתיד (Phase 5+).

## 13. רשימות כרטיסים — `listId` חובה על כל כרטיס, סינון בצד לקוח (לא שאילתה נוספת)
**תאריך**: 2026-08-26
**החלטה**: נוסף collection חדש `cardLists/{listId}` (top-level, `ownerId` — תואם החלטה #1). כל מסמך `cards` מקבל שדה חובה `listId` (לא nullable), נאכף הן ב-UI והן ב-`firestore.rules` (`create` דורש `listId is string && size() > 0`). הסינון של כרטיסים בתוך רשימה ספציפית (`/cards/lists/[listId]`) נעשה בצד לקוח על תוצאות ה-`useCards` הקיים (שכבר שולף את כל הכרטיסים של המשתמש ל-`/cards`), **לא** ע"י שאילתת Firestore נפרדת עם `where("listId","==",...)`.
**נימוק**: הוספת שאילתה עם `where("listId","==",...)` לצד `where("ownerId","==",...)` ו-`orderBy("createdAt")` הייתה דורשת אינדקס מורכב שלישי על `cards` (בנוסף לשניים הקיימים). מאחר שמדובר באפליקציית שימוש אישי עם מספר כרטיסים קטן יחסית למשתמש, סינון בצד לקוח על נתונים שכבר קיימים ב-`onSnapshot` הקיים פשוט יותר ונמנע מהאינדקס הנוסף; ניתן לעבור לשאילתה ייעודית אם מספר הכרטיסים למשתמש יגדל משמעותית.
**זרימת יצירה**: כשמשתמש מוסיף כרטיס והוא **הכרטיס הראשון שלו** (כלומר אין לו עדיין אף רשימה) — המערכת יוצרת אוטומטית רשימה ראשונית ("הרשימה שלי", `CardForm`) ומשייכת את הכרטיס אליה, בלי לשאול. בכל מקרה אחר (יש כבר רשימה אחת או יותר) — נדרשת בחירת רשימה מפורשת דרך `ListSelect` (כולל אפשרות "+ רשימה חדשה", אותו pattern כמו `CategorySelect`/`CreateCategoryDialog`).
**מחיקת רשימה**: מותרת מה-UI רק כשהרשימה ריקה (0 כרטיסים) — נבדק בצד לקוח לפני הקריאה ל-`deleteDoc`, לא ב-Security Rules (אין דרך פשוטה לבדוק "האם קיימים מסמכי cards עם listId זה" בתוך rule יחיד בלי collection-group query נוסף). המטרה: למנוע כרטיסים "יתומים" עם `listId` שמצביע לרשימה שלא קיימת.
**אלטרנטיבה שנדחתה**: לאפשר לכרטיס להיות בלי רשימה (`listId: string | null`) ולהציג "ללא רשימה" כברירת מחדל — נדחה כי המשתמש ביקש מפורשות שכל כרטיס ינוהל בתוך רשימה, וזה גם מפשט את ה-UI (אין צורך במסך "כרטיסים ללא רשימה" נפרד).

## 14. מחיקת כרטיס — מחיקה מלאה (לא ארכוב), cascade דרך Admin SDK
**תאריך**: 2026-08-26
**החלטה**: נוסף `deleteCard` (`src/actions/card.ts`) — Server Action שמאמת ownership ואז מריץ `adminDb.recursiveDelete(cardRef)` (מוחק את מסמך הכרטיס **וגם** את כל תת-האוסף `usageLog` שלו) ומוחק את קבצי ה-Storage תחת `users/{uid}/cards/{cardId}/` (`cardImage`+`receipts/*`) דרך `adminStorage.bucket().deleteFiles({ prefix })`. זמין מה-UI דרך `DeleteCardButton` (דיאלוג אישור) גם בשורת הכרטיס ב-`/cards/lists/[listId]` וגם בעמוד פרטי הכרטיס (שם מפנה בחזרה לרשימה אחרי מחיקה מוצלחת).
**נימוק**: זו פעולה נפרדת מ-`ArchiveCardButton` הקיים (שרק משנה `status`) — המשתמש ביקש מפורשות "מחיקה", לא ארכוב. מכיוון ש-`usageLog` הוא subcollection (לא top-level, החלטה #1), `deleteDoc` רגיל בצד לקוח על מסמך הכרטיס **לא** היה מוחק את רשומות היומן שלו (יתומות ולא נגישות דרך ה-UI אך עדיין קיימות ב-Firestore) ולא את קבצי ה-Storage — ולכן זו חייבת להיות Server Action עם Admin SDK, לא כתיבת client SDK ישירה כמו ב-`ArchiveCardButton`.
**Security Rules**: לא נדרש שינוי — `allow delete: if isExistingOwner()` כבר קיים על `cards/{cardId}` מ-Phase 1 (מכסה מחיקה ישירה אם תתווסף אי-פעם); ה-Server Action עוקף את ה-Rules ממילא (Admin SDK), כמו בהחלטות #10/#12.
**אלטרנטיבה שנדחתה**: "מחיקה רכה" (soft delete/status נוסף) — נדחה מאותה סיבה כמו ב-#4/#12: המשתמש ביקש מחיקה בפועל, לא הסתרה. אלטרנטיבה נוספת שנדחתה: להשאיר את רשומות ה-`usageLog`/קבצי ה-Storage יתומים ולנקות אותם רק ב-Cloud Function מתוזמן — נדחה כי מוסיף delay/תלות מיותרים כשאפשר למחוק אטומית באותה קריאה.

## 15. שיתוף רשימות — תפקידים לפי חבר (מנהל/צופה), הזמנה לפי אימייל + אישור, ownerId נשאר של הבעלים
**תאריך**: 2026-08-26
**החלטה**: נוסף collection חדש `cardLists/{listId}/members/{memberUid}` (subcollection, doc id == memberUid — תואם את התבנית של `usageLog` כ-subcollection, לא את #1, כי כאן דווקא נדרשת collection-group query כדי לשלוף "כל השיתופים שלי" על פני רשימות של בעלים שונים). כל מסמך: `{listId, memberUid, email, role: "manager"|"viewer", status: "pending"|"accepted", invitedBy, createdAt, updatedAt}`. בעל הרשימה (ורק הוא) בוחר את ההרשאה לכל משתמש בנפרד, וניתן לשנות אותה בכל עת — לא הרשאה גלובלית אחידה לכל השותפים. הזמנה היא לפי אימייל של משתמש **קיים** במערכת + אישור מפורש מהמוזמן (לא צפייה מיידית) — פעולת `inviteListMember` (`src/actions/listShare.ts`, Server Action) מפענחת את המייל ל-uid דרך `adminAuth.getUserByEmail` (אין דרך client-safe לחפש uid לפי מייל בלי לחשוף קיום חשבונות) ויוצרת מסמך `status:"pending"`; קבלה/דחייה של ההזמנה היא כתיבת client רגילה על ידי המוזמן עצמו (`update`/`delete` על מסמך ה-member שלו), נאכפת ב-`firestore.rules`.
**הרשאות בפועל**: "מנהל" יכול לעשות בכרטיסי הרשימה המשותפת כל מה שהבעלים יכול (יצירה/עריכה/מחיקה/רישום שימוש/עדכון יתרה ידני) חוץ מניהול השיתוף עצמו (הזמנה/הסרה/שינוי תפקיד — נשאר בלעדי לבעלים, כדי למנוע "שרשרת הזמנות" בלתי מבוקרת). "צופה" יכול רק לקרוא (כרטיסים, יתרות, יומן שימושים). כרטיס שנוצר על ידי מנהל משותף עדיין נכתב עם `ownerId` של **בעל הרשימה**, לא של היוצר בפועל — כדי ש-`useCards`/דוחות עתידיים לפי `ownerId` ימשיכו להתייחס לרשימה כיחידה אחת עם בעלים יחיד; מי שביצע את הפעולה בפועל נשמר ב-`usageLog.createdBy` (שדה שכבר תוכנן לכך, ראו `docs/DATA_MODEL.md`).
**Security Rules**: `cards`/`cards/usageLog` נפתחו לקריאה לכל חבר מאושר (`status:"accepted"`) ברשימה, וליצירה/עדכון/מחיקה על `cards` גם למי שהוא `role:"manager"` מאושר — נבדק דרך `get()` על מסמך ה-member של המבקש (ראו פונקציות `isAcceptedListMember`/`isManagerOfList` ב-`firestore.rules`). כתיבת `usageLog` נשארת אך ורק דרך ה-Server Actions הקיימים (לא נפתחה כתיבת client ל-managers) — `src/lib/auth/listAccess.ts` (`assertCanManageCard`) מרכז את בדיקת ההרשאה (owner או manager מאושר) ומשמש את `addUsageEntry`/`deleteUsageEntry`/`updateCardBalance`/`deleteCard`.
**מגבלה מכוונת שלא טופלה**: `storage.rules` נשארו ללא שינוי (`isOwner(uid)` לפי segment בנתיב) — מנהל משותף (לא הבעלים) לא יכול להעלות תמונת כרטיס/קבלה, כי זה ידרוש הרחבת Storage Rules עם `firestore.get()` צולב-שירות שלא נבדקה. ה-UI מסתיר את פקד ההעלאה למי שאינו הבעלים (`CardForm`/`AddUsageForm`/עמוד הכרטיס) כדי לא להיכשל בשקט; שאר הפעולות (טקסט/מספרים/יתרה) לא מושפעות.
**Trade-off נוסף**: `useCardLists` שולף רשימות משותפות (accepted) פעם אחת (`getDoc`) בכל שינוי בסט החברויות, לא ב-`onSnapshot` חי לכל רשימה — שינוי שם רשימה על ידי הבעלים לא יתעדכן אצל שותף בזמן אמת בלי ריענון/שינוי חברות. סביר בקנה מידה משפחתי/אישי. כמו כן `useCards` קורא ל-`useCardLists` פנימית וגם דפים שקוראים לשני ה-hooks יחד (כמו `/cards`) מפעילים את שאילתות הרשימות פעמיים — כפילות מקובלת בקנה המידה הזה, לא עברנו ל-context משותף כדי לא להוסיף infrastructure מיותר.
**מחיקת רשימה**: הורחבה הדרישה הקיימת (0 כרטיסים, #13) ל-0 גם חברים משותפים — כדי למנוע מסמכי `members` יתומים תחת רשימה שנמחקה (המחיקה עדיין `deleteDoc` רגיל בצד לקוח, לא recursive).
**אלטרנטיבות שנדחו**: (א) שיתוף לפי קישור פתוח בלי אימייל/אישור — נדחה, המשתמש ביקש מפורשות אימייל+אישור. (ב) הרשאה גלובלית אחידה לכל שותפי רשימה — נדחה, המשתמש ביקש בחירת הרשאה פר-משתמש. (ג) לאפשר ל-managers גם לנהל שיתוף (הזמנה/הסרה) — נדחה כרגע כדי לצמצם את משטח האבטחה למקרה הפשוט ביותר; ניתן להרחיב בעתיד אם יידרש.

## 16. Hosting/Deployment platform — Firebase App Hosting + Cloud Functions (סוגר ADR #5)
**תאריך**: 2026-08-26
**החלטה**: Firebase App Hosting לאפליקציית ה-Next.js (SSR), + Cloud Functions for Firebase לכל webhook/job ברקע/מתוזמן. סביבה אחת בלבד (production) — בלי סביבת staging נפרדת כרגע. פרטים מלאים ב-`docs/DEPLOYMENT.md`.
**נימוק**: מתוכנן פיצ'ר עתידי של chatbot (שיחה חופשית מעל הנתונים, LLM עם semantic cache/MCP/context, ככל הנראה עם ממשק WhatsApp ו/או Telegram). Cloud Functions הוא הבית הטבעי ל-webhook endpoints (WhatsApp/Telegram) וללוגיקת רקע/מתוזמנת — כבר קיים שלד ל-`functions/` מ-Phase 0 (ראה `functions/src/index.ts`). App Hosting רץ על Cloud Run מתחת למכסה, ולכן תומך בחיבורים ארוכי-טווח וב-min-instances אם יידרש בעתיד לשרתי MCP. השארות בעולם Firebase-native שומרת משטח IAM/secrets/billing אחיד, במקום פיצול בין Vercel ל-Firebase. סוגר את הדחייה שנקבעה ב-ADR #5.
**אלטרנטיבה שנדחתה**: Vercel — DX מעולה ל-Next.js, אך מוסיף ספק/billing נפרד, ו-webhooks/MCP servers עתידיים היו צריכים Firebase/GCP בכל מקרה — פיצול לשני ספקים ללא יתרון ארכיטקטוני ברור. Firebase Hosting + web frameworks integration (האופציה השנייה שנשקלה ב-ADR #5) נדחתה לטובת App Hosting כי היא מחייבת ניהול ידני יותר של rewrites/build ללא יתרון על פני הגישה הגיט-אינטגרטיבית.
