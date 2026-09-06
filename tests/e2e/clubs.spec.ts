import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

import { signInAsTestUser } from "./helpers/auth";

type TestPage = import("@playwright/test").Page;

// The catalog is Admin-SDK-only (ADR #61), so it cannot be created through the
// UI the way cards are. Seeding it is idempotent and shared across tests.
async function seedCatalog(page: TestPage) {
  await page.goto("/e2e/seed-clubs");
  await expect(page.getByRole("status")).toHaveText("seeded");
}

// Waiting on the h1 rather than the checkboxes: the grid renders a skeleton
// first, and asserting straight against a checkbox would race the catalog load.
async function gotoClubs(page: TestPage) {
  await page.goto("/clubs");
  await expect(page.getByRole("heading", { name: "מועדוני חברות", level: 1 })).toBeVisible();
}

// Ticks a card and does not return until the write has actually landed.
//
// The grid ticks optimistically and disables the checkbox until its write is
// acked, so re-enabling is the signal that the write reached the server rather
// than merely Firestore's local cache. Waiting for it matters because
// page.goto() is a hard navigation: it tears down the page context and discards
// any write still in the queue, and no amount of retrying the *read* afterwards
// can bring that write back. (A real user navigates client-side, which keeps
// the queue alive — this is harsher than anything the app does.)
async function toggleCard(page: TestPage, clubName: string, cardName: string, check: boolean) {
  const box = page.getByRole("group", { name: clubName }).getByRole("checkbox", { name: cardName });
  if (check) await box.check();
  else await box.uncheck();
  await expect(box).toBeEnabled();
}

async function expectPersisted(
  page: TestPage,
  clubName: string,
  expectations: Array<[cardName: string, held: boolean]>
) {
  await gotoClubs(page);
  const club = page.getByRole("group", { name: clubName });
  for (const [cardName, held] of expectations) {
    const box = club.getByRole("checkbox", { name: cardName });
    if (held) await expect(box).toBeChecked();
    else await expect(box).not.toBeChecked();
  }
}

test("a user can mark one card tier without marking its sibling", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });
  await seedCatalog(page);

  await gotoClubs(page);
  const club = page.getByRole("group", { name: "מועדון בדיקה רב-כרטיסים" });
  const vip = club.getByRole("checkbox", { name: "VIP" });
  const regular = club.getByRole("checkbox", { name: "רגיל" });

  // Proof of hydration before clicking: the grid renders a skeleton first.
  await expect(vip).toBeVisible();
  await expect(vip).not.toBeChecked();

  await toggleCard(page, "מועדון בדיקה רב-כרטיסים", "VIP", true);
  await expect(page.getByText("נבחרו 1 כרטיסים")).toBeVisible();

  // The whole reason the model has two levels: tiers under one club are
  // independent holdings, not one flag on the club.
  await expect(regular).not.toBeChecked();

  await expectPersisted(page, "מועדון בדיקה רב-כרטיסים", [
    ["VIP", true],
    ["רגיל", false],
  ]);
});

test("unmarking a card removes it", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });
  await seedCatalog(page);

  await gotoClubs(page);
  const single = page
    .getByRole("group", { name: "מועדון בדיקה חד-כרטיסי" })
    .getByRole("checkbox", { name: "רגיל" });

  await toggleCard(page, "מועדון בדיקה חד-כרטיסי", "רגיל", true);
  await expect(single).toBeChecked();

  await toggleCard(page, "מועדון בדיקה חד-כרטיסי", "רגיל", false);
  await expect(single).not.toBeChecked();
  await expect(page.getByText("לא נבחרו כרטיסים")).toBeVisible();

  await expectPersisted(page, "מועדון בדיקה חד-כרטיסי", [["רגיל", false]]);
});

// A new personal-data collection is only actually covered by the right to
// access once it is in the file the user downloads — and the export resolves
// the catalog so the file names the club and tier rather than two slugs.
test("marked club cards appear in the data export, with readable names", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });
  await seedCatalog(page);

  await gotoClubs(page);
  // The export reads the server, so the tick has to have reached it first.
  await toggleCard(page, "מועדון בדיקה רב-כרטיסים", "VIP", true);

  await page.goto("/settings");
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "ייצוא כל הנתונים שלי (JSON)" }).click();
  const download = await downloadPromise;

  const exported = JSON.parse(await readFile((await download.path())!, "utf-8"));
  expect(exported.clubMemberships).toHaveLength(1);
  expect(exported.clubMemberships[0]).toMatchObject({
    clubCardId: "e2e-multi-vip",
    clubId: "e2e-multi",
    clubName: "מועדון בדיקה רב-כרטיסים",
    cardName: "VIP",
  });
});

// The catalog carries a logo and a site per club, and both are optional. The
// fixture has one club with each and one with neither, so this covers all four
// states in a single load — including the one that only shows up in production:
// a logoUrl that points at a file nobody committed still renders an <img>, so
// the assertion is on naturalWidth, not on the element being there.
test("a club shows its logo and site link only when the catalog carries them", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });
  await seedCatalog(page);
  await gotoClubs(page);

  const withAssets = page.getByRole("group", { name: "מועדון בדיקה רב-כרטיסים" });
  const logo = withAssets.locator("img");
  // Decorative on purpose: the club name is text right beside it, so a described
  // logo would make a screen reader announce the club twice.
  await expect(logo).toHaveAttribute("alt", "");
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(
    withAssets.getByRole("link", { name: "לאתר של מועדון בדיקה רב-כרטיסים" })
  ).toBeVisible();

  const withNeither = page.getByRole("group", { name: "מועדון בדיקה חד-כרטיסי" });
  await expect(withNeither.locator("img")).toHaveCount(0);
  await expect(withNeither.getByRole("link")).toHaveCount(0);
});

test("a signed-out visitor is redirected away from /clubs", async ({ page }) => {
  // Deliberately a bare goto, not gotoClubs: the whole point is that /clubs
  // never renders for this visitor.
  await page.goto("/clubs");
  await expect(page).toHaveURL(/\/\?next=%2Fclubs$/);
});
