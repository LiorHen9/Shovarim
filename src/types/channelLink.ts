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

// What crosses the Server Action boundary to the client. Firestore Timestamp
// instances are not serializable across that boundary (same reason
// requestAccountDeletion returns an ISO string), so dates are ISO strings and
// the raw uid is dropped — the client already knows its own uid.
export interface ChannelLinkSummary {
  channelKey: string;
  channel: ChannelKind;
  externalId: string;
  linkedAt: string;
  lastMessageAt: string | null;
}

// Result of issuing a link code, as shown in the UI.
export interface IssuedLinkCode {
  code: string;
  expiresAt: string;
}
