// Deterministic PII masking for the relink-confirmation message (issue #75):
// before overwriting an existing channelLink, the sender must be shown *which*
// account currently holds the number, without leaking it in full. Distinct
// from listInvites.ts's toPhoneHint (last-4-digits, no stars, different
// purpose) — this needs an explicit masked shape for both email and phone.

// Keeps the first and last character of the local part (before "@") and stars
// the middle; a local part too short to have a meaningful middle is starred
// in full instead of left exposed.
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "*".repeat(email.length || 1);

  const local = email.slice(0, at);
  const domain = email.slice(at);
  const maskedLocal =
    local.length <= 2 ? "*".repeat(local.length) : `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}`;
  return `${maskedLocal}${domain}`;
}

// Keeps the country code and the last 2 digits, stars everything between —
// e.g. "+972501234567" -> "+972*******67".
export function maskPhone(e164: string): string {
  const match = /^(\+\d{1,3})(\d+)$/.exec(e164);
  if (!match) return "*".repeat(e164.length);

  const countryCode = match[1] ?? "";
  const rest = match[2] ?? "";
  if (rest.length <= 2) return `${countryCode}${"*".repeat(rest.length)}`;

  const lastTwo = rest.slice(-2);
  return `${countryCode}${"*".repeat(rest.length - 2)}${lastTwo}`;
}
