import { z } from "zod";

export const createUsageEntrySchema = z.object({
  cardId: z.string().trim().min(1),
  amount: z.number().positive("הסכום חייב להיות גדול מאפס"),
  date: z.date(),
  purpose: z.string().trim().min(1, "יש לציין מטרת שימוש").max(200),
  location: z.string().trim().max(200).nullable().default(null),
});

export type CreateUsageEntryInput = z.infer<typeof createUsageEntrySchema>;
