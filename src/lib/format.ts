import type { Timestamp } from "firebase/firestore";

import type { CardStatus } from "@/types/card";

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("he-IL", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// Claude cost figures (docs/DATA_MODEL.md's claudeUsageLog section, ADR #49).
// An estimate from a static pricing table, not an invoice. 4 fraction digits:
// per-user totals can be well under a cent at low usage, where 2 digits would
// just show "$0.00" for everyone; Intl drops the extra digits on larger sums.
export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
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
