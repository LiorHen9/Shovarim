import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

import { expectNoA11yViolations, expectNoA11yViolationsInDark } from "./helpers/a11y";
import { signInAsTestUser } from "./helpers/auth";

test("new user sees an empty dashboard with a call to add their first card", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await expect(page.getByRole("heading", { name: "שלום, בודק אוטומטי" })).toBeVisible();
  await expect(page.getByText("עדיין אין כרטיסים פעילים.")).toBeVisible();

  await page.getByRole("link", { name: "הוספת כרטיס ראשון" }).click();
  await expect(page).toHaveURL(/\/cards\/new/);
});

test("the signed-in dashboard has no WCAG 2.1 AA violations, in either theme", async ({
  page,
}) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });
  await expect(page.getByRole("heading", { name: "שלום, בודק אוטומטי" })).toBeVisible();

  await expectNoA11yViolations(page);
  // The dark tokens in globals.css became reachable only when Phase 6.4 mounted the
  // ThemeProvider, so they get their own pass rather than inheriting the light result.
  await expectNoA11yViolationsInDark(page);
});
