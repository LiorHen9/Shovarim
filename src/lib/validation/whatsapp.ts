import { z } from "zod";

import { e164Schema } from "./channelLink";

// Shape of a WhatsApp Cloud API webhook delivery, narrowed to what we act on.
// Everything optional and every unknown key dropped: Meta adds fields and event
// types over time, and a strict schema would turn "a field we don't use
// appeared" into "the bot stopped answering". Anything unrecognized simply
// yields no messages to process.
//
// This runs *after* the signature check (src/lib/whatsapp/signature.ts) — the
// payload is only structurally trustworthy, never authoritative about identity.
// The sender's number here is not a credential; the uid comes from
// channelLinks alone (ADR #29).

const messageSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  type: z.string().optional(),
  text: z.object({ body: z.string() }).optional(),
  // Reply-button tap (issue #75) — Meta echoes back the id/title of whichever
  // button the sender pressed. Only button_reply is handled; other
  // interactive subtypes (e.g. future list replies) fall through to
  // REPLY_UNSUPPORTED_TYPE unchanged, same as any other non-text message.
  interactive: z
    .object({
      type: z.string().optional(),
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
});

const valueSchema = z.object({
  metadata: z.object({ phone_number_id: z.string() }).optional(),
  messages: z.array(messageSchema).optional(),
});

export const whatsappWebhookSchema = z.object({
  entry: z
    .array(z.object({ changes: z.array(z.object({ value: valueSchema.optional() })).optional() }))
    .optional(),
});

export interface InboundWhatsAppMessage {
  messageId: string;
  // Normalized to E.164 ("+972…"). Meta sends wa_id without the plus.
  from: string;
  // The business number the message was sent to — checked against
  // WHATSAPP_PHONE_NUMBER_ID so one shared Meta app can't feed us another
  // number's traffic.
  phoneNumberId: string | null;
  // null for any non-text message (image, audio, sticker, reaction…): the bot
  // has no way to act on those, and says so rather than ignoring the sender.
  text: string | null;
}

// WhatsApp's own outbound limit is 4096 characters; anything longer is a paste
// accident or an attempt to run up the token bill, and the model gains nothing
// from the tail.
const MAX_TEXT_LENGTH = 4000;

export function extractInboundMessages(payload: unknown): InboundWhatsAppMessage[] {
  const parsed = whatsappWebhookSchema.safeParse(payload);
  if (!parsed.success) return [];

  const messages: InboundWhatsAppMessage[] = [];

  for (const entry of parsed.data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;

      for (const message of value.messages) {
        // Meta sends the sender as a bare wa_id ("972501234567"); e164Schema
        // is the same normalizer the /settings linking form uses, so both
        // paths produce byte-identical channelKeys.
        const from = e164Schema.safeParse(
          message.from.startsWith("+") ? message.from : `+${message.from}`
        );
        if (!from.success) continue;

        // A button tap becomes text: "כן"/"לא" identically to free-form
        // typing — one single path into handleInboundChannelMessage, no
        // duplicated logic between tap and typed reply.
        const body =
          message.type === "text"
            ? message.text?.body?.trim()
            : message.type === "interactive" && message.interactive?.type === "button_reply"
              ? message.interactive.button_reply?.title?.trim()
              : undefined;
        messages.push({
          messageId: message.id,
          from: from.data,
          phoneNumberId: value.metadata?.phone_number_id ?? null,
          text: body ? body.slice(0, MAX_TEXT_LENGTH) : null,
        });
      }
    }
  }

  return messages;
}
