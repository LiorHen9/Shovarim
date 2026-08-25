import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// No "server-only" import here on purpose: this module is also used by
// scripts/ (plain Node/tsx, outside Next.js's bundler) where "server-only"
// unconditionally throws. Next.js code must import `./admin.ts` instead,
// which re-exports this with the "server-only" guard in front.

function buildAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const useEmulators = process.env.FIREBASE_USE_EMULATOR === "true";
  if (useEmulators) {
    // The Admin SDK auto-detects the emulator hosts from these env vars
    // (set by `firebase emulators:start` / .env.local), so no credentials
    // are required in local development.
    return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, " +
        "FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY (see .env.example), " +
        "or FIREBASE_USE_EMULATOR=true for local development."
    );
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const adminApp = buildAdminApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
