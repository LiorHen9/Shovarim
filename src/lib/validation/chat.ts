import { z } from "zod";

// `history` isn't validated field-by-field — it's the Anthropic SDK's
// BetaMessageParam[] round-tripped opaquely through the client (see
// src/app/api/chat/route.ts) — only that it's an array at all.
export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, "יש להקליד הודעה").max(4000),
  history: z.array(z.unknown()).default([]),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
