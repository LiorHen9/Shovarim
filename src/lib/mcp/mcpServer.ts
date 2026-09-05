// Transport-agnostic MCP server builder — extracted from mcp-server/index.ts
// (docs/DECISIONS.md ADR #22) so both the CLI entry point (stdio subprocess)
// and the web Route Handler (in-process InMemoryTransport, see
// src/app/api/chat/route.ts) register the exact same tools against the exact
// same uid-scoped service layer. Pure/no side effects on import — unlike
// mcp-server/index.ts, this file never reads env vars or connects a
// transport itself. Relative imports throughout so this resolves under both
// tsx (mcp-server/) and Next's bundler.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { adminDb } from "../firebase/adminApp";
import { ActionError } from "../actions/errorsCore";
import { checkAndConsumeRateLimit, RateLimitExceededError } from "../services/rateLimit";
import {
  createCardForUid,
  deleteCardForUid,
  getCardForUid,
  getCardSecretsForUid,
  listCardsForUid,
  updateCardDetailsForUid,
} from "../services/cards";
import { addUsageEntryForUid, deleteUsageEntryForUid } from "../services/usage";
import { updateCardBalanceForUid } from "../services/balance";
import { createCardListForUid, listCardListsForUid } from "../services/cardLists";
import { writeAuditLog } from "../audit/log";
import type { AuditLogChannel } from "../../types/auditLog";
import type { GiftCard } from "../../types/card";
import {
  createCardToolShape,
  createListToolShape,
  deleteCardToolShape,
  deleteUsageEntryToolShape,
  getCardToolShape,
  logUsageToolShape,
  updateBalanceToolShape,
  updateCardToolShape,
} from "./toolSchemas";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

// Central wrapper every tool handler goes through (docs/ROADMAP.md Phase
// 5.3/5.4): checks the per-uid rate limit before running the handler, and
// writes exactly one auditLog entry per call either way. Two kinds of
// failure are reported back to the model as a graceful tool_result
// (isError: true) rather than a protocol-level crash: a rate-limit
// rejection, and an ActionError (an *expected* business failure — not
// found/no permission/validation — same distinction docs/DECISIONS.md ADR
// #18 draws for Server Actions). Anything else is a real bug and is
// rethrown, same as before Phase 5.4's write tools existed.
async function withToolExecution(
  { uid, tool, channel, paramsSummary }: { uid: string; tool: string; channel: AuditLogChannel; paramsSummary?: string },
  handler: () => Promise<string>
): Promise<ToolResult> {
  try {
    await checkAndConsumeRateLimit(uid);
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      await writeAuditLog({ uid, eventType: "mcp_tool_call", tool, channel, paramsSummary, result: "error" });
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    throw error;
  }

  try {
    const resultText = await handler();
    await writeAuditLog({ uid, eventType: "mcp_tool_call", tool, channel, paramsSummary, result: "success" });
    return { content: [{ type: "text", text: resultText }] };
  } catch (error) {
    await writeAuditLog({ uid, eventType: "mcp_tool_call", tool, channel, paramsSummary, result: "error" });
    if (error instanceof ActionError) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    throw error;
  }
}

// cvv/barcodeOrCode are the two most sensitive fields on a card (see
// docs/SECURITY.md) and aren't useful for a chat answer — dropped here
// rather than sent to the LLM at all. This still holds for every *read* tool
// even though createCard/updateCard can now *write* these fields (ADR #36):
// letting the model set a value the user just typed is a one-way door, not
// a reason to also echo stored secrets back into read results.
function serializeCardForLlm(card: GiftCard) {
  return {
    id: card.id,
    name: card.name,
    categoryId: card.categoryId,
    tags: card.tags,
    initialBalance: card.initialBalance,
    currentBalance: card.currentBalance,
    currency: card.currency,
    expiryDate: card.expiryDate ? card.expiryDate.toDate().toISOString() : null,
    purchaseDate: card.purchaseDate ? card.purchaseDate.toDate().toISOString() : null,
    status: card.status,
  };
}

function serializeCardsForLlm(cards: GiftCard[]) {
  return cards.map(serializeCardForLlm);
}

// Adding a tool here that writes anything? Add its name to MUTATING_TOOL_NAMES
// in ./toolEffects.ts as well, or the WhatsApp reply that reports it will come
// without the "לאזור האישי" button (issue #62, ADR #60). Nothing fails loudly
// if you forget — the feature just quietly stops covering the new tool.
export function createMcpServer(uid: string, channel: AuditLogChannel): McpServer {
  const server = new McpServer({ name: "shovarim-mcp", version: "0.2.0" });

  server.registerTool(
    "listCards",
    { description: "רשימת כרטיסי המתנה של המשתמש המחובר (בבעלותו או משותפים עמו)." },
    async () =>
      withToolExecution({ uid, tool: "listCards", channel }, async () => {
        const cards = await listCardsForUid(uid);
        return JSON.stringify(serializeCardsForLlm(cards));
      })
  );

  server.registerTool(
    "getCard",
    {
      description: "פרטי כרטיס מתנה יחיד (בלי CVV/ברקוד).",
      inputSchema: getCardToolShape,
    },
    async ({ cardId }) =>
      withToolExecution({ uid, tool: "getCard", channel, paramsSummary: `cardId=${cardId}` }, async () => {
        const card = await getCardForUid(uid, cardId);
        return JSON.stringify(serializeCardForLlm(card));
      })
  );

  server.registerTool(
    "createCard",
    {
      description:
        "יצירת כרטיס מתנה חדש ברשימה קיימת, כולל אפשרות להזין קוד/ברקוד ו-CVV (שני השדות מוצפנים בצד שרת מיד עם השמירה — ראו docs/DECISIONS.md ADR #36). לא כולל תמונה — זו מתווספת דרך האתר בלבד.",
      inputSchema: createCardToolShape,
    },
    async (args) =>
      withToolExecution(
        {
          uid,
          tool: "createCard",
          channel,
          paramsSummary: `listId=${args.listId}, name=${args.name}, hasSecrets=${args.cvv !== null || args.barcodeOrCode !== null}`,
        },
        async () => {
          const cardId = adminDb.collection("cards").doc().id;
          const result = await createCardForUid(uid, {
            cardId,
            listId: args.listId,
            name: args.name,
            categoryId: args.categoryId,
            tags: args.tags,
            initialBalance: args.initialBalance,
            currency: args.currency,
            expiryDate: args.expiryDate ? new Date(args.expiryDate) : null,
            purchaseDate: args.purchaseDate ? new Date(args.purchaseDate) : null,
            cardImageUrl: null,
            barcodeOrCode: args.barcodeOrCode,
            cvv: args.cvv,
            acceptingRetailersUrl: args.acceptingRetailersUrl,
            notes: args.notes,
          });
          return JSON.stringify(result);
        }
      )
  );

  server.registerTool(
    "updateCard",
    {
      description:
        "עדכון פרטי כרטיס קיימים (שם, קטגוריה, תגיות, תוקף, הערות, קישור לרשתות מכבדות, ואופציונלית קוד/ברקוד ו-CVV — ADR #36). לא משנה יתרה/מטבע. יש לשלוח את שאר השדות הרגילים (כמו בטופס העריכה באתר) — אפשר לקרוא קודם ל-getCard כדי לראות את הערכים הנוכחיים (לא כולל CVV/ברקוד, שאינם נחשפים בקריאה בכלל). כדי לא לשנות CVV/ברקוד קיימים אל תכלול/י את השדות האלה בקריאה; כדי למחוק אותם שלח/י null; כדי לעדכן שלח/י ערך חדש.",
      inputSchema: updateCardToolShape,
    },
    async (args) =>
      withToolExecution(
        {
          uid,
          tool: "updateCard",
          channel,
          paramsSummary: `cardId=${args.cardId}, secretsTouched=${args.cvv !== undefined || args.barcodeOrCode !== undefined}`,
        },
        async () => {
          const secrets = await getCardSecretsForUid(uid, { cardId: args.cardId });
          const result = await updateCardDetailsForUid(uid, {
            cardId: args.cardId,
            name: args.name,
            categoryId: args.categoryId,
            tags: args.tags,
            expiryDate: args.expiryDate ? new Date(args.expiryDate) : null,
            acceptingRetailersUrl: args.acceptingRetailersUrl,
            notes: args.notes,
            barcodeOrCode: args.barcodeOrCode !== undefined ? args.barcodeOrCode : secrets.barcodeOrCode,
            cvv: args.cvv !== undefined ? args.cvv : secrets.cvv,
          });
          return JSON.stringify(result);
        }
      )
  );

  server.registerTool(
    "deleteCard",
    {
      description:
        "מחיקה מלאה של כרטיס (כולל יומן השימושים והתמונות שלו) — פעולה בלתי הפיכה. חובה לקרוא רק אחרי אישור מפורש של המשתמש/ת בשיחה.",
      inputSchema: deleteCardToolShape,
      annotations: { destructiveHint: true },
    },
    async (args) =>
      withToolExecution(
        { uid, tool: "deleteCard", channel, paramsSummary: `cardId=${args.cardId}, confirmed=${args.confirmed}` },
        async () => {
          if (!args.confirmed) {
            throw new ActionError(
              "לא בוצעה מחיקה — יש לבקש אישור מפורש מהמשתמש/ת (בטקסט חופשי, לא קריאה ל-tool) ולקרוא לכלי הזה שוב עם confirmed:true רק לאחר תשובה חיובית וברורה."
            );
          }
          const result = await deleteCardForUid(uid, { cardId: args.cardId });
          return JSON.stringify(result);
        }
      )
  );

  server.registerTool(
    "logUsage",
    {
      description: "רישום שימוש (הוצאה) בכרטיס — מקטין את היתרה הזמינה בהתאם.",
      inputSchema: logUsageToolShape,
    },
    async (args) =>
      withToolExecution(
        { uid, tool: "logUsage", channel, paramsSummary: `cardId=${args.cardId}, amount=${args.amount}` },
        async () => {
          const result = await addUsageEntryForUid(uid, {
            cardId: args.cardId,
            amount: args.amount,
            purpose: args.purpose,
            location: args.location,
            date: args.date ? new Date(args.date) : new Date(),
          });
          return JSON.stringify(result);
        }
      )
  );

  server.registerTool(
    "deleteUsageEntry",
    {
      description:
        "מחיקת רשומת שימוש מהיומן — פעולה בלתי הפיכה. חובה לקרוא רק אחרי אישור מפורש של המשתמש/ת בשיחה.",
      inputSchema: deleteUsageEntryToolShape,
      annotations: { destructiveHint: true },
    },
    async (args) =>
      withToolExecution(
        {
          uid,
          tool: "deleteUsageEntry",
          channel,
          paramsSummary: `cardId=${args.cardId}, entryId=${args.entryId}, confirmed=${args.confirmed}`,
        },
        async () => {
          if (!args.confirmed) {
            throw new ActionError(
              "לא בוצעה מחיקה — יש לבקש אישור מפורש מהמשתמש/ת (בטקסט חופשי, לא קריאה ל-tool) ולקרוא לכלי הזה שוב עם confirmed:true רק לאחר תשובה חיובית וברורה."
            );
          }
          const result = await deleteUsageEntryForUid(uid, {
            cardId: args.cardId,
            entryId: args.entryId,
            restoreBalance: args.restoreBalance,
          });
          return JSON.stringify(result);
        }
      )
  );

  server.registerTool(
    "updateBalance",
    {
      description: "עדכון ידני של יתרת כרטיס (לא דרך רישום שימוש) — לתיקון פערים מול בית העסק.",
      inputSchema: updateBalanceToolShape,
    },
    async (args) =>
      withToolExecution(
        { uid, tool: "updateBalance", channel, paramsSummary: `cardId=${args.cardId}, newBalance=${args.newBalance}` },
        async () => {
          const result = await updateCardBalanceForUid(uid, args);
          return JSON.stringify(result);
        }
      )
  );

  server.registerTool(
    "listCardLists",
    { description: "רשימת רשימות הכרטיסים של המשתמש (בבעלותו או משותפות עמו) כולל ההרשאה שלו בכל אחת." },
    async () =>
      withToolExecution({ uid, tool: "listCardLists", channel }, async () => {
        const lists = await listCardListsForUid(uid);
        return JSON.stringify(lists.map((l) => ({ id: l.id, name: l.name, role: l.role })));
      })
  );

  server.registerTool(
    "createList",
    {
      description: "יצירת רשימת כרטיסים חדשה.",
      inputSchema: createListToolShape,
    },
    async (args) =>
      withToolExecution(
        { uid, tool: "createList", channel, paramsSummary: `name=${args.name}` },
        async () => {
          const result = await createCardListForUid(uid, args);
          return JSON.stringify(result);
        }
      )
  );

  return server;
}
