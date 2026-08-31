import { z } from "zod";

export const listMemberRoleSchema = z.enum(["manager", "viewer"]);
export type ListMemberRoleInput = z.infer<typeof listMemberRoleSchema>;

// inviteListMemberSchema lived here for the email invite path of ADR #15, which
// ADR #38 removed — sharing no longer asks the owner for an address. Existing
// members created that way are untouched; only the entry point is gone.
