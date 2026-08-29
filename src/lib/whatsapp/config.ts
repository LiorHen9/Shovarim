import "server-only";

// WhatsApp Cloud API credentials (docs/DEPLOYMENT.md "ערוץ WhatsApp"). Read
// lazily inside the request, never at module scope: these are `[RUNTIME]`-only
// secrets in apphosting.yaml, so `next build` must not need them — the same
// rule CARD_FIELD_ENCRYPTION_KEY follows, and the opposite of the eager
// FIREBASE_ADMIN_* reads that cost Phase 3.3 a broken rollout.
//
// Nothing here throws on missing values. Until Phase 5.5.c fills the secrets
// in, the webhook must deploy and answer 503 rather than crash the route.

export interface WhatsAppInboundConfig {
  appSecret: string;
  verifyToken: string;
}

export interface WhatsAppOutboundConfig {
  accessToken: string;
  phoneNumberId: string;
  graphBaseUrl: string;
}

function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

// Pinned rather than "latest": Graph is versioned and a silent bump is how a
// working webhook starts failing on a Tuesday. Overridable so tests can point
// the sender at a local stub.
const DEFAULT_GRAPH_BASE_URL = "https://graph.facebook.com/v23.0";

// What it takes to *accept* a delivery: the shared secret that signs it and
// the token Meta echoes during the GET handshake.
export function getInboundConfig(): WhatsAppInboundConfig | null {
  const appSecret = read("WHATSAPP_APP_SECRET");
  const verifyToken = read("WHATSAPP_VERIFY_TOKEN");
  if (!appSecret || !verifyToken) return null;
  return { appSecret, verifyToken };
}

// What it takes to *reply*. Deliberately separate from the inbound config: the
// two fail independently, and an inbound-only deployment (E2E against the
// emulators) is a legitimate state, not a misconfiguration.
export function getOutboundConfig(): WhatsAppOutboundConfig | null {
  const accessToken = read("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = read("WHATSAPP_PHONE_NUMBER_ID");
  if (!accessToken || !phoneNumberId) return null;
  return {
    accessToken,
    phoneNumberId,
    graphBaseUrl: read("WHATSAPP_GRAPH_BASE_URL") ?? DEFAULT_GRAPH_BASE_URL,
  };
}
