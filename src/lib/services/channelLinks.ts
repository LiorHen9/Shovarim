// Channel↔user linking for messaging channels (docs/ROADMAP.md Phase 5.5,
// docs/DECISIONS.md ADR #29). This module is the *only* place a uid is derived
// for an inbound channel message — never from message content, which is
// attacker-controlled (a phone number in a WhatsApp payload proves nothing on
// its own). Relative imports for the same reason as ./cards.ts: the webhook
// smoke script runs under tsx, outside Next's bundler, where "@/" does not
// resolve.
import { randomInt } from "node:crypto";

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { ActionError } from "../actions/errorsCore";
import { writeAuditLog } from "../audit/log";
import { deleteChannelHistory } from "./chatSessions";
import { channelLinkReverifyDeadlineMs, isChannelLinkStale } from "./channelLinkExpiry";
import { LINK_CODE_ALPHABET, LINK_CODE_LENGTH } from "../validation/channelLink";
import type {
  ChannelKind,
  ChannelLink,
  ChannelLinkCode,
  ChannelLinkSummary,
  IssuedLinkCode,
} from "../../types/channelLink";

export const LINK_CODE_TTL_MS = 10 * 60 * 1000;

// How many distinct ids to try before giving up on a collision. 32^8 ≈ 1.1e12,
// so a second attempt is already astronomically unlikely — this exists so a
// create() race fails loudly instead of overwriting a live code.
const CODE_CREATE_ATTEMPTS = 5;

const LINKS = "channelLinks";
const CODES = "channelLinkCodes";

// The only place a channelKey is constructed. Callers pass parsed, validated
// parts (see src/lib/validation/channelLink.ts) — a raw key string is never
// used as a doc id on trust.
export function buildChannelKey(channel: ChannelKind, externalId: string): string {
  return `${channel}:${externalId}`;
}

function generateCode(): string {
  let code = "";
  for (let i = 0; i < LINK_CODE_LENGTH; i += 1) {
    code += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)];
  }
  return code;
}

function toSummary(link: ChannelLink): ChannelLinkSummary {
  return {
    channelKey: link.channelKey,
    channel: link.channel,
    externalId: link.externalId,
    linkedAt: link.linkedAt.toDate().toISOString(),
    lastMessageAt: link.lastMessageAt ? link.lastMessageAt.toDate().toISOString() : null,
    status: isChannelLinkStale(link.linkedAt, link.lastMessageAt) ? "expired" : "active",
    reverifyBy: new Date(
      channelLinkReverifyDeadlineMs(link.linkedAt, link.lastMessageAt)
    ).toISOString(),
  };
}

// Issues a fresh one-time code for an authenticated uid, invalidating any of
// that user's earlier unused codes first: an outstanding code is a bearer
// credential, and "generate a new one" should not quietly leave the old one
// live. Filtering in memory rather than with a second where() clause keeps
// this off a composite index — a user has a handful of codes at most.
//
// A user who already has this channel linked gets nothing: issuing a code to
// them only creates a live bearer credential for an account that needs no new
// link (issue #26). /settings hides the button in that state, but the action
// is directly POST-able (ADR #25), so the rule lives here too. Unlinking is
// the deliberate way back — which also makes "move my number to another
// account" (redeemLinkCode, ADR #29) unaffected: that code is issued by the
// *other* account, which has no link yet.
export async function createLinkCodeForUid(
  uid: string,
  channel: ChannelKind
): Promise<IssuedLinkCode> {
  const now = Timestamp.now();

  // An expired link (issue #68, ADR #41) does not block a fresh code — that
  // *is* the renewal path, and redeemLinkCode already overwrites a same-uid
  // link with no extra confirmation. Only a still-active link blocks this,
  // matching the original reasoning in the comment above (issue #26): no
  // point in a live bearer credential for a link that needs no renewal yet.
  const links = await listChannelLinksForUid(uid);
  const existingForChannel = links.find((link) => link.channel === channel);
  if (existingForChannel && existingForChannel.status === "active") {
    throw new ActionError("הערוץ כבר מקושר לחשבון. נתקו את הקישור הקיים לפני יצירת קישור חדש.");
  }

  const existing = await adminDb.collection(CODES).where("uid", "==", uid).get();
  const stillOpen = existing.docs.filter((doc) => (doc.data() as ChannelLinkCode).usedAt === null);
  if (stillOpen.length > 0) {
    const batch = adminDb.batch();
    for (const doc of stillOpen) batch.update(doc.ref, { usedAt: now });
    await batch.commit();
  }

  const expiresAt = Timestamp.fromMillis(now.toMillis() + LINK_CODE_TTL_MS);

  for (let attempt = 0; attempt < CODE_CREATE_ATTEMPTS; attempt += 1) {
    const code = generateCode();
    try {
      await adminDb
        .collection(CODES)
        .doc(code)
        .create({ code, uid, channel, createdAt: now, expiresAt, usedAt: null });
      return { code, expiresAt: expiresAt.toDate().toISOString() };
    } catch {
      // create() throws ALREADY_EXISTS on collision; try another id.
    }
  }

  throw new ActionError("יצירת קוד הקישור נכשלה, נסו שוב");
}

// Thrown mid-transaction when a code would move a number away from an
// account *other* than the one it's already linked to, and the caller hasn't
// passed { confirmed: true } yet — see options below. Carries the existing
// owner's uid so channelChat.ts can build the confirmation prompt without a
// second read.
export class RelinkConfirmationRequiredError extends Error {
  constructor(public readonly existingUid: string) {
    super("relink confirmation required");
  }
}

// Redeems a code on behalf of an inbound channel message. Single transaction:
// two webhook events racing with the same code must not link two different
// external ids. Reads come first (Firestore requires all reads before writes
// in a transaction).
//
// options.confirmed is the only door past a relink conflict (issue #75): it
// is set only by the internal retry in channelChat.ts, after the sender has
// already replied "yes" to the confirmation prompt built from
// RelinkConfirmationRequiredError. There is no separate peek before the
// transaction — that would open a race window between the check and the
// write — so the conflict is detected here, inside the same transaction that
// would otherwise perform the overwrite.
export async function redeemLinkCode(
  channel: ChannelKind,
  externalId: string,
  code: string,
  options?: { confirmed?: boolean }
): Promise<ChannelLinkSummary> {
  const channelKey = buildChannelKey(channel, externalId);
  const codeRef = adminDb.collection(CODES).doc(code);
  const linkRef = adminDb.collection(LINKS).doc(channelKey);

  // Returns primitives rather than the written doc: the stored shape carries
  // firebase-admin Timestamps while ChannelLink (shared with the client) is
  // typed with the firebase/firestore ones — the same split every service here
  // handles by writing plain literals and casting on read.
  const link = await adminDb.runTransaction(async (tx) => {
    const codeSnap = await tx.get(codeRef);
    const existingLinkSnap = await tx.get(linkRef);
    const now = Timestamp.now();

    // One message for every failure mode: an inbound sender is unauthenticated
    // by definition, so "no such code" and "expired" must not be
    // distinguishable to them.
    const invalid = new ActionError("קוד הקישור אינו תקין או שפג תוקפו");
    if (!codeSnap.exists) throw invalid;

    const codeDoc = codeSnap.data() as ChannelLinkCode;
    if (codeDoc.usedAt !== null) throw invalid;
    if (codeDoc.expiresAt.toMillis() <= now.toMillis()) throw invalid;
    if (codeDoc.channel !== channel) throw invalid;

    // A code redeemed while this number is already linked to a *different*
    // account is a candidate account takeover, not necessarily a legitimate
    // "move this phone to my other account" — the sender only proved
    // possession of the number, and the code alone proves nothing about who
    // used to own it. Confirmation is required before the overwrite proceeds,
    // unless the caller already collected it (options.confirmed).
    if (existingLinkSnap.exists) {
      const existingLink = existingLinkSnap.data() as ChannelLink;
      if (existingLink.uid !== codeDoc.uid && !options?.confirmed) {
        throw new RelinkConfirmationRequiredError(existingLink.uid);
      }
    }

    // Overwriting an existing link is intentional: the sender proved
    // possession of the external id (the message came from it) and the code
    // proves account ownership, so this is a legitimate "move this phone to my
    // other account". The previous binding simply stops resolving.
    tx.set(linkRef, {
      channelKey,
      uid: codeDoc.uid,
      channel,
      externalId,
      linkedAt: now,
      lastMessageAt: null,
    });
    tx.update(codeRef, { usedAt: now });
    return {
      uid: codeDoc.uid,
      linkedAt: now.toDate().toISOString(),
      reverifyBy: new Date(channelLinkReverifyDeadlineMs(now, null)).toISOString(),
    };
  });

  // Re-linking may hand this number to a different account, so any earlier
  // conversation on it is dropped. loadChannelHistory also refuses a session
  // whose uid no longer matches — belt and braces, since this is a data leak
  // if it ever goes wrong.
  await deleteChannelHistory(channelKey);

  await writeAuditLog({
    uid: link.uid,
    eventType: "channel_linked",
    channel,
    paramsSummary: channelKey,
    result: "success",
  });

  return {
    channelKey,
    channel,
    externalId,
    linkedAt: link.linkedAt,
    lastMessageAt: null,
    status: "active",
    reverifyBy: link.reverifyBy,
  };
}

// The uid lookup every inbound message goes through. Returns null rather than
// throwing: "not linked" is an ordinary state the webhook answers with an
// explanatory message, not an error. A stale link (issue #68, ADR #41) is
// treated exactly the same as "never linked" — same null, same reply — so a
// recycled number does not silently keep resolving to its previous owner,
// and so an unauthenticated sender learns nothing new (no distinct message
// for "expired" vs "never linked", consistent with ADR #29's uniform-failure
// principle).
export async function resolveUidForChannel(
  channel: ChannelKind,
  externalId: string
): Promise<string | null> {
  const snap = await adminDb.collection(LINKS).doc(buildChannelKey(channel, externalId)).get();
  if (!snap.exists) return null;
  const link = snap.data() as ChannelLink;
  if (isChannelLinkStale(link.linkedAt, link.lastMessageAt)) return null;
  return link.uid;
}

// Best-effort activity stamp for the "last message" column in /settings
// (Phase 5.5.b). update() rather than set(): if the link was removed between
// the resolve and here, the message stays unanswered — it must not resurrect
// the link document.
export async function touchChannelLink(channel: ChannelKind, externalId: string): Promise<void> {
  const ref = adminDb.collection(LINKS).doc(buildChannelKey(channel, externalId));
  await ref.update({ lastMessageAt: Timestamp.now() }).catch(() => {});
}

// Sorted in memory (see docs/DATA_MODEL.md) — a user has a single-digit number
// of channels, and orderBy would cost a composite index.
export async function listChannelLinksForUid(uid: string): Promise<ChannelLinkSummary[]> {
  const snap = await adminDb.collection(LINKS).where("uid", "==", uid).get();
  return snap.docs
    .map((doc) => toSummary(doc.data() as ChannelLink))
    .sort((a, b) => a.linkedAt.localeCompare(b.linkedAt));
}

// Ownership is re-checked against the stored uid, not assumed from the fact
// that the caller knows the channelKey — the key is a phone number, which is
// guessable.
export async function unlinkChannel(uid: string, channelKey: string): Promise<void> {
  const ref = adminDb.collection(LINKS).doc(channelKey);
  const snap = await ref.get();
  if (!snap.exists) throw new ActionError("הערוץ אינו מקושר");

  const link = snap.data() as ChannelLink;
  if (link.uid !== uid) throw new ActionError("הערוץ אינו מקושר");

  await ref.delete();
  // The conversation is part of the link, not something that survives it
  // (Phase 5.5.b) — leaving it behind would hand the next person to link this
  // number the previous owner's transcript.
  await deleteChannelHistory(channelKey);
  await writeAuditLog({
    uid,
    eventType: "channel_unlinked",
    channel: "web",
    paramsSummary: channelKey,
    result: "success",
  });
}
