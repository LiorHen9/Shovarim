import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

import { initAppCheck } from "./appCheck";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Connect to local emulators in development so no real Firebase project data
// is touched while iterating locally. See docs/ARCHITECTURE.md.
const useEmulators =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" &&
  typeof window !== "undefined";

if (useEmulators) {
  const g = globalThis as unknown as { __shovarimEmulatorsConnected?: boolean };
  if (!g.__shovarimEmulatorsConnected) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    g.__shovarimEmulatorsConnected = true;
  }
}

// Skipped entirely against emulators: App Check enforcement never applies to
// emulated Firestore/Storage/Auth, and the debug-token flow still makes a
// real network call to exchange the token — against the fake "demo-*"
// project emulators use, that call has nothing real to talk to and just adds
// startup latency for no benefit. See src/lib/firebase/appCheck.ts.
if (!useEmulators && typeof window !== "undefined") {
  const g = globalThis as unknown as { __shovarimAppCheckInitialized?: boolean };
  if (!g.__shovarimAppCheckInitialized) {
    initAppCheck(firebaseApp);
    g.__shovarimAppCheckInitialized = true;
  }
}
