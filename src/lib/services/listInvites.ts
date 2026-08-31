// Shareable list invitations (docs/DECISIONS.md ADR #39, which restores the
// two-fact rule of ADR #37 that ADR #38 had dropped) — the path that shares a
// list with someone who may not have an account yet.
//
// Two independent facts are required before an invite becomes a membership:
// holding the code proves "an invite was addressed to this number", and
// channelLinks proves "that number is mine". Neither is sufficient alone, which
// is the whole point — a link that leaks, is forwarded, or is screenshotted is
// worthless to anyone who cannot also receive WhatsApp on the invited number.
// The bounds ADR #38 introduced are kept on top of that rather than in place of
// it: single use, a 48-hour TTL, a cap on open links, and owner revocation.
//
// This does not contradict ADR #29. A phone number is still never proof of
// identity by itself; what authorizes here is channelLinks, which was built
// precisely so that a number becomes attached to a uid only by a message the
// account holder actually sent.
//
// Codes written during the ADR #38 window carry `phone: null` and are bearer
// credentials — they are honoured on those weaker terms until they expire
// rather than being invalidated, and every branch that cares splits on
// `invite.phone === null`.
//
// Relative imports for the same reason as ./channelLinks.ts: scripts run this
// under tsx, outside Next's bundler, where "@/" does not resolve.
import { randomInt } from "node:crypto";

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { ActionError } from "../actions/errorsCore";
import { writeAuditLog } from "../audit/log";
import { listChannelLinksForUid, resolveUidForChannel } from "./channelLinks";
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "../validation/listInvite";
import type {
  IssuedListInvite,
  ListInviteCode,
  ListInviteGate,
  ListInvitePreview,
  ListInviteStatus,
  ListInviteSummary,
} from "../../types/listInvite";
import type { ListMemberRole } from "../../types/cardListMember";

// 48 hours. ADR #37 allowed 14 days on the reasoning that a bound invite is
// useless to anyone but the invited number, which is true again under ADR #39 —
// but the shorter window carried over from ADR #38 is kept deliberately. It
// still comfortably covers "sent it last night, they opened it after work",
// and it bounds the one case binding does not: the invited number itself
// changing hands, or a link left live and forgotten.
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

// Each open code is live until used or expired. Re-sharing with the same number
// supersedes rather than accumulates (see createListInvite), so this cap is
// about breadth — how many different people can have an outstanding invite to
// one list at once — not about repeat clicks. The owner clears them from the
// dialog.
const MAX_OPEN_INVITES = 10;

// New shares always start here. Promotion to "manager" is a separate, deliberate
// act on the members list — which is what lets the share itself be one click.
const DEFAULT_INVITE_ROLE: ListMemberRole = "viewer";

// Same rationale as CODE_CREATE_ATTEMPTS in ./channelLinks.ts: 32^12 makes a
// collision astronomically unlikely, so this exists only so a create() race
// fails loudly instead of overwriting a live invite.
const CODE_CREATE_ATTEMPTS = 5;

const INVITES = "listInviteCodes";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

// Last 4 digits only. The preview is readable by anyone holding the link, so
// the full invited number must not travel with it — but the invitee needs
// enough to recognize which of their numbers to link. null only for the ADR #38
// bearer leftovers, which name no number.
function toPhoneHint(phone: string | null): string | null {
  return phone === null ? null : phone.slice(-4);
}

function isExpired(invite: ListInviteCode, now: Timestamp): boolean {
  return invite.expiresAt.toMillis() <= now.toMillis();
}

function toSummary(
  invite: ListInviteCode,
  listName: string,
  buildInviteUrl: (code: string) => string
): ListInviteSummary {
  const inviteUrl = buildInviteUrl(invite.code);
  return {
    code: invite.code,
    listId: invite.listId,
    role: invite.role,
    phone: invite.phone,
    status: invite.status,
    createdAt: invite.createdAt.toDate().toISOString(),
    expiresAt: invite.expiresAt.toDate().toISOString(),
    inviteUrl,
    shareText: buildShareText(listName, inviteUrl),
  };
}

async function getListOwnedBy(listId: string, uid: string): Promise<{ name: string }> {
  const snap = await adminDb.collection("cardLists").doc(listId).get();
  const list = snap.data() as { ownerId: string; name: string } | undefined;
  if (!list) throw new ActionError("הרשימה לא נמצאה");
  // Deliberately not assertCanManageListAndGetOwner: that also admits accepted
  // managers, and sharing a list stays owner-only (ADR #15 rejected letting
  // managers invite, to avoid uncontrolled invite chains). Same rule here.
  if (list.ownerId !== uid) throw new ActionError("רק בעל הרשימה יכול לשתף אותה");
  return { name: list.name };
}

// Mints a share link addressed to one number. `input.phone` is already E.164 —
// ilPhoneSchema normalized it, on this side of the boundary, from the ten
// Israeli digits the form collects.
//
// The two guards below are convenience, not security: acceptListInvite decides
// the same questions again from the uid that actually shows up. Resolving them
// here only spares the owner from sending a link that could never be redeemed —
// and both stay silent about numbers they cannot resolve, so neither turns into
// an oracle for whether an arbitrary number has an account.
export async function createListInvite(
  uid: string,
  input: { listId: string; phone: string },
  buildInviteUrl: (code: string) => string
): Promise<IssuedListInvite> {
  const list = await getListOwnedBy(input.listId, uid);
  const now = Timestamp.now();

  const invitedUid = await resolveUidForChannel("whatsapp", input.phone);
  if (invitedUid === uid) throw new ActionError("אי אפשר לשתף רשימה עם עצמך");
  if (invitedUid !== null) {
    const memberSnap = await adminDb
      .collection("cardLists")
      .doc(input.listId)
      .collection("members")
      .doc(invitedUid)
      .get();
    if (memberSnap.exists) throw new ActionError("הרשימה כבר משותפת עם המספר הזה");
  }

  const open = await getOpenInvites(input.listId, now);

  // Sharing again with the same number means "resend", not "a second live
  // code" — ADR #37's dedupe, restored along with the binding that gives
  // (listId, phone) its meaning as a key. Superseding before the cap check also
  // keeps a resend from counting against a limit it does not actually grow.
  const superseded = open.filter((invite) => invite.phone === input.phone);
  if (open.length - superseded.length >= MAX_OPEN_INVITES) {
    throw new ActionError(
      `יש כבר ${MAX_OPEN_INVITES} לינקים פתוחים לרשימה זו. בטלו לינק קיים לפני יצירת חדש.`
    );
  }
  if (superseded.length > 0) {
    const batch = adminDb.batch();
    for (const invite of superseded) {
      batch.update(adminDb.collection(INVITES).doc(invite.code), {
        status: "declined" satisfies ListInviteStatus,
        usedAt: now,
      });
    }
    await batch.commit();
  }

  const expiresAt = Timestamp.fromMillis(now.toMillis() + INVITE_TTL_MS);

  for (let attempt = 0; attempt < CODE_CREATE_ATTEMPTS; attempt += 1) {
    const code = generateCode();
    try {
      await adminDb.collection(INVITES).doc(code).create({
        code,
        listId: input.listId,
        role: DEFAULT_INVITE_ROLE,
        phone: input.phone,
        invitedBy: uid,
        status: "pending" satisfies ListInviteStatus,
        createdAt: now,
        expiresAt,
        usedAt: null,
      });

      await writeAuditLog({
        uid,
        eventType: "list_invite_created",
        channel: "web",
        paramsSummary: `list:${input.listId} role:${DEFAULT_INVITE_ROLE}`,
        result: "success",
      });

      const inviteUrl = buildInviteUrl(code);
      return {
        code,
        phone: input.phone,
        inviteUrl,
        shareText: buildShareText(list.name, inviteUrl),
        expiresAt: expiresAt.toDate().toISOString(),
      };
    } catch {
      // create() throws ALREADY_EXISTS on collision; try another id.
    }
  }

  throw new ActionError("יצירת ההזמנה נכשלה, נסו שוב");
}

// One wording, for both generations. ADR #37 branched it on whether the number
// was already known to the system; that was framing only and told the recipient
// nothing they had to act on. The closing line is not a plea but a description
// of what the code enforces — forwarding the link gains the next person
// nothing, because they cannot receive WhatsApp on the invited number.
function buildShareText(listName: string, inviteUrl: string): string {
  return [
    `שיתפתי איתך את הרשימה "${listName}" ב-Shovarim.`,
    "לאישור ההצטרפות (תתבקש/י להתחבר עם חשבון Google בפעם הראשונה):",
    inviteUrl,
    "",
    "הלינק משויך למספר הזה ותקף ל-48 שעות — רק חשבון שמקושר אליו יוכל לאשר.",
  ].join("\n");
}

// Single-field query, filtered in memory: a list has a handful of invites at
// most and this keeps it off a composite index (see docs/DATA_MODEL.md). Shared
// by the creation cap and by the owner's dialog so both mean the same thing by
// "open".
async function getOpenInvites(listId: string, now: Timestamp): Promise<ListInviteCode[]> {
  const snap = await adminDb.collection(INVITES).where("listId", "==", listId).get();
  return snap.docs
    .map((doc) => doc.data() as ListInviteCode)
    .filter((invite) => invite.status === "pending" && !isExpired(invite, now));
}

// Whether a WhatsApp number can be linked at all right now. With the bot number
// unset, buildWhatsAppLinkCodeUrl returns null and nobody can link one.
//
// This relaxes the requirement for ADR #38 bearer leftovers only, where the
// number was never authorization to begin with and demanding it would strand
// the invitee for nothing. It deliberately does NOT relax anything for a
// phone-bound invite: there the link *is* the authorization, and letting a
// missing env var wave it through would be a fail-open — a misconfigured
// deployment would silently turn every bound invite into a bearer one. Such a
// deployment simply cannot complete an invite, which is the correct outcome.
//
// Checked here rather than only in the UI: the accept action is directly
// POST-able (ADR #25).
function whatsAppLinkingAvailable(): boolean {
  return (process.env.NEXT_PUBLIC_WHATSAPP_BOT_PHONE?.replace(/\D/g, "") ?? "").length > 0;
}

// The WhatsApp number this account has linked, or null. Used only on the ADR #38
// bearer path, where it is enrichment rather than an authorization answer; a
// bound invite asks the opposite question (resolveUidForChannel, from the
// invited number to a uid) and never consults this.
async function getLinkedWhatsAppNumber(uid: string): Promise<string | null> {
  const links = await listChannelLinksForUid(uid);
  return links.find((link) => link.channel === "whatsapp")?.externalId ?? null;
}

// The invitee's view, resolved from the code alone — no auth. Safe because the
// code is the secret; it returns nothing about the list beyond its name, and
// never the full invited phone number.
export async function getListInvitePreview(code: string): Promise<ListInvitePreview> {
  const snap = await adminDb.collection(INVITES).doc(code).get();
  if (!snap.exists) throw new ActionError("ההזמנה אינה קיימת או שפג תוקפה");

  const invite = snap.data() as ListInviteCode;
  const listSnap = await adminDb.collection("cardLists").doc(invite.listId).get();
  const list = listSnap.data() as { name: string } | undefined;
  // The list was deleted after the invite went out — nothing to join.
  if (!list) throw new ActionError("הרשימה לא נמצאה");

  return {
    code: invite.code,
    listName: list.name,
    role: invite.role,
    status: invite.status,
    expired: isExpired(invite, Timestamp.now()),
    phoneHint: toPhoneHint(invite.phone),
  };
}

// Which gate the invite page should render for an authenticated visitor. Split
// out from acceptListInvite so the page can explain the blocker before the
// user clicks anything — accept re-derives all of it server-side anyway and
// never trusts this result.
export async function getListInviteGate(uid: string, code: string): Promise<ListInviteGate> {
  const snap = await adminDb.collection(INVITES).doc(code).get();
  if (!snap.exists) throw new ActionError("ההזמנה אינה קיימת או שפג תוקפה");
  const invite = snap.data() as ListInviteCode;

  if (invite.invitedBy === uid) return "self_invite";

  const memberSnap = await adminDb
    .collection("cardLists")
    .doc(invite.listId)
    .collection("members")
    .doc(uid)
    .get();
  if (memberSnap.exists) return "already_member";

  if (invite.phone === null) {
    // Bearer leftover from the ADR #38 window: there is no number to match, so
    // any linked one will do and the question is only "do we have one to
    // record". Not reachable for invites minted since.
    if (!whatsAppLinkingAvailable()) return "ready";
    return (await getLinkedWhatsAppNumber(uid)) === null ? "needs_channel_link" : "ready";
  }

  // The bound case (ADR #39): the visitor may accept only from the account that
  // has proved the invited number.
  const linkedUid = await resolveUidForChannel("whatsapp", invite.phone);
  if (linkedUid === uid) return "ready";
  // The invited number belongs to nobody yet → this account can link it.
  // If it belongs to someone else, this account simply cannot accept.
  //
  // These are deliberately NOT collapsed into one blocked state, even though
  // telling them apart lets the holder of a live code learn whether one
  // specific number is registered. Collapsing them would send the second group
  // off to run a linking flow that cannot succeed — the number is already
  // claimed — and leave them looping. The leak is bounded to a single number
  // the owner themselves typed, behind a 48-hour code, and cannot be run over
  // a list. See docs/SECURITY.md for the trade in full.
  if (linkedUid === null) return "needs_channel_link";
  return "linked_to_other_number";
}

// Accepts an invite. Every precondition is re-checked here against Firestore —
// getListInviteGate is a UI affordance, not an authorization step.
export async function acceptListInvite(
  uid: string,
  code: string,
  email: string
): Promise<{ listId: string }> {
  const inviteRef = adminDb.collection(INVITES).doc(code);
  const snap = await inviteRef.get();
  if (!snap.exists) throw new ActionError("ההזמנה אינה קיימת או שפג תוקפה");

  const invite = snap.data() as ListInviteCode;
  const now = Timestamp.now();
  if (invite.status !== "pending") throw new ActionError("ההזמנה כבר טופלה");
  if (isExpired(invite, now)) throw new ActionError("ההזמנה אינה קיימת או שפג תוקפה");
  // Safety net for the case where the owner's own number got linked between
  // creation and accept; createListInvite blocks the common case up front.
  if (invite.invitedBy === uid) throw new ActionError("אי אפשר לשתף רשימה עם עצמך");

  // The load-bearing check, and the whole of ADR #39's second fact: holding the
  // code proved an invite was addressed to a number; only channelLinks proves
  // that number belongs to the account accepting. Re-derived here from
  // Firestore and never taken from the client — getListInviteGate is a UI hint
  // that a directly POSTed accept would skip entirely (ADR #25).
  //
  // Bearer codes from the ADR #38 window have no number to match, so for those
  // the link is collected for the owner's benefit rather than as a gate. That
  // branch must stay exactly as narrow as `phone === null`.
  let memberPhone: string | null;
  if (invite.phone !== null) {
    const linkedUid = await resolveUidForChannel("whatsapp", invite.phone);
    if (linkedUid !== uid) {
      throw new ActionError("יש לקשר את מספר הוואטסאפ שאליו נשלחה ההזמנה לפני אישור ההצטרפות");
    }
    memberPhone = invite.phone;
  } else if (whatsAppLinkingAvailable()) {
    memberPhone = await getLinkedWhatsAppNumber(uid);
    if (memberPhone === null) {
      throw new ActionError("יש לקשר מספר וואטסאפ לחשבון לפני אישור ההצטרפות");
    }
  } else {
    memberPhone = null;
  }

  const memberRef = adminDb
    .collection("cardLists")
    .doc(invite.listId)
    .collection("members")
    .doc(uid);

  // One transaction so two clicks on the same link cannot both write a member
  // doc / double-consume the code, matching redeemLinkCode's shape.
  await adminDb.runTransaction(async (tx) => {
    const freshInvite = await tx.get(inviteRef);
    const current = freshInvite.data() as ListInviteCode | undefined;
    if (!current || current.status !== "pending") throw new ActionError("ההזמנה כבר טופלה");

    const existingMember = await tx.get(memberRef);
    if (existingMember.exists) throw new ActionError("כבר יש לך גישה לרשימה זו");

    // Written straight to "accepted", skipping the pending stage the email
    // flow uses (ADR #15): the explicit accept already happened on this page,
    // and there is no uid to create a pending doc for before that.
    tx.set(memberRef, {
      id: uid,
      listId: current.listId,
      memberUid: uid,
      email,
      // Captured at the one moment the invitee explicitly consents to joining,
      // and never refreshed afterwards — see CardListMember.phone.
      phone: memberPhone,
      role: current.role,
      status: "accepted",
      invitedBy: current.invitedBy,
      createdAt: now,
      updatedAt: now,
    });
    tx.update(inviteRef, { status: "accepted", usedAt: now });
  });

  await writeAuditLog({
    uid,
    eventType: "list_invite_accepted",
    channel: "web",
    paramsSummary: `list:${invite.listId} role:${invite.role}`,
    result: "success",
  });

  return { listId: invite.listId };
}

// Declining needs no channel link: refusing an invite is not a claim about who
// you are, and requiring proof of the number just to say "no" would strand
// anyone who received a link meant for someone else.
export async function declineListInvite(code: string, uid: string | null): Promise<void> {
  const inviteRef = adminDb.collection(INVITES).doc(code);
  const snap = await inviteRef.get();
  if (!snap.exists) throw new ActionError("ההזמנה אינה קיימת או שפג תוקפה");

  const invite = snap.data() as ListInviteCode;
  if (invite.status !== "pending") throw new ActionError("ההזמנה כבר טופלה");

  await inviteRef.update({ status: "declined", usedAt: Timestamp.now() });

  if (uid) {
    await writeAuditLog({
      uid,
      eventType: "list_invite_declined",
      channel: "web",
      paramsSummary: `list:${invite.listId}`,
      result: "success",
    });
  }
}

// The owner's view of the links still live on one of their lists. Each summary
// carries its URL and message so the dialog can reopen the recipient's chat for
// a link that was generated but never sent, rather than minting a second one —
// which would supersede the first and invalidate a link that may already be in
// the recipient's hands.
export async function listInvitesForList(
  uid: string,
  listId: string,
  buildInviteUrl: (code: string) => string
): Promise<ListInviteSummary[]> {
  const list = await getListOwnedBy(listId, uid);

  const open = await getOpenInvites(listId, Timestamp.now());
  return open
    .map((invite) => toSummary(invite, list.name, buildInviteUrl))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Ownership is re-checked against invitedBy rather than assumed from knowing
// the code — the same reasoning as unlinkChannel checking the stored uid.
export async function cancelListInvite(uid: string, code: string): Promise<void> {
  const inviteRef = adminDb.collection(INVITES).doc(code);
  const snap = await inviteRef.get();
  if (!snap.exists) throw new ActionError("ההזמנה לא נמצאה");

  const invite = snap.data() as ListInviteCode;
  if (invite.invitedBy !== uid) throw new ActionError("ההזמנה לא נמצאה");
  if (invite.status !== "pending") throw new ActionError("ההזמנה כבר טופלה");

  await inviteRef.update({ status: "declined", usedAt: Timestamp.now() });
}
