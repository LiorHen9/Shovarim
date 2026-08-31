import { z } from "zod";

// History used to round-trip through the client (ADR #22) but now persists
// server-side in chatSessions (issue #44, docs/ISSUES_SPRINT.md) — the request
// only ever needs the new message.
export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, "יש להקליד הודעה").max(4000),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
