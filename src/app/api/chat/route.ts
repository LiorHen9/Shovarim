// First Route Handler in the app (docs/ROADMAP.md Phase 5.4). Streams NDJSON
// (one JSON object per line) rather than raw text for the assistant's reply.
// History used to round-trip through the client on every request (ADR #22)
// but now persists server-side in chatSessions under a "web:{uid}" key — same
// collection and 24h-idle-reset WhatsApp already uses (issue #44), so GET
// restores prior turns on page load and POST no longer trusts client-sent
// history.
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
import { loadChannelHistory, saveChannelHistory } from "@/lib/services/chatSessions";
import { assertNotBlocked } from "@/lib/services/moderation";
import { ActionError } from "@/lib/actions/errors";

export const runtime = "nodejs";

type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string }
  | { type: "done" }
  | { type: "error"; message: string };

function webChannelKey(uid: string): string {
  return `web:${uid}`;
}

// Tool-use/tool-result turns carry no text worth showing — only the plain
// user/assistant conversation renders in the UI.
function extractDisplayText(content: Anthropic.Beta.BetaMessageParam["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export async function GET() {
  let uid: string;
  try {
    uid = await requireUid();
  } catch {
    return Response.json({ error: "התחברות נדרשת" }, { status: 401 });
  }

  const history = await loadChannelHistory<Anthropic.Beta.BetaMessageParam>(webChannelKey(uid), uid);
  const messages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, text: extractDisplayText(m.content) }))
    .filter((m) => m.text.trim().length > 0);

  return Response.json({ messages });
}

export async function POST(request: Request) {
  let uid: string;
  try {
    uid = await requireUid();
  } catch {
    return Response.json({ error: "התחברות נדרשת" }, { status: 401 });
  }

  // Defense-in-depth alongside Auth disable+revoke (which already invalidates
  // the session cookie requireUid() just verified) — see
  // src/lib/services/moderation.ts.
  try {
    await assertNotBlocked(uid);
  } catch (error) {
    const message = error instanceof ActionError ? error.message : "אירעה שגיאה";
    return Response.json({ error: message }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  const { message } = parsed.data;
  const channelKey = webChannelKey(uid);
  const history = await loadChannelHistory<Anthropic.Beta.BetaMessageParam>(channelKey, uid);

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
          history,
          userMessage: message,
          onText: (text) => controller.enqueue(encodeEvent({ type: "text", text })),
          onToolCall: (name) => controller.enqueue(encodeEvent({ type: "tool_call", name })),
        });
        await saveChannelHistory(channelKey, uid, result.history);
        controller.enqueue(encodeEvent({ type: "done" }));
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
