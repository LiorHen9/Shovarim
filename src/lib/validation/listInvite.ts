import { z } from "zod";

// Shared client+server validation for shareable list invitations
// (docs/DECISIONS.md ADR #38). Same rule as the rest of src/lib/validation/:
// one schema for the form and the Server Action, so a payload POSTed straight
// at the action is validated identically.

// Same alphabet as the channel link code (Crockford base32 minus I/L/O/U) but
// longer: this code lives for 48 hours rather than 10 minutes, and since
// ADR #38 it is the whole credential — anyone holding it can join. It is
// clicked as a link, never transcribed by hand, so the extra length costs
// nothing.
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

// The owner names nobody: no phone, no email, and no role either — every share
// starts as "viewer" and is promoted afterwards from the members list, so the
// share button can be a single click (ADR #38).
export const createListInviteSchema = z.object({
  listId: z.string().trim().min(1),
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
