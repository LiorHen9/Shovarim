import { z } from "zod";

import { firestoreIdSchema } from "./card";
import { e164Schema } from "./channelLink";

// Free-text justification recorded on the block doc and in adminAuditLog, so
// "why was this blocked" is always answerable later by someone other than
// the admin who did it (docs/ROADMAP.md Phase 9.3).
export const blockReasonSchema = z.string().trim().min(1, "יש לציין סיבה").max(500);

export const blockUidSchema = firestoreIdSchema;

export const blockEmailSchema = z.string().trim().toLowerCase().email("כתובת אימייל לא תקינה");

// Same E.164 normalization as channelLink.ts's e164Schema — blockedPhones is
// keyed by the same shape channelLinks/{channelKey}'s externalId uses, so the
// two have to compare equal for redeemLinkCode's lookup to find a block.
export const blockPhoneSchema = e164Schema;

export const blockUserSchema = z.object({
  uid: blockUidSchema,
  reason: blockReasonSchema,
});
export type BlockUserInput = z.infer<typeof blockUserSchema>;

export const blockEmailActionSchema = z.object({
  email: blockEmailSchema,
  reason: blockReasonSchema,
});
export type BlockEmailInput = z.infer<typeof blockEmailActionSchema>;

export const blockPhoneActionSchema = z.object({
  phone: blockPhoneSchema,
  reason: blockReasonSchema,
});
export type BlockPhoneInput = z.infer<typeof blockPhoneActionSchema>;
