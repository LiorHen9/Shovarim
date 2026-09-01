import type { Timestamp } from "firebase/firestore";

// userModeration/{uid} (docs/ROADMAP.md Phase 9.3, docs/DECISIONS.md ADR #44).
// Deliberately separate from users/{uid} — the existing `update` rule on
// users does not restrict fields, so a `blocked` field living there would
// let a blocked user un-block themselves with an ordinary client write.
export interface UserModerationDoc {
  uid: string;
  blocked: boolean;
  blockedReason: string | null;
  blockedAt: Timestamp | null;
  blockedBy: string | null;
  updatedAt: Timestamp;
}
