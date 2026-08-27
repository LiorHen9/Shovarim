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
  const consentButton = page.getByRole("button", { name: "מאשר/ת, המשך" });
  try {
    await consentButton.waitFor({ state: "visible", timeout: 3000 });
    await consentButton.click();
  } catch {
    // useConsent() already resolved to "granted"/not-needed — nothing to dismiss.
  }
}
