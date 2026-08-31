// Shareable list invitations (docs/DECISIONS.md ADR #38, superseding ADR #37
// decisions 1 and 3) — the path that shares a list with someone who may not
// have an account yet.
//
// ADR #37 required two independent facts before an invite became a membership:
// the code proved "an invite was addressed to this number", and channelLinks
// proved "the number is mine". Since the owner no longer names a number, the
// first fact has nothing to bind to, and the code stands alone as a **bearer
// credential** — whoever holds the link can join, exactly like a WhatsApp group
// invite link. What keeps that bounded is enforced here: single use, a 48-hour
// TTL, a cap on how many can be open at once, and the owner's ability to revoke
// any of them.
//
// Linking a WhatsApp number is still part of the invitee's flow, but its role
// changed: it is enrichment (so the owner can see who joined), not the
// authorization step. Nothing below may treat it as one. This does not
// contradict ADR #29 — a phone number is still never proof of identity; it is
// simply no longer what this flow relies on.
//
// Codes written before this change carry a non-null `phone` and are still
// honoured on ADR #37's original terms until they expire; every branch that
// cares splits on `invite.phone === null`.
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

// 48 hours. ADR #37 allowed 14 days because the invite was addressed to one
// number and useless to anyone else, so a long unread window cost nothing. A
// bearer link is different: every hour it stays live is an hour a forward or a
// screenshot can be redeemed by a stranger. Two days still comfortably covers
// "sent it last night, they opened it after work".
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

// Every click of the share button mints a code, and each open one is live until
// used or expired. Capping them keeps a slipped finger from leaving a dozen
// redeemable links behind; the owner clears them from the dialog.
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

// Last 4 digits only, and only for legacy phone-bound invites. The preview is
// readable by anyone holding the link, so the full invited number must not
// travel with it — but the invitee needs enough to recognize which of their
// numbers to link.
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

// Mints a fresh share link for the list owner. Nothing identifies a recipient —
// the owner picks one in WhatsApp's own contact picker after this returns —
// which is why the self-invite and already-member checks that used to live here
// are gone: both keyed off a phone number nobody supplies any more. Their real
// work happens at accept time anyway, where getListInviteGate resolves them
// from the uid actually clicking.
//
// Earlier open invites are deliberately left alone. ADR #37 closed them on
// every new invite because "(listId, phone)" identified one recipient and a
// second code for the same one meant "resend". Without a recipient there is no
// such key, and sharing with three people in a row is the normal case.
export async function createListInvite(
  uid: string,
  input: { listId: string },
  buildInviteUrl: (code: string) => string
): Promise<IssuedListInvite> {
  const list = await getListOwnedBy(input.listId, uid);
  const now = Timestamp.now();

  const open = await getOpenInvites(input.listId, now);
  if (open.length >= MAX_OPEN_INVITES) {
    throw new ActionError(
      `יש כבר ${MAX_OPEN_INVITES} לינקים פתוחים לרשימה זו. בטלו לינק קיים לפני יצירת חדש.`
    );
  }

  const expiresAt = Timestamp.fromMillis(now.toMillis() + INVITE_TTL_MS);

  for (let attempt = 0; attempt < CODE_CREATE_ATTEMPTS; attempt += 1) {
    const code = generateCode();
    try {
      await adminDb.collection(INVITES).doc(code).create({
        code,
        listId: input.listId,
        role: DEFAULT_INVITE_ROLE,
        phone: null,
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

// One wording now. ADR #37 branched it on whether the number was already known
// to the system, which is unanswerable without a number — and it was framing
// only, so nothing about what actually happens changes.
function buildShareText(listName: string, inviteUrl: string): string {
  return [
    `שיתפתי איתך את הרשימה "${listName}" ב-Shovarim.`,
    "לאישור ההצטרפות (תתבקש/י להתחבר עם חשבון Google בפעם הראשונה):",
    inviteUrl,
    "",
    "הלינק אישי, חד-פעמי ותקף ל-48 שעות — אין להעביר אותו הלאה.",
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

// Whether the invitee is required to prove a WhatsApp number before joining.
// With the bot number unset, buildWhatsAppLinkCodeUrl returns null and there is
// no way for anyone to link one — so demanding it would strand every invitee
// permanently. Checked here rather than only in the UI: the accept action is
// directly POST-able (ADR #25), so the two sides must agree from the server's
// own view of the environment, not the client's claim about it.
function whatsAppLinkingAvailable(): boolean {
  return (process.env.NEXT_PUBLIC_WHATSAPP_BOT_PHONE?.replace(/\D/g, "") ?? "").length > 0;
}

// The WhatsApp number this account has linked, or null. Enrichment only since
// ADR #38 — never an authorization answer.
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

  if (invite.phone !== null) {
    // Legacy phone-bound invite (ADR #37) — unchanged terms.
    const linkedUid = await resolveUidForChannel("whatsapp", invite.phone);
    if (linkedUid === uid) return "ready";
    // The invited number belongs to nobody yet → this account can link it.
    // If it belongs to someone else, this account simply cannot accept; both
    // read as "link that number first" from here, and the distinction is not
    // surfaced (it would be an oracle for whether a number is registered).
    if (linkedUid === null) return "needs_channel_link";
    return "linked_to_other_number";
  }

  // Bearer invite (ADR #38). Any linked WhatsApp number will do — the question
  // is no longer "is this the invited number" but "do we have one to record".
  if (!whatsAppLinkingAvailable()) return "ready";
  return (await getLinkedWhatsAppNumber(uid)) === null ? "needs_channel_link" : "ready";
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

  // What proves the right to join splits by invite generation. Legacy codes
  // keep ADR #37 decision 3 exactly: holding the code proves an invite was
  // addressed to a number, and only channelLinks proves that number belongs to
  // the account accepting. Bearer codes (ADR #38) are the proof themselves —
  // there is no number to match against, so the link is collected for the
  // owner's benefit, not as a gate. Either way it is re-derived here and never
  // taken from the client.
  let memberPhone: string | null = null;
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
// carries its URL and message so the dialog can reopen WhatsApp for a link that
// was generated but never sent, rather than minting a second one — which under
// ADR #38 would mean two redeemable credentials where the owner wanted one.
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
