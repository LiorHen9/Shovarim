import type { Timestamp } from "firebase/firestore";

export type CardStatus = "active" | "expired" | "depleted" | "archived";

export interface GiftCard {
  id: string;
  ownerId: string;
  listId: string;
  name: string;
  categoryId: string | null;
  tags: string[];
  initialBalance: number;
  currentBalance: number;
  currency: string;
  expiryDate: Timestamp | null;
  purchaseDate: Timestamp | null;
  cardImageUrl: string | null;
  barcodeOrCode: string | null;
  cvv: string | null;
  acceptingRetailersUrl: string | null;
  notes: string | null;
  status: CardStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
