import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "שם הקטגוריה נדרש").max(40),
  icon: z.string().nullable(),
  color: z.string().nullable(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
