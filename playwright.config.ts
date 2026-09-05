import { defineConfig, devices } from "@playwright/test";

// E2E tests always run against the Firebase Emulators (see docs/ARCHITECTURE.md
// and docs/DECISIONS.md #18) — never against a real project. .env.local already
// sets these locally; CI sets the same values at the job level (see .github/workflows/ci.yml).
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // CI runs against the production build, not `next dev`. This is not a preference:
    // once a route has a loading.tsx, Next renders it inside a Suspense boundary and
    // streams the response, and in dev mode that stream keeps the document's `load`
    // event pending long enough to time out every navigation to /settings. The exact
    // same tests pass against `next start` (verified when Phase 6.2 added the loading
    // boundaries), which is also what the Next offline guide says — "Dev mode is not a
    // reliable reference for offline behavior".
    //
    // This costs no extra build time: .github/workflows/ci.yml already runs `npm run
    // build` before Playwright, and NEXT_PUBLIC_* values are inlined at build time, so
    // the emulator wiring in src/lib/firebase/client.ts behaves identically.
    //
    // Locally the default stays `next dev` for fast iteration — but a failure that
    // reproduces only locally should be re-checked against `npm run build && npm run
    // start` before being believed.
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
