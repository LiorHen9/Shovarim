// One inbound message from a messaging channel, end to end (docs/ROADMAP.md
// Phase 5.5.b). Provider-agnostic on purpose: the WhatsApp route handler owns
// signatures, payload shapes and Graph calls, while everything here — linking,
// throttling, history, the agent turn — is what a Telegram channel would reuse
// unchanged. Relative imports and no "server-only" for the same reason as the
// rest of src/lib/services/: verification scripts run these under tsx, outside
// Next's bundler.
//
// The security spine, unchanged from ADR #29: the uid is looked up from
// channelLinks and nothing else. The sender's phone number reaches this
// function only as a lookup key, never as an identity claim, and it is never
// passed to the model or to a tool.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type Anthropic from "@anthropic-ai/sdk";

import { createAnthropicClient } from "../mcp/anthropicClient";
import { runAgentTurn, toAnthropicTools } from "../mcp/agentLoop";
import { createMcpServer } from "../mcp/mcpServer";
import { buildSystemPrompt } from "../mcp/systemPrompt";
import { ActionError } from "../actions/errorsCore";
import { linkCodeSchema } from "../validation/channelLink";
import {
  buildChannelKey,
  redeemLinkCode,
  resolveUidForChannel,
  touchChannelLink,
} from "./channelLinks";
import { loadChannelHistory, saveChannelHistory } from "./chatSessions";
import { checkAndConsumeRateLimit, RateLimitExceededError } from "./rateLimit";
import { getAppUrl } from "../appUrl";
import type { ChannelKind } from "../../types/channelLink";

export const REPLY_NOT_LINKED =
  "היי! המספר הזה עדיין לא מקושר לחשבון Shovarim.\n" +
  "כדי לקשר: היכנסו לאתר → הגדרות → “חיבור WhatsApp”, ושלחו לכאן את הקוד בן 8 התווים שיוצג (תקף ל-10 דקות).\n" +
  getAppUrl();

export const REPLY_LINKED =
  "מעולה, המספר הזה מקושר עכשיו לחשבון שלך ✅\n" +
  "אפשר לכתוב לי בשפה חופשית — למשל “מה היתרה בכרטיסים שלי?” או “רשום שימוש של 50 ש״ח בכרטיס המתנה”.";

export const REPLY_UNSUPPORTED_TYPE =
  "אני יודע לקרוא רק הודעות טקסט כרגע — אפשר לכתוב לי מה תרצו לעשות.";

export const REPLY_ERROR = "אירעה שגיאה בעיבוד ההודעה. אפשר לנסות שוב בעוד רגע.";

const REPLY_EMPTY = "לא הצלחתי לנסח תשובה. אפשר לנסח את השאלה אחרת?";

export interface InboundChannelMessage {
  channel: ChannelKind;
  externalId: string;
  text: string;
}

// Always resolves to something to send back — a channel with no reply looks
// identical to a broken bot from the sender's side, so failures are turned
// into sentences here rather than thrown at the route handler.
export async function handleInboundChannelMessage({
  channel,
  externalId,
  text,
}: InboundChannelMessage): Promise<string> {
  const channelKey = buildChannelKey(channel, externalId);
  const uid = await resolveUidForChannel(channel, externalId);

  // Charged before any work: for a linked sender this is the per-turn budget
  // that closes the "long chat with no tool calls is unlimited" gap; for an
  // unlinked one it is what makes guessing link codes over WhatsApp pointless.
  try {
    await checkAndConsumeRateLimit(uid ?? channelKey, "turns");
  } catch (error) {
    if (error instanceof RateLimitExceededError) return error.message;
    throw error;
  }

  // Code check comes before the linked/unlinked split so that a user who is
  // already linked can still move this number to another account by sending a
  // fresh code — the re-link ADR #29 explicitly allows. A message that merely
  // looks like a code (eight base32 characters) but doesn't redeem falls
  // through to the model for a linked sender, so nothing legitimate is
  // swallowed.
  const code = linkCodeSchema.safeParse(text);
  if (code.success) {
    try {
      await redeemLinkCode(channel, externalId, code.data);
      return REPLY_LINKED;
    } catch (error) {
      if (!(error instanceof ActionError)) throw error;
      if (!uid) return error.message;
    }
  }

  if (!uid) return REPLY_NOT_LINKED;

  const history = await loadChannelHistory<Anthropic.Beta.BetaMessageParam>(channelKey, uid);

  const server = createMcpServer(uid, channel);
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: `shovarim-${channel}`, version: "0.1.0" });
  await mcp.connect(clientTransport);

  // Every text block of the turn, not just the last one: the model often says
  // "בודק…" before a tool call and answers after it, and on WhatsApp there is
  // no streaming surface to show the first part — dropping it would lose real
  // content in the cases where the model front-loads its reasoning.
  const chunks: string[] = [];

  try {
    const result = await runAgentTurn({
      client: createAnthropicClient(),
      mcp,
      systemPrompt: buildSystemPrompt(),
      tools: await toAnthropicTools(mcp),
      history,
      userMessage: text,
      onText: (chunk) => chunks.push(chunk),
    });
    await saveChannelHistory(channelKey, uid, result.history);
  } catch (error) {
    // The message is already claimed for dedup, so a retry from the provider
    // won't re-run this — the sender gets a sentence and can try again
    // themselves, which is the honest outcome.
    console.error(`[${channel}] agent turn failed`, error);
    return REPLY_ERROR;
  } finally {
    await mcp.close().catch(() => {});
  }

  await touchChannelLink(channel, externalId);

  const reply = chunks.join("\n\n").trim();
  return reply || REPLY_EMPTY;
}
