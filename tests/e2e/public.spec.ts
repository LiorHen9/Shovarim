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
