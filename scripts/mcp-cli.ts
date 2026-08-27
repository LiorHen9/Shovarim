// Internal CLI for the Phase 5 walking skeleton (see docs/ROADMAP.md 5.1,
// docs/DECISIONS.md #19). Mints a real Firebase ID token for a given uid,
// spawns mcp-server/index.ts as a stdio subprocess with that token, and runs
// a manual Claude tool-calling loop where every tool call is relayed to the
// MCP server. Run with:
//   npm run mcp:cli -- <uid>
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";

import { adminAuth } from "../src/lib/firebase/adminApp";

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
async function signIn(): Promise<string> {
  const [, , uid] = process.argv;
  if (!uid) {
    console.error("Usage: npm run mcp:cli -- <uid>");
    process.exit(1);
  }

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

async function toAnthropicTools(mcp: Client): Promise<Anthropic.Tool[]> {
  const { tools } = await mcp.listTools();
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
  }));
}

const SYSTEM_PROMPT =
  "אתה עוזר AI לניהול שוברים וכרטיסי מתנה (Shovarim). ענה בעברית. " +
  "השתמש בכלים שברשותך כדי לענות על שאלות לגבי הכרטיסים של המשתמש המחובר בלבד — " +
  "אין לך גישה לנתונים של משתמשים אחרים, ואל תמציא מידע שלא הוחזר מכלי.";

async function main() {
  const idToken = await signIn();
  const mcp = await connectMcp(idToken);
  const tools = await toAnthropicTools(mcp);
  const anthropic = new Anthropic();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  process.on("SIGINT", async () => {
    await mcp.close();
    process.exit(0);
  });

  console.log(`מחובר. tools זמינים: ${tools.map((t) => t.name).join(", ")}. Ctrl+C ליציאה.`);

  const messages: Anthropic.MessageParam[] = [];
  for (;;) {
    const userInput = await rl.question("> ");
    messages.push({ role: "user", content: userInput });

    for (;;) {
      const response = await anthropic.messages.create({
        model: "claude-opus-5",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      for (const block of response.content) {
        if (block.type === "text") console.log(block.text);
      }

      if (response.stop_reason !== "tool_use") break;

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
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
      messages.push({ role: "user", content: toolResults });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
