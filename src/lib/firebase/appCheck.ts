import type { FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Abuse/spam protection (docs/SECURITY.md threat #4): attaches an App Check
// token to every Firestore/Storage request so only this actual app instance
// (not a scripted client hitting the REST API directly) can write. Enforcing
// it is a Firebase Console per-service toggle, not something expressed in
// firestore.rules/storage.rules — see docs/DEPLOYMENT.md for the one-time
// Console setup (register the web app with reCAPTCHA v3, flip "Enforce")
// that has to happen before this actually blocks anything; until then the
// SDK just attaches a token that nothing checks yet.
export function initAppCheck(app: FirebaseApp): void {
  if (typeof window === "undefined") return;

  const debug = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG === "true";
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;

  if (debug) {
    // Registers a debug token instead of running real reCAPTCHA attestation —
    // for local dev/CI against emulators only. The SDK prints the generated
    // token to the console on first run; register it under Firebase Console
    // -> App Check -> Manage debug tokens if you ever need App Check enforced
    // against a real (non-emulator) backend from a debug build.
    (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;
  } else if (!siteKey) {
    // Console registration (see docs/DEPLOYMENT.md) hasn't happened yet in
    // this environment — skip rather than throw, so the app keeps working
    // with no App Check token attached until that manual step is done.
    return;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey || "debug-mode-placeholder"),
    isTokenAutoRefreshEnabled: true,
  });
}
