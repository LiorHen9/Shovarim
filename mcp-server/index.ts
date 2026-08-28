// CLI entry point for the MCP server (docs/ROADMAP.md 5.1, docs/DECISIONS.md
// #19/#22). Spawned as a plain Node child process over stdio by
// scripts/mcp-cli.ts — one process per CLI session, not a long-lived
// service. Tool registration itself lives in src/lib/mcp/mcpServer.ts
// (createMcpServer), which has no side effects on import and is also used
// in-process by the web Route Handler (src/app/api/chat/route.ts) — this
// file must stay a thin CLI wrapper around it, not grow tool logic of its
// own, since importing it anywhere else would immediately run main() below.
//
// The authenticated uid is verified once at startup from a real Firebase ID
// token and closed over by every tool handler registered in
// createMcpServer(). It is never a tool input parameter — see
// docs/SECURITY.md and docs/DECISIONS.md ADR #17: an LLM must have no channel
// to influence which uid a tool call runs as.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { adminAuth } from "../src/lib/firebase/adminApp";
import { createMcpServer } from "../src/lib/mcp/mcpServer";

async function main() {
  const idToken = process.env.MCP_ID_TOKEN;
  if (!idToken) {
    console.error("MCP_ID_TOKEN environment variable is required.");
    process.exit(1);
  }

  const decoded = await adminAuth.verifyIdToken(idToken);
  const server = createMcpServer(decoded.uid, "cli");

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
