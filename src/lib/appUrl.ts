// Absolute URL of this app. Needed wherever a link leaves the app and lands in
// a WhatsApp message, where a relative path is meaningless: the list-invite
// flow (ADR #37, issue #58) and the bot's own reply buttons (issues #66, #62).
// Every link rendered inside the app itself is same-origin, which is why no
// such helper existed before those.
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

// The personal area, linked from the WhatsApp bot's action-summary replies
// (issue #62). /dashboard rather than /cards: after changing something from
// WhatsApp the useful thing to land on is the summary — active card count and
// total balance — and if the session has expired, src/proxy.ts redirects to
// login with ?next= and comes back here.
export function buildDashboardUrl(): string {
  return `${getAppUrl()}/dashboard`;
}
