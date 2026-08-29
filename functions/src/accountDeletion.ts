// Right-to-erasure, stage 2 (docs/PRIVACY.md § "זכות מחיקה"): sweeps
// users/{uid} docs whose grace period (see requestAccountDeletion in
// src/actions/privacy.ts) has elapsed and deletes them for real.
//
// GRACE_PERIOD_DAYS is duplicated from src/lib/services/accountDeletion.ts —
// functions/ can't import from src/ (see functions/src/firebaseAdmin.ts),
// so keep the two constants in sync manually. See docs/DECISIONS.md #24.
import { Timestamp } from "firebase-admin/firestore";

import { auth, db, storage } from "./firebaseAdmin";

export const GRACE_PERIOD_DAYS = 30;

// Deletes everything owned by uid, in an order that never leaves the account
// data-orphaned-but-still-signed-in: Firestore/Storage data first, the Auth
// user last. The auditLog entry is written before any of it, so a partial
// failure (caught by the caller) still leaves a record that deletion began.
export async function deleteUserAccount(uid: string): Promise<void> {
  await db.collection("auditLog").add({
    uid,
    eventType: "deletion_completed",
    tool: null,
    channel: null,
    paramsSummary: null,
    result: "success",
    createdAt: Timestamp.now(),
  });

  const [
    ownedListsSnap,
    ownedCardsSnap,
    ownedCategoriesSnap,
    otherMembershipsSnap,
    channelLinksSnap,
    channelLinkCodesSnap,
    chatSessionsSnap,
  ] = await Promise.all([
    db.collection("cardLists").where("ownerId", "==", uid).get(),
    db.collection("cards").where("ownerId", "==", uid).get(),
    db.collection("categories").where("ownerId", "==", uid).get(),
    db.collectionGroup("members").where("memberUid", "==", uid).get(),
    // Phase 5.5 (docs/DECISIONS.md ADR #29). These three are keyed by
    // channelKey, not uid, so the ownership queries above never reach them —
    // without an explicit pass they would survive account deletion as orphaned
    // phone numbers and message history. Queried by the `uid` *field* instead.
    db.collection("channelLinks").where("uid", "==", uid).get(),
    db.collection("channelLinkCodes").where("uid", "==", uid).get(),
    db.collection("chatSessions").where("uid", "==", uid).get(),
  ]);

  await Promise.all(ownedListsSnap.docs.map((listDoc) => db.recursiveDelete(listDoc.ref)));
  await Promise.all(ownedCardsSnap.docs.map((cardDoc) => db.recursiveDelete(cardDoc.ref)));
  await Promise.all(ownedCategoriesSnap.docs.map((categoryDoc) => categoryDoc.ref.delete()));
  await Promise.all(otherMembershipsSnap.docs.map((memberDoc) => memberDoc.ref.delete()));
  await Promise.all(
    [...channelLinksSnap.docs, ...channelLinkCodesSnap.docs, ...chatSessionsSnap.docs].map((doc) =>
      doc.ref.delete()
    )
  );
  await db.collection("consents").doc(uid).delete();

  await storage.bucket().deleteFiles({ prefix: `users/${uid}/` });

  await db.collection("users").doc(uid).delete();
  await auth.deleteUser(uid);
}

export async function sweepExpiredAccountDeletions(
  now: Date
): Promise<{ processed: number; failed: number }> {
  const cutoff = Timestamp.fromDate(new Date(now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));
  const dueSnap = await db.collection("users").where("deletionRequestedAt", "<=", cutoff).get();

  let processed = 0;
  let failed = 0;
  for (const userDoc of dueSnap.docs) {
    const uid = userDoc.id; // users/{uid} doc id == uid (docs/DATA_MODEL.md)
    try {
      await deleteUserAccount(uid);
      processed += 1;
    } catch (error) {
      failed += 1;
      console.error(`Account deletion failed for uid=${uid}, will retry next sweep.`, error);
    }
  }
  return { processed, failed };
}
