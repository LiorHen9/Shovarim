import type { Timestamp } from "firebase/firestore";

export interface UsageLogEntry {
  id: string;
  ownerId: string;
  cardId: string;
  amount: number;
  date: Timestamp;
  purpose: string;
  location: string | null;
  receiptImageUrl: string | null;
  balanceAfter: number;
  createdAt: Timestamp;
  createdBy: string;
}
