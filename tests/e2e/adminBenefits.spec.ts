import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

import { signInAsTestUser } from "./helpers/auth";

type TestPage = import("@playwright/test").Page;

// Same admin bootstrap as adminClubs.spec.ts: adminRoles is Admin-SDK-only by
// design, so a test gets there through the emulator-guarded /e2e/grant-admin
// page.
async function signInAsAdmin(page: TestPage): Promise<string> {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "אדמין בדיקה" });
  await page.goto(`/e2e/grant-admin?uid=${uid}`);
  await expect(page.getByRole("status")).toHaveText("granted", { timeout: 20_000 });
  return uid;
}

// Deliberately no test that actually runs a scrape. It would reach four live
// third-party sites from CI on every push — slow, rude, and red whenever
// somebody else's site has a bad morning. The scrapers are covered by
// tests/unit/ against real captured payloads, and the overwrite behaviour by
// tests/unit/benefitOverwrite.test.ts. What is left for E2E is what only E2E
// can see: that the page renders, is gated, and reports honestly.

test("a signed-in non-admin is redirected away from the benefits admin", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await page.goto("/admin/benefits");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("the benefits panel lists every club and says why the closed ones cannot be scraped", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/e2e/seed-clubs");
  await expect(page.getByRole("status")).toHaveText("seeded", { timeout: 20_000 });

  await page.goto("/admin/benefits");
  await expect(page.getByRole("heading", { name: "הטבות מועדונים", level: 1 })).toBeVisible();

  // The table is the whole page, and it must include clubs that cannot be
  // scraped: one silently missing would look exactly like one whose scraper
  // broke.
  const table = page.getByRole("table");
  await expect(table).toBeVisible();

  // A club with no run yet says so rather than showing a blank cell.
  await expect(table.getByText("טרם רץ").first()).toBeVisible();

  // "הרץ הכל עכשיו" is always offered; the per-club button only appears for a
  // club that actually has an adapter.
  await expect(page.getByRole("button", { name: "הרץ הכל עכשיו" })).toBeEnabled();
});

test("the extraction cap is editable on a club and survives a reload", async ({ page }) => {
  await signInAsAdmin(page);

  const slug = `e2e-limit-${randomUUID().slice(0, 8)}`;
  const clubName = `מועדון תקרה ${slug}`;

  await page.goto("/admin/clubs");
  await expect(page.getByRole("heading", { name: "ניהול מועדונים", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "מועדון חדש" }).click();
  await page.getByLabel("מזהה").fill(slug);
  await page.getByLabel("שם").fill(clubName);
  // The cap defaults to 50 on a new club, which is the value the scraper
  // substitutes for a club that predates the field.
  await expect(page.getByLabel("מקסימום הטבות")).toHaveValue("50");
  await page.getByLabel("מקסימום הטבות").fill("10");
  await page.getByRole("button", { name: "שמירה" }).click();

  const row = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: clubName, level: 2 }) });
  // Generous for the same reason signInAsAdmin is: this is a Server Action
  // round-trip on a route the dev server may still be compiling, and the
  // default 5s loses that race often enough to matter.
  await expect(row).toBeVisible({ timeout: 20_000 });

  // Reopening the form is what proves the value was stored rather than merely
  // accepted by the dialog.
  await page.reload();
  await row.getByRole("button", { name: `עריכת ${clubName}` }).click();
  await expect(page.getByLabel("מקסימום הטבות")).toHaveValue("10");

  // 0 is a legitimate value meaning "no cap" — the case a truthiness check
  // would silently turn back into 50.
  await page.getByLabel("מקסימום הטבות").fill("0");
  await page.getByRole("button", { name: "שמירה" }).click();
  // The dialog closes only once the Server Action has returned. Reloading
  // straight after the click races the in-flight request and cancels it —
  // which is what made this assertion read back the previous value.
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 20_000 });
  await page.reload();
  await row.getByRole("button", { name: `עריכת ${clubName}` }).click();
  await expect(page.getByLabel("מקסימום הטבות")).toHaveValue("0");
  await page.keyboard.press("Escape");

  // Leave the shared emulator catalog as it was found.
  await page.getByRole("button", { name: `מחיקת ${clubName}` }).click();
  const confirm = page.getByRole("dialog");
  await confirm.getByRole("button", { name: "מחיקה" }).click();
  await expect(
    page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: clubName, level: 2 }) })
  ).toHaveCount(0, { timeout: 20_000 });
});
