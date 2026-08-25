"use server";

import { cookies } from "next/headers";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/auth/session";
import type { AuthProviderId } from "@/lib/auth/providers";

// Called right after a successful client-side sign-in. Verifies the fresh ID
// token, mints a long-lived session cookie for SSR route protection
// (src/middleware.ts + app/(protected)/layout.tsx), and makes sure a
// users/{uid} profile document exists (first-login bootstrap).
export async function createSession(idToken: string): Promise<void> {
  const decoded = await adminAuth.verifyIdToken(idToken);

  // Firebase requires the ID token to have been issued within the last 5
  // minutes before minting a session cookie from it.
  const authTimeMs = decoded.auth_time * 1000;
  if (Date.now() - authTimeMs > 5 * 60 * 1000) {
    throw new Error("Recent sign-in required");
  }

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    maxAge: SESSION_MAX_AGE_MS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  await ensureUserProfile(decoded);
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

interface DecodedForProfile {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  firebase: { sign_in_provider: string };
}

async function ensureUserProfile(decoded: DecodedForProfile): Promise<void> {
  const userRef = adminDb.collection("users").doc(decoded.uid);
  const snap = await userRef.get();
  if (snap.exists) return;

  const providerId: AuthProviderId = decoded.firebase.sign_in_provider.startsWith("apple")
    ? "apple"
    : "google";

  await userRef.set({
    uid: decoded.uid,
    email: decoded.email ?? "",
    displayName: decoded.name ?? "",
    photoURL: decoded.picture ?? null,
    authProvider: providerId,
    createdAt: new Date(),
    locale: "he",
    currency: "ILS",
    notificationPrefs: {
      email: true,
      push: false,
      reminderDaysBefore: [30, 7, 1],
    },
    fcmTokens: [],
    deletionRequestedAt: null,
  });
}
