// First Route Handler in the app (docs/ROADMAP.md Phase 5.4). Streams NDJSON
// (one JSON object per line) rather than raw text so the final line can carry
// back the full updated Anthropic message history — the browser has no
// server-side chat session to persist it in, so it round-trips the whole
// history on every request, same as scripts/mcp-cli.ts does in-process (see
// docs/DECISIONS.md ADR #22 for the scope note on this).
//
// Connects the MCP server in-process via InMemoryTransport instead of
// spawning mcp-server/index.ts as a subprocess (what the CLI does) — spawning
// a Node child process per HTTP request would be slow and awkward to manage
// on Cloud Run/App Hosting. createMcpServer (src/lib/mcp/mcpServer.ts) is the
// same tool registration either way.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type Anthropic from "@anthropic-ai/sdk";

import { requireUid } from "@/lib/auth/session";
import { chatRequestSchema } from "@/lib/validation/chat";
import { createMcpServer } from "@/lib/mcp/mcpServer";
import { runAgentTurn, toAnthropicTools } from "@/lib/mcp/agentLoop";
import { createAnthropicClient } from "@/lib/mcp/anthropicClient";
import { buildSystemPrompt } from "@/lib/mcp/systemPrompt";

export const runtime = "nodejs";

type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string }
  | { type: "done"; history: Anthropic.Beta.BetaMessageParam[] }
  | { type: "error"; message: string };

export async function POST(request: Request) {
  let uid: string;
  try {
    uid = await requireUid();
  } catch {
    return Response.json({ error: "התחברות נדרשת" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  const { message, history } = parsed.data;

  const server = createMcpServer(uid, "web");
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: "shovarim-web", version: "0.1.0" });
  await mcp.connect(clientTransport);

  const tools = await toAnthropicTools(mcp);
  const anthropic = createAnthropicClient();

  const encoder = new TextEncoder();
  const encodeEvent = (event: ChatStreamEvent) => encoder.encode(`${JSON.stringify(event)}\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runAgentTurn({
          client: anthropic,
          mcp,
          systemPrompt: buildSystemPrompt(),
          tools,
          history: history as Anthropic.Beta.BetaMessageParam[],
          userMessage: message,
          onText: (text) => controller.enqueue(encodeEvent({ type: "text", text })),
          onToolCall: (name) => controller.enqueue(encodeEvent({ type: "tool_call", name })),
        });
        controller.enqueue(encodeEvent({ type: "done", history: result.history }));
      } catch (error) {
        console.error("chat route agent turn failed", error);
        controller.enqueue(encodeEvent({ type: "error", message: "אירעה שגיאה. נסה/י שוב." }));
      } finally {
        await mcp.close().catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
