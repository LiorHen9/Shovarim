import type { Timestamp } from "firebase/firestore";

// blockedPhones/{e164} (docs/ROADMAP.md Phase 9.3, docs/DECISIONS.md ADR
// #44). Doc id is the same E.164 shape channelLinks/{channelKey}'s
// externalId uses, so redeemLinkCode's lookup compares equal.
export interface BlockedPhoneDoc {
  phone: string;
  blockedReason: string | null;
  blockedAt: Timestamp;
  blockedBy: string;
}
