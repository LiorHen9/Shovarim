# FEATURES

מצב נוכחי של פיצ'רי מוצר. עדכן בכל פעם שפיצ'ר זז שלב.

| פיצ'ר | סטטוס | הערות |
|---|---|---|
| תשתית פרויקט (Next.js/Firebase/shadcn) | ✅ הושלם | Phase 0 |
| Security Rules (deny-by-default) | ✅ הושלם ונבדק | Phase 0/1 — 19 טסטים ב-`tests/rules/firestore.test.ts` עוברים |
| Google Sign-In | ✅ הושלם | Phase 1 — `src/components/auth/SignInButtons.tsx` + session cookie |
| CRUD כרטיסים (create/list/edit/archive) | ✅ הושלם | Phase 1 — `/cards`, `/cards/new`, `/cards/[cardId]`. עריכה מוגבלת בכוונה לשם/תוקף/מספר כרטיס/CVV/קישור רשתות מכבדות — מטבע לא ניתן לעריכה כלל, ויתרה רק דרך יומן שימושים או עדכון ידני ייעודי (Phase 3), ראו `docs/DECISIONS.md` #11 |
| יומן שימושים + מטרת שימוש | ✅ הושלם | Phase 1 — `src/actions/usage.ts`, עדכון יתרה אטומי בטרנזקציה, מונע overdraft |
| Consent banner + Privacy Policy | ✅ הושלם | Phase 1 — חוסם UI עד הסכמה, `/privacy` ו-`/terms` עם תוכן אמיתי |
| Categories (system defaults) | ✅ הושלם | Phase 1 — `npm run seed:categories`; קטגוריות מותאמות אישית עדיין ב-Phase 2 |
| תמונות כרטיס/קבלות | ✅ הושלם | Phase 2 — `src/lib/storage/upload.ts`, `CardImageUpload`, `ImageDropInput`; ה-id של הכרטיס/רשומת השימוש נוצר בצד הלקוח לפני ההעלאה כדי לשמור על העלאה לפני כתיבת המסמך |
| קטגוריות/תגיות מותאמות אישית | ✅ הושלם | Phase 2 — `useCategories`, `CategorySelect` (כולל יצירה מהירה), `TagsInput`, ניהול (עריכה/מחיקה) ב-`/settings` דרך `CategoryManager` |
| עדכון יתרה ידני (ללא רשומת שימוש) | ✅ הושלם | Phase 3 — `src/actions/balance.ts` (`updateCardBalance`), `UpdateBalanceDialog` בעמוד פרטי הכרטיס, ראו `docs/DECISIONS.md` #11 |
| URL לרשתות מכבדות בטופס כרטיס | ✅ הושלם | Phase 3 — `acceptingRetailersUrl` ב-`CardForm`/`EditCardDialog` |
| שדה CVV בטופס כרטיס | ✅ הושלם | Phase 3 — `cvv` בסמוך לשדה התוקף ב-`CardForm`/`EditCardDialog`; מאוחסן ללא הצפנת application-level (כמו `barcodeOrCode`), ראו `docs/SECURITY.md` |
| הצגת קישור לרשתות מכבדות בעמוד הכרטיסים ובעמוד כרטיס | ✅ הושלם | Phase 3 — מוצג רק כש-`acceptingRetailersUrl` קיים; אייקון קישור ברשימת `/cards`, קישור טקסטואלי בעמוד `/cards/[cardId]` |
| מחיקת רשומה מיומן השימושים | ✅ הושלם | Phase 3 — `deleteUsageEntry` ב-`src/actions/usage.ts`, `DeleteUsageEntryButton`; דיאלוג שואל אם להחזיר את הסכום ליתרת הכרטיס. חריגה מוגבלת ל-immutability של #4, ראו `docs/DECISIONS.md` #12 |
| ניהול רשימות כרטיסים | ✅ הושלם | Phase 3.1 — כל כרטיס שייך לרשימה אחת (`cardLists`, `cards.listId`). `/cards` מציג את רשימות המשתמש, `/cards/lists/[listId]` מנהל את הכרטיסים של רשימה בודדת (כולל שינוי שם ומחיקת רשימה ריקה). ביצירת כרטיס ראשון בלי רשימות קיימות, `CardForm` יוצר רשימה ראשונית אוטומטית; אחרת נדרשת בחירה דרך `ListSelect` (כולל "+ רשימה חדשה"). ראו `docs/DECISIONS.md` #13 |
| מחיקת כרטיס | ✅ הושלם | Phase 3.1 — `src/actions/card.ts` (`deleteCard`, Admin SDK), `DeleteCardButton` (דיאלוג אישור) בשורת הכרטיס ב-`/cards/lists/[listId]` ובעמוד פרטי הכרטיס. מוחק גם את `usageLog` (recursiveDelete) וגם קבצי Storage (תמונת כרטיס/קבלות). ראו `docs/DECISIONS.md` #14 |
| שיתוף רשימות (מנהל/צופה, הזמנה לפי אימייל+אישור) | ✅ הושלם | Phase 3.2 — `cardLists/{listId}/members`, `src/actions/listShare.ts` (`inviteListMember`), `ShareListDialog` (ניהול שיתוף לבעלים), `PendingInvitationsPanel` (קבלה/דחייה למוזמן) ב-`/cards`. "מנהל" מנהל כרטיסים/שימושים/יתרה כמו הבעלים; "צופה" קריאה בלבד. העלאת תמונת כרטיס/קבלה נשארה לבעלים בלבד (מגבלת Storage Rules). ראו `docs/DECISIONS.md` #15 |
| ייצוא נתונים (GDPR) | ✅ הושלם | Phase 4.1 — `src/lib/services/export.ts` (`buildUserDataExport`), Server Action `exportUserData` ב-`src/actions/privacy.ts` (uid נגזר מה-session בלבד), `ExportDataButton` ב-`/settings`. בשונה מהסריאליזציה ל-LLM, `cvv`/`barcodeOrCode` **כן** נכללים — זה המידע של המשתמש חוזר אליו |
| מחיקת חשבון מלאה (GDPR) | ✅ הושלם | Phase 4.2 — זרימה דו-שלבית עם grace period של 30 יום: `requestAccountDeletion`/`cancelAccountDeletion` (`src/actions/privacy.ts`) + `DeleteAccountSection`/`DeletionPendingBanner`, ומחיקה בפועל ב-Cloud Function מתוזמן (`deleteExpiredAccounts`, `functions/src/accountDeletion.ts`). ראו `docs/DECISIONS.md` #24 |
| App Check | ✅ הושלם ונאכף | Phase 4.4 — `src/lib/firebase/appCheck.ts` (reCAPTCHA **Enterprise**) + debug mode ל-dev/CI. המפתח נוצר, נרשם ומולא ב-`apphosting.yaml`, ואחרי rollout ואימות verified requests הופעל **Enforce** על Firestore ו-Storage (2026-08-29) — threat #4 ב-`docs/SECURITY.md` סגור. ראו `docs/DECISIONS.md` #26, #27, #28 |
| הצפנת שדות רגישים (מספר כרטיס, CVV) בבסיס הנתונים | ✅ הושלם | Phase 4.3 — AES-256-GCM ב-`src/lib/crypto/{fieldEncryptionCore,fieldEncryption}.ts`, מפתח `CARD_FIELD_ENCRYPTION_KEY` ב-Secret Manager. יצירה/עריכה של שני השדות הרגישים עברו ל-Server Actions כדי שהמפתח לא יגיע ל-client. מיגרציה: `npm run migrate:encrypt-fields` (הורצה מול production ב-2026-08-29). ראו `docs/DECISIONS.md` #25 |
| צ'אטבוט/CLI לשיחה חופשית (הוספה/עריכה/מחיקה/שאילתה בשפה טבעית) | ✅ הושלם | Phase 5 — עמוד `/chat` + `POST /api/chat` (streaming), 10 MCP tools (קריאה+כתיבה+הרסניים עם אישור בשיחה), `npm run mcp:cli` ל-CLI. ראו `docs/DECISIONS.md` #17, #22 |
| קישור ערוץ הודעות לחשבון (WhatsApp) | ✅ הושלם | Phase 5.5.a — `channelLinks`/`channelLinkCodes`/`chatSessions` (Admin SDK בלבד), `src/lib/services/channelLinks.ts`, `src/actions/channelLink.ts`, `ChannelLinksSection` ב-`/settings`. קוד base32 בן 8 תווים ל-10 דקות, חד-פעמי, נוצר רק כשהמשתמש מאומת; ה-`uid` של הודעה נכנסת נגזר **רק** מ-`channelLinks`, לעולם לא מתוכן ההודעה. ראו `docs/DECISIONS.md` #29 |
| בוט WhatsApp (שיחה מעל ה-MCP tools) | ✅ הושלם | Phase 5.5.b–c — `POST/GET /api/whatsapp/webhook` (אימות `X-Hub-Signature-256` על הגוף הגולמי, דדופליקציה ב-`channelMessages`, `handleInboundChannelMessage` ניטרלי לספק, היסטוריה ב-`chatSessions`, rate limit על turns) + `npm run whatsapp:sim` לאימות בלי Meta. **חי בפרודקשן מ-2026-08-30** — inbound חתום מ-Meta אומת מקצה לקצה. מגבלה: מספר טסט של Meta, כ-5 נמענים מאושרים. ראו `docs/DECISIONS.md` #30, #31 |
| PWA (installable, offline) | ⏳ מתוכנן | Phase 6 |
| התראות תפוגה (push/email) | ⏳ מתוכנן | Phase 7 |
| דוחות וסטטיסטיקות | ⏳ מתוכנן | Phase 8 |
