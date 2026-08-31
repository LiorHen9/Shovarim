import { z } from "zod";

import { e164Schema } from "./channelLink";
import { listMemberRoleSchema } from "./cardListMember";

// Shared client+server validation for phone-number list invitations
// (docs/DECISIONS.md ADR #37). Same rule as the rest of src/lib/validation/:
// one schema for the form and the Server Action, so a payload POSTed straight
// at the action is validated identically.

// Same alphabet as the channel link code (Crockford base32 minus I/L/O/U) but
// longer: this code lives for 14 days rather than 10 minutes, so the guessing
// window is orders of magnitude larger. It is clicked as a link, never
// transcribed by hand, so the extra length costs nothing.
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

export const createListInviteSchema = z.object({
  listId: z.string().trim().min(1),
  phone: e164Schema,
  role: listMemberRoleSchema,
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
