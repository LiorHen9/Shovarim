import type { Timestamp } from "firebase/firestore";

import type { CardStatus } from "@/types/card";

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("he-IL", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(timestamp: Timestamp): string {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(timestamp.toDate());
}

export const statusLabelHe: Record<CardStatus, string> = {
  active: "פעיל",
  expired: "פג תוקף",
  depleted: "מוצה",
  archived: "בארכיון",
};
