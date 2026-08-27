"use server";

import { adminAuth } from "@/lib/firebase/admin";

// Playwright-only helper: mints a Firebase custom token for a given uid so
// E2E tests can sign in without driving the real Google OAuth popup (which
// automated browsers can't do — Google blocks it). Hard-guarded to the
// emulator so this can never mint a token against a real project.
// See docs/DECISIONS.md #18 and src/app/(public)/e2e/sign-in/page.tsx.
export async function mintTestCustomToken(
  uid: string,
  claims?: { email?: string; name?: string }
): Promise<string> {
  if (process.env.FIREBASE_USE_EMULATOR !== "true") {
    throw new Error("mintTestCustomToken is only available against the Firebase emulator");
  }

  try {
    await adminAuth.getUser(uid);
  } catch {
    await adminAuth.createUser({
      uid,
      email: claims?.email,
      displayName: claims?.name,
    });
  }

  return adminAuth.createCustomToken(uid);
}
