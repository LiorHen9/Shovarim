import type { Timestamp } from "firebase/firestore";

export type ListMemberRole = "manager" | "viewer";
export type ListMemberStatus = "pending" | "accepted";

// Subcollection: cardLists/{listId}/members/{memberUid} — doc id always equals
// memberUid, resolved server-side from an invite email (see src/actions/listShare.ts).
export interface CardListMember {
  id: string;
  listId: string;
  memberUid: string;
  email: string;
  role: ListMemberRole;
  status: ListMemberStatus;
  invitedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
