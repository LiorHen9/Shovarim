# CHATBOT — סטטוס הסוכן (MCP + Claude)

מצב נכון ל-2026-08-30. עדכן מסמך זה עם כל שינוי משמעותי בארכיטקטורת הצ'אטבוט/MCP — ראה גם `docs/ROADMAP.md` Phase 5 (השלבים המלאים) ו-`docs/DECISIONS.md` ADR #17/#19/#20/#21/#22/#29/#30/#36 (הרציונל המלא).

## תמונת מצב כללית

**יש UI צ'אטבוט בווב** (שלב 5.4): עמוד `/chat` (`src/components/chat/ChatPanel.tsx`) מול `POST /api/chat` — ה-Route Handler הראשון באפליקציה — שמזרים NDJSON חזרה לדפדפן. לצדו ממשיך להתקיים ה-CLI (`npm run mcp:cli`) כערוץ שני. אין endpoint ב-Cloud Functions.

**ערוץ WhatsApp: הקוד שלם, ההקמה מול Meta באמצע** (שלב 5.5.c). ה-webhook, הקישור, ההיסטוריה בצד שרת וה-rate limit קיימים ונבדקו, ו-Meta app + WABA + מספר טסט כבר קיימים — **כולל אימות מוצלח של השליחה דרך Graph API** (2026-08-29), שהיה עד אז הנתיב היחיד שלא הורץ מעולם. מה שחסר: הזרקת הסודות ל-Secret Manager ורישום ה-webhook. עד אז ה-endpoint מחזיר 503 ו**אין דרך למשתמש אמיתי לדבר עם הבוט** — אבל `npm run whatsapp:sim` מריץ את אותו קוד בדיוק בלי Meta.

**שלושה transports, אותם tools**: ה-CLI מריץ את `mcp-server/index.ts` כ-subprocess דרך stdio; ה-Route Handler של הווב ו-`handleInboundChannelMessage` של הערוצים מחברים את אותו שרת **in-process** דרך `InMemoryTransport.createLinkedPair()`, בלי spawn של תהליך לכל בקשה. רישום ה-tools עצמו משותף לחלוטין — `createMcpServer(uid, channel)` ב-`src/lib/mcp/mcpServer.ts` (ADR #22).

זהו "סוכן" במובן המצומצם — LLM + tools + לולאה שבה המודל מחליט מתי לקרוא לכלים — אך לא מסגרת אורקסטרציה (לא LangChain, לא Claude Agent SDK).

## היכן הקוד

| קובץ | תפקיד |
|---|---|
| `src/app/api/chat/route.ts` | ה-Route Handler של הווב — `requireUid()`, חיבור MCP in-process, סטרימינג NDJSON |
| `src/components/chat/ChatPanel.tsx` | קומפוננטת הצ'אט (client) — קוראת את ה-stream, מציגה סטטוס tool, שומרת history |
| `scripts/mcp-cli.ts` | נקודת כניסה — CLI אינטראקטיבי, מנפיק custom token, מתחבר, מריץ REPL |
| `src/lib/mcp/mcpServer.ts` | **רישום כל ה-tools** (`createMcpServer`) + `withToolExecution` — טהור, בלי transport/side effects |
| `mcp-server/index.ts` | עטיפת CLI דקה בלבד: מאמת ID token, קורא ל-`createMcpServer(uid, "cli")`, מחבר stdio |
| `src/lib/mcp/toolSchemas.ts` | סכימות ה-input של ה-tools הכותבים — `cvv`/`barcodeOrCode` כן נכללים ב-`createCard`/`updateCard` (ADR #36); תמונות (`cardImageUrl`/`receiptImageUrl`) לא, ואף פעם לא נחשפות בקריאה |
| `src/lib/mcp/systemPrompt.ts` | ה-system prompt המשותף ל-CLI ולווב |
| `src/lib/mcp/agentLoop.ts` | לולאת tool-use משותפת של Claude (`runAgentTurn`, `toAnthropicTools`, callbacks `onText`/`onToolCall`) |
| `src/lib/mcp/anthropicClient.ts` | בניית ה-client; DEV=`ANTHROPIC_API_KEY`, PROD=Workload Identity Federation |
| `src/lib/mcp/config.ts` | `MODEL_ID = "claude-sonnet-5"`, `MAX_TOKENS = 16000`, `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX_CALLS` |
| `src/lib/services/{cards,usage,balance,cardLists}.ts` | שכבת השירות (Admin SDK, uid כפרמטר) — משותפת בין MCP tools ל-Server Actions |
| `src/lib/services/rateLimit.ts` | `checkAndConsumeRateLimit` — fixed-window rate limit פר-uid (`rateLimits/{uid}`) |
| `src/types/auditLog.ts` | טיפוס רשומת audit log לקריאות tool |
| `src/lib/services/channelLinks.ts` | **הערוץ→uid** — יצירה/פדיון של קוד קישור, `resolveUidForChannel`, `touchChannelLink` |
| `src/lib/validation/channelLink.ts` | נרמול E.164, פורמט קוד ה-base32, `channelKey` |
| `src/actions/channelLink.ts` + `src/components/settings/ChannelLinksSection.tsx` | הצד המאומת: הפקת קוד ב-`/settings`, רשימת ערוצים, ניתוק |
| `src/app/api/whatsapp/webhook/route.ts` | ה-webhook (5.5.b) — handshake, חתימה, דדופליקציה, שליחת התשובה |
| `src/lib/services/channelChat.ts` | **`handleInboundChannelMessage`** — הודעה נכנסת מקצה לקצה, ניטרלי לספק |
| `src/lib/whatsapp/{config,signature,graph}.ts` | הצד הספציפי ל-WhatsApp: env lazily, אימות HMAC, שליחה דרך Graph API |
| `src/lib/validation/whatsapp.ts` | פרסור סלחני של ה-payload של Meta → הודעות נכנסות מנורמלות |
| `src/lib/services/{chatSessions,channelMessages}.ts` | היסטוריה בצד שרת (24 שעות, גזימה בטוחה) ותביעת דדופליקציה |
| `src/lib/mcp/historyLimits.ts` | `trimHistory` — טהור וניתן לבדיקת יחידה, בלי Admin SDK |
| `scripts/whatsapp-sim.ts` | `npm run whatsapp:sim` — הרצת הזרימה האמיתית בלי Meta |

## האם יש System Prompt?

כן — `buildSystemPrompt(now?)` ב-`src/lib/mcp/systemPrompt.ts` (עברית; פונקציה, לא קבוע — כל שלושת ה-callers קוראים לה מחדש בכל תור כדי שהמודל יקבל את התאריך האמיתי). עד שלב 5.4 היה inline ב-`scripts/mcp-cli.ts`; חולץ לקובץ משותף כדי ששני הערוצים (CLI, web) יקבלו בדיוק אותן הנחיות.

מכסה: מענה בעברית, **התאריך הנוכחי מוזרק בכל תור** (כדי שהמודל יחשב תוקף יחסי כמו "5 שנים מהיום" בעצמו ולעולם לא ישאל את המשתמש/ת מה התאריך), שימוש ב-tools בלבד ואיסור המצאת מידע, איסור להמציא `listId`/`categoryId` (לברר קודם דרך `listCardLists`/`listCards`), **כלל האישור לפני פעולות הרסניות** (ראה Guardrails למטה), **זרימת "הדבקת שובר"** — כשמשתמש/ת מדביק/ה טקסט חיצוני (מייל/SMS) שמתאר שובר ומבקש/ת להוסיף כרטיס, המודל מונחה לחלץ בעצמו את כל השדות (כולל חישוב תוקף יחסי וקביעת הרשימה, עם ברירת מחדל לרשימה היחידה אם יש רק אחת), להציג תמצית אחת מסודרת של כל הפרטים ולבקש אישור/תיקון אחד — במקום סבב שאלות נפרד לכל שדה, ואיסור להמציא/לבקש ביוזמת הבוט ערכי CVV/קוד/ברקוד (מותר לקבל ולעדכן אותם דרך `createCard`/`updateCard` כשהמשתמש/ת יוזם/ת זאת — ADR #36).

מועבר ל-`runAgentTurn` כבלוק טקסט יחיד עם `cache_control: { type: "ephemeral" }` (`agentLoop.ts`).

## Context

- **היסטוריית שיחה**: מערך `BetaMessageParam[]` מלא. ב-CLI מוזרם בין תורות ב-REPL; בווב נשמר **בצד הלקוח בלבד** (state ב-`ChatPanel`) ונשלח במלואו בכל בקשה, כי אין session שרתי — ריענון דף מאבד את השיחה. אין persistence ואין sync בין מכשירים (ADR #22, היקף שנדחה במפורש). **ב-WhatsApp** אין לקוח שיחזיק אותה, ולכן היא נשמרת ב-`chatSessions/{channelKey}` כמחרוזת JSON (ADR #30): מתאפסת אחרי 24 שעות אי-פעילות, נגזמת בגבול ~200KB רק על גבול של הודעת משתמש אמיתית, ונמחקת בניתוק/קישור-מחדש של הערוץ.
- **RAG**: אין (ללא embeddings/vector store).
- **נתוני אפליקציה**: לא מוזרקים מראש — המודל חייב לקרוא ל-tool כדי לקבל אותם (tool-use ולא context stuffing).
- **Prompt caching**: `cache_control: ephemeral` על בלוק ה-system, מכסה גם את סכימות ה-tools (סדר render קבוע).
- **Compaction**: beta `context_management: { edits: [{ type: "compact_20260112" }] }` — סיכום שיחה בצד שרת לשיחות ארוכות.

## Tools

**10 tools**, כולם רשומים ב-`src/lib/mcp/mcpServer.ts` דרך `withToolExecution` (wrapper מרוכז: rate limit → handler → רשומת audit log אחת בדיוק, בכל תוצאה):

| Tool | סוג | הערות |
|---|---|---|
| `listCards` | קריאה | ללא input schema כלל — אוכף מבנית שאין דרך למודל "להעביר" `uid` |
| `getCard` | קריאה | כרטיס יחיד, בלי שדות רגישים |
| `listCardLists` | קריאה | כולל ה-role של המשתמש בכל רשימה |
| `createCard` | כתיבה | `cvv`/`barcodeOrCode` ניתנים ליצירה (מוצפנים מיד, ADR #36); `cardImageUrl` תמיד `null` — אין תמיכת תמונה בצ'אט |
| `updateCard` | כתיבה | `cvv`/`barcodeOrCode` הם שדות **אופציונליים** בסכימה — השמטה = ללא שינוי (השרת ממשיך להשתמש בסוד המוצפן הקיים), `null` = מחיקה, ערך = עדכון (ADR #36) |
| `logUsage` | כתיבה | טרנזקציה, מונע overdraft |
| `updateBalance` | כתיבה | עדכון ידני, בלי רשומת `usageLog` |
| `createList` | כתיבה | |
| `deleteCard` | **הרסני** | דורש `confirmed: true` |
| `deleteUsageEntry` | **הרסני** | דורש `confirmed: true` + `restoreBalance` |

כל ה-handlers קוראים לשכבת השירות (`src/lib/services/`) — אותה לוגיקה בדיוק שה-Server Actions של ה-UI מריצים, כולל `assertCanManageCard`/`assertCanManageListAndGetOwner`. הפלט עובר `serializeCardForLlm` שמסיר `cvv`/`barcodeOrCode` לפני שהמידע מגיע ל-LLM בכלל — זה עדיין נכון לכל כלי **קריאה** (`getCard`/`listCards`) גם אחרי ADR #36.

**סכימות ה-input**: `cardImageUrl`/`receiptImageUrl` אינם שדות בשום tool — אין תמיכת תמונה בצ'אט (`agentLoop.ts` לא מחבר Claude vision), והם לא עוברים ב-conversation history בכלל. `cvv`/`barcodeOrCode` **כן** שדות tool מ-ADR #36 (2026-08-30) — חריגה מפורשת ומצומצמת מהעיצוב המקורי, ראו שם לרציונל המלא ולהשלכות האבטחה (הערך עצמו כן עובר בקונטקסט המודל ובהיסטוריית השיחה מרגע שהמשתמש/ת מקליד/ה אותו).

## Guardrails

- **`uid` אף פעם לא פרמטר של tool** — נגזר בצד שרת מ-ID token מאומת, ננעל בסגירה. זו החלטה מבנית (לא רק ולידציה) נגד prompt injection — ADR #17 ב-`docs/DECISIONS.md`.
- **הסרת שדות רגישים מכלי קריאה** — `cvv`/`barcodeOrCode` מוסרים לפני serialization ל-LLM ב-`getCard`/`listCards`. **בכתיבה** (`createCard`/`updateCard`) המודל כן מקבל ומעביר אותם הלאה מ-ADR #36 — ראו שם.
- **Audit log** — כל קריאת tool נכתבת ל-`auditLog/{entryId}` (`writeAuditLog`), טיפוס `mcp_tool_call`.
- **הפרדת קרדנציאלים DEV/PROD** — `ANTHROPIC_API_KEY` חייב להיות unset ב-prod (עוקף WIF בשקט אם קיים) — ADR #20.
- **הנחיה ברמת system prompt נגד הזיה** — לא מנגנון אכיפה, רק הנחיה טקסטואלית.
- **Rate limiting per-uid, שני buckets** — `rateLimits/{subjectId}` (fixed window). `tools`: 30 קריאות/5 דקות, נאכף בתוך `withToolExecution` לפני כל handler; חריגה חוזרת כ-tool error (`isError: true`), לא כשגיאת פרוטוקול. `turns`: 12 הודעות/5 דקות, נאכף פעם אחת בראש כל הודעה נכנסת בערוץ webhook — כולל שיחה בלי שום קריאת tool. מספר שאינו מקושר נמדד לפי `channelKey` (אין uid, וזה משטח ניחוש קודי הקישור). ADR #21/#30.
- **אישור מפורש לפעולות הרסניות** (שלב 5.4) — `deleteCard`/`deleteUsageEntry` דורשים `confirmed: true` בסכימה, וה-system prompt מנחה לשאול בטקסט חופשי ולחכות לתשובה חיובית מפורשת לפני הקריאה. אם `confirmed` הוא `false`, ה-handler מחזיר tool error שמסביר למודל לשאול קודם. **זו לא אכיפה קשיחה** — המודל הוא זה שממלא את השדה; אין code-level gate בלולאת ה-tool-use (ADR #22, כולל האלטרנטיבה שנדחתה).
- **`ActionError` מוחזר כ-tool error, לא כקריסה** — שגיאות צפויות (לא נמצא/אין הרשאה/יתרה לא מספיקה) חוזרות למודל כ-`isError: true` והוא מסביר למשתמש; רק באגים אמיתיים נזרקים הלאה. אותה הבחנה כמו ADR #18 ל-Server Actions.
- **חסר עדיין**: אין content moderation, אין stop sequences, אין allow/deny lists. אין semantic cache (מתוכנן, ADR #17). ב-`/chat` ו-`mcp:cli` עדיין אין מגבלת turns — ה-bucket הזה נאכף רק בערוצי webhook, שם כל הודעה מגיעה מגורם לא-מאומת; בווב ה-session cookie הוא כבר חסם כניסה.

## ערוץ WhatsApp — הערוץ השלישי (שלב 5.5)

### חוויית המשתמש המתוכננת
יש **מספר טלפון עסקי אחד של הבוט**, ששייך למערכת ולא למשתמש. הזרימה:
1. המשתמש נכנס ל-`/settings` באפליקציה (מאומת), לוחץ "חיבור WhatsApp", ומקבל קישור `wa.me/<מספר-הבוט>?text=<קוד>` (issue #39, `src/lib/whatsapp/deepLink.ts`) — קוד בן 8 תווים עדיין קיים מתחת לקישור, אך אינו מוצג יותר ב-UI.
2. הוא לוחץ על הקישור בטלפון שלו — נפתח WhatsApp עם הקוד ממולא כהודעה, ונשאר רק ללחוץ שליחה.
3. מאותו רגע `channelLinks/whatsapp:+9725...` מקשר את המספר שלו ל-`uid`, והוא מתכתב בשפה חופשית — **אותם 10 tools** של `/chat`, רק שהממשק הוא WhatsApp.

צעד 1 הוא היחיד שקורה באפליקציה. זו גם הנקודה היחידה בזרימה שבה יש הוכחת בעלות על החשבון — ולכן היא מעוגנת ב-`requireUid()` (ADR #29).

### מה קיים בפועל (5.5.b) ומה לא
| | סטטוס |
|---|---|
| מודל הנתונים (`channelLinks`/`channelLinkCodes`/`chatSessions`/`channelMessages`) + Rules | ✅ |
| הפקת קוד, פדיון, רשימת ערוצים, ניתוק, audit log | ✅ |
| UI ב-`/settings` | ✅ |
| מחיקת חשבון + ייצוא מכסים את הערוצים ואת השיחות | ✅ |
| **webhook** (`/api/whatsapp/webhook`) — handshake, חתימה, דדופליקציה | ✅ 5.5.b |
| **היסטוריית שיחה בצד שרת** (`chatSessions` נכתב בפועל) | ✅ 5.5.b |
| **rate limit על turns** (לא רק על tool calls) | ✅ 5.5.b |
| **Meta app + WABA + מספר טסט** | ✅ 2026-08-29 |
| **שליחה אמיתית דרך Graph API** | ✅ 2026-08-29 — `sendWhatsAppText` הורץ מול Meta ונמסר למכשיר |
| **סודות ב-Secret Manager + רישום webhook** | ✅ 2026-08-30 |
| **inbound אמיתי מ-Meta** | ✅ 2026-08-30 — delivery חתום → פדיון קוד → תשובה במכשיר |

כלומר: הערוץ **חי מקצה לקצה**. משתמש מפיק קוד ב-`/settings`, שולח אותו בווטסאפ למספר הבוט, ומשם מנהל שיחה רגילה — אותו `runAgentTurn` ואותם MCP tools כמו הצ'אט באתר.

מגבלה שנשארה: המספר הוא **מספר טסט של Meta**, שמדבר רק עם רשימה של כ-5 נמענים מאושרים מראש. מעבר למספר אמיתי הוא צעד נפרד ולא נדרש שינוי קוד.

### למה הסדר הזה
זרימת הקישור נושאת את **כל** מודל ההרשאות של הערוץ: מספר טלפון ב-payload נכנס אינו הוכחת זהות, וה-`uid` נגזר אך ורק מ-`channelLinks`. עדיף להוכיח את זה ב-E2E לפני שמכניסים צד שלישי לתמונה.

### מה שונה מהווב
| | ווב | WhatsApp |
|---|---|---|
| מקור ה-`uid` | session cookie מאומת | lookup ב-`channelLinks` בלבד |
| היסטוריית שיחה | state בדפדפן, נשלחת בכל בקשה (ADR #22) | `chatSessions/{channelKey}` בצד שרת — אין לקוח שיחזיק אותה |
| גבול אמון של הבקשה | `requireUid()` | `X-Hub-Signature-256` על הגוף הגולמי |
| סטרימינג | NDJSON per-turn | אין — הודעה אחת שלמה חזרה |

### נקודות שדורשות תשומת לב לפני פרודקשן
- **תוכן ההודעות עובר דרך השרתים של Meta**, כולל תשובות הבוט (יתרות, שמות כרטיסים) — **וכעת גם `cvv`/`barcodeOrCode` עצמם**, אם המשתמש/ת בוחר/ת להזין אותם דרך הצ'אט (ADR #36 הפך את זה מבלתי-אפשרי מבנית להחלטת מוצר מכוונת). `docs/PRIVACY.md` מסמן את העברת התוכן לצד שלישי כדורשת עדכון מדיניות ו-re-consent לפני פרודקשן — סעיף שהיה פתוח עוד לפני ADR #36 ונעשה דחוף יותר עכשיו שהוא כולל גם את שני השדות הרגישים ביותר במפורש, לא רק יתרות/שמות.
- **הבוט רק עונה, לעולם לא יוזם** — מה שמשאיר אותנו בתוך חלון השירות של 24 שעות של WhatsApp, שבו מותר טקסט חופשי, בלי צורך ב-message templates מאושרים מראש. **אומת אמפירית ב-2026-08-29**: שליחה יזומה מחוץ לחלון נדחתה על ידי Meta בשגיאה `131047 Re-engagement message`, ואותה שליחה בדיוק עברה אחרי שהנמען שלח הודעה למספר הבוט. כלומר זו לא העדפת עיצוב אלא אילוץ אכיף של הספק. אם אי פעם ירצו התראות יזומות (למשל תזכורת תפוגה ב-Phase 7), זו החלטה חדשה לגמרי עם דרישות templates משלה — **ADR #31** קובע שהתראות Phase 7 מתוכננות סביב FCM ואימייל, ו-WhatsApp נשאר ערוץ שיחה. ראו `docs/DEPLOYMENT.md` לפירוט השגיאות והבחנתן מ-`131030`.
- **מקרה קצה ידוע — תשובה שנופלת מחוץ לחלון**: אם עיבוד הודעה מתארך מעבר לחלון (או ב-retry מאוחר של Meta), `sendWhatsAppText` ייכשל ב-`131047`, ו-`route.ts` יבלע את זה ללוג בלבד — **אחרי** שה-tools כבר רצו ושינו נתונים. מהצד של המשתמש זה נראה כמו בוט שותק שבכל זאת יצר כרטיס/עדכן יתרה. נדיר בפרודקשן (הבוט עונה בשניות) ולא נחסם ב-5.5.c, אבל זה המקום להתחיל לחפש אם מדווח "עשה את הפעולה ולא ענה".
- הקמת Meta (app, מספר, טוקנים) מתועדת ב-`docs/DEPLOYMENT.md`.

## Skills

לא רלוונטי כרגע — אין `.claude/skills`-style directory לצ'אטבוט הזה. רק system prompt אחד + tool אחד, ללא הפשטה נוספת.

## מסמכים קשורים

- `docs/ROADMAP.md` Phase 5 — כל השלבים (5.1 עד 5.4) כולל מה נדחה במפורש ומה מתוכנן.
- `docs/DECISIONS.md` ADR #17 (MCP + uid בצד שרת), #19 (walking skeleton, runtime), #20 (מודל/caching/WIF), #21 (rate limiting), #22 (UI + סט tools מלא, שכבת שירות משותפת, transport in-process), **#29 (ערוץ WhatsApp — קישור, runtime, היסטוריה בצד שרת)**, **#30 (ה-webhook — שכבה ניטרלית לספק, buckets, דדופליקציה, 503 עד ההקמה)**, **#36 (`cvv`/`barcodeOrCode` הופכים לשדות tool — חריגה מ-#17/#22)**.
- `docs/SECURITY.md` — threat #6 (prompt injection / פעולה בשם משתמש אחר), וסעיף "קישור ערוץ→משתמש".
- `docs/DATA_MODEL.md` — collections `auditLog`, `channelLinks`, `channelLinkCodes`, `chatSessions`.
- `docs/DEPLOYMENT.md` — הקמת WIF ל-PROD, והקמת WhatsApp (Meta app, מספר, סודות).
- `docs/PRIVACY.md` — מספר הטלפון כ-PII והעברת תוכן לצד שלישי.
