import "server-only";

// Outbound half of the WhatsApp channel: one call, "send a text reply".
// Deliberately not a general Graph client — the bot only ever answers, never
// initiates (docs/CHATBOT.md), which is what keeps us inside WhatsApp's
// 24-hour service window where free-form text is allowed and no approved
// message template is needed.
import { getOutboundConfig } from "./config";

// WhatsApp rejects a body over 4096 characters outright. Truncating loses the
// tail of an answer; failing to send loses all of it.
const MAX_BODY_LENGTH = 4096;

export class WhatsAppSendError extends Error {
  constructor(status: number, body: string) {
    super(`WhatsApp send failed (${status}): ${body}`);
    this.name = "WhatsAppSendError";
  }
}

// Returns false when no outbound credentials are configured — the state the
// app is in between Phase 5.5.b (this code) and 5.5.c (the Meta setup), and
// the state E2E runs in. The caller logs it; it must not look like an inbound
// failure, because the message *was* processed.
export async function sendWhatsAppText(to: string, body: string): Promise<boolean> {
  const config = getOutboundConfig();
  if (!config) {
    console.warn("[whatsapp] outbound not configured — reply dropped");
    return false;
  }

  const response = await fetch(`${config.graphBaseUrl}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      // preview_url off: an answer may contain a card's acceptingRetailersUrl,
      // and fetching a preview would tell that site someone just asked about it.
      text: { preview_url: false, body: body.slice(0, MAX_BODY_LENGTH) },
    }),
  });

  if (!response.ok) {
    // The response body carries Meta's error code but never our access token,
    // so it is safe to surface in logs.
    throw new WhatsAppSendError(response.status, await response.text().catch(() => ""));
  }

  return true;
}
