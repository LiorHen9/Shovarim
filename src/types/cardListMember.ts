import type { Timestamp } from "firebase/firestore";

export type ListMemberRole = "manager" | "viewer";
export type ListMemberStatus = "pending" | "accepted";

// Subcollection: cardLists/{listId}/members/{memberUid} — doc id always equals
// memberUid, resolved server-side when the invite is accepted (see
// src/lib/services/listInvites.ts).
export interface CardListMember {
  id: string;
  listId: string;
  memberUid: string;
  email: string;
  // The WhatsApp number the member had linked at the moment they accepted, so
  // the owner can tell two shares apart in ShareListDialog. Stored once, at
  // accept time — never re-derived later from channelLinks, which would surface
  // a number the member may since have unlinked (docs/PRIVACY.md). Optional
  // rather than `string | null` because useListMembers casts the raw snapshot:
  // docs written before this field existed have no `phone` key at all.
  phone?: string | null;
  role: ListMemberRole;
  status: ListMemberStatus;
  invitedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
