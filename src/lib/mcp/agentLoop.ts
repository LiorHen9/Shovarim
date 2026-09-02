// Shared Claude tool-use loop for the Phase 5 chatbot (docs/DECISIONS.md ADR
// #20). Extracted out of scripts/mcp-cli.ts so a future web route handler
// (docs/ROADMAP.md workstream א) reuses the same model/caching/compaction
// behavior instead of re-deriving it. Transport-agnostic: every tool call is
// relayed to an MCP client the caller already connected (stdio today, see
// mcp-server/index.ts).
import type Anthropic from "@anthropic-ai/sdk";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MAX_TOKENS, MODEL_ID } from "./config";
import { logClaudeUsage } from "./claudeUsageLog";
import type { AuditLogChannel } from "../../types/auditLog";

// Server-side conversation summarization for long sessions - the walking
// skeleton resent the full, ever-growing history on every turn. Requires
// pushing response.content (not just extracted text) back onto `messages` on
// every turn so compaction blocks round-trip correctly.
const COMPACTION_BETA = "compact-2026-01-12";

export async function toAnthropicTools(mcp: Client): Promise<Anthropic.Beta.BetaTool[]> {
  const { tools } = await mcp.listTools();
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: tool.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
  }));
}

export type AgentTurnParams = {
  client: Anthropic;
  mcp: Client;
  systemPrompt: string;
  tools: Anthropic.Beta.BetaTool[];
  history: Anthropic.Beta.BetaMessageParam[];
  userMessage: string;
  // Whose turn this is and which surface it came in on — used only to tag
  // claudeUsageLog entries (docs/ROADMAP.md Phase 9.5). Required, not
  // optional: every caller already has both in hand (either from
  // requireUid()/resolveUidForChannel(), or as the fixed channel literal a
  // script passes to createMcpServer), so there's no legitimate "unknown
  // uid" call site to default around.
  uid: string;
  channel: AuditLogChannel;
  onText?: (text: string) => void;
  // Fired right before each tool_use block is executed (docs/ROADMAP.md
  // Phase 5.4) — lets a caller show "calling tool X" status. Purely
  // additive/optional: existing callers (scripts/mcp-cli.ts) are unaffected.
  onToolCall?: (name: string) => void;
};

export type AgentTurnResult = {
  history: Anthropic.Beta.BetaMessageParam[];
};

// Runs one user turn to completion: calls Claude, executes any tool_use
// blocks via the MCP client, feeds results back, and repeats until Claude
// stops requesting tools. Returns the updated history for the caller to keep
// across turns - does not mutate the `history` it was given.
export async function runAgentTurn(params: AgentTurnParams): Promise<AgentTurnResult> {
  const { client, mcp, systemPrompt, tools, uid, channel, onText, onToolCall } = params;
  const history: Anthropic.Beta.BetaMessageParam[] = [
    ...params.history,
    { role: "user", content: params.userMessage },
  ];

  // Fired (not awaited) right after each model call and collected here,
  // instead of awaited inline before onText/the tool loop continue — a
  // Firestore write must never delay text the caller is about to stream to
  // the user (docs/ROADMAP.md Phase 9.5, docs/DECISIONS.md ADR #49).
  // logClaudeUsage() itself never rejects, so this array only ever holds
  // resolving promises; Promise.all below is purely a "wait for all pending
  // writes to land" gate, not error handling.
  const pendingUsageWrites: Promise<void>[] = [];

  try {
    for (;;) {
      const response = await client.beta.messages.create({
        betas: [COMPACTION_BETA],
        model: MODEL_ID,
        max_tokens: MAX_TOKENS,
        // Single cached system block - per the tools -> system -> messages
        // render order, this breakpoint covers the (static, per-session) tool
        // schemas too, not just the prompt text.
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        tools,
        messages: history,
        context_management: { edits: [{ type: "compact_20260112" }] },
      });

      pendingUsageWrites.push(
        logClaudeUsage({
          uid,
          channel,
          model: MODEL_ID,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
            cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
          },
        })
      );

      history.push({ role: "assistant", content: response.content });

      if (onText) {
        for (const block of response.content) {
          if (block.type === "text") onText(block.text);
        }
      }

      if (response.stop_reason !== "tool_use") {
        return { history };
      }

      const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        onToolCall?.(block.name);
        const result = (await mcp.callTool({
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        })) as CallToolResult;
        const text = result.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("\n");
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: text,
          is_error: Boolean(result.isError),
        });
      }
      history.push({ role: "user", content: toolResults });
    }
  } finally {
    // Awaited on every exit path (return above, or an exception propagating
    // out of this function) — not just the happy path — so a serverless
    // caller (the WhatsApp webhook's Cloud Function) never sends its
    // response and lets the process freeze before a usage write lands.
    await Promise.all(pendingUsageWrites);
  }
}
