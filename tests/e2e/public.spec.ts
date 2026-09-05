import { test, expect } from "@playwright/test";

test("landing page shows sign-in options", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "שוברים" })).toBeVisible();
  await expect(page.getByRole("button", { name: "המשך עם Google" })).toBeVisible();
});

// The redirect overlay (issue #47) is gated on a pending-provider flag left in
// sessionStorage by `handleSignIn`. A visitor who never started a sign-in has
// no such flag, so the landing page must stay unblurred and interactive — the
// regression to guard against is the overlay firing for everyone.
test("landing page shows no redirect overlay for a plain visitor", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "המשך עם Google" })).toBeEnabled();
  await expect(page.getByTestId("redirect-sign-in-overlay")).toHaveCount(0);
});

test("unauthenticated user hitting a protected route is redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/\?next=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: "שוברים" })).toBeVisible();
});

test("terms and privacy pages render", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "תנאי שימוש" })).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "מדיניות פרטיות" })).toBeVisible();
});

// Before Phase 6.2 an unknown path rendered Next's default English, LTR error page.
// The smoke test in docs/DEPLOYMENT.md recorded "GET /nonexistent-route → 404 תקין",
// which was true about the status code and wrong about what the visitor actually saw.
test("an unknown path renders the Hebrew 404 page, not Next's default", async ({ page }) => {
  const response = await page.goto("/nonexistent-route");
  expect(response?.status()).toBe(404);

  await expect(page.getByRole("heading", { name: "הדף לא נמצא" })).toBeVisible();
  await expect(page.getByRole("link", { name: "חזרה לדף הבית" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
