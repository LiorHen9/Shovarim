import { z } from "zod";

export const cardStatusSchema = z.enum(["active", "expired", "depleted", "archived"]);

// Firestore-safe document id — no "/" (which firebase-admin's .doc() parses
// as a path separator, letting a caller nest an arbitrary write into a
// subcollection under a completely different, unowned document) and no
// leading/trailing "." Server Actions are directly POST-able with arbitrary
// payloads (not limited to what the UI sends), so this has to be enforced in
// the schema, not just relied on as "the client always sends a real id."
export const firestoreIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, "מזהה לא תקין");

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

// Server Action input for card creation (src/actions/card.ts createCard) —
// createCardSchema plus the fields the client already resolved before
// calling the action (cardId generated client-side for the Storage upload
// path, listId chosen/created by CardForm, cardImageUrl from the completed
// upload). See docs/DECISIONS.md for why card creation moved server-side.
export const createCardServerSchema = createCardSchema.extend({
  cardId: firestoreIdSchema,
  listId: firestoreIdSchema,
  cardImageUrl: z.string().trim().nullable(),
});

export type CreateCardServerInput = z.infer<typeof createCardServerSchema>;

export const deleteCardSchema = z.object({
  cardId: z.string().trim().min(1),
});

export type DeleteCardInput = z.infer<typeof deleteCardSchema>;

export const cardIdSchema = z.object({
  cardId: firestoreIdSchema,
});

export type CardIdInput = z.infer<typeof cardIdSchema>;
