# CHATBOT — סטטוס הסוכן (MCP + Claude)

מצב נכון ל-2026-08-29 (סוף שלב 5.4). עדכן מסמך זה עם כל שינוי משמעותי בארכיטקטורת הצ'אטבוט/MCP — ראה גם `docs/ROADMAP.md` Phase 5 (השלבים המלאים) ו-`docs/DECISIONS.md` ADR #17/#19/#20/#21/#22 (הרציונל המלא).

## תמונת מצב כללית

**יש UI צ'אטבוט בווב** (שלב 5.4): עמוד `/chat` (`src/components/chat/ChatPanel.tsx`) מול `POST /api/chat` — ה-Route Handler הראשון באפליקציה — שמזרים NDJSON חזרה לדפדפן. לצדו ממשיך להתקיים ה-CLI (`npm run mcp:cli`) כערוץ שני. אין endpoint ב-Cloud Functions (ערוצי WhatsApp/Telegram עדיין לא מומשו).

**שני ה-transports, אותם tools**: ה-CLI מריץ את `mcp-server/index.ts` כ-subprocess דרך stdio; ה-Route Handler מחבר את אותו שרת **in-process** דרך `InMemoryTransport.createLinkedPair()`, בלי spawn של תהליך לכל בקשת HTTP. רישום ה-tools עצמו משותף לחלוטין — `createMcpServer(uid, channel)` ב-`src/lib/mcp/mcpServer.ts` (ADR #22).

זהו "סוכן" במובן המצומצם — LLM + tools + לולאה שבה המודל מחליט מתי לקרוא לכלים — אך לא מסגרת אורקסטרציה (לא LangChain, לא Claude Agent SDK).

## היכן הקוד

| קובץ | תפקיד |
|---|---|
| `src/app/api/chat/route.ts` | ה-Route Handler של הווב — `requireUid()`, חיבור MCP in-process, סטרימינג NDJSON |
| `src/components/chat/ChatPanel.tsx` | קומפוננטת הצ'אט (client) — קוראת את ה-stream, מציגה סטטוס tool, שומרת history |
| `scripts/mcp-cli.ts` | נקודת כניסה — CLI אינטראקטיבי, מנפיק custom token, מתחבר, מריץ REPL |
| `src/lib/mcp/mcpServer.ts` | **רישום כל ה-tools** (`createMcpServer`) + `withToolExecution` — טהור, בלי transport/side effects |
| `mcp-server/index.ts` | עטיפת CLI דקה בלבד: מאמת ID token, קורא ל-`createMcpServer(uid, "cli")`, מחבר stdio |
| `src/lib/mcp/toolSchemas.ts` | סכימות ה-input של ה-tools הכותבים (בלי `cvv`/`barcodeOrCode`/תמונות) |
| `src/lib/mcp/systemPrompt.ts` | ה-system prompt המשותף ל-CLI ולווב |
| `src/lib/mcp/agentLoop.ts` | לולאת tool-use משותפת של Claude (`runAgentTurn`, `toAnthropicTools`, callbacks `onText`/`onToolCall`) |
| `src/lib/mcp/anthropicClient.ts` | בניית ה-client; DEV=`ANTHROPIC_API_KEY`, PROD=Workload Identity Federation |
| `src/lib/mcp/config.ts` | `MODEL_ID = "claude-sonnet-5"`, `MAX_TOKENS = 16000`, `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX_CALLS` |
| `src/lib/services/{cards,usage,balance,cardLists}.ts` | שכבת השירות (Admin SDK, uid כפרמטר) — משותפת בין MCP tools ל-Server Actions |
| `src/lib/services/rateLimit.ts` | `checkAndConsumeRateLimit` — fixed-window rate limit פר-uid (`rateLimits/{uid}`) |
| `src/types/auditLog.ts` | טיפוס רשומת audit log לקריאות tool |

## האם יש System Prompt?

כן — `SYSTEM_PROMPT` ב-`src/lib/mcp/systemPrompt.ts` (עברית). עד שלב 5.4 היה inline ב-`scripts/mcp-cli.ts`; חולץ לקובץ משותף כדי ששני הערוצים (CLI, web) יקבלו בדיוק אותן הנחיות.

מכסה: מענה בעברית, שימוש ב-tools בלבד ואיסור המצאת מידע, איסור להמציא `listId`/`categoryId` (לברר קודם דרך `listCardLists`/`listCards`), **כלל האישור לפני פעולות הרסניות** (ראה Guardrails למטה), ואיסור לבקש/לקבל CVV/קוד/ברקוד בצ'אט.

מועבר ל-`runAgentTurn` כבלוק טקסט יחיד עם `cache_control: { type: "ephemeral" }` (`agentLoop.ts`).

## Context

- **היסטוריית שיחה**: מערך `BetaMessageParam[]` מלא. ב-CLI מוזרם בין תורות ב-REPL; בווב נשמר **בצד הלקוח בלבד** (state ב-`ChatPanel`) ונשלח במלואו בכל בקשה, כי אין session שרתי — ריענון דף מאבד את השיחה. אין persistence ואין sync בין מכשירים (ADR #22, היקף שנדחה במפורש).
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
| `createCard` | כתיבה | נוצר תמיד עם `cvv:null, barcodeOrCode:null, cardImageUrl:null` |
| `updateCard` | כתיבה | שולף את הסודות המוצפנים הקיימים ומעביר ללא שינוי, כדי לא למחוק אותם |
| `logUsage` | כתיבה | טרנזקציה, מונע overdraft |
| `updateBalance` | כתיבה | עדכון ידני, בלי רשומת `usageLog` |
| `createList` | כתיבה | |
| `deleteCard` | **הרסני** | דורש `confirmed: true` |
| `deleteUsageEntry` | **הרסני** | דורש `confirmed: true` + `restoreBalance` |

כל ה-handlers קוראים לשכבת השירות (`src/lib/services/`) — אותה לוגיקה בדיוק שה-Server Actions של ה-UI מריצים, כולל `assertCanManageCard`/`assertCanManageListAndGetOwner`. הפלט עובר `serializeCardForLlm` שמסיר `cvv`/`barcodeOrCode` לפני שהמידע מגיע ל-LLM בכלל.

**סכימות ה-input צרות מכוונת**: `cvv`/`barcodeOrCode`/`cardImageUrl`/`receiptImageUrl` אינם שדות בשום tool — המודל לא רואה ולא קובע אותם, והם לא עוברים ב-conversation history בכלל.

## Guardrails

- **`uid` אף פעם לא פרמטר של tool** — נגזר בצד שרת מ-ID token מאומת, ננעל בסגירה. זו החלטה מבנית (לא רק ולידציה) נגד prompt injection — ADR #17 ב-`docs/DECISIONS.md`.
- **הסרת שדות רגישים** — `cvv`/`barcodeOrCode` מוסרים לפני serialization ל-LLM.
- **Audit log** — כל קריאת tool נכתבת ל-`auditLog/{entryId}` (`writeAuditLog`), טיפוס `mcp_tool_call`.
- **הפרדת קרדנציאלים DEV/PROD** — `ANTHROPIC_API_KEY` חייב להיות unset ב-prod (עוקף WIF בשקט אם קיים) — ADR #20.
- **הנחיה ברמת system prompt נגד הזיה** — לא מנגנון אכיפה, רק הנחיה טקסטואלית.
- **Rate limiting per-uid** — `rateLimits/{uid}` (fixed window, 30 קריאות/5 דקות), נאכף בתוך `withToolExecution` לפני כל handler; חריגה חוזרת כ-tool error (`isError: true`), לא כשגיאת פרוטוקול. ADR #21 ב-`docs/DECISIONS.md`.
- **אישור מפורש לפעולות הרסניות** (שלב 5.4) — `deleteCard`/`deleteUsageEntry` דורשים `confirmed: true` בסכימה, וה-system prompt מנחה לשאול בטקסט חופשי ולחכות לתשובה חיובית מפורשת לפני הקריאה. אם `confirmed` הוא `false`, ה-handler מחזיר tool error שמסביר למודל לשאול קודם. **זו לא אכיפה קשיחה** — המודל הוא זה שממלא את השדה; אין code-level gate בלולאת ה-tool-use (ADR #22, כולל האלטרנטיבה שנדחתה).
- **`ActionError` מוחזר כ-tool error, לא כקריסה** — שגיאות צפויות (לא נמצא/אין הרשאה/יתרה לא מספיקה) חוזרות למודל כ-`isError: true` והוא מסביר למשתמש; רק באגים אמיתיים נזרקים הלאה. אותה הבחנה כמו ADR #18 ל-Server Actions.
- **חסר עדיין**: אין content moderation, אין stop sequences, אין allow/deny lists. ה-rate limit חל רק על קריאות tool — שיחת טקסט ארוכה בלי tools לא מוגבלת. אין semantic cache (מתוכנן, ADR #17).

## Skills

לא רלוונטי כרגע — אין `.claude/skills`-style directory לצ'אטבוט הזה. רק system prompt אחד + tool אחד, ללא הפשטה נוספת.

## מסמכים קשורים

- `docs/ROADMAP.md` Phase 5 — כל השלבים (5.1 עד 5.4) כולל מה נדחה במפורש ומה מתוכנן.
- `docs/DECISIONS.md` ADR #17 (MCP + uid בצד שרת), #19 (walking skeleton, runtime), #20 (מודל/caching/WIF), #21 (rate limiting), #22 (UI + סט tools מלא, שכבת שירות משותפת, transport in-process).
- `docs/SECURITY.md` — threat #6 (prompt injection / פעולה בשם משתמש אחר).
- `docs/DATA_MODEL.md` — collection `auditLog`.
- `docs/DEPLOYMENT.md` — הקמת WIF ל-PROD.
