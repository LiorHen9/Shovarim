import { z } from "zod";

import { ilPhoneSchema } from "./channelLink";

// Shared client+server validation for shareable list invitations
// (docs/DECISIONS.md ADR #39). Same rule as the rest of src/lib/validation/:
// one schema for the form and the Server Action, so a payload POSTed straight
// at the action is validated identically.

// Same alphabet as the channel link code (Crockford base32 minus I/L/O/U) but
// longer: this code lives for 48 hours rather than 10 minutes. Under ADR #39 it
// is only half the credential — the other half is proving the invited number —
// but length is still the cheapest defence against someone guessing at live
// codes, and it is clicked as a link rather than transcribed by hand.
export const INVITE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const INVITE_CODE_LENGTH = 12;

// Not uppercased/stripped like linkCodeSchema: this one arrives from a URL
// path segment, not from something a human retyped. Accepting case variants
// would mean two URLs resolving to one doc, and "/" must stay impossible — the
// same path-injection class as ADR #25.
export const inviteCodeSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value.length === INVITE_CODE_LENGTH &&
      [...value].every((char) => INVITE_CODE_ALPHABET.includes(char)),
    "קוד הזמנה לא תקין"
  );

// The owner names one recipient, by phone number, and nothing else: no email
// and no role either — every share starts as "viewer" and is promoted
// afterwards from the members list (ADR #39). ilPhoneSchema normalizes the ten
// Israeli digits the form collects into the E.164 form channelLinks is keyed
// by, so the stored invite and any later inbound message describe the same
// number as the same string.
export const createListInviteSchema = z.object({
  listId: z.string().trim().min(1),
  phone: ilPhoneSchema,
});
export type CreateListInviteInput = z.infer<typeof createListInviteSchema>;

export const listInviteCodeSchema = z.object({
  code: inviteCodeSchema,
});
export type ListInviteCodeInput = z.infer<typeof listInviteCodeSchema>;

export const listInvitesForListSchema = z.object({
  listId: z.string().trim().min(1),
});
export type ListInvitesForListInput = z.infer<typeof listInvitesForListSchema>;
