import "server-only";

import { cookies } from "next/headers";

import { adminAuth } from "@/lib/firebase/admin";

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

export async function requireUid(): Promise<string> {
  const uid = await getSessionUid();
  if (!uid) throw new Error("Not authenticated");
  return uid;
}
