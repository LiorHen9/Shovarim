import type { Timestamp } from "firebase/firestore";

import type { ListMemberRole } from "./cardListMember";

// Phone-number list invitations (docs/DECISIONS.md ADR #37, issue #58) — the
// only path that shares a list with someone who has no account yet.
export type ListInviteStatus = "pending" | "accepted" | "declined";

// listInviteCodes/{code} — see docs/DATA_MODEL.md.
// Keyed by the code rather than by the invitee's uid because at creation time
// there is no uid to key by: the owner knows only a phone number, and the
// invitee may not have signed up at all. The member doc (ADR #15) is created
// only once the invite is accepted.
export interface ListInviteCode {
  code: string;
  listId: string;
  role: ListMemberRole;
  phone: string;
  invitedBy: string;
  status: ListInviteStatus;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  usedAt: Timestamp | null;
}

// What the owner sees in ShareListDialog for their own outstanding invites.
// Timestamps become ISO strings crossing the Server Action boundary, same as
// ChannelLinkSummary.
export interface ListInviteSummary {
  code: string;
  listId: string;
  role: ListMemberRole;
  phone: string;
  status: ListInviteStatus;
  createdAt: string;
  expiresAt: string;
}

// Returned when an invite is issued. `shareText` is the full WhatsApp message
// (wording already branched on whether the number is known to the system —
// framing only, see ADR #37), `inviteUrl` the absolute link inside it.
export interface IssuedListInvite {
  code: string;
  inviteUrl: string;
  shareText: string;
  expiresAt: string;
}

// The invitee's view of an invite, resolved server-side from the code alone —
// no auth required, since the code itself is the secret. Deliberately narrow:
// it names the list and who is sharing it, and never leaks the invited phone
// number or anything about the list's contents to whoever holds the link.
export interface ListInvitePreview {
  code: string;
  listName: string;
  role: ListMemberRole;
  status: ListInviteStatus;
  expired: boolean;
  // Last 4 digits only — enough for the invitee to recognize which of their
  // numbers to link, without handing the full number to a forwarded link.
  phoneHint: string;
}

// Why an authenticated visitor cannot accept yet — drives which gate the
// invite page renders. "ready" means accept/decline can be shown.
export type ListInviteGate =
  | "ready"
  | "needs_channel_link"
  | "linked_to_other_number"
  | "already_member"
  | "self_invite";
