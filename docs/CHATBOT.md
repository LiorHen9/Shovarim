# CHATBOT — סטטוס הסוכן (MCP + Claude)

מצב נכון ל-2026-08-27 (סוף שלב 5.2). עדכן מסמך זה עם כל שינוי משמעותי בארכיטקטורת הצ'אטבוט/MCP — ראה גם `docs/ROADMAP.md` Phase 5 (השלבים המלאים) ו-`docs/DECISIONS.md` ADR #17/#19/#20 (הרציונל המלא).

## תמונת מצב כללית

**אין עדיין UI צ'אטבוט בווב.** אין `/api/chat` route, אין קומפוננטת React לצ'אט, ואין endpoint ב-Cloud Functions. מה שקיים היום הוא **walking skeleton מקומי בלבד**: סקריפט CLI (`npm run mcp:cli`) שמריץ לולאת tool-use ידנית מול Anthropic Messages API, עם שרת MCP יחיד (subprocess דרך stdio) שחושף tool בודד.

זהו "סוכן" במובן המצומצם — LLM + tools + לולאה שבה המודל מחליט מתי לקרוא לכלים — אך לא מסגרת אורקסטרציה (לא LangChain, לא Claude Agent SDK). ה-Route Handler העתידי לצ'אטבוט בווב (שלב 5.4) מיועד לעשות שימוש חוזר באותם מודולים (`agentLoop.ts`/`anthropicClient.ts`).

## היכן הקוד

| קובץ | תפקיד |
|---|---|
| `scripts/mcp-cli.ts` | נקודת כניסה — CLI אינטראקטיבי, מנפיק custom token, מתחבר, מריץ REPL |
| `mcp-server/index.ts` | שרת ה-MCP עצמו (stdio transport), מאמת ID token פעם אחת, נועל `uid` בסגירה |
| `src/lib/mcp/agentLoop.ts` | לולאת tool-use משותפת של Claude (`runAgentTurn`, `toAnthropicTools`) — מיועדת לשימוש חוזר ע"י route עתידי |
| `src/lib/mcp/anthropicClient.ts` | בניית ה-client; DEV=`ANTHROPIC_API_KEY`, PROD=Workload Identity Federation |
| `src/lib/mcp/config.ts` | `MODEL_ID = "claude-sonnet-5"`, `MAX_TOKENS = 16000` |
| `src/lib/services/cards.ts` | לוגיקת קריאת כרטיסים בצד שרת (`listCardsForUid`) — משותפת בין MCP tools לעתידיים Server Actions |
| `src/types/auditLog.ts` | טיפוס רשומת audit log לקריאות tool |

## האם יש System Prompt?

כן — מחרוזת inline ב-`scripts/mcp-cli.ts:70-73` (עברית), לא externalized לקובץ נפרד:

> "אתה עוזר AI לניהול שוברים וכרטיסי מתנה (Shovarim). ענה בעברית. השתמש בכלים שברשותך כדי לענות על שאלות לגבי הכרטיסים של המשתמש המחובר בלבד — אין לך גישה לנתונים של משתמשים אחרים, ואל תמציא מידע שלא הוחזר מכלי."

מועבר ל-`runAgentTurn` כבלוק טקסט יחיד עם `cache_control: { type: "ephemeral" }` (`agentLoop.ts:61`).

## Context

- **היסטוריית שיחה**: מערך `BetaMessageParam[]` מלא, מוזרם בין תורות ב-REPL של ה-CLI.
- **RAG**: אין (ללא embeddings/vector store).
- **נתוני אפליקציה**: לא מוזרקים מראש — המודל חייב לקרוא ל-tool כדי לקבל אותם (tool-use ולא context stuffing).
- **Prompt caching**: `cache_control: ephemeral` על בלוק ה-system, מכסה גם את סכימות ה-tools (סדר render קבוע).
- **Compaction**: beta `context_management: { edits: [{ type: "compact_20260112" }] }` — סיכום שיחה בצד שרת לשיחות ארוכות.

## Tools

כרגע **tool יחיד**: `listCards` (`mcp-server/index.ts:58-75`) — ללא input schema (`z.object({})`), כדי לאכוף מבנית שאין דרך למודל "להעביר" `uid`. מחזיר כרטיסים דרך `listCardsForUid(uid)`, אחרי `serializeCardsForLlm` שמסיר `cvv`/`barcodeOrCode` לפני שהמידע מגיע ל-LLM בכלל.

סט הכלים המתוכנן המלא (שלב 5.4, טרם מומש): `listCards, getCard, createCard, updateCard, deleteCard, logUsage, deleteUsageEntry, updateBalance, listCardLists, createList, ...` — ראה `docs/ROADMAP.md` שורה 85.

## Guardrails

- **`uid` אף פעם לא פרמטר של tool** — נגזר בצד שרת מ-ID token מאומת, ננעל בסגירה. זו החלטה מבנית (לא רק ולידציה) נגד prompt injection — ADR #17 ב-`docs/DECISIONS.md`.
- **הסרת שדות רגישים** — `cvv`/`barcodeOrCode` מוסרים לפני serialization ל-LLM.
- **Audit log** — כל קריאת tool נכתבת ל-`auditLog/{entryId}` (`writeAuditLog`), טיפוס `mcp_tool_call`.
- **הפרדת קרדנציאלים DEV/PROD** — `ANTHROPIC_API_KEY` חייב להיות unset ב-prod (עוקף WIF בשקט אם קיים) — ADR #20.
- **הנחיה ברמת system prompt נגד הזיה** — לא מנגנון אכיפה, רק הנחיה טקסטואלית.
- **חסר עדיין**: אין content moderation, אין rate limiting (מתוכנן — שלב 5.3, ADR #21), אין stop sequences, אין allow/deny lists. אישור מפורש לפעולות הרסניות (מחיקה) מתוכנן לשלב 5.4 ולא קיים היום כי אין עדיין tools כותבים.

## Skills

לא רלוונטי כרגע — אין `.claude/skills`-style directory לצ'אטבוט הזה. רק system prompt אחד + tool אחד, ללא הפשטה נוספת.

## מסמכים קשורים

- `docs/ROADMAP.md` Phase 5 — כל השלבים (5.1 עד 5.4) כולל מה נדחה במפורש ומה מתוכנן.
- `docs/DECISIONS.md` ADR #17 (MCP + uid בצד שרת), #19 (walking skeleton, runtime), #20 (מודל/caching/WIF).
- `docs/SECURITY.md` — threat #6 (prompt injection / פעולה בשם משתמש אחר).
- `docs/DATA_MODEL.md` — collection `auditLog`.
- `docs/DEPLOYMENT.md` — הקמת WIF ל-PROD.
