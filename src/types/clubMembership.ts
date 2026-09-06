import type { Timestamp } from "firebase/firestore";

// One doc per club card the user declares they hold. Self-declared and
// unverified — nothing here is an entitlement, only a filter for which
// benefits to show them later.
//
// The doc id is `${ownerId}_${clubCardId}`, which firestore.rules enforces on
// create. That makes a duplicate impossible without a uniqueness query, and
// turns toggling into an idempotent setDoc/deleteDoc.
//
// The owning club is deliberately NOT denormalized here: a clubId written by
// the client is a clubId the client can lie about, and Rules cannot verify it
// against clubCards without a get() on another document. It is derived from
// the catalog instead, which is the single source of truth. See ADR #61.
export interface ClubMembership {
  id: string;
  ownerId: string;
  clubCardId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
