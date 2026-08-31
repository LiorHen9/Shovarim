// Pending relink-confirmation state (issue #75, docs/DECISIONS.md ADR #40).
// Same shape of module as chatSessions.ts: Admin SDK only, relative imports,
// no "server-only" so scripts/ can run this under tsx.
import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { LINK_CODE_TTL_MS } from "./channelLinks";
import type { ChannelKind, ChannelRelinkConfirmation } from "../../types/channelLink";

const CONFIRMATIONS = "channelRelinkConfirmations";

export async function createPendingRelink(
  channelKey: string,
  channel: ChannelKind,
  externalId: string,
  code: string,
  existingUid: string
): Promise<void> {
  const now = Timestamp.now();
  await adminDb
    .collection(CONFIRMATIONS)
    .doc(channelKey)
    .set({
      channelKey,
      channel,
      externalId,
      code,
      existingUid,
      createdAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + LINK_CODE_TTL_MS),
    });
}

// Returns null for a missing or expired confirmation — both mean "nothing is
// pending", same staleness pattern as loadChannelHistory.
export async function getPendingRelink(channelKey: string): Promise<ChannelRelinkConfirmation | null> {
  const snap = await adminDb.collection(CONFIRMATIONS).doc(channelKey).get();
  if (!snap.exists) return null;

  const confirmation = snap.data() as ChannelRelinkConfirmation;
  if (confirmation.expiresAt.toMillis() <= Date.now()) return null;

  return confirmation;
}

export async function deletePendingRelink(channelKey: string): Promise<void> {
  await adminDb.collection(CONFIRMATIONS).doc(channelKey).delete();
}
