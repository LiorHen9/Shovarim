// Admin-only blocking mutations (docs/ROADMAP.md Phase 9.3, docs/DECISIONS.md
// ADR #44). Called only from src/actions/adminModeration.ts, which already
// ran requireAdmin() — these functions trust the adminUid they're given, same
// as adminUsers.ts trusts the layout's gate.
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "../firebase/adminApp";
import { ActionError } from "../actions/errorsCore";
import { writeAdminAuditLog } from "../audit/adminLog";

function isAuthUserNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found";
}

// Auth disable+revoke is the primary enforcement (see ./moderation.ts):
// verifySessionCookie(cookie, true) already checks both, so every session-based
// entry point is blocked the moment this returns. userModeration/{uid} exists
// for the WhatsApp fallback (no Auth token there at all) and for the admin UI
// to display status. Written before the Auth mutation — audit-before-action,
// same ordering as functions/src/accountDeletion.ts's deleteUserAccount.
export async function blockUser(adminUid: string, targetUid: string, reason: string): Promise<void> {
  if (adminUid === targetUid) {
    throw new ActionError("לא ניתן לחסום את עצמך — היחיד עם הרשאת אדמין כרגע");
  }

  await writeAdminAuditLog({ adminUid, targetUid, action: "block", reason });

  await adminDb.doc(`userModeration/${targetUid}`).set({
    uid: targetUid,
    blocked: true,
    blockedReason: reason,
    blockedAt: FieldValue.serverTimestamp(),
    blockedBy: adminUid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await adminAuth.updateUser(targetUid, { disabled: true });
  await adminAuth.revokeRefreshTokens(targetUid);
}

export async function unblockUser(adminUid: string, targetUid: string): Promise<void> {
  await writeAdminAuditLog({ adminUid, targetUid, action: "unblock" });

  await adminDb.doc(`userModeration/${targetUid}`).set({
    uid: targetUid,
    blocked: false,
    blockedReason: null,
    blockedAt: null,
    blockedBy: null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await adminAuth.updateUser(targetUid, { disabled: false });
}

// Proactive block for an address that may not have an account yet — checked
// in createSession before a session cookie is minted. If an account already
// exists for this email, it's disabled+revoked too (email block is a
// superset that also covers the existing account).
export async function blockEmail(adminUid: string, email: string, reason: string): Promise<void> {
  const adminRecord = await adminAuth.getUser(adminUid);
  if (adminRecord.email === email) {
    throw new ActionError("לא ניתן לחסום את כתובת האימייל של עצמך — היחיד עם הרשאת אדמין כרגע");
  }

  await writeAdminAuditLog({ adminUid, targetUid: null, action: "block", reason: `email ${email}: ${reason}` });

  await adminDb.doc(`blockedEmails/${email}`).set({
    email,
    blockedReason: reason,
    blockedAt: FieldValue.serverTimestamp(),
    blockedBy: adminUid,
  });

  try {
    const record = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(record.uid, { disabled: true });
    await adminAuth.revokeRefreshTokens(record.uid);
  } catch (error) {
    if (!isAuthUserNotFoundError(error)) throw error;
  }
}

export async function unblockEmail(adminUid: string, email: string): Promise<void> {
  await writeAdminAuditLog({ adminUid, targetUid: null, action: "unblock", reason: `email ${email}` });
  await adminDb.doc(`blockedEmails/${email}`).delete();
}

// Proactive block for a phone number — checked in redeemLinkCode before a
// channelLinks doc is created, so a blocked number can't (re-)link to any
// account. Does not touch any existing Auth account: a phone alone identifies
// no account (ADR #29), only a channelLinks entry does, and unlinking that is
// a separate action from blocking the number going forward.
export async function blockPhone(adminUid: string, phone: string, reason: string): Promise<void> {
  await writeAdminAuditLog({ adminUid, targetUid: null, action: "block", reason: `phone ${phone}: ${reason}` });
  await adminDb.doc(`blockedPhones/${phone}`).set({
    phone,
    blockedReason: reason,
    blockedAt: FieldValue.serverTimestamp(),
    blockedBy: adminUid,
  });
}

export async function unblockPhone(adminUid: string, phone: string): Promise<void> {
  await writeAdminAuditLog({ adminUid, targetUid: null, action: "unblock", reason: `phone ${phone}` });
  await adminDb.doc(`blockedPhones/${phone}`).delete();
}
