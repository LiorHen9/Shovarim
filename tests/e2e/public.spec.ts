import { test, expect } from "@playwright/test";

test("landing page shows sign-in options", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "שוברים" })).toBeVisible();
  await expect(page.getByRole("button", { name: "המשך עם Google" })).toBeVisible();
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
