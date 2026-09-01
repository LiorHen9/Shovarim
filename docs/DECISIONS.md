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

## 17. צ'אטבוט/CLI לשיחה חופשית — MCP כממשק כלים, uid נגזר בצד שרת בלבד
**תאריך**: 2026-08-27
**החלטה**: פיצ'ר עתידי (Phase 5, בין Privacy Hardening ל-PWA) שמאפשר שיחה חופשית בשפה טבעית לביצוע פעולות (הוספה/עריכה/מחיקה של כרטיסים, רישום שימוש, שאילתות יתרה) יחשוף את הפעולות ל-LLM כ-**MCP tools** (לא REST API ציבורי מתועד ב-OpenAPI/Swagger), וכל tool יפעל תחת `uid` שנגזר אך ורק בצד שרת (session cookie מאומת / מיפוי ערוץ WhatsApp-Telegram→uid מאומת) — לעולם לא פרמטר שה-LLM יכול לספק. ה-tools קוראים לאותה שכבת לוגיקה (ownership/validation) שכבר קיימת ב-`src/actions/*.ts`, לא מימוש מקביל.
**נימוק**: הצרכן היחיד של הממשק הזה הוא שכבת האורקסטרציה של ה-LLM שלנו (Claude, tool-calling) — MCP הוא הפרוטוקול הטבעי לכך, ובניית REST API ציבורי מלא (auth נפרד, versioning, תיעוד Swagger) הייתה משטח מיותר בלי צרכן חיצוני שמצדיק אותה. הסיכון האמיתי בפיצ'ר כזה הוא לא הפרוטוקול אלא **דליפת מידע בין משתמשים דרך prompt injection/הזיה** — אם ה-`uid` היה שדה גלוי בסכימת ה-tool, טקסט חופשי עוין (או תשובת מודל שגויה) יכול היה "לבקש" לפעול על נתוני משתמש אחר. נעילת ה-`uid` כברירת מחדל בצד שרת (לא ב-schema של ה-tool בכלל) סוגרת את הפרצה מבנית, לא רק בבדיקת קלט.
**בקרות נוספות שהוחלטו יחד עם זה**: (א) אישור מפורש בשיחה לפני פעולות הרסניות (מחיקת כרטיס/רשומה); (ב) semantic cache ממופתח כולל `uid`, בלי שיתוף cache בין משתמשים, ובלי caching לשאילתות שחושפות `cvv`/`barcodeOrCode`; (ג) הרחבת `auditLog` (`docs/DATA_MODEL.md`) לכל קריאת tool; (ד) rate limiting per-uid ברמת הרצת ה-tools, כי ערוצי WhatsApp/Telegram חושפים משטח spoofing (מספר טלפון) שלא קיים באפליקציית ה-web המאומתת מול Google. ראו הרחבה ב-`docs/SECURITY.md`.
**אלטרנטיבה שנדחתה**: REST API ציבורי + Swagger, עם ה-LLM קורא לו כמו כל HTTP client — נדחה כרגע כי מוסיף שכבת auth/רשת/תיעוד כפולה בלי יתרון בפועל; אפשר לגזור OpenAPI spec מאותם Zod schemas בעתיד רק אם ייווסף צרכן חיצוני לא-MCP. אלטרנטיבה נוספת שנדחתה: לתת ל-LLM לספק `uid`/`ownerId` מפורש ולוודא אותו מול session בשכבת validation — נדחה כי זה משאיר את שדה הזיהוי בתוך משטח התקיפה (input שה-LLM "רואה" ויכול "להחליט" לשנות), במקום להוציא אותו ממנו לגמרי.

## 18. שגיאות "צפויות" ב-Server Actions מוחזרות כערך, לא נזרקות (`ActionError`/`toActionResult`)
**תאריך**: 2026-08-27
**החלטה**: `inviteListMember`/`updateCardBalance`/`deleteCard`/`addUsageEntry`/`deleteUsageEntry` (וכל בדיקת ההרשאה המשותפת `assertCanManageCard` ב-`src/lib/auth/listAccess.ts`) זורקים `ActionError` (מחלקה חדשה, `src/lib/actions/errors.ts`) עבור תנאים צפויים (לא נמצא/אין הרשאה/כבר משותף/יתרה לא מספיקה וכו'), ועוטפים את גוף הפעולה ב-`toActionResult()` שממיר `ActionError` ל-`{ error: string }` מוחזר; שגיאות אחרות (bugs אמיתיים) ממשיכות לצאת כ-`throw` רגיל. כל הקומפוננטות שקוראות לפעולות אלו (`ShareListDialog`, `AddUsageForm`, `DeleteCardButton`, `DeleteUsageEntryButton`, `UpdateBalanceDialog`) עודכנו לבדוק `"error" in result` במקום להסתמך על `catch (error) { error.message }`.
**נימוק**: התגלה באג production אמיתי — ניסיון לשתף רשימה עם אימייל לא רשום החזיר למשתמש "Minified React error #441" במקום ההודעה בעברית. הסיבה: Next.js מוחק (redact) את ה-`message` של כל שגיאה שנזרקת מ-Server Action וחומקת עד הלקוח ב-production build (כדי לא לחשוף פרטי שרת), ומחליף אותה בהודעת RSC גנרית שממוזערת לקוד React מספרי — זו בדיוק ההנחיה הרשמית של Next ב-`node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md` ("For these [expected] errors, avoid using try/catch blocks and throw errors. Instead, model expected errors as return values."). ה-`throw new Error(...)` הישן עבד בסביבת פיתוח (שם ההודעה כן מגיעה ללקוח) ולכן הבאג לא נתפס עד בדיקה ידנית ב-production.
**היקף**: תוקן בכל ה-Server Actions שהיו בעלי אותה תבנית (`listShare.ts`, `balance.ts`, `card.ts`, `usage.ts`) — לא רק בזרימת השיתוף שדווחה. `src/actions/auth.ts` (`createSession`, "Recent sign-in required") ו-`requireUid` (`src/lib/auth/session.ts`, "Not authenticated") נשארו ללא שינוי במכוון: אלו מקרי קצה נדירים (session פג/לא מאומת) שקרובים יותר ל"שגיאה בלתי-צפויה" לפי אותה הבחנה של Next, לא ולידציה עסקית שהמשתמש אמור לראות בעברית.
**אלטרנטיבה שנדחתה**: להגדיר `onServerActionError`/handler ברמת ה-framework שמעביר את ה-message של כל שגיאה ללקוח — נדחה כי זה מבטל את הגנת ה-redaction גם עבור שגיאות בלתי-צפויות אמיתיות (בדיוק ההגנה שה-redaction נועד לספק), במקום להבחין בין המקרים כמו שההנחיה הרשמית ממליצה.

## 19. MCP walking skeleton (שלב 5.1) — תהליך Node מקומי (stdio) + Firebase ID token אמיתי ל-CLI
**תאריך**: 2026-08-27
**החלטה**: הצעד הראשון במימוש Phase 5 (ראו `docs/ROADMAP.md` שלב 5.1) — tool קריאה יחיד (`listCards`) שמאמת מקצה לקצה את מודל האבטחה מ-ADR #17 — מיושם עם שתי הכרעות runtime שנשארו פתוחות שם:
(א) שרת ה-MCP רץ כתהליך Node מקומי עם stdio transport (`mcp-server/`), לא כ-Cloud Function; (ב) ה-CLI (`scripts/mcp-cli.ts`) גוזר uid מ-**Firebase ID token אמיתי** (sign-in אמיתי מול Firebase Auth דרך `src/lib/firebase/client.ts`, לא flag/משתנה סביבה קבוע), שהשרת מאמת עם `adminAuth.verifyIdToken`.
**נימוק**: המטרה של השלב הזה היא לוודא שהמודל הארכיטקטוני (uid נגזר בצד שרת, לא פרמטר ל-LLM) עובד בפועל, לא רק על הנייר — קיצור-דרך באימות (uid קבוע מ-`.env.local`) היה מייתר בדיוק את מה שהשלב הזה אמור לבדוק. מנגד, runtime מלא (Cloud Function + HTTP) הוא overhead מיותר לפני שיש אפילו tool אחד עובד: אין עדיין webhook חיצוני (WhatsApp/Telegram) שדורש HTTP, ו-stdio מספיק לחלוטין ל-CLI פנימי. שכבת השירות (`src/lib/services/`) והגדרות ה-tools עצמן הן transport-agnostic במכוון, כדי שהמעבר ל-Cloud Function בעתיד (כשיתווספו ערוצי webhook) לא ידרוש שינוי בלוגיקת ההרשאות/העסקית — רק בעטיפת ה-transport.
**היקף שנדחה במפורש לשלבים הבאים**: tools כותבים/הרסניים ואישור מפורש בשיחה, ערוצי WhatsApp/Telegram (`channelLinks`), semantic cache, rate limiting per-uid, App Check/Secret Manager (מספיק `.env.local` ב-dev מקומי). ראו `docs/ROADMAP.md` שלב 5.1.
**אלטרנטיבה שנדחתה**: Cloud Function מההתחלה — נדחה זמנית (לא לצמיתות) כי מוסיף deploy/IAM/secrets overhead לפני שיש אפילו tool אחד שהוכח כעובד; ההחלטה הזו ספציפית לשלב 5.1 ותיבחן מחדש כשמתווספים ערוצי webhook.
**עדכון (2026-08-27)**: התברר בזמן הבדיקה בפועל שהאפליקציה תומכת רק ב-Google (`src/lib/auth/providers.ts`, `SUPPORTED_PROVIDERS`) — אין נתיב אימייל/סיסמה בכלל, אז `signInWithEmailAndPassword` לא ישים. `scripts/mcp-cli.ts` מנפיק במקום זאת custom token דרך Admin SDK (`adminAuth.createCustomToken(uid)`) עבור uid נתון כארגומנט, ומחליף אותו client-side (`signInWithCustomToken`). זה עדיין Firebase ID token אמיתי, מאומת ע"י `mcp-server/index.ts` באותה דרך בדיוק (`adminAuth.verifyIdToken`) — רק שלב ה-bootstrap השתנה, לא מודל האבטחה.

## 20. מודל Sonnet 5 + prompt caching + compaction + Anthropic-native WIF ל-PROD (לא Vertex, לא Firebase)
**תאריך**: 2026-08-27
**החלטה**: המשך Phase 5 (אחרי שלב 5.1 walking skeleton) נחלק לארבעה workstreams — א' (צ'אטבוט UI), ב' (rate limiting), ג' (עלות), ד' (הפרדת סביבת קרדיטים DEV/PROD). ג' ו-ד' מטופלים יחד, ראשונים, כי שניהם נוגעים באותם קבצים חדשים: `src/lib/mcp/config.ts` (קבוע `MODEL_ID = "claude-sonnet-5"`, הוחלף מ-`claude-opus-5` שהיה קבוע קשיח ב-`scripts/mcp-cli.ts` והיה הגורם המרכזי לעלות ~0.03$ לשאלה), `src/lib/mcp/anthropicClient.ts` (factory שבוחר בין DEV ל-PROD), ו-`src/lib/mcp/agentLoop.ts` (ה-tool-use loop המשותף, מחולץ מ-`scripts/mcp-cli.ts` כדי ש-Route Handler עתידי ל-web ישתמש באותה לוגיקה בדיוק — לא ישוכפל).
**עלות (ג')**: `agentLoop.ts` מוסיף `cache_control: {type:"ephemeral"}` על בלוק ה-system היחיד (מכסה גם את סכימות ה-tools, לפי סדר ה-render `tools→system→messages`), ו-compaction (beta `compact-2026-01-12`, `context_management.edits:[{type:"compact_20260112"}]`) שפותר היסטוריית שיחה שגדלה בלי גבול. שני אלה דורשים `client.beta.messages.create` (לא ה-endpoint הרגיל).
**קרדיטים DEV/PROD + WIF (ד')**: "identity federation" שהמשתמש ביקש מתייחס ל-**Claude API עצמו** (platform.claude.com), לא ל-Firebase Admin SDK — תוכנן בטעות ראשונית לכיוון האחרון, תוקן אחרי הבהרה מפורשת של המשתמש. אומת מול תיעוד Anthropic חי (WebFetch): הודות ל-provider guide ייעודי ל-Google Cloud, workload עם זהות GCP (App Hosting/Cloud Run) יכול לחלץ Google-signed identity token מה-metadata server (`format=full`, כדי לכלול claim `email`) ולהחליף אותו ב-`POST /v1/oauth/token` מול Anthropic (`oidcFederationProvider` מ-`@anthropic-ai/sdk/lib/credentials/oidc-federation`, מאומת קיים בגרסה המותקנת) — בלי מפתח `ANTHROPIC_API_KEY` סטטי כלל. `src/lib/mcp/anthropicClient.ts`: DEV (ברירת מחדל) ממשיך עם `new Anthropic()`/`ANTHROPIC_API_KEY` מ-workspace "dev" נפרד ב-Console; PROD (כש-`ANTHROPIC_FEDERATION_RULE_ID` מוגדר) בונה client עם `credentials: oidcFederationProvider(...)`. קריטי: `ANTHROPIC_API_KEY` חייב **לא** להיות מוגדר בסביבת production — הוא יושב מעל federation ב-credential precedence וישתיק אותה בשקט.
**נימוק לדחיית Vertex AI**: היה שיקול לנתב את הקריאות ל-Claude דרך Google Cloud Vertex AI Model Garden (אימות GCP native מובנה) — נדחה כי Anthropic-native WIF משיג בדיוק אותה תוצאה (אימות keyless מבוסס GCP service account) בלי לעבור דרך שכבת Vertex נוספת, בלי מגבלות הזמינות של Vertex (`inference_geo`, כמה server-side tools לא נתמכים שם), ובלי לשנות client library.
**נימוק לדחיית שינוי Firebase Admin SDK**: שדרוג נפרד — attached service account + Application Default Credentials במקום `FIREBASE_ADMIN_PRIVATE_KEY` הסטטי ב-`apphosting.yaml` — הוא רעיון תקף אך **נפרד לגמרי**, לא בוצע ולא תוכנן כחלק מההחלטה הזו. לא התבקש; מוזכר רק כהערת שוליים בתכנון (ר' `docs/ROADMAP.md`).
**אלטרנטיבה שנדחתה**: Redis/מטמון חיצוני לניהול היסטוריית שיחה — נדחה, compaction ה-server-side (beta) פותר את אותה בעיה בלי תשתית נוספת.

## 21. Rate limiting per-uid (שלב 5.3) — fixed window, Firestore transaction, wrapper מרוכז סביב כל tool call
**תאריך**: 2026-08-28
**החלטה**: `rateLimits/{uid}` (מסמך יחיד פר-משתמש, `{windowStart: Timestamp, count: number}`) + `checkAndConsumeRateLimit` (`src/lib/services/rateLimit.ts`, Admin SDK, `runTransaction`) — fixed window (לא sliding/token-bucket): אם החלון (`RATE_LIMIT_WINDOW_MS`, `src/lib/mcp/config.ts`) פג, המסמך מאותחל מחדש (`count:1`); אחרת המונה גדל, וכשהוא חוצה את `RATE_LIMIT_MAX_CALLS` נזרקת `RateLimitExceededError`. ברירות מחדל: 30 קריאות ל-5 דקות — שמרני מספיק לשיחה אינטראקטיבית רגילה, נמוך מספיק לחסום לולאת retry שיצאה משליטה.
**wrapper מרוכז, לא בדיקה בכל handler**: `withToolExecution` חדש ב-`mcp-server/index.ts` עוטף כל tool — קודם בודק rate limit, ואז מריץ את ה-handler, וכותב בדיוק רשומת `auditLog` אחת בכל מקרה (הצלחה/rate-limit/שגיאת handler). `listCards` (שלב 5.1) עבר להשתמש בו במקום ה-try/catch הידני שהיה חוזר על עצמו — ה-wrapper הזה הוא הבסיס ש-tools עתידיים (שלב 5.4) יירשמו דרכו במקום לשכפל את הלוגיקה.
**חסימה מדווחת כ-tool error, לא כשגיאת פרוטוקול**: כשהמכסה נחצית, ה-wrapper מחזיר `{ content: [...], isError: true }` (מוסכמת MCP הרגילה ל"הכלי נכשל") במקום לזרוק — `runAgentTurn` (`src/lib/mcp/agentLoop.ts`) כבר מטפל ב-`isError` ומעביר אותו כ-`tool_result` עם `is_error:true` בחזרה למודל, כך שקלוד יכול לספר למשתמש "נסה שוב בעוד X שניות" במקום שהתהליך כולו יקרוס.
**`firestore.rules`**: `rateLimits/{uid}` נוסף עם `allow read, write: if false` מפורש (עקבי עם `auditLog`/`reminders`) — אין client שקורא/כותב את זה בכלל, לא רק Server Action.
**אלטרנטיבה שנדחתה**: sliding window / token bucket — נדחה כרגע כ-over-engineering לסקאלה של אפליקציה אישית/משפחתית; fixed window מספיק וקל להסביר/לדבג. ניתן לשדרג בעתיד בלי לשנות את ה-caller (`checkAndConsumeRateLimit`).

## 22. צ'אטבוט ב-UI + סט tools מלא (שלב 5.4) — שכבת שירות משותפת, transport in-process ל-web, אישור הרסניות דרך system prompt
**תאריך**: 2026-08-28
**החלטה**: שלב 5.4 (ראו `docs/ROADMAP.md`) הוסיף Route Handler ראשון (`src/app/api/chat/route.ts`, streaming NDJSON), עמוד `/chat`, ותשעה MCP tools חדשים (`getCard`, `createCard`, `updateCard`, `deleteCard`, `logUsage`, `deleteUsageEntry`, `updateBalance`, `listCardLists`, `createList`) לצד `listCards` הקיים. שני חסמים טכניים נפתרו כדי לאפשר את זה:
**(א) שכבת שירות משותפת, לא כפילות**: `src/actions/{card,usage,balance}.ts` היו `"use server"` functions שקוראות `revalidatePath`/`requireUid()` — API שלא זמין מחוץ ל-request context של Next, כך ש-`mcp-server/index.ts` (תהליך `tsx` רגיל) לא יכול היה לקרוא להן ישירות. הלוגיקה (ownership checks, טרנזקציות, הצפנה) חולצה ל-`src/lib/services/{cards,usage,balance,cardLists}.ts` (uid כפרמטר מפורש, בלי `revalidatePath`/`requireUid`, import יחסי — אותה תבנית כמו `listCardsForUid` משלב 5.1), ו-`src/actions/*.ts` הפכו לעטיפות דקות (`requireUid()` + parse + קריאה לשירות + `revalidatePath`). גילוי נלווה: גם `src/lib/actions/errors.ts` (`ActionError`/`toActionResult`) וגם `src/lib/auth/listAccess.ts` (`assertCanManageCard`/`assertCanManageListAndGetOwner`) כללו `import "server-only"`, שזורק unconditionally כשמיובא מחוץ ל-bundler של Next (`node_modules/server-only/index.js` — `throw` תמיד, ה-swap לגרסה ריקה קורה רק בבנייה של Next). כל אחד מהם פוצל לקובץ `*Core.ts` נטול ה-guard (`errorsCore.ts`, `listAccessCore.ts`), באותה תבנית בדיוק כמו `adminApp.ts`/`admin.ts` ו-`fieldEncryptionCore.ts`/`fieldEncryption.ts` הקיימים — הקובץ המקורי נשאר barrel עם ה-guard, קוד Next קיים ממשיך לייבא אותו בלי שינוי.
**(ב) transport in-process ל-web, לא subprocess**: `mcp-server/index.ts` הריץ `main()` כ-side-effect ברמת המודול (קורא `process.env`, `process.exit(1)`) — אי אפשר לייבא אותו מ-Route Handler בלי שינסה לרוץ כ-CLI. רישום ה-tools עצמו חולץ לפונקציה טהורה `createMcpServer(uid, channel)` ב-`src/lib/mcp/mcpServer.ts` (בלי side effects, בלי transport). ה-CLI (`mcp-server/index.ts`, מכווץ עכשיו לעטיפה דקה) ממשיך stdio subprocess per session; ה-Route Handler מתחבר **in-process** דרך `InMemoryTransport.createLinkedPair()` (קיים ב-`@modelcontextprotocol/sdk`, אומת) — נמנע מ-spawn של תהליך Node לכל בקשת HTTP על Cloud Run/App Hosting. זו ההחלטה ש-ADR #19 השאיר פתוחה "כשמתווספים ערוצי webhook".
**אישור מפורש לפעולות הרסניות (`deleteCard`, `deleteUsageEntry`) — מנגנון בפועל ל-ADR #17**: לא נבנה code-level interception ללולאת ה-tool-use ב-`agentLoop.ts`. המנגנון: (1) `src/lib/mcp/systemPrompt.ts` (חדש, משותף ל-CLI ול-web) מנחה את המודל לשאול אישור בטקסט חופשי (לא tool call) ולחכות לתשובה חיובית מפורשת לפני קריאה ל-tool; (2) סכימת ה-tool כוללת שדה `confirmed: boolean` חובה — אם `false`, ה-handler זורק `ActionError` שמוחזר כ-tool error רגיל (לא קורס). זה חשף פער קיים ב-`withToolExecution`: תשעת ה-tools הכותבים הראשונים שיכולים לזרוק `ActionError` (כרטיס לא נמצא/אין הרשאה/וכו') — קודם כל שגיאה שיוצאת מ-handler הייתה נזרקת הלאה כ-כישלון פרוטוקול MCP אמיתי, שהיה מקריס את כל התור. `withToolExecution` הורחב להבחין `ActionError` (מוחזר כ-`{isError:true}` רגיל, אותו עיקרון בדיוק כמו ADR #18 ל-Server Actions) משגיאות אמיתיות (עדיין נזרקות).
**היקף שנדחה במפורש**: (1) rate limiting (ADR #21) נשאר per-tool-call בלבד — שיחה טקסט-בלבד ארוכה בלי tool calls לא מוגבלת; (2) היסטוריית שיחה (`BetaMessageParam[]`) נשמרת client-side בלבד (state בדפדפן, מועברת מלאה בכל בקשה כמו ש-`scripts/mcp-cli.ts` עושה בזיכרון) — בלי persistence שרתי, בלי sync בין מכשירים, רענון דף מאבד את השיחה; (3) אין streaming ברמת token — `agentLoop.ts` עדיין קורא ל-`client.beta.messages.create()` לא ל-`.stream()`, כך שה-streaming ל-UI הוא per-turn (טקסט שלם + tool_call events), לא per-token; (4) אין Playwright E2E חדש (streaming אמיתי + קריאות LLM אמיתיות = השקעת בדיקה אוטומטית לא טריוויאלית).
**סכימות ה-tools הכותבים צרות מכוונות**: לעולם בלי `cvv`/`barcodeOrCode`/`cardImageUrl`/`receiptImageUrl` — לא רק "לא נשמר ב-cache" (ADR #17) אלא לא עובר ב-conversation history בכלל. `createCard` יוצר עם `cvv:null, barcodeOrCode:null, cardImageUrl:null`; `updateCard` שולף את הסודות המוצפנים הקיימים דרך `getCardSecretsForUid` ומעביר אותם ללא שינוי כדי לא למחוק אותם.
**אומת**: `typecheck`/`lint`/`build` נקיים, `test:rules` — 41/41 ללא שינוי (אין שינוי ב-`firestore.rules`). זרימה מלאה מול ה-emulator (סקריפט זמני, נמחק) דרך בדיוק אותו מנגנון in-process ש-Route Handler משתמש בו: `createList` → `createCard` → `logUsage` → `getCard` → `deleteCard` (המודל שאל אישור, המשתמש סירב — לא נמחק — ואז אישר — נמחק בהצלחה). `mcp:cli` נבדק בנפרד מול ה-emulator ואישר שה-CLI (stdio) עדיין עובד אחרי הפיצול.
**אלטרנטיבה שנדחתה**: לתת ל-`agentLoop.ts` לעצור את הלולאה ולהחזיר שליטה ל-caller ממש לפני הרצת `tool_use` על `deleteCard`/`deleteUsageEntry` (code-level gate) — נדחה כרגע כי דורש לשנות את חוזה ה-API של `runAgentTurn` (החזרת "pending confirmation" state באמצע תור) בלי יתרון אמיתי מעבר למנגנון ה-`confirmed`+system prompt שכבר עקבי עם ADR #17.

## 23. E2E testing (Playwright) — כניסה דרך custom token מול ה-emulator, לא Google popup אמיתי
**תאריך**: 2026-08-27
**החלטה**: `@playwright/test` רץ אך ורק מול Firebase Emulators (`.env.local`/CI, לעולם לא פרויקט אמיתי). לזרימות שדורשות משתמש מחובר, הטסטים לא מדמים את ה-popup של Google — הם קוראים לעמוד בדיקה ייעודי `src/app/(public)/e2e/sign-in/page.tsx` שמקבל `uid` מה-URL, קורא ל-Server Action `mintTestCustomToken` (`src/actions/testAuth.ts`, Admin SDK `createCustomToken`), ואז עובר באותו נתיב client בדיוק כמו כניסה אמיתית — `signInWithCustomToken` → `user.getIdToken()` → `createSession` הקיים (`src/actions/auth.ts`). `mintTestCustomToken` בודקת `FIREBASE_USE_EMULATOR === "true"` וזורקת שגיאה אחרת; עמוד ה-`e2e/sign-in` עצמו בודק גם בצד client (`NEXT_PUBLIC_USE_FIREBASE_EMULATOR`) ומפנה ל-`/` אם לא — הגנה כפולה שהופכת את הנתיב לחסר-אפקט מחוץ ל-emulator.
**נימוק**: Google חוסם sign-in אוטומטי מדפדפנים לא-אינטראקטיביים (זיהוי automation), כך שדימוי ה-popup עצמו ב-CI לא אפשרי בפועל בלי לפרוץ הגנות Google. הזרימה החלופית לא מדלגת על הקוד שבודקים — היא עדיין עוברת דרך `createSession` (verify token, session cookie, `ensureUserProfile`) בדיוק כמו Google אמיתי, כך שהיא בודקת את כל האפליקציה מלבד ה-popup עצמו. שימוש ב-custom token (לא ב-Admin SDK ליצירת session cookie ישירות) הכרחי כי `useAuth()`/`useCards()` וכו' קוראים state מה-Firebase client SDK בדפדפן (persisted, לא רק מה-cookie) — היה צריך בכל מקרה sign-in אמיתי בצד client כדי שהם יעבדו.
**אלטרנטיבה שנדחתה**: מזריקים session cookie ישירות דרך Playwright `storageState` בלי sign-in בדפדפן בכלל — נדחה כי משאיר את ה-Firebase Auth client state (IndexedDB) ריק, ואז `useAuth()` מחזיר `user: null` וכל ה-UI שתלוי בו (dashboard, cards) נשבר גם עם cookie תקין. אלטרנטיבה נוספת: Route Handler רגיל (`route.ts`) במקום Server Action — נדחה כדי להישאר עקבי עם שאר הקוד בפרויקט שמשתמש אך ורק ב-Server Actions (`src/actions/`), ללא Route Handlers קיימים.

## 24. מחיקת חשבון מלאה (Phase 4.2) — grace period 30 יום, functions/ עצמאי, סקריפט אימות שמריץ קוד production אמיתי
**תאריך**: 2026-08-27
**החלטה**: זכות המחיקה (`docs/PRIVACY.md`) מיושמת דו-שלבית: (א) `requestAccountDeletion`/`cancelAccountDeletion` (`src/actions/privacy.ts`, Server Actions, Admin SDK) קובעות/מאפסות את `users/{uid}.deletionRequestedAt` — idempotent (בקשה חוזרת לא דוחה את המועד), הפיך לחלוטין עד שה-sweep רץ; (ב) Cloud Function מתוזמן ראשון בפרויקט (`functions/src/index.ts`, `onSchedule("0 3 * * *", ...)`, `firebase-functions/v2/scheduler`, region `europe-west4` תואם ל-App Hosting backend — ADR #16) מוחק בפועל חשבונות שחלף עליהם חלון grace של **30 יום** (`GRACE_PERIOD_DAYS`).
**מבנה functions/ נשאר עצמאי**: `functions/tsconfig.json` (`rootDir: "src"`) מונע מ-`functions/src/*.ts` לייבא מ-`src/*` — ניסיון ייבוא טיפוס יחיד (`UserProfile`) גרם לכשל `tsc` אמיתי בזמן הפיתוח (`File is not under 'rootDir'`), ותוקן על ידי הסתמכות על `users/{uid}` doc id (== uid) במקום קריאת שדה מהמסמך. `functions/src/firebaseAdmin.ts` (bootstrap `admin.initializeApp()` עצמאי) ו-`functions/src/accountDeletion.ts` (`sweepExpiredAccountDeletions`/`deleteUserAccount`) הם self-contained לגמרי, כולל `GRACE_PERIOD_DAYS` כפול (מוגדר שוב, בסנכרון ידני, מול `src/lib/services/accountDeletion.ts` שה-UI צורך לתצוגת התאריך הצפוי).
**סקריפט האימות מריץ קוד production אמיתי, לא עותק**: `scripts/sweep-account-deletions.ts` (בשורש, `tsx`) מייבא ישירות `import { sweepExpiredAccountDeletions, deleteUserAccount } from "../functions/src/accountDeletion"` — `tsx` מתעלם מ-`rootDir` (מגבלת `tsc`-emit בלבד, לא מגבילה resolution בזמן ריצה), אז זה עובד בלי שכפול לוגיקה. אותה תבנית בדיוק כמו `scripts/mcp-cli.ts` שכבר חוצה את גבול `src/`/scripts באותה צורה.
**סדר מחיקה בפועל** (`deleteUserAccount`): כתיבת `auditLog` (`deletion_completed`) לפני שמתחילים; אז `cardLists`/`cards` (`recursiveDelete`, כולל `members`/`usageLog` subcollections), `categories`, `consents/{uid}`, מסמכי חברות של ה-uid ברשימות של **אחרים** (`collectionGroup("members").where("memberUid","==",uid)`), קבצי Storage (`deleteFiles({prefix: users/${uid}/})`), מסמך `users/{uid}`, ולבסוף `auth.deleteUser(uid)` — Auth תמיד אחרון, כדי שכשל חלקי לא ישאיר משתמש בלי גישה ובלי דרך לבטל.
**התראה כפולה**: גם ב-`/settings` (`DeleteAccountSection`, דיאלוג אישור לבקשה + כרטיס inline לביטול, אותו pattern כמו `DeleteCardButton`) וגם באנר גלובלי לא-חוסם (`DeletionPendingBanner`, ב-`(protected)/layout.tsx` לצד `ConsentBanner` הקיים, אך לא מודלי כמוהו) — כדי שהמשתמש לא "ישכח" בקשת מחיקה פתוחה אם לא ביקר ב-Settings.
**אלטרנטיבה שנדחתה**: לשתף קוד בין `functions/` ל-`src/` על ידי הרפיית `rootDir`/מעבר למונו-רפו משותף — נדחה כרגע כהשקעת תשתית לא מידתית לפונקציה מתוזמנת בודדת; שכפול קבוע יחיד (`GRACE_PERIOD_DAYS`) מתועד הוא מחיר סביר. אלטרנטיבה נוספת: להריץ את בדיקת ה-sweep רק ב-production אחרי deploy אמיתי — נדחה כי Cloud Scheduler לא ניתן לדימוי מהימן ב-emulators, ואי אפשר "לדלג" 30 יום בפרודקשן; הסקריפט מאפשר בדיקה מקומית אמיתית של הקוד שרץ בפועל.

## 25. הצפנת שדות רגישים (Phase 4 — נותר) — AES-256-GCM application-level, יצירה/עריכת כרטיס עברו ל-Server Actions
**תאריך**: 2026-08-27
**החלטה**: `cvv`/`barcodeOrCode` מוצפנים ב-application level (AES-256-GCM, `src/lib/crypto/fieldEncryptionCore.ts`/`fieldEncryption.ts`) לפני שהם נכתבים ל-Firestore, מעבר להצפנת at-rest הקיימת של Google Cloud. הפורמט המאוחסן: `v1:<iv base64>:<authTag base64>:<ciphertext base64>`. המפתח (`CARD_FIELD_ENCRYPTION_KEY`, 32 בייט base64) נטען lazily בתוך הקריאה עצמה (לא ב-module top-level) כדי שלא יידרש ב-BUILD כמו `FIREBASE_ADMIN_PRIVATE_KEY` (ראו הפוסט-מורטם ב-Phase 3.3, `docs/DEPLOYMENT.md`) — ב-`apphosting.yaml` הוא `RUNTIME`-only.
**השלכה ארכיטקטונית**: עד עכשיו כל ה-CRUD של כרטיסים (`CardForm`, `EditCardDialog`) כתב ישירות ל-Firestore דרך ה-client SDK, כי Security Rules הספיקו לאכיפת הרשאות. הצפנה דורשת מפתח שאסור שיגיע ל-client, אז יצירה/עריכה של הכרטיס (החלק שנוגע ל-`cvv`/`barcodeOrCode`) עברו ל-Server Actions חדשים (`createCard`, `updateCardDetails`, `getCardSecrets` ב-`src/actions/card.ts`, Admin SDK). **רק** שני השדות האלה עברו לשרת — יצירת רשימה אוטומטית והעלאת תמונת כרטיס (`CardForm`) נשארו client-side כמו קודם, כדי לא להרחיב את ה-scope של השינוי. מכיוון שה-Admin SDK עוקף לגמרי את `firestore.rules`, `createCard` משתמש בפונקציית הרשאה חדשה (`assertCanManageListAndGetOwner` ב-`src/lib/auth/listAccess.ts`) שמשחזרת ידנית את אותה בדיקת `isNewOwner()`/`isManagerOfList()` שקיימת ב-Rules עבור `cards.create`.
**קריאה**: `useCard`/`useCards` (client `onSnapshot`) ממשיכים לקבל את מסמך הכרטיס המלא — כולל `cvv`/`barcodeOrCode` — אבל כערך מוצפן, לא כטקסט גלוי; שום קומפוננטה לא מציגה אותם ישירות מ-`card.cvv`/`card.barcodeOrCode` יותר. `EditCardDialog` קורא ל-`getCardSecrets` (Server Action, מפענח) בכל פתיחה של הדיאלוג במקום לקרוא ערכי ברירת מחדל מה-`card` prop. `buildUserDataExport` (`src/lib/services/export.ts`) מפענח לפני סריאליזציה לייצוא — המשתמש מקבל בחזרה טקסט קריא, לא ciphertext. שרת ה-MCP (`mcp-server/index.ts`) לא נגע כלל — הוא כבר משמיט את שני השדות לגמרי מלפני זה (ADR #17), ללא תלות בשאלה אם הם מוצפנים.
**מיגרציה**: כרטיסים קיימים שנוצרו לפני השדרוג עדיין מכילים טקסט גלוי. `decryptSensitiveField` מזהה ערך שלא תואם את פורמט `v1:` ומחזיר אותו כמו שהוא (fallback תואם-לאחור מכוון, לא permanent) במקום לזרוק שגיאת פענוח — כדי שכרטיסים לא-ממוגרים יישארו קריאים. `scripts/migrate-encrypt-sensitive-fields.ts` (Admin SDK, `tsx`, אותו pattern כמו `scripts/sweep-account-deletions.ts`) מצפין בפועל את כל הכרטיסים הקיימים; אידמפוטנטי (`isEncryptedField` מדלג על מה שכבר מוצפן), מיועד להרצה חד-פעמית אחרי כל deploy.
**אלטרנטיבה שנדחתה**: להשאיר את היצירה/עריכה client-side ולהצפין בצד הלקוח עם מפתח חשוף ב-bundle — נדחה מיידית: מפתח נגיש ל-client מבטל את כל התועלת של הצפנת application-level (כל תוקף שיש לו גישה ל-Firestore export/backup גם יכול לחלץ את המפתח מה-bundle). אלטרנטיבה נוספת: Cloud KMS envelope encryption במקום מפתח סטטי ב-Secret Manager — נדחה כרגע כ-over-engineering לשדה יחיד בסקאלה של אפליקציה אישית/משפחתית; ניתן לשדרג בעתיד בלי לשנות את הפורמט המאוחסן (רק את מקור המפתח).
**תיקון אבטחה שהתגלה בסקירה (2026-08-27, Phase 4.5)**: `createCard`/`updateCardDetails`/`getCardSecrets` קיבלו `cardId`/`listId` כ-`z.string().min(1)` ללא הגבלת תווים. Server Actions הם endpoint שניתן לקרוא לו ישירות עם payload שרירותי (לא מוגבל למה שה-UI שולח) — ומכיוון ש-`firebase-admin`'s `.doc()` מפרש `/` כמפריד path, `cardId` כמו `"<victimCardId>/usageLog/<injectedId>"` היה יוצר מסמך חדש בתת-אוסף של כרטיס **אחר לגמרי**, בלי שום בדיקת בעלות על אותו כרטיס-קורבן (אומת בפועל מול ה-emulator). `.create()` ב-`createCard` מונע דריסה של מסמך קיים באותו path בדיוק, אבל לא מונע יצירת מסמך חדש בנתיב מקונן שנוצר במיוחד. **תוקן**: `firestoreIdSchema` חדש (`src/lib/validation/card.ts`, `^[A-Za-z0-9_-]+$`) על כל שדה מזהה שמגיע מ-client input ב-Server Actions אלה — חוסם `/` (ומכאן גם `..`) לגמרי.

## 26. Firebase App Check (Phase 4 — נותר) — reCAPTCHA v3, קוד+debug mode הושלמו, Console enforcement נשאר ידני
**תאריך**: 2026-08-27
**החלטה**: `src/lib/firebase/appCheck.ts` מאתחל App Check בצד הלקוח (`initializeAppCheck` עם `ReCaptchaV3Provider`) כחלק מ-`src/lib/firebase/client.ts`, מוגן מאחורי אותו global flag guard כמו חיבור ה-emulators כדי לא לאתחל פעמיים ב-HMR. מצב debug (`NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG=true`, מוגדר כברירת מחדל ב-`.env.local`) עוקף לגמרי את reCAPTCHA האמיתי לטובת debug token — מאפשר לפיתוח מקומי ול-Playwright E2E לרוץ בלי site key אמיתי. אם אין site key ואין debug mode, `initAppCheck` פשוט לא מאתחל (לא זורק) — כדי שהאפליקציה תמשיך לעבוד בסביבות שעדיין לא עברו את הקמת ה-Console.
**נימוק**: זהו הפריט האחרון שנשאר מתועד תחת threat #4 ב-`docs/SECURITY.md` (abuse/spam על כתיבות ישירות ל-Firestore/Storage REST API, עוקף את ה-UI). App Check הוא הכלי הטבעי לזה ברמת Firebase — לא נדרש קוד Rules נוסף, ה-"Enforce" הוא toggle ברמת קונסולה per-service.
**היקף שנשאר ידני (Console, לא ניתן ל-scripting מ-CI/CLI ללא OAuth consent אינטראקטיבי)**: רישום site key אמיתי מול reCAPTCHA admin console + מילוי `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` ב-`apphosting.yaml`, ואז הפעלת "Enforce" בפועל על Firestore/Storage — **בכוונה בסדר הזה**: enforce לפני שיש טוקנים תקינים מגיעים מפרודקשן היה חוסם גישה לכל האפליקציה. תועד צעד-אחר-צעד ב-`docs/DEPLOYMENT.md`, אותו pattern כמו הקמת ה-WIF ל-Anthropic ב-ADR #20.
**Admin SDK לא מושפע**: App Check חל רק על client SDK מול Firestore/Storage ישירות. Server Actions ו-Cloud Functions (Admin SDK) ממשיכים לעקוף אותו לגמרי כמו שהם עוקפים Security Rules — זה כבר האמון שניתן לקוד server-side בארכיטקטורה הקיימת.
**אלטרנטיבה שנדחתה**: reCAPTCHA Enterprise במקום v3 — נדחה כרגע, v3 מספיק לסקאלה של אפליקציה אישית/משפחתית ופשוט יותר להקמה; ניתן לשדרג בעתיד (App Check תומך בהחלפת provider בלי לשנות קוד קורא).
**עדכון (2026-08-29)**: השומר "אם אין site key אל תאתחל" היה שגוי בפועל — ראו ADR #27.
**עדכון (2026-08-29) — ההחלטה על v3 התהפכה**: ראו ADR #28. גם ההנחה בסוגריים למעלה ("בלי לשנות קוד קורא") התבררה כשגויה — ה-provider הוא class שנבחר בקוד.

## 27. site key placeholder נחשב כ"מוגדר" → נפילת Google Sign-In בספארי נייד; דיווח שגיאות התחברות לשרת
**תאריך**: 2026-08-29
**רקע**: `apphosting.yaml` מגדיר `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY: "REPLACE_ME"` עד שרישום ה-Console (ADR #26) יתבצע. השומר ב-`appCheck.ts` בדק `!siteKey` — שתופס רק מחרוזת ריקה. `"REPLACE_ME"` הוא truthy, ולכן App Check אותחל מול site key שאינו קיים.
**למה זה הפיל דווקא התחברות**: ב-`@firebase/auth`, `_openPopup` קורא ל-`await _getRedirectUrl(...)`, וזה מחכה ל-`auth._getAppCheckToken()` **לפני** `window.open`. מול site key שבור ההמתנה כוללת סיבוב רשת מלא ל-`google.com/recaptcha` שנכשל, ואז exchange שמחזיר 403. iOS Safari חוסם `window.open` שלא קורה בתוך ה-user gesture המיידי → `auth/popup-blocked`. בדסקטופ כרום סלחני יותר, ולכן הכשל נראה כמו "בעיה בנייד בלבד".
**למה זה התגלה רק עכשיו**: הקוד נכנס ב-PR #14 אך לא הגיע לפרודקשן במשך יומיים בגלל ה-secret החסר (הפוסט-מורטם ב-`docs/DEPLOYMENT.md`). הוא נחת באוויר רק כשהרולאאוט התוקן — כלומר תקלה שנכתבה ביום אחד התפוצצה ביום אחר לגמרי, בלי commit סמוך שיסביר אותה.
**החלטה (1)**: `isConfiguredSiteKey` ב-`src/lib/firebase/appCheck.ts` פוסל placeholders (`REPLACE_ME`/`CHANGE_ME`/`TODO`/`YOUR_...`) ולא רק מחרוזת ריקה, ומדפיס `console.warn` כשהוא מדלג — הענף הזה היה שקט לחלוטין, וזו הסיבה שהמפתח השבור עבר בלי שאיש שם לב. בנוסף אזהרה רכה (לא חסימה) אם המפתח לא מתחיל ב-`6L`. מכוסה ב-`tests/unit/appCheckSiteKey.test.ts`.
**החלטה (2)**: `POST /api/auth-errors` — sink לכשלי התחברות בצד הלקוח, שנרשם ל-Cloud Logging כ-`jsonPayload.event="auth_sign_in_failed"`. `SignInButtons` מפריד בין שני שלבים (`provider-sign-in` מול `create-session`) ומציג את קוד השגיאה בטוסט. ביטול יזום של המשתמש (`auth/popup-closed-by-user`) לא מדווח ולא מציג שגיאה.
**נימוק**: פופאפ חסום נכשל כולו בדפדפן — השרת לא רואה בקשה, ולכן ל-Cloud Logging אין מה לרשום. האבחון של התקלה הזו דרש ארכיאולוגיית git במקום שאילתת לוג אחת. ה-toast הגנרי `"ההתחברות נכשלה, נסו שוב"` כיסה לפחות שישה כשלים שונים, כולל כשל צד-שרת ב-`createSession`.
**אבטחה**: הנקודה **לא מאומתת** בהכרח — היא מדווחת על כשלים שקורים לפני שקיים session cookie, אז אין uid לייחס אליו. תקרת ההתעללות נשמרת נמוכה דרך הצורה בלבד: כל שדה הוא enum חסום או קוד שעובר `AUTH_ERROR_CODE_PATTERN`, כך ששום טקסט חופשי בשליטת תוקף לא מגיע ל-Cloud Logging (מונע גם log injection דרך `\n`). **אין להוסיף שם שדה טקסט חופשי בלי לחזור לשיקול הזה.** ללא rate limiting: ה-limiter ב-`src/lib/services/rateLimit.ts` הוא per-uid, וכתיבת Firestore לכל POST אנונימי הייתה עסקה גרועה יותר מרעש הלוגים החסום שהנקודה יכולה לייצר.
**מה זה לא פותר**: `signInWithPopup` נשאר שביר בנייד. גם עם site key תקין, `_getAppCheckToken` שוב יכניס המתנה לפני `window.open` — הפעם מוצלחת, אבל עדיין סיבוב רשת. מעבר ל-`signInWithRedirect` בנייד נשאר פתוח ולא נכלל כאן.
**אלטרנטיבה שנדחתה**: rollback ל-`f94bc5f` (ה-build שעבד) — היה מחזיר את ההתחברות מיד אבל גם מחזיר את פרצת ה-path injection של ADR #25 לפרודקשן.

## 28. App Check עובר ל-reCAPTCHA Enterprise (מהפך על ADR #26)
**תאריך**: 2026-08-29
**החלטה**: `src/lib/firebase/appCheck.ts` משתמש ב-`ReCaptchaEnterpriseProvider` במקום `ReCaptchaV3Provider`. `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` נשאר אותו שם משתנה, אבל מחזיק מעתה **key id של reCAPTCHA Enterprise** ולא site key של v3 קלאסי.
**נימוק**: ADR #26 בחר ב-v3 הקלאסי מתוך שיקול פשטות. בפועל, בזמן ההקמה בקונסולה (2026-08-29) Firebase Console מציג `reCAPTCHA is deprecated, please use reCAPTCHA Enterprise instead` ומכוון את הרישום ל-Enterprise. בנייה על provider שהפלטפורמה מסמנת כ-deprecated עוד לפני שהוא הופעל אפילו פעם אחת היא חוב מיותר — עדיף לשלם את המעבר עכשיו, כשאין עדיין אף לקוח בפרודקשן ששולח טוקנים ואין מה לשבור.
**מה זה עלה בקוד**: החלפת ה-class ותו לא — הן `initializeAppCheck` והן שאר הקוד (`isConfiguredSiteKey`, ה-guard של debug mode, `client.ts`) לא השתנו. `firebase@12.18.0` מייצא את שני ה-providers.
**תיקון להנחה שגויה ב-ADR #26**: שם נכתב ש-"App Check תומך בהחלפת provider בלי לשנות קוד קורא". זה לא נכון — ה-provider הוא class שמועבר ל-`initializeAppCheck`, כלומר החלפה מחייבת שינוי קוד ו-rollout. ההערה נשארה שם עם הפניה לכאן, כדי שההנחה לא תשוכפל בהחלטה עתידית.
**הבדל תפעולי מרכזי**: v3 קלאסי מנפיק זוג site key + **secret key**, כשה-secret מודבק בקונסולת Firebase. ל-Enterprise **אין secret key בכלל** — המפתח נוצר ב-Google Cloud Console (Security → reCAPTCHA), האימות בצד השרת נעשה דרך IAM של הפרויקט, ולקונסולת Firebase מודבק רק ה-key id. משמעות: אין סוד חדש להכניס ל-Secret Manager, ו-`apphosting.yaml` ממשיך להחזיק את הערך כ-plain value.
**מלכודת מתועדת**: מפתחות Enterprise ומפתחות v3 קלאסיים **שניהם** מתחילים ב-`6L`. האזהרה הרכה ב-`appCheck.ts` (`EXPECTED_KEY_PREFIX`) לא מבחינה ביניהם, ולכן הדבקה של מפתח מהסוג הלא נכון תעבור בשקט ותיכשל רק ב-runtime מול reCAPTCHA. תועד גם בהערה בקוד וב-`apphosting.yaml`.
**עלות**: reCAPTCHA Enterprise דורש שה-API `recaptchaenterprise.googleapis.com` יהיה מופעל בפרויקט (Blaze כבר קיים מ-ADR #16). יש מכסה חינמית חודשית של assessments; מעבר לה יש חיוב. בסקאלה של אפליקציה אישית/משפחתית זה לא צפוי להיות גורם — אם השימוש יגדל, זו נקודה לבדוק מחדש.
**מה לא השתנה**: כל השאר ב-ADR #26 עומד בעינו — מצב ה-debug ל-dev/CI, ההתנהגות "אין key → לא מאתחל, לא זורק" (ADR #27), העובדה ש-Admin SDK לא מושפע, והסדר המחייב: site key ב-`apphosting.yaml` → rollout → אימות verified requests → ורק אז Enforce.

## 29. ערוץ WhatsApp — קישור ערוץ→משתמש, runtime, והיסטוריה בצד שרת
**תאריך**: 2026-08-29
**סוגר**: את הפריט הפתוח האחרון של ADR #17 ("קישור ערוץ→משתמש... זרימת linking לא מתוכננת עדיין ברמת המימוש"), `docs/ROADMAP.md` שלב 5.5.

**החלטה (1) — גזירת `uid` רק מ-`channelLinks`, לעולם לא מתוכן ההודעה.** ההודעה הנכנסת מ-WhatsApp נושאת מספר טלפון, וזה **לא** credential: כל אחד יכול לשלוח payload עם מספר של מישהו אחר. ה-uid נגזר מ-lookup ישיר ב-`channelLinks/{channel}:{externalId}`, שנוצר רק דרך זרימת הקישור המתוארת למטה. ה-tools עצמם לא משתנים כלל — `createMcpServer(uid, "whatsapp")` נועל את ה-uid בסגירה בדיוק כמו ב-Route Handler של הווב, וסכימות ה-input שלהם עדיין לא מכילות שדה `uid` (ADR #17).

**החלטה (2) — קוד חד-פעמי שנוצר באפליקציה בזמן שהמשתמש מאומת.** זו הנקודה היחידה בזרימה שבה יש הוכחת בעלות על החשבון: `createChannelLinkCode` קורא ל-`requireUid()`, מייצר קוד ב-`channelLinkCodes/{code}`, והמשתמש שולח אותו מהטלפון שלו. `redeemLinkCode` מחליף אותו בקישור בטרנזקציה אחת (קורא, מוודא לא-פג ולא-מומש, כותב `channelLinks` ומסמן `usedAt`). שני צדדים מוכחים: הקוד מוכיח בעלות על החשבון, והמקור של ההודעה מוכיח החזקה במספר.
- **8 תווי base32 (Crockford, בלי I/L/O/U) ולא 6 ספרות**: המנחש כאן הוא בוט ששולח הודעות, לא טופס ווב מאחורי CAPTCHA. 10^6 ניתן לסריקה; 32^8 (~10^12) לא. נוצר מ-`crypto.randomInt`, לא `Math.random`.
- TTL של 10 דקות, שימוש חד-פעמי, ויצירת קוד חדש מבטלת קודים קודמים שלא מומשו — כדי שלא יהיה יותר מ-credential אחד תלוי באוויר.
- כל הודעות הכישלון בפדיון זהות ("קוד לא תקין או שפג תוקפו"): הצד השולח אנונימי מעצם הגדרתו, ואסור שיוכל להבדיל בין "אין קוד כזה" ל-"פג".

**החלטה (3) — `channelLinks` ממופתח לפי `channelKey` ולא לפי `uid`.** הפוך מכל שאר ה-collections בפרויקט, שממופתחים לפי בעלות. הסיבה: ה-webhook מקבל מספר טלפון ותו לא, וחייב לגזור ממנו `get()` ישיר — query לפי uid לא אפשרי כשה-uid הוא בדיוק מה שמחפשים. המחיר הוא ש-`listChannelLinksForUid` דורש query על `where("uid","==",...)`, שזה בסדר גמור בהיקף של הפרויקט.

**החלטה (4) — שלושת ה-collections הם `allow read, write: if false`**, כולל קריאה של הבעלים. באוסף שממופתח לפי מספר טלפון, קריאה מותרת היא oracle שמאשר "האם המספר הזה רשום במערכת"; ו-`channelLinkCodes` הוא bearer credential, כך שקריאה של קוד לא-מומש של מישהו אחר מספיקה כדי לחטוף את הקישור שלו. ה-UI קורא את הערוצים של המשתמש דרך Server Action (`listMyChannelLinks`), לא דרך ה-client SDK.

**החלטה (5) — Route Handler ב-App Hosting, לא Cloud Function.** `src/app/api/chat/route.ts` כבר מייבא `createMcpServer`/`runAgentTurn`/`createAnthropicClient` ישירות מ-`src/lib/`; `functions/` הוא עצמאי בכוונה ולא משתף קוד עם `src/` (ADR #24), כך שוובהוק שם היה מחייב שכפול של כל שכבת ה-MCP וה-services. גם ה-WIF ל-Anthropic (ADR #20) קשור ל-service account של backend ה-App Hosting.

**החלטה (6) — ספק: WhatsApp Cloud API של Meta ישירות, לא Twilio.** ללא מתווך ועלות נוספת; ה-webhook הוא HTTPS פשוט וה-URL של App Hosting כבר ציבורי.

**החלטה (7) — היסטוריית שיחה ב-`chatSessions/{channelKey}` בצד שרת.** בווב ההיסטוריה נשמרת ב-state של הדפדפן ונשלחת מלאה בכל בקשה (ADR #22) — ב-WhatsApp אין לקוח שיחזיק אותה. TTL קצר (24 שעות מאי-פעילות) כדי לא לצבור PII לנצח.

**החלטה (8, מוקדמת בכוונה) — v1 מעבד את ההודעה inline לפני החזרת 200, לא ב-`after()`.** `after()` מ-`next/server` יציב ב-Next 16 ונתמך על Node server, אבל App Hosting רץ על Cloud Run, שם ה-CPU עלול להיחנק אחרי שהתשובה נשלחה — מה ש**ישתיק את הבוט בשקט**, הכשל הגרוע ביותר האפשרי כאן. במקום זה: עיבוד inline + דדופליקציה של `messageId` (`channelMessages/{messageId}`, נכתב ב-5.5.b) שהופכת את ה-retries של Meta ל-no-op. **אם ה-latency יתגלה כבעייתי — למדוד קודם**, ורק אז לשקול `after()` ואחריו Cloud Tasks. לא לבחור `after()` בלי מדידה.

**גבול האמון של ה-webhook** (יבוצע ב-5.5.b): `X-Hub-Signature-256` (HMAC-SHA256 עם `WHATSAPP_APP_SECRET`) על הגוף ה**גולמי**, לפני כל פרסור. זה שער האימות היחיד — מספר טלפון ניתן לזיוף, החתימה לא.

**מה נדחה מ-5.5.a במכוון**: אין עדיין webhook, ספק, סודות, או `channelMessages`. שלב 5.5.a מוכיח את זרימת הקישור מקצה לקצה (כולל E2E) לפני שמערבים צד שלישי — `src/actions/testChannelLink.ts` + `/e2e/redeem-link` הם stand-in של ה-webhook, נעולים ל-emulator באותו pattern כמו `mintTestCustomToken` (ADR #18).

## 30. ה-webhook של WhatsApp — החלטות מימוש
**תאריך**: 2026-08-29
**סוגר**: `docs/ROADMAP.md` שלב 5.5.b. משלים את ADR #29, שקבע את מודל האמון; כאן רק ההכרעות שנפתחו בזמן הכתיבה בפועל.

**החלטה (1) — שכבת `channelChat` ניטרלית לספק.** `src/lib/services/channelChat.ts` (`handleInboundChannelMessage`) מכיל את כל מה שאינו WhatsApp — פדיון קוד, rate limit, טעינת/שמירת היסטוריה, ה-agent turn — ואילו ה-Route Handler מחזיק חתימות, פרסור payload וקריאות Graph. ערוץ Telegram עתידי מוסיף route ו-provider adapter בלבד. הפונקציה **תמיד מחזירה טקסט לשליחה**, לעולם לא זורקת: ערוץ שלא עונה נראה מצד השולח כמו בוט מקולקל, ולכן גם כשל פנימי מתורגם למשפט בעברית.

**החלטה (2) — בדיקת קוד קישור לפני פיצול מקושר/לא-מקושר.** הודעה שנראית כמו קוד (8 תווי base32) נבדקת קודם, גם כשהמספר כבר מקושר — אחרת אי אפשר היה להעביר מספר לחשבון אחר, מה ש-ADR #29 מתיר במפורש. אם הפדיון נכשל **והמספר מקושר**, ההודעה ממשיכה כרגיל למודל, כך שמשתמש שכתב במקרה 8 תווים חוקיים ("12345678") לא נתקע בהודעת שגיאה.

**החלטה (3) — bucket שני ל-rate limit (`turns`), ומפתח `channelKey` לפני קישור.** כל הודעה נכנסת עולה קריאת LLM גם בלי קריאת tool, ולכן `RATE_LIMITS.turns` (12 ל-5 דקות) נצרך פעם אחת בראש כל תור. להודעה ממספר שאינו מקושר אין uid לחייב, והיא בדיוק משטח ניחוש קודי הקישור — ולכן היא נמדדת לפי `channelKey`. אומת מול ה-emulator: 12 הודעות עברו, ה-13 נחסמה.
**אלטרנטיבה שנדחתה**: מסמך `rateLimits` נפרד לכל bucket (`{uid}:{bucket}`) — נדחה כי מסמך אחד עם map פר-bucket שומר על כתובת אחת למשתמש ומאפשר לראות את שתי המכסות במבט אחד; `merge:true` מונע דריסה הדדית.

**החלטה (4) — `chatSessions.history` נשמר כמחרוזת JSON ולא כמערך.** `BetaMessageParam[]` הוא מבנה של ה-SDK שאיננו הבעלים שלו: שדות `undefined` בתוכו גורמים ל-Firestore לזרוק, וייצוגים מקוננים עלולים להיתקל באיסור "מערך בתוך מערך". סריאליזציה אחת מנתקת את הסכימה מגרסת ה-SDK. גזימה בגבול ~200KB נעשית **רק על גבול של הודעת משתמש אמיתית** (`trimHistory`, `src/lib/mcp/historyLimits.ts`) — חיתוך לפי מספר הודעות היה מפריד בין `tool_use` ל-`tool_result` ויוצר בקשה שה-API דוחה.

**החלטה (5) — מפתח הדדופליקציה הוא hash ולא ה-`messageId` הגולמי.** `wamid` הוא base64-ish ועשוי להכיל `/`, ש-`.doc()` של firebase-admin מפרש כמפריד path — מחלקת ה-path injection של ADR #25. `sha256("<channelKey> <messageId>")` נותן אורך ומרחב תווים קבועים ונשאר דטרמיניסטי. התביעה נעשית **לפני** העיבוד: ריצה כפולה של `logUsage`/`deleteCard` גרועה מתשובה שאבדה.

**החלטה (6) — הקוד נפרס בלי הסודות, וה-endpoint מחזיר 503 עד שיוגדרו.** `apphosting.yaml` **לא** מקבל רשומות `secret:` בשלב הזה: הוספת סוד שלא הוזרק בפועל מפילה rollout ולא מנסה שוב (הפוסט-מורטם של Phase 4.3, `docs/DEPLOYMENT.md`). `getInboundConfig()` מחזיר `null` כשאין `WHATSAPP_APP_SECRET`/`WHATSAPP_VERIFY_TOKEN`, ה-handler עונה 503, וההקמה ב-5.5.c היא זו שמפעילה אותו. מסיבה דומה `getOutboundConfig()` נפרד: פריסה שמקבלת הודעות אך לא יכולה לענות (E2E מול emulator) היא מצב לגיטימי ולא תקלה.

**החלטה (7) — `POST` מחזיר 200 על כל דבר שעבר את החתימה.** גם payload לא-פריק, גם כשל בעיבוד, וגם כשל בשליחת התשובה. כל סטטוס אחר גורם ל-Meta לנסות שוב ובסוף לנתק את המנוי — ומכיוון שההודעה כבר נתבעה לדדופליקציה, ניסיון חוזר לא היה מייצר תשובה ממילא. רק חתימה שגויה מקבלת 401.

## 31. חלון 24 השעות של WhatsApp — אילוץ ספק מאומת, ומה הוא עושה ל-Phase 7
**תאריך**: 2026-08-30
**סוגר**: `docs/ROADMAP.md` שלב 5.5.c. מקבע כאילוץ ארכיטקטוני את מה ש-5.5.b תיאר כהעדפה.

**הרקע**: לאורך התכנון נכתב שהבוט "רק עונה ואף פעם לא יוזם". זה נוסח כהחלטת עיצוב. בהקמה מול Meta (2026-08-29) התברר שזו לא בחירה: שליחה ראשונה נכשלה ב-`131047 Re-engagement message`, ואותה שליחה בדיוק עברה אחרי שהנמען שלח הודעה למספר הבוט. WhatsApp מתיר טקסט חופשי **רק בתוך 24 שעות מההודעה האחרונה של הלקוח**.

**החלטה (1) — לא מנסים לעקוף את החלון.** אין ניסיון לשמור "חלון פתוח" מלאכותית, אין תזכורות keep-alive, ואין ניסיון לשלוח מחוץ לחלון ולתפוס את הכישלון. הבוט נשאר תגובתי בלבד, מה שמשאיר אותו בתוך החלון מעצם ההגדרה.

**החלטה (2) — Phase 7 ב-WhatsApp הוא פרויקט נפרד, לא הרחבה.** תזכורות תפוגה יזומות ייחסמו ב-`131047` בדיוק כמו כל שליחה אחרת מחוץ לחלון. הן דורשות **message templates מאושרים מראש** מ-Meta — תהליך אישור תוכן נפרד, עם קטגוריות ומגבלות ניסוח משלו, ובנייה מחדש של נתיב השליחה (`sendWhatsAppText` שולח `type: "text"` בלבד). ההשלכה המעשית: **התראות Phase 7 מתוכננות סביב FCM ואימייל**, ו-WhatsApp נשאר ערוץ שיחה. מי שיתכנן את Phase 7 לא צריך לגלות את זה מחדש.

**החלטה (3) — כשל שליחה מחוץ לחלון נבלע ללוג, ולא מגולגל אחורה.** אם עיבוד הודעה מתארך מעבר לחלון (או ב-retry מאוחר של Meta), `sendWhatsAppText` נכשל **אחרי** שהפעולה כבר בוצעה — כרטיס נוצר, יתרה עודכנה — ומהצד של המשתמש זה נראה כמו בוט שותק ששינה נתונים. נבחר לחיות עם זה: rollback של פעולה שהצליחה בגלל כשל תקשורת גרוע יותר, וכל סטטוס שאינו 200 היה גורם ל-Meta לשלוח שוב (ADR #30 החלטה 7). נדיר בפרודקשן — הבוט עונה בשניות — ומתועד כדי שלא יאובחן מאפס.

**מה זה לא אומר**: `131030` (recipient not in allowed list) היא שגיאה **אחרת** לגמרי, ששייכת למגבלת מספר הטסט ולא לחלון. `131047` דווקא מעידה שהנמען מאושר.

## 32. תקלת ייצוא הנתונים (2026-08-30) — טייפ שמשקר על Firestore, ומפתח Server Actions שמתחלף בכל deploy
**תאריך**: 2026-08-30
**סוגר**: תקלת פרודקשן — "ייצוא הנתונים נכשל" במסך ההגדרות. שתי תקלות שונות שהופיעו ברצף מאחורי אותה הודעת toast.

**הרקע**: הלחצן החזיר 404 על `POST /settings`, ואחרי רענון קשיח — 500. אותו טקסט שגיאה בשני המקרים, כי `ExportDataButton` עטף הכל ב-`catch` ריק. שני הגורמים אובחנו בנפרד מול production build מקומי (`next start` + emulators) עם קריאה אמיתית ל-Server Action ו-session cookie תקין, ומטריצה של שבעה תרחישי דאטה — רק אחד מהם החזיר 500.

**החלטה (1) — `decryptNullableField` מנרמל `undefined`, ולא רק `null`.** ה-500 היה `TypeError: Cannot read properties of undefined (reading 'split')`. `GiftCard` מצהיר `cvv`/`barcodeOrCode` כ-`string | null`, אבל מסמך Firestore שנכתב **לפני** שהשדות האלה נוספו פשוט לא מכיל אותם — ו-`doc.data() as GiftCard` מחזיר `undefined` בלי ש-TypeScript יראה דבר. הטייפ משקר, וה-cast הוא זה שמאפשר לו. הנרמול נכנס לתוך `fieldEncryptionCore.ts` ולא לכל call site: `src/lib/services/cards.ts` כבר הגן על עצמו עם `?? null` ו-`src/lib/services/export.ts` לא, וזה בדיוק סוג ההבדל שאף אחד לא מבחין בו בביקורת קוד. **ההשלכה הרחבה**: כל `as SomeType` על `doc.data()` בקוד הזה נושא את אותה חשיפה למסמכים ישנים.

**החלטה (2) — `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` מקובע ב-Secret Manager.** ה-404 לא היה שגיאת ניתוב אלא `handleUnrecognizedFetchAction` של Next (`x-nextjs-action-not-found: 1`): מזהי ה-Server Actions נגזרים ממפתח שנוצר **אקראית** בכל build שאין לו cache חם (`loadOrGenerateKey`), וכל rollout של App Hosting בונה בקונטיינר נקי — ולכן כל rollout, גם כזה שנוגע רק ב-docs, מחליף את **כל** המזהים. מקומית זה מתחבא: `.next/cache/.rscinfo` שומר את המפתח בין builds (עד תפוגת 14 יום או `rm -rf .next`). נמדד: שני builds נקיים עם מפתח מקובע נתנו מזהים זהים, ובלעדיו שרדו 0 מתוך 18. כל טאב פתוח עם ה-bundle הקודם מתחיל לירות מזהים שהשרת החדש לא מכיר. זה לא ספציפי לייצוא; זה חל על כל פעולה באפליקציה, וזו הסיבה שהרענון הקשיח "תיקן" את התסמין. קיבוע המפתח הופך את המזהים ליציבים בין builds. **רוטציה של המפתח שקולה להיעדרו** — היא שוברת כל לקוח פתוח, ולכן הוא נוצר פעם אחת ונשמר.

**החלטה (3) — `requireUid()` זורק `ActionError` ולא `Error`.** נמצא אגב האבחון: session שפג החזיר 500 עם הודעה מצונזרת במקום "יש להתחבר מחדש", כי `toActionResult` מגלגל הלאה כל מה שאינו `ActionError` (ADR #18). `src/proxy.ts` מפנה רק כשה-cookie **חסר** ולא בודק cookie קיים אך פג, ולכן זו הנקודה היחידה שבה המצב הזה מתגלה.

**החלטה (4) — ה-`catch` בצד הלקוח מציג את ה-`digest`.** בפרודקשן Next מוחק את הודעת השגיאה ומשאיר רק `digest`, שהוא המזהה של שורת הלוג המקבילה בשרת. הצגתו הופכת "ייצוא הנתונים נכשל" — שהיה זהה עבור 404 ועבור 500 — למשהו שאפשר לחפש ב-App Hosting logs. השגיאה גם נרשמת ל-console.

**מה זה לא**: לא סריאליזציה של `Timestamp` מעבר לגבול ה-RSC, ולא ערכים לא-מוצפנים שלא עברו מיגרציה — שניהם נבדקו ונשללו במטריצה.

> **תיקון (2026-08-30, אחרי ה-rollout)**: הגרסה המקורית של הפסקה הזו שללה גם "בעיית אינדקס Firestore". זה היה שגוי, והשלילה נשענה על מטריצה שרצה מול ה-emulator — שבונה אינדקס לכל שאילתה ולכן לא יכול היה להפריך כלום בנושא. הכשל שפרודקשן נתקל בו בפועל **היה** אינדקס חסר (ADR #33). החלטה (1) כאן מתקנת באג אמיתי אך חבוי: שאילתת ה-collection group יושבת ב-`Promise.all` שלפני פענוח הכרטיסים, ולכן `undefined.split` מעולם לא הספיק לרוץ בפרודקשן. החלטות (2)-(4) עומדות בזכות עצמן, והחלטה (4) היא זו שאיפשרה למצוא את ADR #33.

## 33. אינדקס single-field ב-collection group — הכשל האמיתי של ייצוא הנתונים
**תאריך**: 2026-08-30
**סוגר**: תקלת פרודקשן שנותרה פתוחה אחרי ADR #32. מתקן גם את פסקת "מה זה לא" שם.

**הרקע**: אחרי ה-rollout של ADR #32 הייצוא עדיין נכשל, גם עבור משתמש ללא כרטיסים כלל — מצב שבו אף אחד מהתיקונים של #32 בכלל לא נקרא. ה-`digest` שנוסף שם (החלטה 4) הופיע ב-toast והוביל ישירות לשורת הלוג:

```
9 FAILED_PRECONDITION: The query requires a COLLECTION_GROUP_ASC index
for collection members and field memberUid
```

אותו `digest` (`1580933236`) מופיע בלוגים כבר ב-`build-2026-08-30-001`, כלומר **לפני** ה-merge של #32. הייצוא לא נשבר באותו יום — הוא מעולם לא עבד בפרודקשן.

**החלטה (1) — `fieldOverride` על `members.memberUid` עם `COLLECTION_GROUP ASC`.** Firestore יוצר אינדקס single-field אוטומטי לכל שדה, אבל **רק ב-collection scope**; שאילתת `collectionGroup` על שדה בודד דורשת הצהרה מפורשת. `buildUserDataExport` היא היחידה שמריצה `where("memberUid","==",uid)` **בלי** `status`, בכוונה — ייצוא חייב לכלול גם הזמנות שטרם נענו. כל שאר הצרכנים (`useCardLists`, `usePendingInvitations`, `cardLists.ts`, `cards.ts`) מסננים `status` ולכן מוגשים ע"י האינדקס המרוכב `(memberUid, status)` שקיים מאז Phase 2 — ולכן שאר האפליקציה עבדה תקין וכיסתה על החוסר.
**אלטרנטיבה שנדחתה**: להוסיף `status` לשאילתת הייצוא כדי "ליפול" על האינדקס הקיים — נדחה כי זה משנה את הסמנטיקה של הייצוא (איבוד ההזמנות ה-pending) כדי לחסוך שורה בקובץ אינדקסים.

**החלטה (2) — ה-override מצהיר במפורש גם על `COLLECTION ASC/DESC`.** `fieldOverride` **מחליף** את האינדוקס האוטומטי של השדה במקום להתווסף אליו. רשומה שמכילה רק `COLLECTION_GROUP` הייתה מכבה את האינדקסים האוטומטיים ושוברת דווקא את ארבע השאילתות שכן עובדות. זו מלכודת שקטה: היא לא מייצרת שגיאה בזמן deploy.

**החלטה (3) — אותו תיקון מכסה באג חבוי במחיקת חשבון.** `functions/src/accountDeletion.ts` מריץ את אותה שאילתה בדיוק, מאותה סיבה (מחיקה חייבת לכלול הזמנות pending). אין לו לוגי שגיאה רק משום שאף חשבון לא הגיע עדיין ל-sweep. זכות המחיקה (GDPR, `docs/PRIVACY.md`) הייתה נכשלת בפעם הראשונה שמישהו היה משתמש בה.

**מה זה לא — ולמה אין כאן בדיקת E2E.** האמולטור של Firestore בונה אינדקס לכל שאילתה שמגיעה אליו, ולכן `npm run test:e2e` היה ירוק (15/15) בזמן שפרודקשן נכשל, ובדיקה חדשה מול האמולטור תהיה ירוקה גם אם האינדקס יימחק שוב. **בדיקה כזו הייתה נותנת ביטחון כוזב ולכן לא נכתבה.** השומר היחיד שעובד הוא התאמה ידנית: לכל `collectionGroup(` בקוד צריכה להיות רשומה מתאימה ב-`firestore.indexes.json` — שש כאלה נכון להיום, ממופות ב-`docs/DATA_MODEL.md`.

**לקח כללי**: `docs/DECISIONS.md` #32 שלל "בעיית אינדקס" על סמך מטריצת בדיקות שרצה מול האמולטור. מטריצה מול האמולטור אינה יכולה לשלול כשל אינדקס — היא עיוורת לו לחלוטין. שלילה של סיבה אפשרית תקפה רק אם כלי הבדיקה מסוגל להראות אותה.

## 34. התחברות עוברת מ-`signInWithPopup` ל-`signInWithRedirect` (סוגר סעיף פתוח ב-ADR #27)
**תאריך**: 2026-08-30
**סוגר**: הסעיף שנשאר פתוח במפורש ב-ADR #27: "מעבר ל-`signInWithRedirect` בנייד נשאר פתוח ולא נכלל כאן". GitHub issue #32.

**החלטה**: `signInWithProvider` (`src/lib/auth/authService.ts`) קורא ל-`signInWithRedirect` במקום `signInWithPopup`, לכל הדפדפנים — לא רק בנייד/Safari. נוסף `completeRedirectSignIn` (עוטף `getRedirectResult`). זרימת הקישור/session (`getIdToken` → Server Action `createSession`) נשארה זהה; רק נקודת ההפעלה שלה זזה מ-callback מיידי בתוך `handleSignIn` ל-`useEffect` שרץ בכל mount של `SignInButtons`, כולל ה-mount שקורה כשהאפליקציה חוזרת מ-Google לאותו URL.

**נימוק**: `signInWithPopup` תלוי ב-`window.open` שקורה מיד בתוך user gesture; ADR #27 כבר תיעד שהמתנה ל-App Check token לפני הקריאה שוברת את זה ב-iOS Safari (`auth/popup-blocked`). גם עם App Check תקין, ADR #27 ציין ש"סיבוב רשת" נשאר לפני `window.open` — כלומר הפגיעות המבנית (popup תלוי-תזמון) לא נפתרת רק בתיקון ה-site key, היא תלויה בזרימה עצמה. Redirect מנווט את כל העמוד, כך שאין תלות בתזמון של `window.open` מול gesture בכלל — לא רק "עובד יותר טוב", אלא מסלקת מחלקת הבאג הזו. אין סיבה להגביל את הזרימה לנייד בלבד: redirect עובד זהה בדסקטופ, ושמירה על שני מסלולים (popup לדסקטופ, redirect לנייד) הייתה מכפילה את משטח הבדיקה/הבאגים בלי תועלת אמיתית.

**השלכה על ניהול ה-state**: בניגוד ל-popup (שמחזיר `Promise<User>` ישירות בתוך אותו טעינת-עמוד), redirect מנווט את הדפדפן משם וחזרה — `handleSignIn` הופך ל-fire-and-forget, וה-`user`/שגיאה מגיעים רק אחרי ש-`SignInButtons` נטען מחדש מאפס בעמוד המקורי (Firebase שומר את ה-URL המקורי ומנווט חזרה אליו). כדי לשמר `providerId` לתצוגת "מתחבר..." ולדיווח שגיאות (`stage`/`providerId` ב-`reportAuthError`) על פני ה-round-trip הזה, `SignInButtons` כותב אותו ל-`sessionStorage` (`shovarim:pendingSignInProvider`) לפני הניווט. `completeRedirectSignIn`/`getRedirectResult` עצמו **לא** תלוי ב-`sessionStorage` הזה — הוא נקרא ללא תנאי בכל mount (התבנית המומלצת של Firebase), כדי שאובדן ה-flag (מצב גלישה פרטית, טאב שנוקה) לא יאבד את תוצאת ה-redirect עצמה, רק את הליבל/הדיווח הנלווים לה.

**קודי שגיאה**: `authErrors.ts` הוחלף מקודים ספציפיים ל-popup (`auth/popup-blocked`, `auth/popup-closed-by-user`, `auth/cancelled-popup-request`) לקודים הרלוונטיים ל-redirect (`auth/redirect-cancelled-by-user` כ"ביטול לגיטימי", `auth/web-storage-unsupported` כהודעה חדשה ב-`MESSAGES_BY_CODE`) — לא נשארו כ-fallback מת, כי הם לא יכולים לקרות יותר מהזרימה הזו.

**אלטרנטיבה שנדחתה**: זיהוי UA (Safari/מובייל) והפעלת redirect רק שם, popup בכל השאר — נדחה: מוסיף ענף קוד ומשטח בדיקה (שני מסלולי sign-in) כדי לשמר התנהגות (popup) שאין לה יתרון אמיתי על redirect בדסקטופ, רק כדי "לא לשנות את מה שכבר עבד" — לא נימוק מספיק מול הפשטות של מסלול יחיד.

## 35. `authDomain` שונה מהדומיין של האפליקציה → Safari חוסם את איחזור תוצאת ה-redirect; תוקן ב-reverse proxy
**תאריך**: 2026-08-30
**סוגר**: תקלה שהתגלתה אחרי ADR #34 — בדיקה ידנית של המשתמש הראתה ש-Chrome/מחשב עובד, אבל Safari באייפון: לוחצים "המשך עם Google", בוחרים חשבון, וחוזרים לעמוד הבית **כאילו לא התחברו** — בלי הודעת שגיאה בכלל.

**האבחון**: זרימת ה-sign-in של Firebase Auth (redirect **וגם** popup — לא רק redirect) לא מעבירה את תוצאת ה-OAuth בחזרה לאפליקציה ישירות. היא תלויה ב-iframe חבוי שהאפליקציה שלנו מטמיעה, מצביע על `https://shovarim-prod.firebaseapp.com/__/auth/iframe`, שדרכו נבדק/מועבר מצב ההתחברות (`_isIframeWebStorageSupported` ב-`@firebase/auth`, אומת ישירות מול קוד ה-SDK המותקן). ה-iframe הזה הוא cross-site ביחס לאפליקציה שלנו: `apphosting.yaml` הגדיר `authDomain: shovarim-prod.firebaseapp.com` בעוד שהאפליקציה עצמה רצה תחת `shovarim-web--shovarim-prod.europe-west4.hosted.app` — שני eTLD+1 שונים לגמרי (`firebaseapp.com` מול `hosted.app`). Safari (16.1+, גם בנייד וגם בדסקטופ) חוסם גישת אחסון ל-iframe cross-site כזה כברירת מחדל (ITP) — ולכן `getRedirectResult()` פשוט resolve-ה ל-`null` בלי שגיאה, בדיוק כמו "אין redirect ממתין". Chrome עדיין לא אוכף את החסימה הזו כברירת מחדל, ולכן עבד תקין באותו קוד בדיוק.
**חשוב**: זו לא בעיה ספציפית ל-redirect — `_isIframeWebStorageSupported` נבדק גם בזרימת popup (`PopupOperation.onExecution`, דוחה עם `auth/web-storage-unsupported` אם החסימה קיימת). כלומר גם popup היה נכשל תחת אותו Safari, רק עם שגיאה גלויה במקום כישלון שקט — חזרה ל-popup (ADR #34) לא הייתה פותרת את זה, רק משנה את צורת הכישלון.

**החלטה (1) — reverse proxy ב-Next.js, לא דומיין מותאם אישית.** `next.config.ts` מוסיף `rewrites()` ל-`/__/auth/:path*` ו-`/__/firebase/init.json` שמעבירים שקוף (לא HTTP redirect — קריטי, לפי ההנחיה הרשמית של Firebase ב-https://firebase.google.com/docs/auth/web/redirect-best-practices) אל `https://${NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com/...`. `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` ב-`apphosting.yaml` השתנה מ-`shovarim-prod.firebaseapp.com` ל-`shovarim-web--shovarim-prod.europe-west4.hosted.app` (דומיין האפליקציה עצמה) — כך ה-iframe הופך **first-party** מנקודת המבט של Safari, וה-ITP לא חוסם אותו.
**נימוק לבחירה בין 3 האופציות המתועדות של Firebase (custom domain / reverse proxy / self-host helper files)**: דומיין מותאם אישית (Option 1) היה הפתרון "הכי נקי" אבל דורש רכישת/הגדרת DNS לדומיין חדש — פרויקט צד (לא קיים כרגע דומיין מותאם אישית לאפליקציה). Self-hosting של קבצי ה-helper (Option 3) לא נתמך ל-SAML/Apple ודורש סנכרון ידני חוזר מול Firebase לעדכוני אבטחה. Reverse proxy (Option 2) התאים בול לארכיטקטורה הקיימת: App Hosting כבר מריץ שרת Next.js אמיתי (Cloud Run, ADR #16) עם routing מלא — לא static hosting — כך שהוספת rewrite היא שינוי קוד קטן, לא תשתית חדשה, ועדיין עומדת בדרישה של Firebase ש"הדפדפן לא יראה את הדומיין המקורי" (rewrite, לא redirect).
**מה נשאר תלוי בדומיין `firebaseapp.com`**: ה-proxy עצמו עדיין קורא ל-`shovarim-prod.firebaseapp.com` מתחת למכסה (בצד שרת, לא מהדפדפן) — לכן ה-redirect URI המקורי חייב להישאר רשום ב-Google OAuth client, לצד זה החדש. זה **לא** דומיין מותאם אישית אמיתי, רק מיסוך; אם `firebaseapp.com` ישתנה/יוסר אי-פעם, ה-proxy נשבר.

**החלטה (2) — סדר deploy קפדני, לא "בואו נעלה ונראה".** בניגוד לרוב שינויי ה-config האחרים בפרויקט (שרק דורשים secret/console step בזמן כלשהו לפני/אחרי), כאן **סדר הפוך שובר sign-in לגמרי בכל דפדפן, לא רק Safari**: אם ה-`apphosting.yaml` עם ה-`authDomain` החדש יוצא ל-production לפני שנרשם ה-redirect URI התואם (`https://shovarim-web--.../__/auth/handler`) ב-Google Cloud Console (OAuth 2.0 Client ID), Google ידחה כל ניסיון sign-in עם `redirect_uri_mismatch`. תועד runbook מפורש ב-`docs/DEPLOYMENT.md` עם הצעד הידני (חובה) **לפני** המיזוג ל-`main` — אותו pattern בדיוק כמו "site key לפני Enforce" ב-ADR #26.
**רישום redirect URI זה ידני במכוון**: Firebase Console "Authorized domains" (שכבר כולל את דומיין ה-App Hosting, מהתקלה הקודמת שתועדה ב-`docs/DEPLOYMENT.md`) שולט על אילו דומיינים Firebase Auth **עצמו** מכיר כ"מקור לגיטימי", אבל **לא** מסתנכרן אוטומטית לרשימת ה-redirect URIs של ה-OAuth client הספציפי ב-Google Cloud Console — אלה שני משטחי הרשאה נפרדים, ואף אחד מהם לא סוגר את השני.

**מה נדחה מכוונת**: תיקון "רך" — לתפוס `getRedirectResult()`-שמחזיר-null ולהציג הודעת שגיאה ברורה למשתמש ("נסו שוב בדפדפן אחר") במקום לתקן את השורש — נדחה: זה משאיר את Safari (חלק ניכר מהתעבורה הפוטנציאלית) שבור לחלוטין, רק עם UX פחות מבלבל. הבעיה ניתנת לתיקון אמיתי בלי תלות בדפדפן הלקוח, אז נבחר בכך.

## 36. `cvv`/`barcodeOrCode` הופכים לשדות tool ב-`createCard`/`updateCard` — חריגה מפורשת ומצומצמת מ-ADR #17/#22
**תאריך**: 2026-08-30
**רקע**: GitHub issue #37 שאל למה הבוט מסרב לקבל מספר כרטיס/CVV/תמונה בצ'אט. התשובה המקורית (ADR #17/#22: שדות אלה לעולם לא בסכימת ה-tool) הייתה החלטה מכוונת, לא מגבלה טכנית — אך המשתמש ביקש במפורש לבטל אותה עבור קוד/ברקוד ו-CVV (**לא** עבור תמונה, שנשארת בלעדית לאתר: אין תמיכת vision ב-`agentLoop.ts`, ואין זרימת upload דרך ה-tools).

**החלטה**: `createCardToolShape`/`updateCardToolShape` (`src/lib/mcp/toolSchemas.ts`) מקבלים `barcodeOrCode`/`cvv` — אותם Zod schemas בדיוק כמו טופס האתר (`cvvSchema`, `src/lib/validation/card.ts`), לא שכפול. ב-`createCard` השדות חובה-nullable כמו שאר שדות היצירה. ב-`updateCard` השדות **schema-optional** (`.optional()` מעל ה-`.nullable()` הקיים) — השמטת המפתח מהקריאה = "השאר ללא שינוי" (השרת ממשיך להשתמש בערך המפוענח הקיים דרך `getCardSecretsForUid`, בדיוק כמו ההתנהגות הקודמת), `null` מפורש = מחיקה, ערך = עדכון. זו הבחנה שלא הייתה קיימת קודם ונדרשה כאן: לפני זה `updateCard` תמיד שלח את הערך הקיים חזרה (המודל לא היה יכול לשנות אותו בכלל), ועכשיו המודל חייב דרך להביע "לא נגעתי בזה" בלי לדעת את הערך הנוכחי (שלא נחשף לו — ראו למטה).
**מה לא השתנה**: ההצפנה (AES-256-GCM, `fieldEncryptionCore.ts`), נתיב הכתיבה/קריאה (Admin SDK בלבד, אותן פונקציות שירות `createCardForUid`/`updateCardDetailsForUid`/`getCardSecretsForUid`), וההסתרה בכלי הקריאה (`getCard`/`listCards` ממשיכים להשמיט את שני השדות דרך `serializeCardForLlm` — ADR #36 הוא חריגה בכתיבה בלבד, לא בקריאה). תמונת כרטיס (`cardImageUrl`/`receiptImageUrl`) נשארת מחוץ לכל סכימת tool, ללא שינוי.
**Audit**: `paramsSummary` של `createCard`/`updateCard` נוסף עם `hasSecrets`/`secretsTouched` בוליאני (האם השדות הוזנו/נגעו) — **בלי** הערך עצמו, עקבי עם ההערה הקיימת ב-`src/types/auditLog.ts` ("paramsSummary must never include secrets").
**system prompt**: האיסור הישן ("לעולם אל תבקש/תקבל CVV") הוחלף בהנחיה שמתירה זאת אך אוסרת בפירוש להמציא ערך או לבקש אותו ביוזמת הבוט, ומדגישה את סמנטיקת ה"השמטה = ללא שינוי" ב-`updateCard` (`src/lib/mcp/systemPrompt.ts`).

**מה השתנה בפועל בהיקף האבטחה, ולמה זה עדיין נחשב "מקסימלי" בהינתן הדרישה**:
- הערך שהמשתמש מקליד עובר כעת כחלק מתוכן ההודעה **אל תוך קונטקסט המודל** (Anthropic API) ונשמר בהיסטוריית השיחה עד לאיפוס/דחיסה — שינוי אמיתי מול ADR #17/#22, לא קוסמטי.
- **prompt caching לא מכסה את זה**: `cache_control: ephemeral` יושב אך ורק על בלוק ה-system (`agentLoop.ts`) — היסטוריית ההודעות (כולל כל ערך cvv/ברקוד שהוקלד) **אינה** נכנסת ל-cache prefix. אומת בקוד, לא רק בהנחה.
- **בווב**: ההיסטוריה חיה רק ב-state של הדפדפן (ADR #22) — לא נשמרת בשרת, נעלמת ברענון דף.
- **בוואטסאפ** (המשתמש אישר לאפשר גם כאן): הערך עובר דרך שרתי Meta (כמו כל תוכן הודעה אחר בערוץ הזה) ונשמר ב-`chatSessions/{channelKey}` בצד שרת עד 24 שעות אי-פעילות (ADR #29/#30). זו הרחבה ממשית של משטח החשיפה של `docs/PRIVACY.md` — הסעיף "חובות פתוחות" שם כבר מסמן ש"תוכן ההודעות עובר דרך שרתי Meta" כטעון עדכון Privacy Policy + re-consent **לפני** פרודקשן, וזה עכשיו נכון גם לגבי cvv/ברקוד במפורש, לא רק ליתרות/שמות כרטיסים. **לא טופל כאן** — משימת מדיניות/consent נפרדת, לא קוד.
- **מה כן נשאר קבוע**: המפתח (`CARD_FIELD_ENCRYPTION_KEY`) עדיין לעולם לא מגיע ל-client; ההצפנה עדיין קורית מיד עם הכתיבה ל-Firestore, לא אחרי; אין שכפול לוגיקה — אותה שכבת שירות בדיוק כמו טופס האתר.
**אלטרנטיבה שנשקלה ונדחתה** (הוצגה למשתמש לפני ההחלטה): ערוץ צד ב-UI (widget מאובטח שפונה ישירות ל-Server Action הקיים בלי לעבור דרך המודל בכלל, ו-magic link לוואטסאפ) — היה שומר על ADR #17 בלי פשרה, אך המשתמש ביקש במפורש שהבוט "ידע לטפל בנתונים האלה", כלומר שהערכים כן יעברו דרך ה-tool call. נדחה לטובת הבקשה המפורשת.

## 37. שיתוף רשימה עם משתמש שאינו רשום — הזמנה לפי מספר טלפון, אישור דרך עמוד ווב, לא דרך שיחת בוט
**תאריך**: 2026-08-31
> **החלטות 1 ו-3 הוחלפו ב-ADR #38** (באותו יום): השיתוף כבר לא נוקב במספר טלפון, ולכן הלינק הפך ל-bearer credential וקישור המספר ירד משער-הרשאה להעשרה. החלטה 2 (אישור בעמוד ווב ולא בשיחת בוט) עומדת בעינה. הזמנות שנוצרו לפי ADR #37 ממשיכות להיאכף בתנאים שלהלן עד שיפוגו.
**רקע**: GitHub issue #58 — `inviteListMember` (ADR #15) מזמין רק לפי אימייל, ומחייב שלמוזמן כבר יש חשבון (`adminAuth.getUserByEmail`). אין דרך לשתף רשימה עם מישהו שהבעלים מכיר רק את מספר הוואטסאפ שלו, או שעדיין אין לו חשבון בכלל. הניסוח המקורי של ה-issue הציע שה"אישור/סירוב" יתבצע כהודעת טקסט חופשית לבוט הוואטסאפ, ושהודעה כזו תוכל גם **ליצור חשבון** למי שעדיין לא רשום.

**החלטה (1) — האישור בוואטסאפ לעולם לא יוצר חשבון.** לאחר בירור עם המשתמש: הרשמה נשארת אך ורק דרך Google Sign-In באתר (תואם את ADR #2 — ספקי auth דרך `src/lib/auth/` בלבד, ואין נתיב חשבון מבוסס-טלפון-בלבד בפרויקט). וואטסאפ משמש כערוץ **הפצה** של ההזמנה (לינק) ו**הוכחת בעלות על המספר** (זרימת הקישור הקיימת, ADR #29) — לא כערוץ אימות זהות/הרשמה עצמאי.

**החלטה (2) — קבלת/דחיית ההזמנה מתבצעת בעמוד ווב ציבורי חדש (`/invite/[code]`), לא כשיחה עם הבוט.** בעל הרשימה בוחר במסך השיתוף (`ShareListDialog`) בין הזרימה הקיימת (אימייל, ADR #15) לזרימה חדשה: מזין מספר טלפון, מקבל הודעת וואטסאפ מוכנה לשליחה (`wa.me/?text=...`, בלי מספר יעד קבוע — הבעלים בוחר את איש הקשר בעצמו, בניגוד ל-`buildWhatsAppLinkCodeUrl` שמכוון תמיד למספר הבוט) עם לינק ייחודי. הלינק מוביל לעמוד ווב שמציג תצוגה מקדימה של ההזמנה, דורש Google Sign-In אם צריך (עם `?next=/invite/{code}` — נעשה שימוש חוזר מלא בקונבנציית ה-`next` הקיימת ב-`proxy.ts`/`SignInButtons.tsx`, בלי שינוי בקוד האימות), ורק אז מציג אישור/דחייה. **נדחה**: זרימת "שלח הודעת טקסט חופשית לבוט ותתפרש כאישור/דחייה" — הבוט (`handleInboundChannelMessage`, ADR #29/#30) בנוי סביב MCP tools ושיחה חופשית עם LLM, לא מכונת מצבים לאישור פעולה חד-פעמית; לשלב את זה שם היה מצריך פרשנות LLM של כוונה ("כן"/"לא"/ניסוחים חופשיים) לפעולה בלתי-הפיכה על נתונים, בלי היתרון של UI מפורש עם כפתורי אישור/דחייה ברורים — סיכון גבוה מול תועלת נמוכה כשקיים כבר ערוץ ווב.

**החלטה (3) — קבלת ההזמנה מותנית בקישור בפועל של אותו מספר טלפון לחשבון המקבל, לא רק בהחזקת הלינק.** ה-uid המקבל נגזר מהחשבון המחובר; ההתאמה בין המספר שהוזמן לחשבון המאשר נבדקת מול `channelLinks` (`resolveUidForChannel`, ADR #29) — **לא** נלקחת כנתון מהימן מתוך ה-invite עצמו. אם המספר עדיין לא מקושר (או מקושר לחשבון אחר), העמוד מפנה לאותה זרימת קישור בדיוק שקיימת ב-`/settings` (`createLinkCodeForUid` + `buildWhatsAppLinkCodeUrl`) — ולא בונה מנגנון הוכחת-בעלות-על-טלפון מקביל. זה עקבי עם ההנחה המרכזית של ADR #29 ("מספר טלפון ב-payload נכנס הוא לא credential") ומכוון את הסיכון של קוד-הזמנה שמועבר הלאה (forwarded link) בחזרה לאותו סיכון bearer-credential ש-`channelLinkCodes` כבר מקבל, ולא מרחיב אותו.

**מודל נתונים חדש**: `listInviteCodes/{code}` — קוד bearer (לא memberUid, כי ה-uid לא ידוע בזמן היצירה), `{listId, role, phone (E.164), invitedBy, status: "pending"|"accepted"|"declined", createdAt, expiresAt, usedAt}`. `allow read, write: if false` — אותה מחלקת אמון בדיוק כמו `channelLinkCodes` (ADR #29 החלטה 4): אוסף שממופתח לפי מפתח שרירותי עם קריאה מותרת הוא oracle, וקוד קריא הוא credential גנוב. כל גישה דרך Server Actions/Admin SDK בלבד. TTL ארוך יותר מ-`channelLinkCodes` (10 דקות) — הקוד מופץ ידנית דרך הבעלים וייתכן שישב זמן-מה לפני שהמוזמן פותח אותו.

**ניסוח הודעה שונה למשתמש קיים/לא-קיים** (הדרישה המקורית ב-issue): נבדק פנימית ברגע היצירה דרך `resolveUidForChannel`, אך זו מסגור (framing) בלבד של טקסט ההודעה המשותפת — העמוד עצמו תמיד גוזר מחדש את המצב האמיתי ברגע האישור, כך שאי-עדכניות בין יצירת ההזמנה ללחיצה עליה לא משפיעה על ההתנהגות/האבטחה.

**היקף שנדחה במפורש כרגע**: אין הרחבה של `channelLinkCodes`/`redeemLinkCode` עצמם — זרימת קישור הערוץ (webhook, חתימה, דדופליקציה) נשארת ללא שינוי; ה-invite רק **מפנה** אליה. אין תמיכה ב"קישור טלפון מרחוק" בלי שהמקבל עצמו שולח הודעת וואטסאפ אמיתית מהמספר שלו.


## 38. שיתוף רשימה בלחיצה אחת — הלינק הופך ל-bearer credential (מהפך על ADR #37 החלטות 1 ו-3)
**תאריך**: 2026-08-31
> **הוחלף ב-ADR #39 (2026-08-31)**: החלטות 1 ו-2 בוטלו — הכריכה למספר טלפון חזרה, וקישור המספר שב להיות שער-הרשאה ולא העשרה. החלטה 3 (הסרת מסלול האימייל) והגבולות שנוספו כאן — חד-פעמיות, TTL של 48 שעות, תקרת לינקים פתוחים, ביטול — נשארים בתוקף. הרקע והשיקולים למטה נשמרים כי הם מסבירים למה הגבולות האלה קיימים.
**רקע**: אחרי ADR #37 היו לשיתוף רשימה שני מסלולים, ושניהם דרשו מהבעלים להקליד פרט שהוא לרוב לא יודע בעל-פה: כתובת אימייל (ADR #15) או מספר טלפון ב-E.164 מדויק (ADR #37). `ShareListDialog` הכיל שני טפסים, שני בוררי הרשאה ופאנל ביניים. הבקשה: כפתור ווטסאפ ירוק אחד — לחיצה מג'נרטת לינק ופותחת את בורר אנשי הקשר של ווטסאפ, בלי שהבעלים מזין דבר.

**החלטה (1) — הלינק הוא bearer credential.** ADR #37 החלטה 3 דרשה שני עובדות נפרדות: הקוד הוכיח "הזמנה נשלחה למספר הזה", ו-`channelLinks` הוכיח "המספר שלי". ברגע שהבעלים לא נוקב במספר, לעובדה הראשונה אין למה להיקשר, והקוד עומד לבדו — מי שמחזיק בלינק יכול להצטרף. זה בדיוק המודל של WhatsApp group invite links, ונבחר במודע: המחיר של הקלדת מספר טלפון בכל שיתוף היה גבוה מהתועלת, כשהערוץ עצמו (צ'אט אישי בווטסאפ) כבר מספק את ההכוונה לנמען הנכון.

**מה מחליף את הכריכה למספר** — ארבעה מנגנונים, כולם ב-`src/lib/services/listInvites.ts`:
- **חד-פעמיות** — הקוד נצרך בהצטרפות הראשונה (`status`/`usedAt`, כבר היה קיים). לינק שהועבר הלאה שווה כלום אחרי שהנמען המקורי השתמש בו.
- **TTL של 48 שעות** במקום 14 יום. ADR #37 יכול היה להרשות לעצמו חלון ארוך כי ההזמנה הייתה חסרת ערך לכל אחד מלבד בעל המספר; לינק bearer לא.
- **תקרה של 10 לינקים פתוחים לרשימה** (`MAX_OPEN_INVITES`) — לחיצה חוזרת בטעות לא משאירה אחריה תריסר קודים חיים.
- **שקיפות וביטול** — כל לינק פתוח מוצג לבעלים ב-`ShareListDialog` וניתן לביטול בלחיצה (`cancelListInvite`).

**החלטה (2) — שיוך מספר הטלפון של המוזמן יורד משער-הרשאה להעשרה.** המוזמן עדיין עובר את זרימת קישור הווטסאפ הקיימת (`createLinkCodeForUid` + webhook, ADR #29), אבל לא כי בלעדיה אסור לו להצטרף — אלא כדי שהבעלים יראה מספר טלפון לצד המייל ברשימת השיתופים. `acceptListInvite` שומר את ה-`externalId` למסמך החבר ברגע האישור. **אין סתירה ל-ADR #29**: מספר טלפון עדיין אינו הוכחת זהות בשום מקום במערכת; פשוט כבר לא מסתמכים עליו כאן. מימושית זו הנקודה הרגישה — כל בדיקה שנשארת חייבת לדעת שהיא לא בקרת אבטחה.

**מוצא חירום מפורש**: אם `NEXT_PUBLIC_WHATSAPP_BOT_PHONE` לא מוגדר, `buildWhatsAppLinkCodeUrl` מחזיר `null` ואין שום דרך לקשר מספר — דרישת הקישור הייתה נועלת כל מוזמן לנצח. במצב הזה בלבד הדרישה נופלת והחבר נשמר עם `phone: null`. נבדק בשרת (`whatsAppLinkingAvailable`), לא רק ב-UI, כי ה-action ניתן ל-POST ישיר (ADR #25).

**החלטה (3) — מסלול האימייל (ADR #15) הוסר כנקודת כניסה.** `src/actions/listShare.ts` נמחק. חברים קיימים שנוצרו דרכו (כולל כאלה ב-`status: "pending"`) ממשיכים לעבוד ללא שינוי: `usePendingInvitations`/`PendingInvitationsPanel` ו-`firestore.rules` לא נגעו. פשוט לא נוצרים חדשים.

**תאימות לאחור**: `listInviteCodes.phone` הופך ל-`string | null` בלי מיגרציה. `null` = הזמנה חדשה, ערך = הזמנה ישנה שממשיכה להיאכף בתנאי ADR #37 המקוריים (`resolveUidForChannel` מול המספר שהוזמן) עד שתפוג. כל ענף שאכפת לו מתפצל על `invite.phone === null`.

**כל השיתופים נוצרים כ-`viewer`**; קידום ל-`manager` הוא פעולה נפרדת ב-`Select` שכבר קיים ברשימת החברים. זה מה שמאפשר לשיתוף עצמו להיות לחיצה אחת, ומקטין את הנזק מלינק שדלף.

**חוסם חלונות קופצים** — `window.open` אחרי `await` מאבד את מחוות המשתמש ונחסם ב-Safari/iOS. `handleShare` פותח את הטאב **סינכרונית** בתוך ה-handler ומנווט אותו כשהקוד חוזר; אם גם זה נחסם (`w === null`), מוצג `<a href>` שהמשתמש לוחץ עליו בעצמו.

**נדחה**: אימות טלפון דרך Firebase Phone Auth — היה הופך את שלב 2 לאוטומטי לגמרי, אבל מוסיף ספק auth שני שלא קיים בפרויקט (ADR #2) ועלות SMS, כדי לחסוך שליחת הודעת ווטסאפ אחת.

## 39. חזרה לכריכת ההזמנה למספר טלפון — הבעלים מזין נמען אחד, והלינק חסר ערך לכל אחד אחר (מהפך על ADR #38)
**תאריך**: 2026-08-31

**רקע**: ADR #38 ויתר על הכריכה למספר כדי שהשיתוף יהיה לחיצה אחת, והפך את הלינק ל-bearer credential. אחרי המימוש התחדדו שתי בעיות. הראשונה תפעולית: `wa.me/?text=` פותח את בורר אנשי הקשר של ווטסאפ, והבורר מאפשר לסמן **כמה** נמענים בבת אחת. אין פרמטר URL שמגביל אותו — ה-Click to Chat API מתעד רק `phone` ו-`text`, והבורר עצמו הוא מסך פנימי של האפליקציה. כלומר לינק חד-פעמי אחד יכול להישלח לשלושה אנשים, ורק הראשון שילחץ יצטרף; השניים האחרים נתקלים ב"ההזמנה כבר טופלה". השנייה מהותית: כל דליפה של הלינק — צילום מסך, העברה בשרשור, גיבוי צ'אט שנקרא במכשיר אחר — היא הצטרפות מלאה לרשימה. חד-פעמיות ו-TTL מגבילים את החלון, אבל לא את **מי** יכול לנצל אותו.

**החלטה (1) — כלל שתי העובדות של ADR #37 חוזר, והוא הכלל היחיד להזמנות חדשות.** הבעלים נוקב במספר, וההזמנה נכרכת אליו. כדי להצטרף צריך גם להחזיק בקוד ("הזמנה נשלחה למספר הזה") וגם להיות החשבון שאליו `channelLinks` ממפה את המספר ("המספר הזה שלי"). אף אחת מהעובדות לא מספיקה לבדה, וזה בדיוק העניין: לינק שדלף בידי חשבון לגיטימי לחלוטין עדיין שווה כלום, כי אותו חשבון לא יכול לקבל ווטסאפ במספר שהוזמן. **אין סתירה ל-ADR #29** — מספר טלפון עדיין אינו הוכחת זהות בפני עצמו; מה שמאשר כאן הוא `channelLinks`, שנבנה מלכתחילה כך שמספר נקשר ל-uid רק דרך הודעה שבעל החשבון באמת שלח.

**החלטה (2) — הקלט הוא מספר ישראלי מקומי בן 10 ספרות**, לא E.164. ADR #37 ביקש `+972501234567` מדויק, וזה היה חלק ניכר מהחיכוך שהוביל ל-ADR #38 מלכתחילה. `ilPhoneSchema` (`src/lib/validation/channelLink.ts`) מקבל `0501234567` ומנרמל ל-E.164 שהוא בדיוק המחרוזת ש-`channelLinks` ממופתח לפיה — הנרמול חייב להיות זהה, אחרת ההזמנה והודעת הווטסאפ הנכנסת יתארו את אותו מספר בשתי מחרוזות שונות. מפרידים (מקפים, רווחים, סוגריים) נחתכים במקום להיפסל.

**החלטה (3) — הלינק מוביל ישירות לצ'אט של הנמען.** `wa.me/<ספרות>?text=...` עם מספר בנתיב פותח שיחה אחת ומדלג על הבורר לגמרי. זה מה שפותר את הבעיה התפעולית: אין מסך בחירה, ולכן אין ריבוי נמענים — ההודעה יכולה לנחות רק אצל המספר שההזמנה נכרכה אליו. **הגבלת הבורר לנמען יחיד אינה אפשרית דרך ה-URL**; מה שאפשרי הוא לא להגיע לבורר.

**החלטה (4) — כל ארבעת הגבולות של ADR #38 נשארים**, על גבי הכריכה ולא במקומה: חד-פעמיות, TTL של 48 שעות (ולא 14 יום כב-ADR #37 — הכריכה לא מכסה מקרה של מספר שהחליף ידיים או לינק שנשכח חי), תקרה של 10 לינקים פתוחים לרשימה, וביטול על ידי הבעלים. חוזר גם ה-dedupe של ADR #37: שיתוף חוזר לאותו מספר **דורס** את הלינק הקודם במקום להוסיף עליו, כי `(listId, phone)` שוב מזהה נמען אחד ו"שלח שוב" פירושו הזמנה אחת, לא שתיים.

**מה שהיה "העשרה" חוזר להיות שער-הרשאה.** ב-ADR #38 קישור המספר של המוזמן נאסף רק כדי שהבעלים יראה מי הצטרף; עכשיו הוא שוב מה שמאשר את ההצטרפות. `acceptListInvite` גוזר אותו מחדש מ-Firestore ולעולם לא מהלקוח — `getListInviteGate` הוא רמז UI ש-POST ישיר ל-action היה מדלג עליו (ADR #25).

**מוצא החירום של ADR #38 מצטמצם בכוונה.** `whatsAppLinkingAvailable()` ("האם `NEXT_PUBLIC_WHATSAPP_BOT_PHONE` מוגדר בכלל") ממשיך להרפות מהדרישה **רק** עבור קודי bearer מתקופת ADR #38, שבהם המספר ממילא לא היה הרשאה. עבור הזמנה כרוכה הוא לא מרפה מכלום: שם הקישור **הוא** ההרשאה, ולתת ל-env var חסר לעקוף אותה היה fail-open — דיפלוימנט שגוי היה הופך בשקט כל הזמנה כרוכה ל-bearer. דיפלוימנט כזה פשוט לא יכול להשלים הזמנה, וזו התוצאה הנכונה.

**תאימות לאחור**: קודים שנוצרו בחלון של ADR #38 נושאים `phone: null` והם bearer. הם **לא** מבוטלים — הם ממשיכים להיאכף בתנאיהם החלשים עד שיפוגו (48 שעות מהיצירה, כלומר החלון נסגר מעצמו). כל ענף שאכפת לו מתפצל על `invite.phone === null`, ואין מיגרציה.

**מה זה עולה**: הבעלים צריך לדעת את המספר. זה החיכוך ש-ADR #38 ניסה להסיר, והוא חוזר במודע — בהפרש שהקלט עכשיו הוא עשר ספרות מקומיות ולא E.164, ושהלחיצה שאחריו מגיעה ישירות לצ'אט הנכון במקום לבורר. שיתוף עם מי שאין לך את המספר שלו כבר לא נתמך.

**תיקון (2026-08-31, אחרי דיווח מפרודקשן)** — שני פערים שנחשפו כשההזמנה הראשונה יצאה לדרך:

1. **מבוי סתום ב-gate.** `getListInviteGate` שאל רק "האם המספר המוזמן מקושר למישהו", ולא "האם למבקר כבר מקושר מספר". מוזמן שכבר קישר מספר משלו קיבל `needs_channel_link`, אבל `createLinkCodeForUid` מסרב להנפיק קוד שני כשערוץ כבר מקושר — והפאנל נתקע על "מכינים את הקישור..." לנצח, בלי שום הודעה. עכשיו מצב כזה מחזיר `linked_to_other_number`, שהטקסט שלו כבר אמר את הדבר הנכון ("נתקו את הקישור הקיים בהגדרות"). בנוסף `InvitePanel` מציג שגיאה במקום להיתקע, וכפתור "בדיקה מחדש" יצא מהתנאי כדי שלא ייווצר מסך בלי שום פעולה אפשרית.
2. **דחייה הייתה פתוחה לכל מי שמחזיק בקוד**, כולל לא-מחובר: `declineInvite` השתמש ב-`getSessionUid()` ו-`declineListInvite` לא בדק שיוך כלל. תחת ADR #38 זה היה סביר (הנימוק: "סירוב אינו טענת זהות"), אבל תחת הכריכה של #39 הוא מתהפך — זר שקיבל לינק מועבר לא יכול להצטרף, אבל **כן** יכול לשרוף את ההזמנה, כלומר DoS על הנמען האמיתי מצד בדיוק מי שהכריכה נועדה לחסום. דחייה מחייבת עכשיו `requireUid()` **ואת אותה הוכחה כמו אישור**, שחולצה ל-`assertMayRedeem` המשותף לשתיהן כדי שלא יוכלו להיפרד. מי שלא רוצה להצטרף פשוט מתעלם — ההזמנה פגה תוך 48 שעות. נוספה גם בדיקת פקיעה שהייתה קיימת באישור וחסרה בדחייה.

**נדחה**: (א) פרמטר URL שיגביל את הבורר לנמען אחד — לא קיים, ראו "רקע"; (ב) להשאיר bearer ולהסתפק בניסוח אזהרה בטקסט ההודעה — טקסט אינו בקרה; (ג) Firebase Phone Auth לאימות המספר במקום קישור ווטסאפ — היה מייתר את שלב 2 למוזמן, אבל מוסיף ספק auth שני שלא קיים בפרויקט (ADR #2) ועלות SMS, כדי לחסוך שליחת הודעת ווטסאפ אחת. אותה דחייה כמו ב-ADR #38.

## 40. אישור לפני מעבר בעלות על מספר WhatsApp מקושר (issue #75)
**תאריך**: 2026-08-31

**רקע**: `redeemLinkCode` (ADR #29) דורס בכוונה קישור קיים כדי לתמוך ב"מעבר מספר בין חשבונות" — אבל דרס גם כשהקישור הקיים שייך לחשבון **אחר** לגמרי, בלי שום אזהרה. השולח הוכיח רק החזקה על המספר; הקוד מוכיח רק בעלות על החשבון החדש. אף אחד מהשניים לא מוכיח שהחשבון הקודם באמת ויתר על המספר — כלומר תרחיש ה"מעבר לגיטימי" (ADR #29) ותרחיש "השתלטות על חשבון" (מישהו שמצא/ניחש קוד ושולח מהמספר של אדם אחר) לא היו ניתנים להבחנה בקוד בכלל. `deleteChannelHistory` נקרא אוטומטית על הקישור הישן, כך שההשתלטות גם מוחקת שקט את היסטוריית השיחה של הקורבן.

**החלטה (1) — הזיהוי בתוך אותה טרנזקציה, לא peek נפרד.** `redeemLinkCode` מוסיף `tx.get(linkRef)` לפני ה-writes הקיימים (Firestore דורש את כל ה-reads לפני כל write באותה טרנזקציה, אז זה חינם מבחינת round-trips). אם קיים קישור ל-uid **שונה** מ-`codeDoc.uid`, נזרקת `RelinkConfirmationRequiredError(existingUid)` במקום לדרוס — אלא אם `options.confirmed === true`. Peek נפרד לפני הטרנזקציה היה פותח חלון race בין הקריאה לכתיבה; בתוך הטרנזקציה הבדיקה אטומית עם ה-write עצמו.

**החלטה (2) — מצב-ביניים ב-Firestore, לא בזיכרון.** `channelRelinkConfirmations/{channelKey}` (Admin SDK בלבד, `if false` ב-Rules — אותה מחלקת אמון כמו `channelLinks`) שומר את הקוד שממתין לאישור + מיהו הבעלים הנוכחי, ב-TTL זהה ל-`channelLinkCodes` (10 דקות). Firestore ולא state בזיכרון כי ה-webhook הוא stateless בין קריאות — אין תהליך ארוך-חי שיכול להחזיק את זה.

**החלטה (3) — כל ההודעה הבאה מהערוץ מתפרשת רק כ"כן"/"לא" כשיש אישור ממתין**, שכבה דטרמיניסטית לחלוטין **לפני** ה-LLM (אותו עיקרון כמו `linkCodeSchema` הקיים) — לא קוד חדש, לא שאלה חופשית. `parseYesNo` היא השוואת מחרוזת מדויקת (`trim()`) מול "כן"/"לא" בדיוק, בלי fuzzy matching. תשובה שאינה אחת מהשתיים חוזרת עם אותה שאלה + כפתורים, ולא מפילה את המשתמש בחזרה לזרימה הרגילה.

**החלטה (4) — כפתורי reply אמיתיים של WhatsApp (`interactive.type:"button"`), לא רק `cta_url`.** `sendWhatsAppReplyButtons` חדש ב-`graph.ts`, ליד `sendWhatsAppCtaUrl` (issue #66) — הבדל מהותי: `cta_url` פותח קישור, `button` מחזיר `id`/`title` בחזרה ב-webhook (`interactive.button_reply`). הכותרות של הכפתורים הן "כן"/"לא" בדיוק, כדי שלחיצה תתורגם ל-`text` זהה למה שמשתמש מקליד (`extractInboundMessages` — `message.interactive.button_reply.title`) ותעבור דרך **אותו** `parseYesNo` בדיוק. **fallback לטקסט חופשי חובה**: לא כל לקוח WhatsApp/Business API integration תומך תצוגת כפתורים זהה, ומשתמש עשוי גם סתם להקליד "לא" בלי ללחוץ. שני המסלולים מתאחדים לפני שהם מגיעים ללוגיקה — אין כפילות.

**החלטה (5) — מיסוך מפורש בכוכביות, לא last-4 כמו `toPhoneHint`.** `maskEmail`/`maskPhone` חדשים ב-`src/lib/utils/mask.ts` — שומרים תו ראשון+אחרון (מייל) / קידומת מדינה+2 ספרות אחרונות (טלפון) ומחליפים את האמצע ב-`*`. `toPhoneHint` הקיים (`listInvites.ts`) מיועד למטרה אחרת (המוזמן מזהה איזה מהמספרים שלו הוזמן) ולא מספיק מוסתר להצגה של "למי המספר שייך כרגע" לצד שלישי פוטנציאלי.

**מה לא השתנה**: תרחיש "מעבר לגיטימי" (ADR #29) עדיין עובד בדיוק כמו קודם — ההבדל היחיד הוא צעד אישור אחד לפני שההיסטוריה הישנה נמחקת. קוד שמומש כשאין קישור קיים בכלל, או שהקישור הקיים הוא לאותו uid, ממשיך לרוץ בלי שום שינוי (אין ירידת ביצועים/UX לזרימה הרגילה).

**Audit log**: `channel_relink_requested` (כשנוצר מצב-ביניים) ו-`channel_relink_cancelled` (כש-"לא" נענה) נוספו ל-`AuditLogEventType`, נכתבים תחת uid הבעלים הקיים (`existingUid`). אישור מוצלח **לא** מקבל event נפרד — הוא ממשיך להירשם כ-`channel_linked` הקיים, כי מבחינת המערכת זו אותה פעולה בדיוק, רק עם `confirmed: true`.

## 41. אימות מחדש תקופתי לקישור WhatsApp (issue #68)
**תאריך**: 2026-08-31

**רקע**: `channelLinks/{channelKey}` ממפה מספר ל-`uid` ללא הגבלת זמן — `resolveUidForChannel` עשה `get()` והחזיר את ה-`uid` בלי שום בדיקת תוקף. אם המספר עובר לבעלים חדש (מיחזור מספרים אצל הספק), הבעלים החדש יכול פשוט להתחיל לדבר עם הבוט ולהיות מזוהה כבעלים הישן — **בלי לנסות לקשר שום דבר בעצמו**. זה שונה מהתרחיש שכבר טופל ב-ADR #40 (issue #75): שם מישהו *מנסה לקשר* קוד חדש למספר תפוס, וזה נחסם ע"י אישור כן/לא. כאן אין ניסיון קישור בכלל — הבעיה היא שהקישור הישן ממשיך לחיות בלי גבול.

**החלטה (1) — שני ספים בלתי-תלויים, "או" ולא "וגם"**: `maxAgeDays` (30) הוא תקרה מוחלטת מאז `linkedAt`, נבדקת **גם אם יש שימוש פעיל רציף**. `inactivityDays` (14) הוא ספה קצר יותר מאז `lastMessageAt` (או `linkedAt` אם עוד לא הייתה פעילות). בלי הספה המוחלט, מספר שמוחזק ע"י בעלים חדש וממשיך "לדבר" עם הבוט היה מאפס כל הזמן את שעון חוסר-הפעילות ולעולם לא נדרש לאימות מחדש — בדיוק התרחיש שה-issue מתאר. שני הערכים חיים ב-`CHANNEL_LINK_REVERIFY` (`src/lib/mcp/config.ts`), ליד `RATE_LIMITS` — קובץ תצורה מרוכז אחד, לפי בקשת המשתמש ש"שני הנתונים יהיו מאוחסנים בצורה פשוטה מאוד לשליטה ועדכון".

**החלטה (2) — התוקף נגזר, לא נשמר**: אין שדה Firestore חדש ואין Cloud Function מתוזמן. `linkedAt` כבר מתעדכן בכל redemption (כולל חידוש עצמי — `redeemLinkCode` תמיד עושה `tx.set` מלא), ו-`lastMessageAt` כבר מתעדכן בכל הודעה נכנסת מוצלחת (`touchChannelLink`). התוקף הוא פונקציה טהורה של שני השדות האלה, מחושבת בזמן קריאה (`src/lib/services/channelLinkExpiry.ts`, מבודד מ-`firebase-admin` באותו pattern כמו `fieldEncryptionCore.ts` כדי להיות טסטבילי בלי אתחול Admin SDK). זה גם מה שהופך את חידוש הקישור לחינם: כשמשתמש עם קישור שפג פודה קוד חדש מאותו uid, `redeemLinkCode` הקיים כבר דורס ומאפס `linkedAt`/`lastMessageAt` — הבדיקה ל-uid שונה (ADR #40) לא מופעלת כי ה-uid זהה.

**החלטה (3) — קישור שפג מזוהה בדיוק כמו "אף פעם לא קושר"**: `resolveUidForChannel` מחזיר `null` לשניהם, כך שהודעה נכנסת מקבלת את אותה תשובת "לא מקושר" בדיוק — עקבי עם עקרון ה"הודעות כישלון אחידות" של ADR #29, ולא פותח oracle חדש (מספר לא יכול ללמוד מהתשובה אם הוא היה מקושר בעבר). `createLinkCodeForUid` מפסיק לחסום הנפקת קוד חדש כשהקישור הקיים לאותו ערוץ פג — התנאי הפך מ"קיים קישור" ל"קיים קישור **פעיל**" (`status === "active"`), כדי לא לסתור את ה-guard המקורי של issue #26 (קוד מיותר לחשבון שלא צריך קישור חדש) עכשיו שקישור פג כן צריך קוד חדש.

**החלטה (4) — `ChannelLinkSummary` מקבל `status`/`reverifyBy` נגזרים**, לתצוגה ב-`/settings`: "נדרש אימות מחדש עד..." כשפעיל, אזהרה בולטת כשפג — והכפתור "חיבור WhatsApp" חוזר להיות זמין (מתנאי `hasWhatsAppLink` ל-`hasActiveWhatsAppLink`) בדיוק כשצריך, בלי כפתור/דיאלוג נפרד לחידוש.

**מה לא השתנה**: `redeemLinkCode` (חידוש עצמי כבר עבד כמו שהוא), `channelChat.ts` (כל ה-branching הקיים כבר מטפל ב-`uid === null` נכון), ADR #40 / `RelinkConfirmationRequiredError` — תרחיש cross-uid (מישהו **מנסה** לקשר קוד חדש למספר תפוס) לא משתנה, גם אם הקישור הישן פג; זו נשארת נקודה פתוחה (ראו מטה).

**מה נשאר מחוץ לסקופ, במפורש**: תרחיש שני, קשור אך שונה מ-issue #68 — מחזיק חדש שכן פותח חשבון Shovarim משלו ומנסה לקשר את המספר מחדש. ADR #40 כבר דורש אישור כן/לא, אבל האישור נשאל מהמספר עצמו (המחזיק החדש יכול לענות לעצמו), לא מהבעלים הקודם. סגירה מלאה (למשל התראה לבעלים הקודם) דורשת תשתית מייל/push שלא קיימת עדיין (Phase 7) — מתועד ב-`docs/ROADMAP.md` כפריט פתוח, לא נסגר כאן. המשתמש אישר את ההיקף הזה במפורש.

**נדחה**: sweep מתוזמן (`functions/`) שמנקה/מסמן קישורים פגי-תוקף באופן יזום — מיותר, כי אין "ניקוי" נדרש: המסמך עצמו נשאר קיים ושימושי לחידוש, וכל צרכן (webhook, `/settings`) כבר מחשב תוקף lazy בכל קריאה.

**נדחה**: (א) re-verification תקופתי/step-up authentication כללי — זה מכסה threat שונה (מיחזור מספרים, issue #68, שנשאר פתוח ב-`docs/ISSUES_SPRINT.md` #21) ולא את מה ש-#75 מבקש; (ב) חסימה מוחלטת של relink כשיש קישור אחר — הייתה שוברת את תרחיש ה"מעבר הלגיטימי" ש-ADR #29 בנה בכוונה.

## 42. פאנל ניהול — מודל הרשאות `adminRoles` (Firestore doc, לא custom claim), שלב יסודות (Phase 9.1)
**תאריך**: 2026-09-01

**רקע**: בקשה לפאנל ניהול מלא (צפייה במשתמשים, חסימה לפי uid/email/טלפון, מחיקה מיידית/מתוזמנת, מעקב שימוש/עלות Claude, אנליטיקס) — ראה design doc מלא ב-plan שהוביל ל-ADR זה. שלב זה (9.1, "יסודות") סוגר רק את שאלת ה-authorization הבסיסית: איך המערכת יודעת מי אדמין, ואיך `/admin` נחסם למי שאינו.

**החלטה (1) — מודל הרשאות: `adminRoles/{uid}` ב-Firestore, לא Firebase Auth custom claims.** custom claims דורשים ריענון טוקן (עד שעה, או sign-out/in מפורש) כדי להתעדכן אצל המשתמש שקיבל את ההרשאה — gotcha ידוע שהיה דורש UX/תיעוד מיוחד ("התחבר/י מחדש אחרי קבלת הרשאה"). לעומת זאת הפרויקט כבר משתמש בדיוק באותו פטרן (`get()`/`exists()` על מסמך subcollection כדי לקבוע הרשאה) עבור שיתוף רשימות — `isAcceptedListMember`/`memberDoc()` ב-`firestore.rules`. `adminRoles/{uid}` הוא אותו רעיון ברמת top-level: `exists()` עונה מיידית, בלי תלות בריענון טוקן, וה-doc כבר כולל שדה `role` שפתוח ל-RBAC עתידי (`"support"`/`"read_only"` וכו') בלי לגעת ב-Auth בכלל ובלי migration.

**החלטה (2) — bootstrap דרך סקריפט חד-פעמי, לא UI.** `adminRoles` הוא `allow read, write: if false` לגמרי (Admin SDK בלבד, אותו פטרן כמו `rateLimits`/`auditLog`) — אין נתיב client לכתוב אליו בכלל, גם לא לאדמין עצמו. הענקת ההרשאה הראשונה (ולעת עתה, היחידה) נעשית דרך `scripts/grant-admin.ts` (`npm run grant-admin -- <uid>`), אותו pattern בדיוק כמו `scripts/migrate-encrypt-sensitive-fields.ts`/`scripts/sweep-account-deletions.ts` — Admin SDK מקומי, מריצים פעם אחת נגד production.

**החלטה (3) — `isAdminUid()`/`requireAdmin()` ב-`src/lib/auth/session.ts`, לצד `requireUid()`.** שתי פונקציות, לא אחת: `isAdminUid(uid): Promise<boolean>` (קריאה בלבד, לשימוש ב-`app/(protected)/admin/layout.tsx` — page component שצריך `redirect()` נקי ולא error boundary), ו-`requireAdmin(): Promise<string>` שזורק `ActionError` (לא `Error` רגיל) כשאין הרשאה — אותה הבחנה בדיוק כמו ADR #18 (`requireUid`): "אין הרשאת ניהול" הוא תנאי צפוי שכל admin Server Action אמור להחזיר כערך דרך `toActionResult`, לא 500 מרוסק.

**החלטה (4) — `/admin` חי בתוך `(protected)/`, שכבת הגנה שנייה על גבי הקיימת.** `app/(protected)/admin/layout.tsx` בודק `getSessionUid()` (כמו `(protected)/layout.tsx` העוטף) **וגם** `isAdminUid()`, ומפנה ל-`/dashboard` (לא error) כשלא אדמין. אין שינוי ב-`src/proxy.ts` — `/admin` כבר מכוסה ב-fast-path של `(protected)` (בדיקת קיום cookie בלבד), והבדיקה המלאה (session + admin) קורית ב-layout כמו כל שאר האפליקציה (ADR #8).

**החלטה (5) — `adminAuditLog` נפרד מ-`auditLog` הקיים, מיום ראשון.** `auditLog` הוא per-user (מיוצא עם המשתמש, נשאר גם אחרי מחיקתו — `docs/PRIVACY.md`) ולא בנוי לשאילתת "כל פעולות האדמינים על פני כל המשתמשים". `adminAuditLog/{entryId}` (`{adminUid, targetUid, action, reason, createdAt}`) הוא הלדג'ר הייעודי לכך — גם הוא `allow read, write: if false`, ונכתב **לפני** כל mutation אדמיניסטרטיבית (אותו סדר "audit לפני פעולה" כמו `deleteUserAccount` הקיים ב-`functions/src/accountDeletion.ts`).

**נדחה**: (א) custom claims — ראו החלטה 1; (ב) RBAC מלא (מספר תפקידים/הרשאות פרטניות) כבר בשלב זה — המשתמש ביקש מפורשות "רק אני כרגע", ושדה `role` הבודד (`"super_admin"`) פתוח להרחבה בלי migration כשיידרש; (ג) route/אפליקציה נפרדת לפאנל — נדחה לטובת נתיב מוגן בתוך האפליקציה הקיימת, כדי לא לשכפל תשתית auth/deploy (בחירת המשתמש המפורשת).

**מה עוד נשאר (שלבים הבאים, לא בשלב זה)**: צפייה במשתמשים, חסימה (`userModeration`/`blockedEmails`/`blockedPhones`), מחיקה יזומה ע"י אדמין (מתוזמנת/מיידית — האחרונה דורשת Cloud Function `onCall` נפרד בגלל מגבלת `functions/tsconfig.json`'s `rootDir` שתועדה ב-ADR #24), מעקב שימוש/עלות Claude API (`response.usage` לא נאסף היום כלל), ואנליטיקס (Firestore aggregation queries → Firebase Extension ל-BigQuery → GA4). ראו `docs/ROADMAP.md` Phase 9.

## 43. פאנל ניהול — צפייה במשתמשים, קריאה בלבד דרך Server Components (Phase 9.2)
**תאריך**: 2026-09-01

**רקע**: שלב 9.1 (ADR #42) סגר את שאלת ה-authorization. שלב זה הוא הפיצ'ר הראשון בפועל: `/admin/users` (רשימה + חיפוש) ו-`/admin/users/[uid]` (פרטי משתמש). אין כאן שום mutation — קריאה בלבד.

## 44. פאנל ניהול — חסימת משתמשים: `userModeration`/`blockedEmails`/`blockedPhones`, Auth disable כמנגנון ראשי (Phase 9.3)
**תאריך**: 2026-09-01

**רקע**: שלב הפיצ'ר הראשון עם mutation אמיתי בפאנל. שלוש רמות חסימה כפי שתוכנן ב-design doc המקורי (Phase 9): לפי uid (חשבון קיים), לפי email (כתובת שאולי אין לה עוד חשבון), ולפי טלפון (מספר WhatsApp).

**החלטה (1) — `userModeration/{uid}` נפרד מ-`users/{uid}`, לא שדה נוסף על המסמך הקיים.** `firestore.rules`'s `allow update: if isOwner(uid)` על `users` לא מגביל שדות — שדה `blocked` שם היה מאפשר למשתמש חסום לבטל את עצמו בכתיבת client רגילה, בדיוק כמו שהתכנון המקורי זיהה. `allow read, write: if false` לחלוטין, כולל לאדמין עצמו — אותו פטרן כמו `adminRoles`.

**החלטה (2) — Auth `disabled`+`revokeRefreshTokens` הוא מנגנון האכיפה הראשי, לא בדיקת `userModeration` בכל בקשה.** `getSessionUid()` (`src/lib/auth/session.ts`) כבר קורא ל-`verifySessionCookie(cookie, true)`, שבודק `disabled`/revocation מובנה — כלומר כל נתיב מבוסס-session (`/api/chat`, `mcp:cli`) נחסם אוטומטית ברגע החסימה, בלי קוד אכיפה חדש בשכבת ה-session עצמה. `assertNotBlocked(uid)` (`src/lib/services/moderation.ts`) הוא הגנת-משנה בשלוש נקודות הכניסה שקוראות ל-`runAgentTurn` — קריטי בפרט לוואטסאפ, שבו ה-`uid` נגזר מ-`channelLinks` בלי Auth token בכלל (ADR #29) ו-Auth disable לא נוגע בו ישירות; לגבי web/`mcp-cli` זו הגנה כפולה שגם חוסכת קריאת Claude מיותרת אם יש חלון מירוץ בין disable לתפוגת ה-session.

**החלטה (3) — `blockedEmails`/`blockedPhones` נבדקים *לפני* שקיים חשבון/קישור, לא אחרי.** `createSession` (`src/actions/auth.ts`) בודק `isEmailBlocked` לפני מתן session cookie — כתובת חסומה לא מקבלת session אפילו בכניסה ראשונה, כשעוד אין `users/{uid}` שאפשר לחסום ישירות. `redeemLinkCode` (`src/lib/services/channelLinks.ts`) בודק `isPhoneBlocked` לפני יצירת `channelLinks` חדש, עם אותה הודעת כישלון גנרית כמו כל דחייה אחרת שם (uniform-failure, ADR #29) — שולח אנונימי לא לומד אם המספר חסום או שהקוד סתם לא תקין. חסימת אימייל שכבר יש לו חשבון קיים גם מבצעת עליו disable+revoke באותה פעולה (superset).

**החלטה (4) — הגנה עצמית: אדמין לא יכול לחסום את עצמו (uid או email).** קריטי כשיש אדמין יחיד — חסימה עצמית הייתה מנעלת (lock out) גם מהאתר וגם מהפאנל עצמו, בלי דרך חזרה מלבד גישה ישירה ל-Firebase Console. הבדיקה יושבת ב-`adminModeration.ts` (לא רק ב-Server Action) כדי לכסות כל קורא עתידי. **לא** נבדק לחסימת טלפון עצמית — חסימת מספר לא משביתה חשבון Auth קיים, ולכן אין lockout מהאתר; רק מונעת קישור/רה-קישור עתידי לאותו מספר.

**החלטה (5) — UI: אישור עם סיבה (dialog) לחסימת uid, פעולה חד-לחיצתית עם סיבה קבועה לחסימת email/phone.** חסימת uid היא הפעולה בעלת ההשפעה הגבוהה ביותר (משבית חשבון קיים לגמרי) ומקבלת דיאלוג אישור + שדה סיבה חופשי (`UserModerationSection.tsx`), אותו pattern כמו `DeleteAccountSection`. חסימת email/phone נקודתית היא הפיכה ונמוכת-סיכון יותר — לחיצה אחת מספיקה, כדי לא לשכפל דיאלוג כמעט-זהה לכל פעולת משנה.

**נדחה**: (א) בדיקת `assertNotBlocked` גם ב-`GET /api/chat` — הנתיב הזה רק טוען היסטוריה קיימת ולא קורא ל-Claude, כך שאין עלות API לחסוך ואין mutation למנוע; (ב) re-verification תקופתי או rate limiting נפרד לחסימה — מכסה threat אחר (ADR #41), לא רלוונטי כאן.

**מה עוד נשאר (שלבים הבאים, לא בשלב זה)**: מחיקה יזומה ע"י אדמין (מתוזמנת/מיידית), מעקב שימוש/עלות Claude API, אנליטיקס. ראו `docs/ROADMAP.md` Phase 9.

## 45. פאנל ניהול — מחיקה יזומה ע"י אדמין: Server Action למתוזמנת, Cloud Function `onCall` למיידית (Phase 9.4)
**תאריך**: 2026-09-01

**רקע**: הפרויקט כבר מממש מחיקה דו-שלבית מלאה ע"י המשתמש עצמו (Phase 4.2, ADR #24): `deletionRequestedAt` על `users/{uid}` + `deleteExpiredAccounts` (Cloud Function מתוזמן) שקורא ל-`deleteUserAccount()`/`sweepExpiredAccountDeletions()` ב-`functions/src/accountDeletion.ts`. שלב זה מוסיף שני נתיבי מחיקה יזומים ע"י אדמין — מתוזמנת ומיידית — בלי לבנות מנגנון cascade-delete מקביל.

**החלטה (1) — מחיקה מתוזמנת היא Server Action רגיל שמשתמש באותו שדה קיים.** `scheduleUserDeletion`/`cancelUserDeletion` (`src/lib/services/adminDeletion.ts`, נקראים דרך `src/actions/adminDeletion.ts`) כותבים/מנקים את `users/{uid}.deletionRequestedAt` דרך ה-Admin SDK — בדיוק אותו grace period ואותו sweep כמו `requestAccountDeletion`/`cancelAccountDeletion` (`src/actions/privacy.ts`) של המשתמש עצמו. אין collection/שדה חדש, ולכן אין שינוי ב-`firestore.rules`.

**החלטה (2) — מחיקה מיידית היא Cloud Function `onCall` חדש, לא Server Action, כדי לקרוא ל-`deleteUserAccount()` בלי לשכפל אותו.** `functions/tsconfig.json`'s `rootDir: "src"` מונע מ-`src/actions/` (חלק מבניית Next.js) לייבא מ-`functions/src/` (ADR #24) — כלומר אין דרך ל-Server Action לקרוא ישירות לפונקציית ה-cascade-delete הקיימת. הפתרון: `functions/src/adminActions.ts` (`adminDeleteUserNow`) חי באותו package כמו `accountDeletion.ts` וקורא אליו ישירות, בלי שכפול שורת קוד. המחיר: callable הוא endpoint ציבורי (לא מוגן ע"י `app/(protected)/admin/layout.tsx` ולא ע"י `firestore.rules`) — הפונקציה **חייבת** לאמת הרשאת אדמין בעצמה בצד שרת (`adminRoles/{caller uid}`), ולא לסמוך על כך שרק ה-UI קורא לה. נקראת מ-`UserDeletionSection.tsx` (client component) ישירות דרך `httpsCallable`, לא Server Action.

**החלטה (3) — לוגיקת ההרשאה מופרדת מה-`onCall` wrapper (`adminDeleteUserNowHandler`).** אותו רציונל כמו הפרדת Server Action ↔ שכבת שירות בכל שאר הקוד (`src/actions/*.ts` ↔ `src/lib/services/*.ts`): מאפשר להפעיל את הבדיקות (לא-מאומת/לא-אדמין/self-delete/מחיקה בפועל) ישירות מסקריפט אימות, בלי transport אמיתי (App Check כלול) — ראו "אימות" ב-`docs/ROADMAP.md` Phase 9.4.

**החלטה (4) — `enforceAppCheck: true` ברמת הפונקציה, לא Console-level Enforce.** ה-Enforce שכבר פעיל בפרודקשן (`docs/DEPLOYMENT.md`) חל רק על Firestore/Storage — Cloud Functions callables לא מכוסים על ידו. `enforceAppCheck` הוא אופציה על `onCall` עצמו: ה-SDK מוודא טוקן App Check ומחזיר 401 אוטומטית אם הוא חסר/לא תקין, לפני שה-handler רץ בכלל.

**החלטה (5) — הגנה עצמית בשני הנתיבים.** גם `scheduleUserDeletion` (uid) וגם `adminDeleteUserNowHandler` (uid של הקורא) דוחים ניסיון של אדמין לפעול על עצמו — אותו רציונל lockout כמו חסימה עצמית (ADR #44 החלטה 4): עם אדמין יחיד, מחיקה עצמית (אחרי גרייס פריוד או מיידית) הייתה בלתי הפיכה בלי גישה ישירה ל-Firebase Console.

**החלטה (6) — UI: type-to-confirm (אימייל המשתמש) למחיקה מיידית, כפתור חד-לחיצתי למתוזמנת/ביטול.** `UserDeletionSection.tsx` — מחיקה מיידית היא בלתי הפיכה ומיידית (הפעולה המסוכנת ביותר בפאנל עד כה), ומקבלת את אותה רמת חיכוך כמו `DeleteAccountSection` הקיים (הקלדת המחרוזת המזהה כתנאי לכפתור). תזמון/ביטול תזמון הם הפיכים בקלות (30 יום להיפתר, `cancelUserDeletion` מבטל בכל רגע) — לחיצה אחת מספיקה.

**נדחה**: (א) callable נפרד ל-`adminCancelScheduledDeletion` — נדחה לטובת Server Action רגיל (`adminCancelUserDeletionAction`), כי מחיקה מתוזמנת לא נוגעת בכלל ב-`deleteUserAccount()` ואין סיבה ל-callable; (ב) `enforceAppCheck` גם על מחיקה מתוזמנת — לא רלוונטי, זו Server Action רגילה שכבר מוגנת ע"י `requireAdmin()` ו-`admin/layout.tsx`, לא endpoint ציבורי.

**מה עוד נשאר**: מעקב שימוש/עלות Claude API, אנליטיקס. ראו `docs/ROADMAP.md` Phase 9.

## 46. תיקון: `storage.bucket()` ב-Cloud Functions לא יכול להסתמך על משתנה של App Hosting
**תאריך**: 2026-09-01

**רקע**: פוסט-מורטם מלא ב-`docs/DEPLOYMENT.md`. `adminDeleteUserNow` (Phase 9.4, ADR #45) — ההפעלה הראשונה בפרודקשן אי-פעם של `deleteUserAccount()` — נכשלה ב-500 עם `Bucket name not specified or invalid`.

**החלטה — `STORAGE_BUCKET` דרך `functions/.env.<project-id>`, לא נגזר מ-`projectId`.** `functions/src/firebaseAdmin.ts` הסתמך על `process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, שקיים רק ב-App Hosting (`apphosting.yaml`, `availability: [BUILD, RUNTIME]`) — Cloud Functions הוא compute environment נפרד לגמרי, ושום מנגנון לא מעביר אליו משתני App Hosting. שקלנו לגזור את שם ה-bucket מ-`${projectId}.firebasestorage.app` (התבנית שבה אכן משתמש הפרויקט הזה), אבל זה שביר — נשען על מוסכמת שם לא-מובטחת ולא היה מתגלה בבדיקה עד שבאמת משתנה. הפתרון שנבחר: `functions/.env.shovarim-prod` (מוסכמת env-file הרשמית של Firebase Functions Gen 2 — נטען ונארז לתוך ה-deploy אוטומטית, רק לפרויקט התואם) עם `STORAGE_BUCKET=shovarim-prod.firebasestorage.app` מפורש. `firebaseAdmin.ts` קורא אותו קודם, ונופל חזרה ל-`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` רק לתאימות עם אמולטור/סקריפטים מקומיים (`.env.local`). לא סוד — נוסף לחריגה ב-`.gitignore` (`!functions/.env.shovarim-prod`) כדי שה-deploy pipeline יוכל לארוז אותו.

**השלכה נלמדת — בדיקת עשן קודמת (Phase 9.4) פספסה את זה, false positive.** `scripts/smoke-deletion.ts` ייבא גם את `src/lib/firebase/adminApp.ts` (בשביל `adminAuth`/`adminDb`) וגם ישירות את ה-handler מ-`functions/src/adminActions.ts`, **באותו תהליך Node**. `adminApp.ts` אותחל ראשון (עם bucket תקין מ-`.env.local`), ולכן `getApps()[0]` ב-`firebaseAdmin.ts` מצא app קיים ומעולם לא הפעיל את לוגיקת ה-resolution הפגומה שלו. תהליך Cloud Function אמיתי לעולם לא מייבא את `adminApp.ts` (בכלל לא רואה את `src/`) — כך שהבדיקה נתנה false positive על ידי שיתוף state בין שני admin apps שלא מתקיים במציאות. לקח: בדיקת קוד תחת `functions/` חייבת לרוץ בבידוד תהליך אמיתי (ללא ייבוא כלשהו מ-`src/lib/firebase/`), לא רק "עבר באמולטור".

**נדחה**: ניקוי ידני של המשתמש שנפגע (`liorh@hms.co.il`) — `deleteUserAccount()` idempotent-safe בעיצובו (כל שלב לא עושה כלום אם הנתונים כבר נמחקו), כך שהתיקון הנכון הוא לתקן את הבאג ולנסות שוב את אותה פעולת מחיקה, לא לבנות מנגנון ניקוי מקביל.

**החלטה (1) — Server Components, לא Server Actions.** `users/{uid}` ב-`firestore.rules` הוא `allow read: if isOwner(uid)` בלבד, כך שאדמין לא יכול לקרוא מסמך של משתמש אחר דרך ה-client SDK בשום מצב — כל קריאה חייבת Admin SDK. מכיוון שמדובר בקריאה (לא כתיבה) ואין טופס לשלוח, `/admin/users` ו-`/admin/users/[uid]` הם `async` Server Components רגילים שקוראים ל-`src/lib/services/adminUsers.ts` ישירות (בדיוק כמו ש-`(protected)/admin/layout.tsx` כבר עושה `isAdminUid()`), ולא Server Actions. ההגנה נשארת רק ב-`admin/layout.tsx` הקיים (Phase 9.1): בניגוד ל-Server Action שהוא endpoint שאפשר לתקוף ישירות מבלי לעבור דרך ה-UI, עמוד תחת layout לא נגיש בלי שה-layout ירוץ קודם — אין צורך לחזור ולבדוק `requireAdmin()` בכל עמוד.

**החלטה (2) — pagination בסמן דרך `startAfter(DocumentSnapshot)`, לא ערך createdAt גולמי ב-URL.** `listUsersPage()` (`src/lib/services/adminUsers.ts`) מקבל רק `uid` של המסמך האחרון בעמוד הקודם (`?cursor=<uid>`), שולף אותו (`doc(cursor).get()`) ומעביר את ה-snapshot ל-`startAfter`. Firestore ממשיך מהערכים בפועל של אותו מסמך על השדה שה-query ממוין לפיו — אין צורך לקודד/לפענח `Timestamp` ב-URL, וה-URL נשאר קריא. "עמוד קודם" לא מומש בצד שרת בכוונה: כל עמוד הוא URL נפרד (`?cursor=...`), כך שכפתור ה-back של הדפדפן כבר עושה את זה.

**החלטה (3) — חיפוש בשדה חופשי אחד, מסווג לפי צורה (`@` → אימייל, אחרת `uid`), לא שני שדות/toggle.** תואם את התיאור בתכנון המקורי ("חיפוש לפי email... ולפי uid") בלי להוסיף בקרת UI שנייה. `adminAuth.getUserByEmail` (לא שאילתת Firestore) לאיתור לפי אימייל — Auth כבר אוכף ייחודיות אימייל, כך שאין צורך בשדה `email` מפוזר על `users/{uid}` ואין אינדקס Firestore חדש.

**החלטה (4) — ספירות בעמוד הפרטים בלבד, לא ברשימה.** ספירת כרטיסים/רשימות (Firestore `count()` aggregation, `where("ownerId","==",uid)`) רצה רק בעמוד `/admin/users/[uid]`, לא בעמוד הרשימה — כדי לא להכפיל N שאילתות aggregation על כל טעינת עמוד (25 שורות × 2 = 50 שאילתות). שני הפילטרים הם equality בודד על `ownerId`, שכבר מכוסה באינדקסים הקיימים (`docs/DATA_MODEL.md`) — אין אינדקס מרוכב חדש.

**החלטה (5) — אין collection Firestore חדש בשלב זה.** בניגוד לשלבים 9.3/9.4/9.5 הבאים, צפייה בלבד לא דורשת שום מסמך חדש — כל הנתונים כבר קיימים ב-`users`/`cards`/`cardLists`/Firebase Auth. משמעות: אין שינוי ב-`firestore.rules`, ואין טסטים חדשים ל-`tests/rules/firestore.test.ts` (אין מה לבדוק — לא נוסף `match` block).

**נדחה**: (א) חיפוש עם שני שדות/toggle נפרדים — נדחה לטובת שדה חופשי אחד עם זיהוי לפי צורה, פשוט יותר ומספיק; (ב) ספירות בעמוד הרשימה — נדחה מטעמי עלות שאילתות (החלטה 4); (ג) `requireAdmin()` חוזר בתוך כל עמוד — מיותר כש-layout כבר אוכף, ראו החלטה 1.
