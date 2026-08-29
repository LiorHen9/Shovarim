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

// `apphosting.yaml` ships the site key as the literal string "REPLACE_ME"
// until that Console registration happens. The original guard here tested
// `!siteKey`, which only catches an *empty* value — "REPLACE_ME" is truthy,
// so App Check initialized against a nonexistent reCAPTCHA key in production
// and took Google Sign-In down on mobile Safari (docs/DECISIONS.md ADR #27).
// Treat any obvious placeholder as "not configured yet".
const PLACEHOLDER_PATTERN = /replace|change[_-]?me|^todo$|^your[_-]/i;

// Real reCAPTCHA site keys (v3 and Enterprise web keys alike) start with
// "6L". This is only a warning, never a gate: a key we fail to recognize is
// still passed through, because silently disabling App Check on a legitimate
// key would be a worse failure than a noisy log line.
const EXPECTED_KEY_PREFIX = "6L";

// Exported for tests/unit/appCheckSiteKey.test.ts — this predicate is the
// exact thing that was wrong in production, so it is worth pinning down.
export function isConfiguredSiteKey(siteKey: string | undefined): siteKey is string {
  const trimmed = siteKey?.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_PATTERN.test(trimmed);
}

export function initAppCheck(app: FirebaseApp): void {
  if (typeof window === "undefined") return;

  const debug = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG === "true";
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  const configured = isConfiguredSiteKey(siteKey);

  if (debug) {
    // Registers a debug token instead of running real reCAPTCHA attestation —
    // for local dev/CI against emulators only. The SDK prints the generated
    // token to the console on first run; register it under Firebase Console
    // -> App Check -> Manage debug tokens if you ever need App Check enforced
    // against a real (non-emulator) backend from a debug build.
    (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;

    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(configured ? siteKey : "debug-mode-placeholder"),
      isTokenAutoRefreshEnabled: true,
    });
    return;
  }

  if (!configured) {
    // Console registration (see docs/DEPLOYMENT.md) hasn't happened yet in
    // this environment — skip rather than throw, so the app keeps working
    // with no App Check token attached until that manual step is done.
    //
    // Deliberately noisy: the previous version of this branch was silent,
    // which is why a broken key reached production unnoticed. Nothing here
    // is user-facing, so a console warning costs nothing.
    console.warn(
      "[app-check] NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY is unset or still a placeholder — App Check disabled. See docs/DEPLOYMENT.md."
    );
    return;
  }

  if (!siteKey.startsWith(EXPECTED_KEY_PREFIX)) {
    console.warn(
      `[app-check] site key does not start with "${EXPECTED_KEY_PREFIX}" — initializing anyway, but verify it against the reCAPTCHA admin console.`
    );
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
