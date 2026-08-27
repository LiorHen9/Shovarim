import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

import { signInAsTestUser } from "./helpers/auth";

test("new user sees an empty dashboard with a call to add their first card", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await expect(page.getByRole("heading", { name: "שלום, בודק אוטומטי" })).toBeVisible();
  await expect(page.getByText("עדיין אין כרטיסים פעילים.")).toBeVisible();

  await page.getByRole("link", { name: "הוספת כרטיס ראשון" }).click();
  await expect(page).toHaveURL(/\/cards\/new/);
});
