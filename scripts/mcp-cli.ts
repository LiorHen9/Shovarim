// Internal CLI for the Phase 5 walking skeleton (see docs/ROADMAP.md 5.1,
// docs/DECISIONS.md #19). Mints a real Firebase ID token for a given uid,
// spawns mcp-server/index.ts as a stdio subprocess with that token, and runs
// a manual Claude tool-calling loop where every tool call is relayed to the
// MCP server. Run with:
//   npm run mcp:cli -- <uid>
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

import type Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";

import { adminAuth } from "../src/lib/firebase/adminApp";
import { runAgentTurn, toAnthropicTools } from "../src/lib/mcp/agentLoop";
import { createAnthropicClient } from "../src/lib/mcp/anthropicClient";
import { buildSystemPrompt } from "../src/lib/mcp/systemPrompt";
import { assertNotBlocked } from "../src/lib/services/moderation";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Separate, minimal Firebase client init (not src/lib/firebase/client.ts):
// that module only connects to the Auth emulator when `window` exists, which
// is never true in a plain Node/tsx process — reusing it here would silently
// sign in against the real project even with the emulator flag set.
//
// The app only supports Google sign-in (src/lib/auth/providers.ts) — there is
// no password path a terminal script could drive. Instead this mints a custom
// token via the Admin SDK for a given uid (find your own uid via the running
// app + the Auth Emulator UI at http://127.0.0.1:4000/auth, or Firestore) and
// exchanges it client-side, which still yields a real, Firebase-issued ID
// token that mcp-server/index.ts verifies exactly as before.
async function signIn(uid: string): Promise<string> {
  const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
  const auth = getAuth(app);
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }

  const customToken = await adminAuth.createCustomToken(uid);
  const credential = await signInWithCustomToken(auth, customToken);
  return credential.user.getIdToken();
}

async function connectMcp(idToken: string): Promise<Client> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", path.join(__dirname, "..", "mcp-server", "index.ts")],
    env: { ...env, MCP_ID_TOKEN: idToken },
  });
  const client = new Client({ name: "shovarim-cli", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

async function main() {
  const [, , uid] = process.argv;
  if (!uid) {
    console.error("Usage: npm run mcp:cli -- <uid>");
    process.exit(1);
  }

  // Checked before minting any credential — a blocked uid shouldn't get a
  // working session here either (see src/lib/services/moderation.ts).
  await assertNotBlocked(uid);

  const idToken = await signIn(uid);
  const mcp = await connectMcp(idToken);
  const tools = await toAnthropicTools(mcp);
  const client = createAnthropicClient();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  process.on("SIGINT", async () => {
    await mcp.close();
    process.exit(0);
  });

  console.log(`מחובר. tools זמינים: ${tools.map((t) => t.name).join(", ")}. Ctrl+C ליציאה.`);

  let history: Anthropic.Beta.BetaMessageParam[] = [];
  for (;;) {
    const userInput = await rl.question("> ");
    const result = await runAgentTurn({
      client,
      mcp,
      systemPrompt: buildSystemPrompt(),
      tools,
      history,
      userMessage: userInput,
      uid,
      channel: "cli",
      onText: (text) => console.log(text),
    });
    history = result.history;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
