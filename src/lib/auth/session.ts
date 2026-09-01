import "server-only";

import { cookies } from "next/headers";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ActionError } from "@/lib/actions/errors";

// "__session" is the one cookie name Firebase Hosting's CDN forwards to
// backends, so we standardize on it now even before Hosting is wired up
// (see docs/DECISIONS.md #5).
export const SESSION_COOKIE_NAME = "__session";
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days (Admin SDK max)

export async function getSessionUid(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

// ActionError, not a plain Error: an expired or missing session cookie is an
// *expected* failure (ADR #18), and every Server Action funnels this through
// toActionResult. Thrown as a plain Error it escaped that check, so a session
// that expired while the tab sat open answered 500 with a redacted message
// instead of telling the user to sign in again. src/proxy.ts only redirects on
// a missing cookie — it never inspects one that is present but stale, so this
// is the only place that failure surfaces. The /api/chat handler catches this
// separately and answers 401 (see that route).
export async function requireUid(): Promise<string> {
  const uid = await getSessionUid();
  if (!uid) throw new ActionError("ההתחברות פגה, יש להתחבר מחדש");
  return uid;
}

// docs/DECISIONS.md ADR #42: admin status lives in adminRoles/{uid}, not a
// custom claim — exists() gives an immediate answer with no token-refresh
// propagation delay, the same get()-based pattern firestore.rules already
// uses for list-sharing (isAcceptedListMember). A boolean check (rather than
// folding this into requireAdmin below) so page components like
// app/(protected)/admin/layout.tsx can redirect cleanly instead of hitting an
// error boundary.
export async function isAdminUid(uid: string): Promise<boolean> {
  const roleDoc = await adminDb.doc(`adminRoles/${uid}`).get();
  return roleDoc.exists;
}

// ActionError, not a plain Error — same ADR #18 reasoning as requireUid:
// "not an admin" is an expected condition every admin Server Action should
// surface as a value via toActionResult, not a redacted 500.
export async function requireAdmin(): Promise<string> {
  const uid = await requireUid();
  if (!(await isAdminUid(uid))) throw new ActionError("אין הרשאת ניהול");
  return uid;
}
