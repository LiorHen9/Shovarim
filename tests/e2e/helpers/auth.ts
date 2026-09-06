import type { Page } from "@playwright/test";

interface TestUser {
  uid: string;
  email?: string;
  name?: string;
}

// Drives the /e2e/sign-in shortcut (see that page for why) and waits for the
// post-sign-in redirect, leaving the browser with both a real session cookie
// and a real client-side Firebase Auth user — the same state a real Google
// sign-in produces.
export async function signInAsTestUser(page: Page, user: TestUser, next = "/dashboard"): Promise<void> {
  const params = new URLSearchParams({ uid: user.uid, next });
  if (user.email) params.set("email", user.email);
  if (user.name) params.set("name", user.name);

  await page.goto(`/e2e/sign-in?${params.toString()}`);
  await page.waitForURL(`**${next}`);

  // New users see the consent modal (ConsentBanner) on first protected page
  // load, same as a real first sign-in — dismiss it so it doesn't block
  // subsequent interactions in the test.
  //
  // Two things here are load-bearing, and both used to be wrong:
  //
  // 1. The timeout must be generous. useConsent() starts at "loading" and only flips to
  //    "needed" once the consents/{uid} onSnapshot lands, so for the fresh uid every
  //    test creates the dialog *always* appears — just not always quickly. The old 3s
  //    wait lost that race under parallel load, swallowed the timeout, and let the modal
  //    pop up mid-test, where its full-screen overlay silently intercepted every
  //    subsequent click until the test timed out.
  // 2. Clicking is not enough; the overlay has to be gone before we return. grantConsent()
  //    is a Firestore write and the dialog unmounts only on the resulting snapshot, so
  //    returning right after the click hands the test a page that is still covered.
  // 3. Detaching is not the same as durable. grantConsent() is a client Firestore
  //    write, and the dialog unmounts on Firestore's *locally* compensated
  //    snapshot — before the server has acked. Returning there let the caller
  //    navigate immediately, which tears down the page context and discards the
  //    still-pending write, so the very next protected page read the server,
  //    correctly found no consent, and popped the modal again mid-test. That is
  //    what made this helper's callers intermittently fail on a click that an
  //    invisible overlay had swallowed. Reloading forces a server-backed read:
  //    once the dialog does not come back on a fresh load, the consent is real.
  const consentDialog = page.getByRole("alertdialog");
  const consentButton = page.getByRole("button", { name: "מאשר/ת, המשך" });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Generous on the first pass for the reason in (1); short afterwards,
      // where absence is the expected answer and we only need to confirm it.
      await consentButton.waitFor({ state: "visible", timeout: attempt === 0 ? 15000 : 3000 });
    } catch {
      // Nothing showing on a freshly loaded page — consent is granted and stuck.
      return;
    }
    await consentButton.click();
    await consentDialog.waitFor({ state: "detached", timeout: 15000 });
    await page.reload();
  }
}
