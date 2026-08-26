import { z } from "zod";

export const createCardListSchema = z.object({
  name: z.string().trim().min(1, "שם הרשימה נדרש").max(60),
});

export type CreateCardListInput = z.infer<typeof createCardListSchema>;
