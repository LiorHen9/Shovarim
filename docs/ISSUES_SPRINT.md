# ISSUES_SPRINT — מעקב ספרינט על 21 ה-issues הפתוחים (#26–#68)

מסמך מעקב חי, ברוח `docs/ROADMAP.md`/`docs/FEATURES.md`. נכתב על בסיס סריקת קוד מלאה (2026-08-30; #62/#66/#67/#68 נוספו ותוארכו 2026-08-31). עדכן את הסטטוס (☐/🔶/✅) ואת ההערות בכל session שנוגע ב-issue מהרשימה.

**כלל עבודה קבוע לספרינט הזה**: לפני שמתחילים לעבוד על issue חדש מהרשימה — **לעצור ולבקש מהמשתמש לפתוח branch חדש**. לא ליצור branch אוטומטית, ולא לעבור בין issues על אותו branch. זה חל על כל issue בנפרד (גם כשכמה issues קטנים נראים דומים).

סטטוס: ☐ לא התחיל | 🔶 בעבודה | ✅ הושלם/נסגר

---

## 1. ✅ #31 — קונטרסט מסגרות פקדים
https://github.com/LiorHen9/Shovarim/issues/31 (label: design)

**קבצים**: `src/app/globals.css` (טוקנים `--border`/`--input`), `src/components/ui/input.tsx:11`.

**ממצא**: `--border`/`--input` היו `oklch(0.922 0 0)` מול `--background: oklch(1 0 0)` (לבן טהור) — קונטרסט ~1.26:1, מתחת ל-3:1 הנדרש (`docs/ACCESSIBILITY.md` checklist).

**תיקון**: הורדת lightness ל-`oklch(0.65 0 0)` לשני הטוקנים (light theme בלבד — `.dark` כבר תקין) → קונטרסט ~3.24:1 מול הרקע הלבן (חישוב אנליטי: ל-oklch אכרומטי, luminance יחסי = L³, כך שקונטרסט = 1.05/(L³+0.05)). `--sidebar-border` (אותו ערך מקורי) נשאר ללא שינוי בכוונה — מפריד דקורטיבי, לא UI component boundary, מחוץ לתחום ה-issue. אומת ויזואלית מול dev server אמיתי (עמוד זמני עם `Input`/`Button variant="outline"`, נמחק בסיום) — הבדל ברור בין before/after.

**Effort**: קטן. **Risk**: נמוך. **אימות**: `npm run typecheck && npm run lint && npm run build` עברו; השוואת screenshot before/after אישרה קונטרסט נראה לעין.

---

## 2. ✅ #43 — לא להציג שמות tools בזמן "חושב"
https://github.com/LiorHen9/Shovarim/issues/43

**קבצים**: `src/components/chat/ChatPanel.tsx`.

**ממצא**: `setStatusText(\`משתמש/ת בכלי ${event.name}...\`)` חשף את שם ה-tool למשתמש.

**תיקון**: קבוע `THINKING_STATUS = "חושב/ת..."` בראש הקומפוננטה, משמש גם כערך ההתחלתי ב-`sendMessage` וגם בענף `tool_call` — כך שהחיווי אחיד לכל שלבי העיבוד ואין דרך שהשם ידלוף ל-UI.

**החלטת היקף**: התיקון מכוון ל-UI בלבד (בחירת המשתמש). שדה `name` נשאר ב-`ChatStreamEvent`/`route.ts:70`/`agentLoop.onToolCall` — הוא עדיין נראה ב-DevTools בזרם ה-NDJSON, אבל נחוץ ל-`scripts/run-chat-scenario.ts:62` לצורכי debug. אם בעתיד תידרש הסתרה גם ברמת ה-wire, זה שינוי נפרד.

**Effort**: קטן. **Risk**: נמוך. **אימות**: `npm run typecheck && npm run lint && npm run build` עברו.

---

## 3. ✅ #26 — הסתרת/חסימת קישור-מחדש כשכבר מקושר ל-WhatsApp
https://github.com/LiorHen9/Shovarim/issues/26

**קבצים**: `src/components/settings/ChannelLinksSection.tsx`, `src/lib/services/channelLinks.ts` (`createLinkCodeForUid`), `tests/e2e/settings.spec.ts`, `docs/DATA_MODEL.md`.

**ממצא**: כפתור "חיבור WhatsApp" הוצג ללא תנאי גם כשכבר היה קישור פעיל, ו-`createLinkCodeForUid` לא בדק קישור קיים לפני הנפקת קוד.

**תיקון (חסימה מלאה — החלטת המשתמש)**:
- **שרת**: `createLinkCodeForUid` קורא `listChannelLinksForUid` ודוחה עם `ActionError` אם כבר יש קישור לאותו ערוץ. הבדיקה לפני כל כתיבה, כך שבקשה דחויה לא מבטלת קודים קיימים.
- **UI**: הכפתור מוחלף בהסבר "חשבון WhatsApp כבר מקושר…" כשיש קישור, ומוצג רק אחרי שהרשימה נטענה (`!loading`) כדי שלא יהבהב. בלוק הקישור שהונפק (`issued`) נעלם גם הוא ברגע שרענון מראה שהקישור נקלט — קוד שמומש הוא שרוף.

**⚠️ נשמר במכוון**: `redeemLinkCode` ממשיך לדרוס קישור קיים (ADR #29, מעבר מספר בין חשבונות) — לא נגענו. הזרימה לא נשברת כי שם הקוד מונפק ע"י החשבון האחר, שאין לו קישור.

**תוצאת לוואי מקובלת**: אין כיום דרך לקשר שני מספרי WhatsApp לאותו חשבון. תועד ב-`docs/DATA_MODEL.md` תחת `channelLinkCodes`.

**Effort**: קטן-בינוני. **Risk**: נמוך. **אימות**: `typecheck`/`lint`/`build` עברו; `tests/e2e/settings.spec.ts` + `whatsapp.spec.ts` — 9/9 עברו (`--workers=1`; במקביליות מלאה יש כשלים סביבתיים שקיימים גם ב-`main`). הבדיקה בצד השרת אומתה בנפרד מול ה-emulator בסקריפט חד-פעמי: הנפקה → פדיון → הנפקה שנייה נדחתה → ניתוק → הנפקה עובדת שוב.

---

## 4. ✅ #37 — נסגר, ללא שינוי קוד

https://github.com/LiorHen9/Shovarim/issues/37

**ממצא**: `src/lib/mcp/toolSchemas.ts:37-38,51-56` ו-`src/lib/mcp/mcpServer.ts:131-132,170` מאשרים ש-`cvv`/`barcodeOrCode` כבר נתמכים ב-`createCard`/`updateCard` דרך הצ'אט (ADR #36, מומש 2026-08-30). רק תמונת כרטיס עדיין לא נתמכת דרך הצ'אט — מגבלה מכוונת (אין תמיכת vision), לא קשורה לתלונה המקורית.

**סגירה**: ה-issue נסגר ידנית ע"י המשתמש ב-2026-08-30. אין שינוי קוד.

**⚠️ נשאר פתוח להמשך (מתוך התגובות ב-issue)**: הועלתה אפשרות ל-**masking** של נתונים רגישים (מספר כרטיס/CVV) כך שלא יגיעו ל-LLM כלל, ופעולות יצירה/עריכה שמערבות אותם יתבצעו בזרימה דטרמיניסטית במקום דרך MCP tool — בדומה לאופן שבו סוכן קולי אוסף פרטי אשראי. ההחלטה של המשתמש: כרגע ה-tools מטפלים גם בנתונים האלה, והנושא יישקל עתידית. **אם זה יוחלט — לפתוח issue/ADR נפרד**, זה לא חלק מהספרינט הזה.

---

## 5. ✅ #47 — פלאש חזרה למסך התחברות אחרי redirect של Google

https://github.com/LiorHen9/Shovarim/issues/47

**קבצים**: `src/components/auth/SignInButtons.tsx`, `tests/e2e/public.spec.ts`.

**ממצא**: הזרימה בפועל היא `signInWithRedirect` (לא popup כפי שתואר ב-issue — ר' הערת קוד ב-`authService.ts:25-28` על iOS Safari + App Check). `completeSignIn()` רץ ב-`useEffect` על דף ה-`(public)` הרגיל: `completeRedirectSignIn()` → `getIdToken()` → `createSession()` Server Action → `router.push`/`router.refresh` — כל זה קורה **אחרי** שהדף כבר צויר במלואו כמסך התחברות רגיל.

**תיקון**: state חדש `isCompletingRedirect` שנקבע ל-`true` **סינכרונית** בראש ה-effect, לפני ה-`await` הראשון, ומצייר overlay `fixed inset-0` עם `backdrop-blur-sm` + spinner (`Loader2`, אותו idiom כמו `ChannelLinksSection.tsx:203`).

**שלוש החלטות בתיקון**:
1. **מותנה ב-`providerId` מ-sessionStorage** — מבקר רגיל, שאצלו `completeRedirectSignIn()` פשוט מחזיר `null`, לא רואה overlay בכלל. זו הסיבה שההעלאה של ה-state לא מותנית ב-`await`.
2. **לא מורידים את ה-overlay ב-`finally`** אלא רק בענף `!user` וב-`catch`. `router.push` אסינכרוני — הורדה ב-`finally` הייתה מחזירה את מסך ההתחברות לאוויר בדיוק בטווח שה-issue מתלונן עליו. בהצלחה הקומפוננטה נעלמת עם הניווט.
3. **כרטיס אטום סביב ה-spinner/טקסט** ולא טקסט חשוף על ה-scrim — בצילום המסך הראשון הטקסט נחת בדיוק מעל כפתור ההתחברות הכהה המטושטש, כהה-על-כהה מתחת ל-4.5:1.

**מגבלה ידועה**: פריים ראשון אחד עדיין מצויר בלי ה-overlay. ה-HTML של `/` הוא SSR ולשרת אין דרך לדעת שחוזרים מ-redirect (Firebase לא מוסיף query params לכתובת החזרה), כך שהדפדפן מצייר את מסך ההתחברות לפני ש-React בכלל מתחיל hydration. סגירה מלאה של הפער הזה דורשת inline script חוסם ב-`<head>` — לא שווה את המחיר. התיקון מקצר את ההבהוב מכל אורך שרשרת ה-async לפריים בודד.

**Effort**: קטן-בינוני. **Risk**: נמוך. **אימות**: `typecheck`/`lint`/`build` עברו; `tests/e2e/public.spec.ts` — 4/4 עברו, כולל טסט regression חדש שמוודא ש**אין** overlay למבקר רגיל. ה-overlay עצמו אומת ויזואלית ב-screenshot מול dev server (הפעלה זמנית של ה-state, הוחזר לקדמותו).

---

## 6. ☐ #30 — הגבלת אורך הודעה בצד לקוח + חיווי
https://github.com/LiorHen9/Shovarim/issues/30

**קבצים**: `src/components/chat/ChatPanel.tsx:133-146` (ה-`<Textarea>`).

**ממצא**: מגבלת שרת **כבר קיימת** — `src/lib/validation/chat.ts:7` (`.max(4000)`) ו-`src/lib/validation/whatsapp.ts:50,77` (`MAX_TEXT_LENGTH=4000`, שם זה `.slice()` שקט). הפער האמיתי: ה-`<Textarea>` בעמוד הצ'אט בלי `maxLength`/מונה תווים — המשתמש מגלה את המגבלה רק אחרי שליחה, מ-toast גנרי ("בקשה לא תקינה", `route.ts:43`).

**תיקון**: `maxLength={4000}` על ה-`<Textarea>` + מונה תווים חי לצידה.

**Effort**: קטן. **Risk**: נמוך.

---

## 7. ✅ #44 — היסטוריית שיחה בעמוד צ'אט (persist בצד שרת)
https://github.com/LiorHen9/Shovarim/issues/44

**קבצים**: `src/lib/validation/chat.ts`, `src/app/api/chat/route.ts`, `src/components/chat/ChatPanel.tsx`.

**ממצא**: `chatSessions.ts` כבר סיפק דפוס גנרי מלא (`loadChannelHistory`/`saveChannelHistory`, `SESSION_MAX_IDLE_MS=24h`, `trimHistory`) — היה חסר רק החיווט מ-`route.ts`, שקיבל `history` מה-client ולא שמר אותו.

**מימוש**: `route.ts` קיבל `GET` חדש (טוען היסטוריה דרך `loadChannelHistory("web:{uid}", uid)`, ממיר ל-`{role, text}` להצגה — מדלג על turns של tool_use/tool_result). `POST` הפסיק לקבל `history` מה-client (`chatRequestSchema` איבד את השדה): טוען מהשרת, מריץ את הסבב, ושומר דרך `saveChannelHistory` לפני שמחזיר `done`. `ChatPanel` מושך היסטוריה ב-`useEffect` בעת mount ומציג אותה, בלי לשלוח שום history ב-body של הבקשה.

**⚠️ באג שנתפס באימות (תוקן באותו סבב)**: race condition אמיתי — אם המשתמש שולח הודעה לפני שה-`GET` הראשוני חוזר, ה-response המאוחר (שעדיין ריק, כי הסבב הנוכחי לא נשמר עדיין) דרס את ה-state האופטימי המקומי ומחק את ההודעה שנשלחה. תוקן: `setMessages((prev) => (prev.length === 0 ? data.messages : prev))` — אם כבר יש state מקומי (המשתמש כבר התחיל), תוצאת ה-fetch מתעלמת מעצמה.

**אימות בפועל**: `typecheck`/`lint`/`build` (גם `functions/`) נקיים. הורץ spec Playwright חד-פעמי (נמחק בסיום) מול Firebase emulators + קריאת Claude אמיתית: שליחת הודעה → תשובה זרמה נכון → `page.reload()` → אותה הודעת משתמש ואותה תשובת עוזר חזרו מ-`GET /api/chat`, בדיוק אותו טקסט. זה מה שחשף וגם אימת את התיקון ל-race condition למעלה — בלי ריצה אמיתית בדפדפן הבאג הזה היה נשאר סמוי.
- `buildUserDataExport`/`accountDeletion.ts` כבר שאלו את `chatSessions` לפי שדה `uid` (לא `channelKey`) — אומת בקריאת קוד: sessions `web:{uid}` נכללים אוטומטית בייצוא ובמחיקת חשבון בלי שום שינוי קוד נוסף.
- `chatSessions` נשאר server-only, `firestore.rules` לא שונה.

**Effort בפועל**: בינוני, כמתוכנן.

---

## 8. ✅ #27 — הנחיות תופסות מקום בעמוד הצ'אט
https://github.com/LiorHen9/Shovarim/issues/27

**קבצים**: `src/components/chat/ChatPanel.tsx`.

**תיקון הממצא הקודם**: הסריקה המקורית התמקדה בטקסט ההנחיה עצמו ("שורה מוחלשת אחת") והסיקה שאין מה לתקן. גוף ה-issue מצביע על **הקונטיינר** שעוטף אותו, לא על הטקסט — שתי תלונות מפורשות: (א) `min-h-[50vh]` ריק שדוחף את תיבת הכתיבה לתחתית העמוד; (ב) `rounded-lg border` זהה ל-`Textarea` (`src/components/ui/textarea.tsx:10`), כך שהקופסה הריקה נראית כמו שדה קלט שצריך ללחוץ עליו.

**תיקון**: `hasMessages` מתנה את ה-className של אזור השיחה. במצב ריק — `flex flex-col gap-3` בלבד (בלי `min-h`, בלי `border`, בלי `p-4`), כך שנשארת רק שורת ההנחיה כטקסט חשוף והטופס עולה לראש העמוד. ברגע שיש הודעות חוזר בדיוק המראה הקודם (`min-h-[50vh]` + מסגרת), כי אז הקונטיינר באמת מחזיק תוכן ובועות ההודעות לא מבלבלות עם שדה קלט.

**החלטת עיצוב**: ההצעה שב-issue הייתה להחליף סדר (טופס למעלה, היסטוריה למטה). המשתמש בחר בגישה הזו במקום — היא סוגרת את שתי התלונות בלי להפוך את כיוון הצ'אט המקובל (היסטוריה למעלה, כתיבה למטה).

**`aria-live="polite"` נשאר על אותו `<div>`** בשני המצבים — רק ה-className מתחלף, כך שהמעבר ממצב ריק למצב עם הודעות לא מחליף node ולא שובר את ההכרזה על טקסט שנכתב בזרימה.

**Effort**: קטן. **Risk**: נמוך. **אימות**: `typecheck`/`lint`/`build` עברו. אין spec E2E לצ'אט, לכן אומת ויזואלית מול dev server אמיתי (עמוד זמני שמרנדר `ChatPanel`, נמחק בסיום): before — קופסה ריקה בגובה 50vh עם תיבת כתיבה ב-y≈490; after — הנחיה כטקסט חשוף ותיבת כתיבה ב-y≈128; ואחרי שליחת הודעה הקונטיינר הממוסגר חוזר כמצופה.

---

## 9. ☐ #29 — הגנה כללית מפני הצפת תעבורה (anti-bot)
https://github.com/LiorHen9/Shovarim/issues/29

**קבצים**: `src/lib/firebase/appCheck.ts`, `src/proxy.ts`, `src/lib/services/rateLimit.ts`, `src/app/api/chat/route.ts`.

**ממצא**:
- App Check מכסה רק קריאות Firestore/Storage SDK ישירות — **לא** Server Actions או Route Handlers (`/api/chat`, `/api/whatsapp/webhook`), פער כבר מתועד ב-`docs/SECURITY.md:21`.
- `src/proxy.ts` עושה רק redirect לפי נוכחות session cookie, בלי rate limiting/זיהוי בוטים, ומחריג במפורש את `/api/chat`.
- `checkAndConsumeRateLimit` קיים אך מופעל **רק** בנתיב הערוצים (WhatsApp/MCP tool calls) — `src/app/api/chat/route.ts` קורא ל-`requireUid()` אבל **אף פעם לא** קורא ל-rate limit. משתמש מאומת בווב יכול היום להציף קריאות LLM בלי throttle.
- אין WAF/Cloud Armor/reCAPTCHA נפרד בפרויקט.

**תוכנית**: (א) להוסיף `checkAndConsumeRateLimit` (buckets `tools`/`turns` כבר קיימים ב-`src/lib/mcp/config.ts`) גם ל-`/api/chat` — הפרצה הכי ברורה ומהירה לסגור; (ב) rate limiting כללי per-IP/session ל-Route Handlers/עמודים ציבוריים; (ג) לשקול Cloud Armor ברמת App Hosting (הקמת Console, מחוץ לקוד — בדומה ל-App Check).

**Effort**: בינוני.

---

## 10. ☐ #41 — אימות אוטומטי של עמידה בדרישות נגישות
https://github.com/LiorHen9/Shovarim/issues/41

**קבצים**: `.github/workflows/ci.yml`, `eslint.config.mjs`, `docs/ACCESSIBILITY.md:19-22`, `tests/e2e/*.spec.ts`.

**ממצא**: היום הכל ידני ומוצהר שלא בוצע בפועל. אין `eslint-plugin-jsx-a11y` נפרד (רק מה שמגיע embedded מ-`eslint-config-next/core-web-vitals`), אין axe-core/lighthouse-ci ב-CI.

**תוכנית**: (א) `@axe-core/playwright` assertions בתוך specs E2E קיימים על flows קריטיים; (ב) `eslint-plugin-jsx-a11y` מפורש ב-`eslint.config.mjs`; (ג) לשקול lighthouse-ci gate ב-CI עם סף ציון. זה גם עונה ל"איך מוודאים גם בעתיד" — הופך לחלק מ-CI במקום תהליך ידני.

**Effort**: בינוני.

---

## 11. ☐ #40 — בר/תפריט נגישות (חובה חוקית)
https://github.com/LiorHen9/Shovarim/issues/40

**קבצים**: אין קיימים — פיצ'ר חדש. השוואה: `src/app/(public)/privacy`, `src/app/(public)/terms`.

**ממצא**: אין שום widget/ספריית נגישות קיימים בפרויקט (נבדק `package.json` וגם `src/`). זה פיצ'ר חדש לגמרי: toolbar צף (הגדלת/הקטנת פונט, ניגודיות גבוהה, אולי עצירת אנימציות) + עמוד "הצהרת נגישות" סטטי (pattern כמו `privacy`/`terms`) + חיווט ל-root layout.

**החלטה נדרשת בזמן העיצוב המפורט**: ספרייה מוכנה (widget צד-שלישי) מול בנייה עצמאית — תלוי גם בדרישות התקן הישראלי הספציפי (תקנות נגישות).

**Effort**: בינוני-גדול.

---

## 12. ☐ #38 — טיפול בהודעת FORWARD מוועד עובדים
https://github.com/LiorHen9/Shovarim/issues/38

**קבצים**: `src/lib/mcp/systemPrompt.ts:33-35`, `docs/CHATBOT_TEST_CASES.md`.

**ממצא**: זרימת "הדבקת שובר" הקיימת כללית וכבר כוללת ענף ל"מימוש דרך אפליקציה/טלפון". אין test case ל-ועד עובדים ספציפית.

**תוכנית**: להוסיף test case חדש (הודעת ועד עובדים לדוגמה, כולל מקרה של כמה שוברים בהודעה אחת אם רלוונטי) ולהריץ דרך `npm run chat:scenario`. לשנות את ה-system prompt **רק אם** הטסט מגלה פער אמיתי — לא לשנות מראש בלי ראיה לכשל.

**Effort**: קטן-בינוני.

---

## 13. ☐ #50 — סקרייפינג לינק שובר ⚠️ החלטת אבטחה פתוחה
https://github.com/LiorHen9/Shovarim/issues/50

**קבצים**: `src/lib/mcp/toolSchemas.ts`, `src/lib/mcp/mcpServer.ts` (אין tool כזה היום), `src/lib/whatsapp/graph.ts:32` (סגנון fetch לצד שרת קיים, לא scraping).

**ממצא**: אין כיום שום tool ל-fetch/scraping בין 10 ה-tools הקיימים, ואין utility ל-HTML parsing בפרויקט.

**⚠️ החלטה פתוחה (המשתמש בחר לא להכריע מראש)**: allowlist דומיינים מוכר (בטוח יותר, דורש תחזוקה) **מול** fetch כללי עם הקשחות (חסימת IP פרטי למניעת SSRF, timeout, הגבלת גודל תגובה, ללא credentials/redirects פראיים). **להחליט את זה במפורש לפני מימוש** — לא לנחש. עד אז לתעד כ-ADR פתוח ב-`docs/DECISIONS.md`.

**Effort**: בינוני-גדול (תלוי בהחלטה).

---

## 14. ☐ #28 — שכבה דטרמיניסטית + חיפוש חכם לחיסכון בטוקנים
https://github.com/LiorHen9/Shovarim/issues/28

**קבצים**: `src/lib/mcp/mcpServer.ts:105-113` (`listCards`/`serializeCardsForLlm`), `src/components/chat/ChatPanel.tsx:55`, `src/app/api/chat/route.ts:67,79`, `src/lib/mcp/agentLoop.ts`, `src/lib/mcp/anthropicClient.ts`.

**ממצאים**:
1. `listCards` מחזיר תמיד את **כל** הכרטיסים במלואם — אין פרמטר סינון/pagination. שאלה ממוקדת עדיין גוררת fetch מלא.
2. היסטוריית שיחה בווב נשלחת **במלואה** בכל בקשה — אין compaction/סיכום בנתיב הזה (רק ב-WhatsApp, וגם שם זה קיצוץ קשיח לא סיכום).
3. אין שכבת RAG/embeddings/pre-filter דטרמיניסטית בכלל.

**תוכנית**: (א) tool עם פרמטר סינון (לפי שם/listId) כדי לא לגרור רשימה מלאה כשלא צריך; (ב) לאמת בקוד (לא רק בתיעוד) אם `cache_control`/compaction (`context_management`) כבר מכוסים בנתיב הווב ולא רק ב-CLI; (ג) profiling קצר לפני השקעה בפתרון — לא לבנות תשתית למקום שהעלות שם כבר נמוכה.

**Effort**: בינוני-גדול. לא דחוף.

---

## 15. ☐ #34 — רישום ראשוני דרך WhatsApp (עיצוב תחילה)
https://github.com/LiorHen9/Shovarim/issues/34

**קבצים**: `src/lib/services/channelChat.ts:57-92` (`handleInboundChannelMessage`), `src/lib/auth/providers.ts:13-15`.

**ממצא**: אין היום שום נתיב ליצירת חשבון חדש מהודעת WhatsApp בלבד. מספר לא מקושר מקבל תשובת `REPLY_NOT_LINKED` ("התחבר/י באתר קודם"). האפליקציה תומכת רק Google Sign-In — אין path של סיסמה/טלפון.

**החלטת המשתמש**: לתכנן עכשיו כפרויקט-משנה ארכיטקטוני, לא רק לדחות.

**נדרש עיצוב (PR ראשון = מסמך ADR ב-`docs/DECISIONS.md`, לא קוד)**:
1. מנגנון יצירת זהות Firebase Auth בלי Google OAuth — Firebase Phone Auth (SMS OTP) מול custom token מבוסס אימות בעלות מספר דרך ה-webhook עצמו (spoofing של מספר הוא threat קיים ומתועד).
2. ענף חדש ב-`handleInboundChannelMessage`: יצירת uid+`channelLinks` doc באטומיות + מקבילה טקסטואלית ל-consent (ConsentBanner היום הוא UI-only).
3. מיזוג זהויות: משתמש שנרשם דרך WhatsApp ורוצה בהמשך גם Google Sign-In על אותו חשבון — זרימה שלא קיימת היום.

**Effort**: גדול, ארכיטקטוני. מתחיל ב-ADR, לא בקוד.

---

## 16-17. ⚠️ #35 / #36 — התראות יזומות ב-WhatsApp — נשאר פתוח בכוונה
https://github.com/LiorHen9/Shovarim/issues/35 · https://github.com/LiorHen9/Shovarim/issues/36

**ממצא משותף**: שני ה-issues חוסמים על אותה מגבלת ספק — חלון 24 שעות, שגיאה `131047` מתועדת אמפירית ב-ADR #31. הודעה יזומה ב-WhatsApp דורשת Meta message templates, תהליך אישור נפרד לגמרי מהקוד הקיים.

**⚠️ המשתמש בחר להשאיר פתוח**: לא הוכרע בין "FCM/email קודם, WhatsApp templates אחר כך" לבין "להתחיל תהליך אישור Meta templates ישירות". **לא לתזמן מימוש של #35/#36 עד שההחלטה הזו תתקבל** — לחזור ולשאול לפני שמתחילים.

**ממצא נלווה ל-#36**: אין **בכלל** תשתית התראה (לא email, לא push, לא in-app) על הזמנה לרשימה משותפת היום — `src/actions/listShare.ts:15-58` (`inviteListMember`) רק כותב Firestore, בלי לעדכן איש. גם אם הערוץ הסופי יהיה WhatsApp, ייתכן שיידרש קודם baseline in-app/email.

**Effort**: תלוי בהחלטה, לא ידוע.

---

## 18. ☐ #62 — לינק לאזור אישי בהודעות סיכום בווטסאפ
https://github.com/LiorHen9/Shovarim/issues/62

**קבצים**: `src/lib/services/channelChat.ts:131` (בניית ה-`reply`), `src/lib/appUrl.ts` (`getAppUrl`/`buildListInviteUrl`), `src/lib/whatsapp/graph.ts` (`sendWhatsAppText`, `MAX_BODY_LENGTH=4096`).

**ממצא**: כשהבוט שולח הודעת סיכום (הוספה/מחיקה/עריכה/שיתוף רשימה/הרשמה וכו') — ה-reply הסופי נבנה ב-`channelChat.ts:131` (`const reply = chunks.join("\n\n").trim();`), **אחרי** ש-`runAgentTurn` (`agentLoop.ts`) כבר סיים לגמרי את הסבב מול ה-LLM. הוספת לינק בנקודה הזו היא concatenation טהור על מחרוזת — אין קריאת Anthropic API נוספת ואין השפעה על ה-context/הקרדיטים, בדיוק האילוץ המפורש ב-issue. אין כיום שום "אובייקט הודעת סיכום" נפרד מתשובת המודל עצמה (`mcpServer.ts` tools מחזירים טקסט רגיל ל-agent loop, שם המודל מנסח את הסיכום בעצמו) — כלומר "לינק בהודעת סיכום" בפועל = "לינק על כל תשובה סופית שיוצאת מ-`channelChat.ts:131`", לא רק על תת-קבוצה מזוהה של הודעות.

יש כבר helper מוכן מ-issue #58/#61 לבניית URL ציבורי ל-WhatsApp: `src/lib/appUrl.ts` — `getAppUrl()` קורא `NEXT_PUBLIC_APP_URL`, ו-`buildListInviteUrl(code)` בונה `${getAppUrl()}/invite/...`. דרוש רק פונקציה מקבילה (למשל `buildSettingsUrl()` → `${getAppUrl()}/settings`).

**מגבלה שצריך לזכור**: `sendWhatsAppText` (`graph.ts`) חותך בתגובה שחוצה `MAX_BODY_LENGTH=4096` תווים — תשובה ארוכה עם לינק בסוף עלולה לאבד את הלינק דווקא. עדיף לבנות את הלינק כשורה קצרה וקבועה, ואולי לבדוק/לקצר את גוף התשובה לפני הצירוף במקום אחרי.

**החלטה נדרשת בזמן העיצוב המפורט**: האם הלינק מוצמד לכל תשובה, או רק כשזוהה tool call "משנה מצב" (create/update/delete/share) בסבב? האופציה השנייה דורשת להעביר סימון מ-`runAgentTurn`/tool handlers חזרה ל-`channelChat.ts` (שינוי קטן ב-`agentLoop.ts` — למשל return value בוליאני "בוצעה פעולת כתיבה"), בעוד האופציה הראשונה היא שינוי שורה אחת. לא להכריע מראש בלי אישור המשתמש.

**Effort**: קטן (אופציה "על כל תשובה") עד קטן-בינוני (אופציה "רק אחרי פעולת כתיבה"). **Risk**: נמוך.

---

## 19. ✅ #66 — לינק לעמוד הבית בהודעת "מספר לא מקושר"
https://github.com/LiorHen9/Shovarim/issues/66

**⚠️ אי-התאמה בין כותרת ה-issue לגוף**: כותרת ה-issue ("כשהבוט בווטסאפ מקבל הודעה ממשתמש שאינו מוכר") לא תאמה לגוף ("לינק לאזור האישי") — הגוף כמעט זהה לניסוח #62. **הובהר מול המשתמש**: ההתנהגות הרצויה היא לפי הכותרת — לינק על ה-`REPLY_NOT_LINKED` (מספר לא מקושר), לא כפילות עם #62.

**קבצים**: `src/lib/services/channelChat.ts` (`ChannelReply`, `REPLY_NOT_LINKED`), `src/lib/whatsapp/graph.ts` (`sendWhatsAppCtaUrl`), `src/app/api/whatsapp/webhook/route.ts`, `scripts/whatsapp-sim.ts`.

**תיקון (עודכן — לינק כפתור, לא טקסט מוטמע)**: המשתמש ביקש במפורש שהלינק לא יהיה חלק ממחרוזת ההודעה אלא כפתור מוצמד. `handleInboundChannelMessage` משנה טיפוס החזרה מ-`string` ל-`ChannelReply` (`{ text, cta? }`) — `cta` מוגדר רק על ה-`REPLY_NOT_LINKED`, כל שאר הענפים מחזירים טקסט בלבד. `graph.ts` מקבל `sendWhatsAppCtaUrl` חדשה ששולחת הודעת `interactive`/`cta_url` (Meta Cloud API — כפתור קישור אמיתי בתוך WhatsApp, לא URL כתוב), עם מגבלת גוף נפרדת של הודעות אינטראקטיביות (1024 תווים, מוגדרת כ-`MAX_INTERACTIVE_BODY_LENGTH` לצד ה-4096 של הודעת טקסט רגילה). ה-webhook route בוחר בין `sendWhatsAppCtaUrl`/`sendWhatsAppText` לפי קיום `reply.cta`.

**Effort**: קטן-בינוני. **Risk**: נמוך. **אימות**: `npm run typecheck && npm run lint && npm run build` עברו; `tests/unit/whatsappWebhook.test.ts` — 17/17 עברו. אין assertions ב-`tests/`/`scripts/` שהתבססו על `handleInboundChannelMessage` מחזיר `string` (רק `scripts/whatsapp-sim.ts`, עודכן).

---

## 20. ☐ #67 — פופאפ אחרי כניסה ראשונה: הצעה לחבר מספר טלפון
https://github.com/LiorHen9/Shovarim/issues/67

**קבצים**: `src/actions/auth.ts` (`createSession`, `ensureUserProfile`), `src/components/auth/SignInButtons.tsx:71-81`, `src/components/ui/dialog.tsx`, `src/components/lists/ShareListDialog.tsx` (דפוס Dialog לשימוש חוזר), `src/components/settings/ChannelLinksSection.tsx`, `src/app/(protected)/settings/page.tsx`.

**ממצא**: `ensureUserProfile` (`src/actions/auth.ts`) כבר בודק `if (snap.exists) return;` לפני יצירת מסמך `users/{uid}` חדש — זו בדיוק ההפרדה "משתמש חדש לגמרי" מול "כניסה חוזרת", בלי שום צורך בשדה Firestore חדש: מספיק שה-server actions (`ensureUserProfile`/`createSession`, כרגע `void`) יחזירו boolean `isNewUser`. מכיוון שה-Firestore existence check הוא חד-פעמי במהותו (המסמך נוצר פעם אחת בלבד לכל uid), אין סיכון ש-boolean כזה "ידלוף" שוב בכניסה הבאה — לא נדרש שדה נוסף כמו `hasSeenPhoneLinkNudge` כדי למנוע הצגה חוזרת.

`SignInButtons.tsx:71-81` הוא נקודת הקריאה היחידה ל-`createSession` מיד אחרי sign-in — שם אפשר לקבל את ה-flag ולהעלות state שמציג `Dialog` (יש כבר שני דפוסים מוכנים: `ShareListDialog.tsx` ו-`ChannelLinksSection.tsx`, שניהם עם `Dialog`/`DialogContent`/`DialogHeader` של shadcn). יעד ה-CTA בפופאפ: `/settings` (שם `ChannelLinksSection` מרונדר, שורה 37 בעמוד ההגדרות).

**תוכנית**: (א) `ensureUserProfile`/`createSession` מחזירים `{ isNewUser: boolean }`; (ב) `SignInButtons.tsx` מציג `Dialog` מותנה ב-`isNewUser` עם כפתור "מעבר להגדרות" → `/settings`, ואפשרות "אולי מאוחר יותר"; (ג) לשקול גם לבדוק `listChannelLinksForUid` לפני הצגה — כדי לא להציע לחבר טלפון למי שכבר מחובר לערוץ WhatsApp (רלוונטי בעיקר אם/כש-issue #34 — הרשמה ראשונית דרך WhatsApp — ימומש; כרגע אין נתיב כזה אז זה לא תרחיש אמיתי היום).

**Effort**: קטן-בינוני. **Risk**: נמוך.

---

## 21. ☐ #68 — מיחזור מספרי טלפון: סיכון זליגת נתונים למשתמש הבא ⚠️ דורש ADR
https://github.com/LiorHen9/Shovarim/issues/68

**קבצים**: `src/lib/services/channelLinks.ts:184-191` (`resolveUidForChannel`), `docs/DATA_MODEL.md` (`channelLinks/{channelKey}`), `docs/SECURITY.md` (threat model קיים סביב webhook/spoofing), `src/app/api/whatsapp/webhook/route.ts` (אימות חתימת Meta), `src/lib/mcp/mcpServer.ts` (10 tools נגישים דרך הבוט), `src/lib/mcp/config.ts` (rate limit buckets).

**ממצא**: `channelLinks/{channelKey}` הוא מיפוי טלפון→uid **קבוע וללא תפוגה** — `resolveUidForChannel` היא `.get()` פשוטה לפי מפתח, בלי שום בדיקת "last verified"/staleness. `touchChannelLink` מעדכן `lastMessageAt` אחרי כל תור, אבל שום קוד לא קורא את זה חזרה לצורך החלטת freshness — זה שדה תצוגה בלבד ל-`/settings`. חתימת ה-webhook (`verifyMetaSignature`, מתועד ב-`docs/SECURITY.md`, ADR #30) מוכיחה שה-payload הגיע מ-Meta ולא זויף — **לא** שמי ששולח מהמספר הזה היום הוא עדיין בעל המספר המקורי. חיפוש ב-`docs/SECURITY.md`/`docs/DECISIONS.md`/`docs/PRIVACY.md` אחר "מיחזור/recycl/carrier" — אין אף אזכור. **זהו threat חדש שלא תועד עד כה בפרויקט**, לא כיסוי חלקי של threat קיים.

**זרוע הסיכון**: מספר ממוחזר מקבל מיידית גישת קריאה/כתיבה מלאה, זהה לבעלים המקורי, לכל 10 ה-tools של הבוט — כולל צפייה/עריכה של `cvv`/`barcodeOrCode` (ADR #36), מחיקת כרטיסים, שיתוף רשימות. אין כיום שום שכבת step-up authentication על אף פעולה — הגנת ה-`confirmed:true` על מחיקות (`mcpServer.ts`) היא double-check שיחתי נגד טעויות, לא הוכחת זהות.

**⚠️ דורש החלטת ADR לפני מימוש (בדומה לתבנית #50 במסמך זה) — לא לנחש**. אפשרויות שהמשתמש/הקוד מצביעים עליהן, ללא הכרעה:
1. **Re-verification תקופתי**: לדרוש קוד קישור מחדש (כמו הזרימה הקיימת ל-linking) אחרי N ימים/חודשים של חוסר פעילות, או במרווח קבוע ללא תלות בפעילות.
2. **Step-up auth לפעולות רגישות בלבד**: פעולות עם blast radius גבוה (צפייה ב-CVV/ברקוד, מחיקה, שיתוף) דורשות אישור טרי — למשל push/email לחשבון ה-Google המקושר עם כפתור אישור, לפני שהבוט מבצע.
3. **שילוב Google + WhatsApp OTP** כפי שהמשתמש הציע במפורש בגוף ה-issue — מורכב יותר כי אין לבוט ערוץ ישיר "לדחוף" בקשת אימות Google לאמצע שיחת WhatsApp; דורש תיאום בין הערוצים (למשל דרך FCM/push לאתר).

עד להחלטה: לתעד כ-ADR פתוח ב-`docs/DECISIONS.md` (לא לממש דבר).

**Effort**: בינוני-גדול (תלוי בהחלטה). **Risk**: גבוה אם לא מטופל — אבל גם גבוה למימוש שגוי (UX חיכוך מיותר אם הסף שגוי).

---

## אימות (רלוונטי לפי issue)

- `npm run typecheck && npm run lint && npm run build` — לכל שינוי קוד.
- `npm run test:rules` (מול Firestore emulator) / `npm run test:e2e` — כשמשנים collections/rules/flows.
- `npm run chat:scenario` / `npm run whatsapp:sim` — לשינויי צ'אטבוט (issues 2, 7, 12, 13, 14, 15).
- עדכון `docs/ROADMAP.md`/`docs/FEATURES.md`/`docs/DECISIONS.md` בסיום כל issue, לפי הכלל הקבוע ב-`CLAUDE.md`.
- סימון ה-checkbox המתאים בקובץ הזה (☐ → ✅) בסיום כל issue.
