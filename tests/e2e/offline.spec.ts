import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

import { signInAsTestUser } from "./helpers/auth";

// Phase 6.3 (ADR #53). These assertions are only meaningful against a production build —
// see the comment in playwright.config.ts, and the Next offline guide's own warning that
// "Dev mode is not a reliable reference for offline behavior". CI runs `next start`.

test("the offline banner appears when connectivity drops and clears when it returns", async ({
  page,
  context,
}) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  const banner = page.getByTestId("offline-banner");
  await expect(banner).toBeHidden();

  await context.setOffline(true);
  // Either signal is a correct reason to show the bar: useOffline() flips on the
  // browser's offline event, and Firestore's listener falls back to its local cache.
  await expect(banner).toBeVisible();

  await context.setOffline(false);
  await expect(banner).toBeHidden();
});

test("the offline banner is announced to assistive tech rather than shown as a toast", async ({
  page,
  context,
}) => {
  // Connectivity is a state, not an event. A toast would auto-dismiss and a flaky mobile
  // network would produce a stream of them — so this must stay a live region.
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await context.setOffline(true);
  const banner = page.getByTestId("offline-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute("role", "status");
  await expect(banner).toHaveAttribute("aria-live", "polite");

  await context.setOffline(false);
});

test("the public landing page has no connectivity banner", async ({ page, context }) => {
  // The banner is mounted in (protected)/layout.tsx, not the root layout: the public
  // pages are static, so a connectivity bar there would be noise.
  await page.goto("/");
  await context.setOffline(true);
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);
  await context.setOffline(false);
});
