import type { Timestamp } from "firebase/firestore";

// blockedEmails/{email} (docs/ROADMAP.md Phase 9.3, docs/DECISIONS.md ADR
// #44). Doc id is the lowercased email itself — checked in createSession
// before a session cookie is ever minted, so a blocked address can't sign in
// even for the first time.
export interface BlockedEmailDoc {
  email: string;
  blockedReason: string | null;
  blockedAt: Timestamp;
  blockedBy: string;
}
