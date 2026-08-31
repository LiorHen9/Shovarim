import type { Timestamp } from "firebase/firestore";

// Messaging channels the bot can be reached on (docs/ROADMAP.md Phase 5.5,
// docs/DECISIONS.md ADR #29). Deliberately narrower than AuditLogChannel:
// "web"/"cli" authenticate through a session, not through a channel link, so
// they can never appear here. Adding "telegram" later means adding it to this
// union and to the Zod enum in src/lib/validation/channelLink.ts — nothing
// else in the link flow is channel-specific.
export type ChannelKind = "whatsapp";

// channelLinks/{channelKey} — see docs/DATA_MODEL.md.
// The doc id is the channelKey ("<channel>:<externalId>") rather than the uid,
// because the only thing an inbound webhook message carries is the external id;
// the lookup has to be a direct get() from that alone.
export interface ChannelLink {
  channelKey: string;
  uid: string;
  channel: ChannelKind;
  externalId: string;
  linkedAt: Timestamp;
  lastMessageAt: Timestamp | null;
}

// channelLinkCodes/{code} — one-time bearer credential that binds a channel to
// a uid. Created only while the user is authenticated in the app; that is the
// single point in the flow with proof of account ownership.
export interface ChannelLinkCode {
  code: string;
  uid: string;
  channel: ChannelKind;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  usedAt: Timestamp | null;
}

// chatSessions/{channelKey} — server-side conversation history, needed only by
// channels with no client to hold it (the web chat keeps its own, ADR #22).
// `history` is a JSON string, not an array: it holds the Anthropic SDK's
// BetaMessageParam[], a shape we don't own — undefined fields in it would make
// Firestore throw, and one serialize/parse pair round-trips it exactly
// regardless of SDK version. See docs/DATA_MODEL.md.
export interface ChatSession {
  channelKey: string;
  uid: string;
  history: string;
  updatedAt: Timestamp;
}

// What crosses the Server Action boundary to the client. Firestore Timestamp
// instances are not serializable across that boundary (same reason
// requestAccountDeletion returns an ISO string), so dates are ISO strings and
// the raw uid is dropped — the client already knows its own uid.
//
// status/reverifyBy are derived, not stored — see
// src/lib/services/channelLinkExpiry.ts (issue #68, ADR #41). There is no
// separate Firestore field for them; they're recomputed from linkedAt/
// lastMessageAt every time a summary is built.
export interface ChannelLinkSummary {
  channelKey: string;
  channel: ChannelKind;
  externalId: string;
  linkedAt: string;
  lastMessageAt: string | null;
  status: "active" | "expired";
  reverifyBy: string;
}

// Result of issuing a link code, as shown in the UI.
export interface IssuedLinkCode {
  code: string;
  expiresAt: string;
}

// channelRelinkConfirmations/{channelKey} — issue #75. Holds a redeemed-but-
// not-yet-applied code while we wait for the sender to confirm they want to
// move this number away from the account it is linked to now. At most one
// per channelKey, mirroring channelLinks itself. See docs/DATA_MODEL.md.
export interface ChannelRelinkConfirmation {
  channelKey: string;
  channel: ChannelKind;
  externalId: string;
  code: string;
  existingUid: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}
