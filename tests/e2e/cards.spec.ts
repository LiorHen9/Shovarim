import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

import { signInAsTestUser } from "./helpers/auth";

test("user can create a card and see it on the dashboard", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  const cardName = `כרטיס בדיקה ${randomUUID().slice(0, 8)}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await page.goto("/cards/new");
  await page.getByLabel("שם הכרטיס").fill(cardName);
  await page.getByLabel("יתרה התחלתית").fill("150");
  await page.getByRole("button", { name: "שמירה" }).click();

  // Two Firestore writes (default list + card) happen before the redirect,
  // so give navigation more room than the default 5s assertion timeout.
  await page.waitForURL(/\/cards\/(?!new$)[^/]+$/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: cardName })).toBeVisible();
  await expect(page.getByText(/150\.00/).first()).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("כרטיסים פעילים")).toBeVisible();
  await expect(page.getByText("1", { exact: true })).toBeVisible();
});
