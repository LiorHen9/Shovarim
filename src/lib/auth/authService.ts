import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";

import { auth } from "@/lib/firebase/client";
import { createGoogleProvider } from "@/lib/auth/googleProvider";
import type { AuthProviderId } from "@/lib/auth/providers";

// Thin wrapper around the Firebase Auth SDK so the rest of the app (hooks,
// components) never imports `firebase/auth` directly. Swapping or adding a
// provider — e.g. Apple — only touches this file and its provider module.
function resolveProvider(providerId: AuthProviderId) {
  switch (providerId) {
    case "google":
      return createGoogleProvider();
    case "apple":
      throw new Error("Apple Sign-In is not implemented yet. See docs/DECISIONS.md.");
  }
}

// Full-page redirect, not a popup: iOS Safari blocks `window.open` calls that
// aren't synchronous with the user gesture, which `signInWithPopup` violated
// once App Check's async token fetch sat in front of it (docs/DECISIONS.md
// ADR #27/#34). This call navigates away — it does not resolve with a user.
export async function signInWithProvider(providerId: AuthProviderId): Promise<void> {
  const provider = resolveProvider(providerId);
  await signInWithRedirect(auth, provider);
}

// Call on mount of the page that initiated the redirect. Resolves to the
// signed-in user if the app just returned from a completed redirect, or
// `null` if there was no pending redirect to resolve.
export async function completeRedirectSignIn(): Promise<User | null> {
  const credential = await getRedirectResult(auth);
  return credential?.user ?? null;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
