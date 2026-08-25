import { z } from "zod";

// Deliberately excludes balance/currency: those are only ever changed by the
// usage-log transaction (src/actions/usage.ts) to keep the audit trail
// meaningful — see docs/DECISIONS.md #3/#4.
export const editCardDetailsSchema = z.object({
  name: z.string().trim().min(1, "שם הכרטיס נדרש").max(100),
  expiryDate: z.date().nullable(),
  barcodeOrCode: z.string().trim().max(100).nullable(),
});

export type EditCardDetailsInput = z.infer<typeof editCardDetailsSchema>;
