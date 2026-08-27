// MCP server for the Phase 5 walking skeleton (docs/ROADMAP.md 5.1,
// docs/DECISIONS.md #19). Spawned as a plain Node child process over stdio by
// scripts/mcp-cli.ts — one process per CLI session, not a long-lived service.
//
// The authenticated uid is verified once at startup from a real Firebase ID
// token and closed over below. It is never a tool input parameter — see
// docs/SECURITY.md and docs/DECISIONS.md ADR #17: an LLM must have no channel
// to influence which uid a tool call runs as.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { adminAuth } from "../src/lib/firebase/adminApp";
import { listCardsForUid } from "../src/lib/services/cards";
import { checkAndConsumeRateLimit, RateLimitExceededError } from "../src/lib/services/rateLimit";
import { writeAuditLog } from "../src/lib/audit/log";
import type { AuditLogChannel } from "../src/types/auditLog";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

// Central wrapper every tool handler goes through (docs/ROADMAP.md Phase
// 5.3): checks the per-uid rate limit before running the handler, and writes
// exactly one auditLog entry per call either way. A rate-limit rejection is
// returned as a normal tool error (isError: true) rather than thrown — MCP
// tool errors are reported back to the model as a tool_result, not a
// protocol-level failure, so Claude can tell the user to slow down instead of
// the whole turn crashing.
async function withToolExecution(
  { uid, tool, channel }: { uid: string; tool: string; channel: AuditLogChannel },
  handler: () => Promise<string>
): Promise<ToolResult> {
  try {
    await checkAndConsumeRateLimit(uid);
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      await writeAuditLog({ uid, eventType: "mcp_tool_call", tool, channel, result: "error" });
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    throw error;
  }

  try {
    const resultText = await handler();
    await writeAuditLog({ uid, eventType: "mcp_tool_call", tool, channel, result: "success" });
    return { content: [{ type: "text", text: resultText }] };
  } catch (error) {
    await writeAuditLog({ uid, eventType: "mcp_tool_call", tool, channel, result: "error" });
    throw error;
  }
}

// cvv/barcodeOrCode are the two most sensitive fields on a card (see
// docs/SECURITY.md) and aren't useful for a "list my cards" answer — dropped
// here rather than sent to the LLM at all.
function serializeCardsForLlm(cards: Awaited<ReturnType<typeof listCardsForUid>>) {
  return cards.map((card) => ({
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
  }));
}

async function main() {
  const idToken = process.env.MCP_ID_TOKEN;
  if (!idToken) {
    console.error("MCP_ID_TOKEN environment variable is required.");
    process.exit(1);
  }

  const decoded = await adminAuth.verifyIdToken(idToken);
  const uid = decoded.uid;

  const server = new McpServer({ name: "shovarim-mcp", version: "0.1.0" });

  server.registerTool(
    "listCards",
    {
      description: "רשימת כרטיסי המתנה של המשתמש המחובר (בבעלותו או משותפים עמו).",
    },
    async () =>
      withToolExecution({ uid, tool: "listCards", channel: "cli" }, async () => {
        const cards = await listCardsForUid(uid);
        return JSON.stringify(serializeCardsForLlm(cards));
      })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
