import { z } from "zod";

export const updateBalanceSchema = z.object({
  cardId: z.string().trim().min(1),
  newBalance: z.number().nonnegative("היתרה לא יכולה להיות שלילית"),
});

export type UpdateBalanceInput = z.infer<typeof updateBalanceSchema>;
