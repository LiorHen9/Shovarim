// Manual runner for the chatbot test cases documented in
// docs/CHATBOT_TEST_CASES.md. Runs a real Claude call, turn by turn, through
// the same in-process agent loop src/lib/services/channelChat.ts uses —
// bypasses WhatsApp channel linking entirely since createMcpServer scopes
// everything by uid via the Admin SDK directly, no auth token needed.
// Requires the Firestore emulator running and .env.local loaded
// (ANTHROPIC_API_KEY, FIREBASE_USE_EMULATOR=true).
//
//   npm run chat:scenario -- <path/to/scenario.json>
//
// Scenario file: a JSON array of user turn strings, sent one after another
// against a single fresh synthetic uid (so each run starts with no existing
// cards/lists, matching what a first-time user would see).
import { readFileSync } from "node:fs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type Anthropic from "@anthropic-ai/sdk";

import { createAnthropicClient } from "../src/lib/mcp/anthropicClient";
import { runAgentTurn, toAnthropicTools } from "../src/lib/mcp/agentLoop";
import { createMcpServer } from "../src/lib/mcp/mcpServer";
import { buildSystemPrompt } from "../src/lib/mcp/systemPrompt";

function loadTurns(path: string): string[] {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  if (!Array.isArray(raw) || !raw.every((t) => typeof t === "string") || raw.length === 0) {
    throw new Error("scenario file must be a non-empty JSON array of strings");
  }
  return raw;
}

async function main() {
  const [, , scenarioPath] = process.argv;
  if (!scenarioPath) {
    console.error("usage: chat:scenario -- <path/to/scenario.json>");
    process.exit(1);
  }
  const turns = loadTurns(scenarioPath);

  const uid = `verify-${Date.now()}`;
  const server = createMcpServer(uid, "cli");
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: "shovarim-verify", version: "0.1.0" });
  await mcp.connect(clientTransport);

  const client = createAnthropicClient();
  const tools = await toAnthropicTools(mcp);
  let history: Anthropic.Beta.BetaMessageParam[] = [];

  for (const userMessage of turns) {
    console.log(`\n>>> ${userMessage}`);
    const result = await runAgentTurn({
      client,
      mcp,
      systemPrompt: buildSystemPrompt(),
      tools,
      history,
      userMessage,
      onText: (text) => console.log(`\n<<< ${text}`),
      onToolCall: (name) => console.log(`\n[tool call: ${name}]`),
    });
    history = result.history;
  }

  await mcp.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
