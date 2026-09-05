import type { NextConfig } from "next";

// Transparently proxies Firebase Auth's sign-in helper (the `/__/auth/**`
// handler + iframe, and `/__/firebase/init.json`) through this app's own
// domain instead of `<project>.firebaseapp.com`. Required so `authDomain`
// (see docs/DECISIONS.md ADR #35) can point at the app's own domain — Safari
// blocks the cross-site iframe storage access that `getRedirectResult`
// depends on when `authDomain` differs from the app's domain, which silently
// broke sign-in on Safari even after switching to signInWithRedirect (ADR
// #34). Must be a rewrite (server-side proxy), not a redirect — Firebase's
// own guidance is explicit that the browser must not see the destination
// domain: https://firebase.google.com/docs/auth/web/redirect-best-practices
const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const nextConfig: NextConfig = {
  experimental: {
    // Offline connectivity detection, plus automatic retry of navigation, prefetch and
    // Server Action requests that were blocked by a dead network. Exposes the
    // `useOffline` hook from `next/offline`, which returns false without this flag.
    //
    // Chosen over a service worker (ADR #53/#55): it is a better signal than
    // navigator.onLine — it also trips on a failed framework fetch, catching a captive
    // portal where the browser still reports online — and it carries none of a service
    // worker's rollback risk.
    //
    // The retry is safe for this app's non-idempotent Server Actions: Next only replays
    // when the `fetch()` itself rejects, which means the request never reached the
    // server, so there is no side effect to duplicate. Aborts and timeouts are excluded.
    useOffline: true,
  },
  async rewrites() {
    if (!firebaseProjectId) return [];
    const authHelperOrigin = `https://${firebaseProjectId}.firebaseapp.com`;
    return [
      { source: "/__/auth/:path*", destination: `${authHelperOrigin}/__/auth/:path*` },
      {
        source: "/__/firebase/init.json",
        destination: `${authHelperOrigin}/__/firebase/init.json`,
      },
    ];
  },
};

export default nextConfig;
