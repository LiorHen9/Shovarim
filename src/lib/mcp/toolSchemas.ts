// LLM-facing input shapes for the write/destructive MCP tools (docs/ROADMAP.md
// Phase 5.4, docs/DECISIONS.md ADR #22). Deliberately narrower than the
// matching form schemas in src/lib/validation/ — cvv/barcodeOrCode/
// cardImageUrl/entryId/receiptImageUrl are never tool-schema fields, so the
// model never sees or sets them (see docs/DECISIONS.md ADR #17). Dates are
// ISO strings here (tool args are plain JSON), converted to Date in
// src/lib/mcp/mcpServer.ts before calling the shared service layer. Relative
// imports so this resolves under both tsx (mcp-server/) and Next's bundler.
import { z } from "zod";

import { acceptingRetailersUrlSchema, firestoreIdSchema, notesSchema } from "../validation/card";

const isoDateSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "תאריך לא תקין (יש להשתמש בפורמט ISO, לדוגמה 2026-08-28)");

export const getCardToolShape = {
  cardId: firestoreIdSchema,
};

export const createCardToolShape = {
  listId: firestoreIdSchema,
  name: z.string().trim().min(1, "שם הכרטיס נדרש").max(100),
  categoryId: z.string().nullable(),
  tags: z.array(z.string().trim().min(1)).max(20),
  initialBalance: z.number().nonnegative("היתרה לא יכולה להיות שלילית"),
  currency: z.string().trim().length(3, "קוד מטבע בן 3 תווים, לדוגמה ILS"),
  expiryDate: isoDateSchema.nullable(),
  purchaseDate: isoDateSchema.nullable(),
  acceptingRetailersUrl: acceptingRetailersUrlSchema,
  notes: notesSchema,
};

export const updateCardToolShape = {
  cardId: firestoreIdSchema,
  name: z.string().trim().min(1, "שם הכרטיס נדרש").max(100),
  categoryId: z.string().nullable(),
  tags: z.array(z.string().trim().min(1)).max(20),
  expiryDate: isoDateSchema.nullable(),
  acceptingRetailersUrl: acceptingRetailersUrlSchema,
  notes: notesSchema,
};

export const deleteCardToolShape = {
  cardId: firestoreIdSchema,
  confirmed: z
    .boolean()
    .describe("true רק לאחר שהמשתמש/ת אישר/ה במפורש בתשובה קודמת שהוא/היא רוצה למחוק את הכרטיס הזה."),
};

export const logUsageToolShape = {
  cardId: firestoreIdSchema,
  amount: z.number().positive("הסכום חייב להיות גדול מאפס"),
  purpose: z.string().trim().min(1, "יש לציין מטרת שימוש").max(200),
  location: z.string().trim().max(200).nullable(),
  date: isoDateSchema.nullable().describe("תאריך השימוש (ISO). null = עכשיו."),
};

export const deleteUsageEntryToolShape = {
  cardId: firestoreIdSchema,
  entryId: firestoreIdSchema,
  restoreBalance: z.boolean().describe("האם להחזיר את הסכום ליתרת הכרטיס לאחר המחיקה."),
  confirmed: z
    .boolean()
    .describe("true רק לאחר שהמשתמש/ת אישר/ה במפורש בתשובה קודמת שהוא/היא רוצה למחוק את הרשומה הזו."),
};

export const updateBalanceToolShape = {
  cardId: firestoreIdSchema,
  newBalance: z.number().nonnegative("היתרה לא יכולה להיות שלילית"),
};

export const createListToolShape = {
  name: z.string().trim().min(1, "שם הרשימה נדרש").max(60),
};
