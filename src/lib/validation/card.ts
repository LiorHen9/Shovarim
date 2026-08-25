import { z } from "zod";

export const cardStatusSchema = z.enum(["active", "expired", "depleted", "archived"]);

export const createCardSchema = z.object({
  name: z.string().trim().min(1, "שם הכרטיס נדרש").max(100),
  categoryId: z.string().nullable().default(null),
  tags: z.array(z.string().trim().min(1)).max(20).default([]),
  initialBalance: z.number().nonnegative("היתרה לא יכולה להיות שלילית"),
  currency: z.string().trim().length(3, "קוד מטבע בן 3 תווים, לדוגמה ILS"),
  expiryDate: z.date().nullable().default(null),
  purchaseDate: z.date().nullable().default(null),
  barcodeOrCode: z.string().trim().max(100).nullable().default(null),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;

export const updateCardSchema = createCardSchema.partial().extend({
  status: cardStatusSchema.optional(),
});

export type UpdateCardInput = z.infer<typeof updateCardSchema>;
