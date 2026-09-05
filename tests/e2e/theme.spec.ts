import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

import { signInAsTestUser } from "./helpers/auth";

// Phase 6.4 (ADR #55). next-themes was a dependency and globals.css carried a complete
// `.dark` token set from the scaffold onward, but no provider was ever mounted — so this
// covers behaviour that existed only on paper until now.

test("the theme can be switched from the user menu and survives a reload", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  // system -> light
  await page.getByRole("button", { name: "תפריט משתמש" }).click();
  await page.getByRole("menuitem", { name: /ערכת נושא/ }).click();
  await expect(page.getByRole("menuitem", { name: "ערכת נושא: בהירה" })).toBeVisible();

  // light -> dark
  await page.getByRole("menuitem", { name: "ערכת נושא: בהירה" }).click();
  await expect(html).toHaveClass(/dark/);

  await page.keyboard.press("Escape");
  await page.reload();
  // next-themes persists to localStorage, so the choice has to outlive the navigation.
  await expect(html).toHaveClass(/dark/);
});

test("the system preference is respected when no choice has been made", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await expect(page.locator("html")).toHaveClass(/dark/);
  await context.close();
});
