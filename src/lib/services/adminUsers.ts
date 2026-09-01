// Admin-only user directory reads (docs/ROADMAP.md Phase 9.2). Called only
// from Server Components under app/(protected)/admin/ — that route's
// layout.tsx already gates every request on requireAdmin-equivalent checks
// (isAdminUid) before any child page runs, so these functions don't repeat
// that check themselves (unlike Server Actions, a Server Component page
// can't be reached without its layout running first). Uses relative imports
// for adminApp, matching every other file in this directory (see cards.ts).
import type { UserRecord } from "firebase-admin/auth";

import { adminAuth, adminDb } from "../firebase/adminApp";
import { getUserModerationStatus, isEmailBlocked, isPhoneBlocked, type ModerationStatus } from "./moderation";
import { listChannelLinksForUid } from "./channelLinks";
import type { UserProfile } from "../../types/user";
import type { ChannelLinkSummary } from "../../types/channelLink";

const PAGE_SIZE = 25;

export interface UsersPage {
  users: UserProfile[];
  nextCursor: string | null;
}

// Cursor-based, not offset: a plain doc id (the previous page's last uid) is
// enough to seek Firestore's startAfter, because startAfter(DocumentSnapshot)
// resumes from that document's actual field values for whatever the query is
// ordered by — the caller never needs to know or pass the createdAt value
// itself. "Previous page" isn't implemented server-side; browser back covers
// it since each page is its own URL (?cursor=...).
export async function listUsersPage(cursor?: string): Promise<UsersPage> {
  let query = adminDb.collection("users").orderBy("createdAt", "desc").limit(PAGE_SIZE + 1);

  if (cursor) {
    const cursorSnap = await adminDb.collection("users").doc(cursor).get();
    if (cursorSnap.exists) query = query.startAfter(cursorSnap);
  }

  const snap = await query.get();
  const docs = snap.docs.slice(0, PAGE_SIZE);
  const lastDoc = docs.at(-1);
  const hasNext = snap.docs.length > PAGE_SIZE;

  return {
    users: docs.map((doc) => doc.data() as UserProfile),
    nextCursor: hasNext && lastDoc ? lastDoc.id : null,
  };
}

export async function findUserByUid(uid: string): Promise<UserProfile | null> {
  const snap = await adminDb.collection("users").doc(uid).get();
  return snap.exists ? (snap.data() as UserProfile) : null;
}

// adminAuth.getUserByEmail, not a Firestore query — the plan's explicit
// reason to prefer it (docs/ROADMAP.md Phase 9.2): Auth already indexes
// email uniquely, so this needs no new Firestore index and no denormalized
// email field on users/{uid} kept in sync.
export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    const record = await adminAuth.getUserByEmail(email);
    return findUserByUid(record.uid);
  } catch (error) {
    if (isAuthUserNotFoundError(error)) return null;
    throw error;
  }
}

function isAuthUserNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found";
}

// A users/{uid} profile doc can outlive its Auth account — e.g. a deletion
// that got partway through deleteUserAccount() before a transient failure
// (docs/DECISIONS.md #46's storage.bucket() bug was one such case). Without
// this guard, adminAuth.getUser(uid) throwing "auth/user-not-found" crashed
// this whole page instead of just showing that the account is in that state.
async function getAuthRecordSafe(uid: string): Promise<UserRecord | null> {
  try {
    return await adminAuth.getUser(uid);
  } catch (error) {
    if (isAuthUserNotFoundError(error)) return null;
    throw error;
  }
}

export interface AdminUserDetail {
  profile: UserProfile;
  authAccountExists: boolean;
  disabled: boolean;
  emailVerified: boolean;
  lastSignInAt: string | null;
  cardCount: number;
  listCount: number;
  moderation: ModerationStatus;
  emailBlocked: boolean;
  channelLinks: (ChannelLinkSummary & { phoneBlocked: boolean })[];
}

// Counts use Firestore's count() aggregation (billed as a small fixed number
// of reads regardless of match size, not one read per document) rather than
// fetching full card/list docs just to count them — see docs/DECISIONS.md
// ADR #42's "aggregation queries first" principle. Both filters are a single
// equality on ownerId, so neither needs a new composite index
// (docs/DATA_MODEL.md's existing indexes already cover single-field ownerId
// lookups).
export async function getUserDetail(uid: string): Promise<AdminUserDetail | null> {
  const profile = await findUserByUid(uid);
  if (!profile) return null;

  const [authRecord, cardCountSnap, listCountSnap, moderation, emailBlocked, links] = await Promise.all([
    getAuthRecordSafe(uid),
    adminDb.collection("cards").where("ownerId", "==", uid).count().get(),
    adminDb.collection("cardLists").where("ownerId", "==", uid).count().get(),
    getUserModerationStatus(uid),
    isEmailBlocked(profile.email),
    listChannelLinksForUid(uid),
  ]);

  const channelLinks = await Promise.all(
    links.map(async (link) => ({ ...link, phoneBlocked: await isPhoneBlocked(link.externalId) }))
  );

  return {
    profile,
    authAccountExists: authRecord !== null,
    disabled: authRecord?.disabled ?? false,
    emailVerified: authRecord?.emailVerified ?? false,
    lastSignInAt: authRecord?.metadata.lastSignInTime ?? null,
    cardCount: cardCountSnap.data().count,
    listCount: listCountSnap.data().count,
    moderation,
    emailBlocked,
    channelLinks,
  };
}
