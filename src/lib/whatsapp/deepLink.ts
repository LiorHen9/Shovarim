// Builds the wa.me deep link used by the /settings linking UI (issue #39):
// instead of showing a code the user has to retype into WhatsApp by hand, the
// UI opens a chat with the bot pre-filled with it, so sending is one tap.
// NEXT_PUBLIC_* is inlined into the client bundle at build time by Next —
// reading it directly here keeps this a pure client-side concern, matching
// where it's used (ChannelLinksSection is a client component).

// wa.me wants digits only — country code + number, no "+", no separators —
// stripped defensively in case the env var is set with a leading "+".
export function buildWhatsAppLinkCodeUrl(code: string): string | null {
  const botPhone = process.env.NEXT_PUBLIC_WHATSAPP_BOT_PHONE?.trim();
  if (!botPhone) return null;

  const digits = botPhone.replace(/\D/g, "");
  if (!digits) return null;

  return `https://wa.me/${digits}?text=${encodeURIComponent(code)}`;
}
