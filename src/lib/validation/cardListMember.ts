import { z } from "zod";

export const listMemberRoleSchema = z.enum(["manager", "viewer"]);
export type ListMemberRoleInput = z.infer<typeof listMemberRoleSchema>;

export const inviteListMemberSchema = z.object({
  listId: z.string().trim().min(1),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "כתובת אימייל נדרשת")
    .email("כתובת אימייל לא תקינה"),
  role: listMemberRoleSchema,
});

export type InviteListMemberInput = z.infer<typeof inviteListMemberSchema>;
