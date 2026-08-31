// Absolute URL of this app. Needed only by the list-invite flow (ADR #37,
// issue #58): the invite link is pasted into a WhatsApp message, so a relative
// path is meaningless there. Every other link in the app is same-origin, which
// is why no such helper existed before.
//
// NEXT_PUBLIC_* is inlined at build time by Next, so this works on both sides
// of the server/client boundary — matching src/lib/whatsapp/deepLink.ts, which
// reads NEXT_PUBLIC_WHATSAPP_BOT_PHONE the same way.

const DEFAULT_APP_URL = "http://localhost:3000";

// Trailing slashes are stripped so callers can always join with "/...".
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base = configured && configured.length > 0 ? configured : DEFAULT_APP_URL;
  return base.replace(/\/+$/, "");
}

export function buildListInviteUrl(code: string): string {
  return `${getAppUrl()}/invite/${encodeURIComponent(code)}`;
}
