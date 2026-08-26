import { z } from "zod";

export const cardStatusSchema = z.enum(["active", "expired", "depleted", "archived"]);

export const cvvSchema = z
  .string()
  .trim()
  .regex(/^\d{3,4}$/, "CVV חייב להכיל 3–4 ספרות")
  .nullable();

export const acceptingRetailersUrlSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .refine((v) => !v || /^https?:\/\//i.test(v), "כתובת URL לא תקינה (חייבת להתחיל ב-http:// או https://)");

export const notesSchema = z.string().trim().max(1000, "הערות עד 1000 תווים").nullable();

export const createCardSchema = z.object({
  name: z.string().trim().min(1, "שם הכרטיס נדרש").max(100),
  categoryId: z.string().nullable(),
  tags: z.array(z.string().trim().min(1)).max(20),
  initialBalance: z.number().nonnegative("היתרה לא יכולה להיות שלילית"),
  currency: z.string().trim().length(3, "קוד מטבע בן 3 תווים, לדוגמה ILS"),
  expiryDate: z.date().nullable(),
  purchaseDate: z.date().nullable(),
  barcodeOrCode: z.string().trim().max(100).nullable(),
  cvv: cvvSchema,
  acceptingRetailersUrl: acceptingRetailersUrlSchema,
  notes: notesSchema,
});

export type CreateCardInput = z.infer<typeof createCardSchema>;

export const deleteCardSchema = z.object({
  cardId: z.string().trim().min(1),
});

export type DeleteCardInput = z.infer<typeof deleteCardSchema>;
