import {
  onAuthStateChanged,
  signInWithPopup,
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

export async function signInWithProvider(providerId: AuthProviderId): Promise<User> {
  const provider = resolveProvider(providerId);
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
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
