// Phone-number list invitations (docs/DECISIONS.md ADR #37, issue #58) — the
// path that shares a list with someone who may not have an account yet, next
// to the email flow of ADR #15 which requires one.
//
// Two independent facts have to hold before an invite becomes a membership,
// and this module is where that pairing is enforced:
//   1. the caller holds the code  → "an invite was addressed to this number"
//   2. channelLinks maps that number to the caller's uid → "the number is mine"
// Neither alone is sufficient. A forwarded link fails (2); a signed-in user who
// linked their phone but was never invited fails (1). This is the same
// reasoning as ADR #29: a phone number is never itself proof of identity.
//
// Relative imports for the same reason as ./channelLinks.ts: scripts run this
// under tsx, outside Next's bundler, where "@/" does not resolve.
import { randomInt } from "node:crypto";

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { ActionError } from "../actions/errorsCore";
import { writeAuditLog } from "../audit/log";
import { resolveUidForChannel } from "./channelLinks";
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

// 14 days: an invite is delivered by hand over WhatsApp and may sit unread for
// days — the 10-minute TTL of a channel link code (which the user redeems
// immediately, while sitting in /settings) would expire before most people
// open it. The longer window is what forces the longer code, see
// INVITE_CODE_LENGTH in ../validation/listInvite.ts.
export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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
// enough to recognize which of their numbers to link.
function toPhoneHint(phone: string): string {
  return phone.slice(-4);
}

function isExpired(invite: ListInviteCode, now: Timestamp): boolean {
  return invite.expiresAt.toMillis() <= now.toMillis();
}

function toSummary(invite: ListInviteCode): ListInviteSummary {
  return {
    code: invite.code,
    listId: invite.listId,
    role: invite.role,
    phone: invite.phone,
    status: invite.status,
    createdAt: invite.createdAt.toDate().toISOString(),
    expiresAt: invite.expiresAt.toDate().toISOString(),
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

// Issues an invite for a phone number on behalf of the list owner. Any earlier
// still-open invite for the same (listId, phone) is closed first: an
// outstanding code is a bearer credential, and "resend" must not quietly leave
// the previous link live — same reasoning as createLinkCodeForUid.
export async function createListInvite(
  uid: string,
  input: { listId: string; phone: string; role: ListMemberRole },
  buildInviteUrl: (code: string) => string
): Promise<IssuedListInvite> {
  const list = await getListOwnedBy(input.listId, uid);
  const now = Timestamp.now();

  // The owner inviting their own linked number would create an invite that can
  // never be accepted (acceptListInvite refuses a self-invite), so fail early
  // with the same message the email flow uses.
  const existingUid = await resolveUidForChannel("whatsapp", input.phone);
  if (existingUid === uid) throw new ActionError("אי אפשר לשתף רשימה עם עצמך");

  if (existingUid) {
    const memberSnap = await adminDb
      .collection("cardLists")
      .doc(input.listId)
      .collection("members")
      .doc(existingUid)
      .get();
    if (memberSnap.exists) throw new ActionError("המשתמש כבר משותף ברשימה זו");
  }

  const open = await adminDb
    .collection(INVITES)
    .where("listId", "==", input.listId)
    .where("phone", "==", input.phone)
    .get();
  const stillOpen = open.docs.filter((doc) => (doc.data() as ListInviteCode).usedAt === null);
  if (stillOpen.length > 0) {
    const batch = adminDb.batch();
    for (const doc of stillOpen) batch.update(doc.ref, { status: "declined", usedAt: now });
    await batch.commit();
  }

  const expiresAt = Timestamp.fromMillis(now.toMillis() + INVITE_TTL_MS);

  for (let attempt = 0; attempt < CODE_CREATE_ATTEMPTS; attempt += 1) {
    const code = generateCode();
    try {
      await adminDb.collection(INVITES).doc(code).create({
        code,
        listId: input.listId,
        role: input.role,
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
        // The list is identified, the invited number is not: paramsSummary
        // lands in an audit trail we keep, and the phone is PII (see
        // docs/PRIVACY.md, where the channelKey rows make the same point).
        paramsSummary: `list:${input.listId} role:${input.role}`,
        result: "success",
      });

      const inviteUrl = buildInviteUrl(code);
      return {
        code,
        inviteUrl,
        shareText: buildShareText(list.name, inviteUrl, existingUid !== null),
        expiresAt: expiresAt.toDate().toISOString(),
      };
    } catch {
      // create() throws ALREADY_EXISTS on collision; try another id.
    }
  }

  throw new ActionError("יצירת ההזמנה נכשלה, נסו שוב");
}

// Two wordings, per issue #58. This is framing only — resolveUidForChannel is
// re-evaluated at accept time, so a number that registers (or unlinks) between
// sending and clicking changes nothing about what actually happens.
function buildShareText(listName: string, inviteUrl: string, isKnownUser: boolean): string {
  const intro = `שיתפתי איתך את הרשימה "${listName}" ב-Shovarim.`;
  const action = isKnownUser
    ? "לאישור ההצטרפות:"
    : "לאישור ההצטרפות (תתבקש/י להתחבר עם חשבון Google בפעם הראשונה):";
  return `${intro}\n${action}\n${inviteUrl}`;
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

  const linkedUid = await resolveUidForChannel("whatsapp", invite.phone);
  if (linkedUid === uid) return "ready";
  // The invited number belongs to nobody yet → this account can link it.
  // If it belongs to someone else, this account simply cannot accept; both
  // read as "link that number first" from here, and the distinction is not
  // surfaced (it would be an oracle for whether a number is registered).
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

  // The load-bearing check (ADR #37 decision 3): holding the code proves an
  // invite was addressed to this number, and only channelLinks proves the
  // number belongs to the account doing the accepting.
  const linkedUid = await resolveUidForChannel("whatsapp", invite.phone);
  if (linkedUid !== uid) {
    throw new ActionError("יש לקשר את מספר הוואטסאפ שאליו נשלחה ההזמנה לפני אישור ההצטרפות");
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

// The owner's view of outstanding invites on one of their lists. Filtered and
// sorted in memory: a list has a handful of open invites at most, and this
// keeps the query on a single field (see docs/DATA_MODEL.md).
export async function listInvitesForList(
  uid: string,
  listId: string
): Promise<ListInviteSummary[]> {
  await getListOwnedBy(listId, uid);

  const snap = await adminDb.collection(INVITES).where("listId", "==", listId).get();
  return snap.docs
    .map((doc) => doc.data() as ListInviteCode)
    .filter((invite) => invite.status === "pending" && !isExpired(invite, Timestamp.now()))
    .map(toSummary)
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
