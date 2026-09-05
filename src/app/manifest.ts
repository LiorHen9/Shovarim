import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest; Next emits the <link rel="manifest"> tag itself.
//
// A TypeScript route rather than a static public/manifest.webmanifest on purpose
// (ADR #51): `npm run typecheck` catches a typo in `purpose` or `display`, which would
// otherwise silently downgrade the Android install to a browser shortcut. It also lives
// next to layout.tsx, whose `viewport`/`metadata` exports it has to stay consistent with.
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Pinned explicitly. With no `id`, the browser derives it from `start_url`, so any
    // future change to start_url would read as a *different* app and leave a second icon
    // on the user's home screen.
    id: "/",
    name: "שוברים — ניהול שוברים וכרטיסי מתנה",
    short_name: "שוברים",
    description: "ניהול שוברים וכרטיסי מתנה",
    lang: "he",
    dir: "rtl",
    // An installed app is by definition a returning user, and the __session cookie lasts
    // 14 days. Launching to "/" would show the marketing page and sign-in buttons inside
    // the app window, which reads as broken. When the cookie is missing or expired,
    // src/proxy.ts already redirects here to /?next=/dashboard — the existing, tested
    // sign-in-then-continue flow, so this needs no new code.
    start_url: "/dashboard",
    // Must include /__/auth/** so signInWithRedirect's round-trip stays inside the
    // installed window instead of bouncing out to the system browser (ADR #34/#35).
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Derived from the design tokens in src/app/globals.css, not eyeballed:
    // oklch(1 0 0) -> #ffffff. The manifest carries a single value; the theme-aware pair
    // lives in the `viewport` export in layout.tsx.
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["finance", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // All three are real routes and all three are in src/proxy.ts's matcher, so a
    // long-press launch while signed out redirects to /?next=… correctly.
    shortcuts: [
      { name: "כרטיס חדש", url: "/cards/new" },
      { name: "הכרטיסים שלי", url: "/cards" },
      { name: "צ'אט", url: "/chat" },
    ],
  };
}
