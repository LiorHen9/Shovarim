import type { Timestamp } from "firebase/firestore";

import type { ListMemberRole } from "./cardListMember";

// Shareable list invitations (docs/DECISIONS.md ADR #39, restoring ADR #37's
// two-fact rule that ADR #38 had dropped) — the only path that shares a list
// with someone who has no account yet.
export type ListInviteStatus = "pending" | "accepted" | "declined";

// listInviteCodes/{code} — see docs/DATA_MODEL.md.
// Keyed by the code rather than by the invitee's uid because at creation time
// there is no uid to key by: the owner knows only a phone number, and the
// person behind it may not have signed up. The member doc is created only once
// the invite is accepted.
export interface ListInviteCode {
  code: string;
  listId: string;
  role: ListMemberRole;
  // E.164, and the second half of the credential: holding the code proves an
  // invite was addressed to this number, and only channelLinks proves the
  // number belongs to the account accepting (ADR #39, restoring ADR #37).
  // null marks a bearer code issued during the ADR #38 window, which is still
  // honoured on its own weaker terms until it expires — every branch that cares
  // splits on `phone === null`.
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
// the recipient's chat for a code they already generated instead of burning a
// new one.
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
// `inviteUrl` the absolute link inside it, and `phone` the normalized E.164 the
// dialog needs to open that one recipient's chat directly — echoed back rather
// than reused from the form so the client addresses exactly the number the
// server bound the invite to.
export interface IssuedListInvite {
  code: string;
  phone: string;
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
  // Last 4 digits of the invited number — enough for the invitee to recognize
  // which of their numbers to link, without handing the full number to a
  // forwarded link. null only for bearer codes left over from ADR #38, which
  // are addressed to no number at all.
  phoneHint: string | null;
}

// Why an authenticated visitor cannot accept yet — drives which gate the
// invite page renders. "ready" means accept/decline can be shown.
// "linked_to_other_number" is unreachable for the ADR #38 bearer leftovers,
// which have no number to disagree with.
export type ListInviteGate =
  | "ready"
  | "needs_channel_link"
  | "linked_to_other_number"
  | "already_member"
  | "self_invite";
