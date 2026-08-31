import type { Timestamp } from "firebase/firestore";

import type { ListMemberRole } from "./cardListMember";

// Shareable list invitations (docs/DECISIONS.md ADR #38, superseding parts of
// ADR #37) — the only path that shares a list with someone who has no account
// yet.
export type ListInviteStatus = "pending" | "accepted" | "declined";

// listInviteCodes/{code} — see docs/DATA_MODEL.md.
// Keyed by the code rather than by the invitee's uid because at creation time
// there is no uid to key by: the owner names no one at all, and the invitee may
// not have signed up. The member doc is created only once the invite is
// accepted.
export interface ListInviteCode {
  code: string;
  listId: string;
  role: ListMemberRole;
  // null for codes issued by the current flow, which are addressed to nobody in
  // particular — the code itself is the credential (ADR #38). A non-null value
  // marks a legacy phone-bound invite (ADR #37), still accepted on its original
  // terms until it expires.
  phone: string | null;
  invitedBy: string;
  status: ListInviteStatus;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  usedAt: Timestamp | null;
}

// What the owner sees in ShareListDialog for their own outstanding invites.
// Timestamps become ISO strings crossing the Server Action boundary, same as
// ChannelLinkSummary. Carries the link and its message so the owner can reopen
// WhatsApp for a code they already generated instead of burning a new one.
export interface ListInviteSummary {
  code: string;
  listId: string;
  role: ListMemberRole;
  phone: string | null;
  status: ListInviteStatus;
  createdAt: string;
  expiresAt: string;
  inviteUrl: string;
  shareText: string;
}

// Returned when an invite is issued. `shareText` is the full WhatsApp message,
// `inviteUrl` the absolute link inside it.
export interface IssuedListInvite {
  code: string;
  inviteUrl: string;
  shareText: string;
  expiresAt: string;
}

// The invitee's view of an invite, resolved server-side from the code alone —
// no auth required, since the code itself is the secret. Deliberately narrow:
// it names the list and who is sharing it, and never leaks anything about the
// list's contents to whoever holds the link.
export interface ListInvitePreview {
  code: string;
  listName: string;
  role: ListMemberRole;
  status: ListInviteStatus;
  expired: boolean;
  // Last 4 digits of the invited number, for legacy phone-bound invites only —
  // enough for the invitee to recognize which of their numbers to link, without
  // handing the full number to a forwarded link. null on current invites, which
  // are addressed to no number at all.
  phoneHint: string | null;
}

// Why an authenticated visitor cannot accept yet — drives which gate the
// invite page renders. "ready" means accept/decline can be shown.
// "linked_to_other_number" is reachable only for legacy phone-bound invites.
export type ListInviteGate =
  | "ready"
  | "needs_channel_link"
  | "linked_to_other_number"
  | "already_member"
  | "self_invite";
