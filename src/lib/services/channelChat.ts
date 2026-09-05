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
import { adminAuth } from "../firebase/adminApp";
import { writeAuditLog } from "../audit/log";
import { maskEmail, maskPhone } from "../utils/mask";
import {
  buildChannelKey,
  redeemLinkCode,
  resolveUidForChannel,
  touchChannelLink,
  RelinkConfirmationRequiredError,
} from "./channelLinks";
import {
  createPendingRelink,
  getPendingRelink,
  deletePendingRelink,
} from "./channelRelinkConfirmations";
import { loadChannelHistory, saveChannelHistory } from "./chatSessions";
import { checkAndConsumeRateLimit, RateLimitExceededError } from "./rateLimit";
import { assertNotBlocked } from "./moderation";
import { didMutate } from "../mcp/toolEffects";
import { buildDashboardUrl, getAppUrl } from "../appUrl";
import type { ChannelKind } from "../../types/channelLink";

// A reply's link rides as a WhatsApp CTA-URL button (interactive message),
// never inlined into the body text — issue #66. `cta` and `buttons` are
// mutually exclusive — a branch returns at most one of the two, never both.
export interface ChannelReply {
  text: string;
  cta?: { url: string; label: string };
  buttons?: { id: string; title: string }[];
}

const HOME_CTA = { url: getAppUrl(), label: "כניסה לאתר" };

// Attached to replies that summarise something the bot just changed (issue
// #62). Distinct from HOME_CTA on purpose: an unlinked sender needs the site
// root so they can sign in and reach Settings, while someone who just created a
// card wants to see it. Never inlined into reply.text and never written to the
// stored history, so it costs no tokens on this turn or any later one.
const DASHBOARD_CTA = { url: buildDashboardUrl(), label: "לאזור האישי" };

export const REPLY_NOT_LINKED =
  "היי! המספר הזה עדיין לא מקושר לחשבון Shovarim.\n" +
  "כדי לקשר: היכנסו לאתר → הגדרות → “חיבור WhatsApp”, ושלחו לכאן את הקוד בן 8 התווים שיוצג (תקף ל-10 דקות).";

export const REPLY_LINKED =
  "מעולה, המספר הזה מקושר עכשיו לחשבון שלך ✅\n" +
  "אפשר לכתוב לי בשפה חופשית — למשל “מה היתרה בכרטיסים שלי?” או “רשום שימוש של 50 ש״ח בכרטיס המתנה”.";

export const REPLY_UNSUPPORTED_TYPE =
  "אני יודע לקרוא רק הודעות טקסט כרגע — אפשר לכתוב לי מה תרצו לעשות.";

export const REPLY_ERROR = "אירעה שגיאה בעיבוד ההודעה. אפשר לנסות שוב בעוד רגע.";

export const REPLY_BLOCKED = "החשבון הזה חסום ואינו יכול להשתמש בבוט. פנו לתמיכה אם לדעתכם מדובר בטעות.";

const REPLY_EMPTY = "לא הצלחתי לנסח תשובה. אפשר לנסח את השאלה אחרת?";

// issue #75: before a link code is allowed to move a number away from an
// account it's already linked to, the sender is shown who currently holds it
// (masked) and must confirm with real WhatsApp reply buttons — or the exact
// text "כן"/"לא", which unify to the same parseYesNo check (see below).
export const RELINK_BUTTONS = [
  { id: "relink_confirm", title: "כן" },
  { id: "relink_cancel", title: "לא" },
];

export const REPLY_RELINK_CANCELLED = "בסדר, לא שינינו כלום. הקישור הקיים נשאר כפי שהיה.";

export const REPLY_RELINK_REPROMPT = 'לא הבנתי — אפשר לענות "כן" או "לא"?';

function buildRelinkConfirmText(maskedEmail: string, maskedPhone: string): string {
  return (
    `המספר הזה כבר מקושר לחשבון אחר (${maskedEmail}, ${maskedPhone}).\n` +
    "לקשר אותו לחשבון הזה במקום זאת ולמחוק את היסטוריית השיחה של החשבון הקודם? כן/לא"
  );
}

// Pure string match, no fuzzy matching, no LLM — the whole point of this
// branch is a deterministic gate before an account-changing write. A button
// tap reaches here as literal text too (see extractInboundMessages), so
// typing and tapping go through the exact same check.
export function parseYesNo(text: string): "confirm" | "cancel" | null {
  const trimmed = text.trim();
  if (trimmed === "כן") return "confirm";
  if (trimmed === "לא") return "cancel";
  return null;
}

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
}: InboundChannelMessage): Promise<ChannelReply> {
  const channelKey = buildChannelKey(channel, externalId);
  const uid = await resolveUidForChannel(channel, externalId);

  // Charged before any work: for a linked sender this is the per-turn budget
  // that closes the "long chat with no tool calls is unlimited" gap; for an
  // unlinked one it is what makes guessing link codes over WhatsApp pointless.
  try {
    await checkAndConsumeRateLimit(uid ?? channelKey, "turns");
  } catch (error) {
    if (error instanceof RateLimitExceededError) return { text: error.message };
    throw error;
  }

  // A pending relink confirmation takes over the entire message: it is
  // interpreted only as "כן"/"לא"/neither, never as a code or a question for
  // the model (issue #75). This sits before the code check so a reply typed
  // while a confirmation is outstanding can't be misread as a fresh code.
  const pending = await getPendingRelink(channelKey);
  if (pending) {
    const verdict = parseYesNo(text);
    if (verdict === "confirm") {
      await deletePendingRelink(channelKey);
      try {
        await redeemLinkCode(pending.channel, pending.externalId, pending.code, { confirmed: true });
        return { text: REPLY_LINKED, cta: DASHBOARD_CTA };
      } catch (error) {
        if (error instanceof ActionError) return { text: error.message };
        throw error;
      }
    }
    if (verdict === "cancel") {
      await deletePendingRelink(channelKey);
      await writeAuditLog({
        uid: pending.existingUid,
        eventType: "channel_relink_cancelled",
        channel,
        paramsSummary: channelKey,
        result: "success",
      });
      return { text: REPLY_RELINK_CANCELLED };
    }
    return { text: REPLY_RELINK_REPROMPT, buttons: RELINK_BUTTONS };
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
      // The "signing up" case issue #62 lists: the account exists but the
      // sender has never seen it from this phone, so this is the single best
      // moment to hand them the way in.
      return { text: REPLY_LINKED, cta: DASHBOARD_CTA };
    } catch (error) {
      if (error instanceof RelinkConfirmationRequiredError) {
        await createPendingRelink(channelKey, channel, externalId, code.data, error.existingUid);
        await writeAuditLog({
          uid: error.existingUid,
          eventType: "channel_relink_requested",
          channel,
          paramsSummary: channelKey,
          result: "success",
        });
        const existingUser = await adminAuth.getUser(error.existingUid);
        return {
          text: buildRelinkConfirmText(maskEmail(existingUser.email ?? ""), maskPhone(externalId)),
          buttons: RELINK_BUTTONS,
        };
      }
      if (!(error instanceof ActionError)) throw error;
      if (!uid) return { text: error.message };
    }
  }

  if (!uid) return { text: REPLY_NOT_LINKED, cta: HOME_CTA };

  // Auth disable+revoke has no effect here — the WhatsApp uid is derived from
  // channelLinks, not an Auth token (ADR #29) — so this is the enforcement
  // for a blocked account on this channel, checked before any Claude call.
  try {
    await assertNotBlocked(uid);
  } catch (error) {
    if (error instanceof ActionError) return { text: REPLY_BLOCKED };
    throw error;
  }

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

  // Which tools the turn actually ran, for the "did this change anything?"
  // decision below (issue #62). onToolCall already existed for the web chat's
  // "calling tool X" status and was simply unused here — reusing it means the
  // model is never asked whether it performed an action, so the button costs
  // nothing in tokens.
  const toolsUsed: string[] = [];

  try {
    const result = await runAgentTurn({
      client: createAnthropicClient(),
      mcp,
      systemPrompt: buildSystemPrompt(),
      tools: await toAnthropicTools(mcp),
      history,
      userMessage: text,
      uid,
      channel,
      onText: (chunk) => chunks.push(chunk),
      onToolCall: (name) => toolsUsed.push(name),
    });
    await saveChannelHistory(channelKey, uid, result.history);
  } catch (error) {
    // The message is already claimed for dedup, so a retry from the provider
    // won't re-run this — the sender gets a sentence and can try again
    // themselves, which is the honest outcome.
    console.error(`[${channel}] agent turn failed`, error);
    return { text: REPLY_ERROR };
  } finally {
    await mcp.close().catch(() => {});
  }

  await touchChannelLink(channel, externalId);

  const reply = chunks.join("\n\n").trim();

  // Only turns that wrote something get the button. A plain question ("what's
  // my balance?") is the common case on WhatsApp, and a button on every single
  // answer would be noise rather than a shortcut — issue #62 asks for it on
  // summary messages specifically.
  if (didMutate(toolsUsed)) return { text: reply || REPLY_EMPTY, cta: DASHBOARD_CTA };
  return { text: reply || REPLY_EMPTY };
}
