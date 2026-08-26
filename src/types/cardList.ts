import type { Timestamp } from "firebase/firestore";

export interface CardList {
  id: string;
  ownerId: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// "owner" is derived (ownerId === current uid); "manager"/"viewer" come from an
// accepted cardLists/{listId}/members/{uid} doc. See docs/DECISIONS.md #15.
export type CardListRole = "owner" | "manager" | "viewer";

export interface CardListWithRole extends CardList {
  role: CardListRole;
}
