// WhatsApp Cloud API webhook (docs/ROADMAP.md Phase 5.5.b, docs/DECISIONS.md
// ADR #29). Second Route Handler in the app, and the first endpoint reachable
// by an unauthenticated caller — src/app/api/chat/route.ts has a session
// cookie to lean on, this one has only the HMAC.
//
// src/proxy.ts is deliberately untouched: its matcher lists page prefixes, and
// /api/* must never be in it. Redirecting a JSON endpoint to an HTML page is
// the trap that broke /api/chat in commit ff99bb8 — fetch follows the 307
// silently and the caller gets HTML where it expected JSON.
import { getInboundConfig } from "@/lib/whatsapp/config";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import {
  sendWhatsAppText,
  sendWhatsAppCtaUrl,
  sendWhatsAppReplyButtons,
  MAX_INTERACTIVE_BODY_LENGTH,
} from "@/lib/whatsapp/graph";
import { extractInboundMessages } from "@/lib/validation/whatsapp";
import { claimInboundMessage } from "@/lib/services/channelMessages";
import { buildChannelKey } from "@/lib/services/channelLinks";
import {
  handleInboundChannelMessage,
  REPLY_ERROR,
  REPLY_UNSUPPORTED_TYPE,
  type ChannelReply,
} from "@/lib/services/channelChat";

export const runtime = "nodejs";
// The signature covers the exact bytes Meta sent, so this handler must never
// be served from a cache or prerendered.
export const dynamic = "force-dynamic";

// Meta's verification handshake, run once when the webhook URL is registered
// and again whenever the subscription is edited.
export async function GET(request: Request) {
  const config = getInboundConfig();
  if (!config) return new Response("not configured", { status: 503 });

  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode !== "subscribe" || token !== config.verifyToken || !challenge) {
    return new Response("forbidden", { status: 403 });
  }

  // Echoed verbatim as text/plain — Meta compares the raw body.
  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const config = getInboundConfig();
  if (!config) return new Response("not configured", { status: 503 });

  // Raw text first, parsed only after the HMAC checks out: re-serializing
  // parsed JSON changes the bytes and the digest would never match again.
  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret)) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Signed but unparseable: nothing to do, and a retry would not help.
    return new Response("ok", { status: 200 });
  }

  const expectedPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  for (const message of extractInboundMessages(payload)) {
    // One Meta app can serve several business numbers; only ours is answered.
    if (
      expectedPhoneNumberId &&
      message.phoneNumberId &&
      message.phoneNumberId !== expectedPhoneNumberId
    ) {
      continue;
    }

    const channelKey = buildChannelKey("whatsapp", message.from);
    // Claimed before processing — a Meta retry (any timeout or 5xx) must not
    // run write tools a second time. See docs/DATA_MODEL.md channelMessages.
    if (!(await claimInboundMessage(channelKey, message.messageId))) continue;

    let reply: ChannelReply;
    if (message.text === null) {
      reply = { text: REPLY_UNSUPPORTED_TYPE };
    } else {
      try {
        reply = await handleInboundChannelMessage({
          channel: "whatsapp",
          externalId: message.from,
          text: message.text,
        });
      } catch (error) {
        console.error("[whatsapp] failed to handle inbound message", error);
        reply = { text: REPLY_ERROR };
      }
    }

    // A failed send must not fail the delivery: the message was processed (and
    // possibly wrote data), so a retry would be strictly worse than a lost
    // reply.
    try {
      if (reply.buttons) {
        await sendWhatsAppReplyButtons(message.from, reply.text, reply.buttons);
      } else if (reply.cta && reply.text.length <= MAX_INTERACTIVE_BODY_LENGTH) {
        await sendWhatsAppCtaUrl(message.from, reply.text, reply.cta);
      } else {
        // Falls through to plain text when an answer is too long for an
        // interactive body (issue #62): a cta_url message caps at 1024 against
        // 4096 for text, so keeping the button here would silently cut the tail
        // off a long summary. Losing the button beats losing the answer.
        await sendWhatsAppText(message.from, reply.text);
      }
    } catch (error) {
      console.error("[whatsapp] failed to send reply", error);
    }
  }

  // Always 200 once the signature is valid. Any other status makes Meta retry
  // the same delivery, and eventually disable the subscription.
  return new Response("ok", { status: 200 });
}
