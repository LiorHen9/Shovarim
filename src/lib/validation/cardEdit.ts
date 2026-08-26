import { z } from "zod";

import { acceptingRetailersUrlSchema, cvvSchema, notesSchema } from "@/lib/validation/card";

// Deliberately excludes balance/currency: those are changed only via the
// usage-log transaction (src/actions/usage.ts) or the dedicated manual-balance
// Server Action (src/actions/balance.ts) — never through this general-details
// form — see docs/DECISIONS.md #3/#4/#11.
export const editCardDetailsSchema = z.object({
  name: z.string().trim().min(1, "שם הכרטיס נדרש").max(100),
  expiryDate: z.date().nullable(),
  barcodeOrCode: z.string().trim().max(100).nullable(),
  cvv: cvvSchema,
  acceptingRetailersUrl: acceptingRetailersUrlSchema,
  notes: notesSchema,
  categoryId: z.string().nullable(),
  tags: z.array(z.string().trim().min(1)).max(20),
});

export type EditCardDetailsInput = z.infer<typeof editCardDetailsSchema>;
