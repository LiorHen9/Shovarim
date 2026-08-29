import { z } from "zod";

// Shared client+server validation for the channel-linking flow (docs/ROADMAP.md
// Phase 5.5). Same rule as the rest of src/lib/validation/: one schema, used by
// the form and by the Server Action, so a payload POSTed straight at the action
// (bypassing the UI) is validated identically.

export const channelKindSchema = z.enum(["whatsapp"]);
export type ChannelKindInput = z.infer<typeof channelKindSchema>;

// Crockford base32 minus the ambiguous letters (I, L, O, U): what the user
// reads off the screen and types into a chat window has to survive being
// transcribed by hand.
export const LINK_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const LINK_CODE_LENGTH = 8;

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

// Accepts what a human would paste (spaces, dashes, parentheses, a leading
// "00" instead of "+") and normalizes to strict E.164 before validating, so
// the same phone number always produces the same channelKey — two spellings
// mapping to two different docs would silently create a second, unlinked
// channel.
export const e164Schema = z
  .string()
  .trim()
  .transform((value) => {
    const compact = value.replace(/[\s\-().]/g, "");
    return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  })
  .refine((value) => E164_PATTERN.test(value), "מספר טלפון לא תקין (פורמט בינלאומי, למשל ‎+972501234567)");

// Uppercased before validation: a code typed in lowercase is the same code.
export const linkCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
  .refine(
    (value) =>
      value.length === LINK_CODE_LENGTH &&
      [...value].every((char) => LINK_CODE_ALPHABET.includes(char)),
    "קוד קישור לא תקין"
  );

// "<channel>:<externalId>" — also the Firestore doc id. The pattern is
// anchored and allows no "/", which is what keeps a caller from steering a
// write into an arbitrary subcollection: firebase-admin's .doc() treats "/" as
// a path separator, the same path-injection class fixed in ADR #25. The
// channelKey is never taken on trust either — buildChannelKey() rebuilds it
// from the parsed parts.
export const channelKeySchema = z
  .string()
  .trim()
  .regex(/^whatsapp:\+[1-9]\d{7,14}$/, "מזהה ערוץ לא תקין");

export const createLinkCodeSchema = z.object({
  channel: channelKindSchema,
});
export type CreateLinkCodeInput = z.infer<typeof createLinkCodeSchema>;

export const unlinkChannelSchema = z.object({
  channelKey: channelKeySchema,
});
export type UnlinkChannelInput = z.infer<typeof unlinkChannelSchema>;

// Used by the webhook (Phase 5.5.b) on the inbound side.
export const redeemLinkCodeSchema = z.object({
  channel: channelKindSchema,
  externalId: e164Schema,
  code: linkCodeSchema,
});
export type RedeemLinkCodeInput = z.infer<typeof redeemLinkCodeSchema>;
