// Right-to-erasure grace period (docs/PRIVACY.md § "זכות מחיקה"). Client-side
// display only — the value that actually gates deletion lives in
// functions/src/accountDeletion.ts (kept in sync manually, see
// docs/DECISIONS.md #24: functions/ can't import from src/ due to its
// tsconfig rootDir, so this constant is duplicated there rather than shared).
export const GRACE_PERIOD_DAYS = 30;

export function getDeletionEligibleAt(requestedAt: Date): Date {
  const eligibleAt = new Date(requestedAt);
  eligibleAt.setDate(eligibleAt.getDate() + GRACE_PERIOD_DAYS);
  return eligibleAt;
}
