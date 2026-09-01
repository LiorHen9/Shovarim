// Self-contained Admin SDK bootstrap for functions/ — this package can't
// import from src/lib/firebase/adminApp.ts (functions/tsconfig.json's
// rootDir: "src" only allows files under functions/src, see
// docs/DECISIONS.md #24). initializeApp() with no args picks up the Cloud
// Functions runtime's default credentials in production, and auto-detects
// the emulator hosts (FIRESTORE_EMULATOR_HOST etc.) set by
// `firebase emulators:start` locally.
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// GCLOUD_PROJECT/FIREBASE_CONFIG are set automatically by the real Cloud
// Functions runtime and by the Functions emulator when it spawns a triggered
// function — but not when this module is imported directly by
// scripts/sweep-account-deletions.ts (a plain tsx process, see
// docs/DECISIONS.md #24), so fall back to the same env vars .env.local
// already defines for the emulator.
const projectId = process.env.GCLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
// STORAGE_BUCKET comes from functions/.env.<project-id> (Firebase Functions
// Gen 2's own env-file convention — bundled into the deploy) and is the only
// reliable source in the real Cloud Functions runtime: unlike GCLOUD_PROJECT,
// nothing sets a bucket name automatically there. NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
// is App Hosting/emulator-only — apphosting.yaml only reaches the Next.js
// backend, never Cloud Functions, which is a separate compute environment
// (see docs/DECISIONS.md #46: storage.bucket() threw "Bucket name not
// specified" in production because this fell through to undefined).
const storageBucket = process.env.STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const app = getApps()[0] ?? initializeApp({ projectId, storageBucket });

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
