import { randomUUID } from "node:crypto";
import path from "node:path";
import { test, expect } from "@playwright/test";

import { signInAsTestUser } from "./helpers/auth";

type TestPage = import("@playwright/test").Page;
type TestLocator = import("@playwright/test").Locator;

// The first E2E coverage of /admin. adminRoles is Admin-SDK-only by design —
// there is no UI that grants admin, see scripts/grant-admin.ts — so a test gets
// there through the emulator-guarded /e2e/grant-admin page, same shape as
// /e2e/sign-in.
async function signInAsAdmin(page: TestPage): Promise<string> {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "אדמין בדיקה" });
  await page.goto(`/e2e/grant-admin?uid=${uid}`);
  // Generous: this is a Server Action round-trip on a cold route, and the
  // default 5s lost that race often enough to matter.
  await expect(page.getByRole("status")).toHaveText("granted", { timeout: 20_000 });
  return uid;
}

async function seedCatalog(page: TestPage) {
  await page.goto("/e2e/seed-clubs");
  await expect(page.getByRole("status")).toHaveText("seeded", { timeout: 20_000 });
}

async function gotoAdminClubs(page: TestPage) {
  await page.goto("/admin/clubs");
  await expect(page.getByRole("heading", { name: "ניהול מועדונים", level: 1 })).toBeVisible();
}

// Located through the club's own <h2> rather than by text, so a club whose
// description happens to contain another club's name cannot match.
function clubRow(page: TestPage, clubName: string): TestLocator {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: clubName, level: 2 }) });
}

test("a signed-in non-admin is redirected away from the club admin", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await page.goto("/admin/clubs");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("an admin can create a club with a tier, publish it, and delete it again", async ({ page }) => {
  await signInAsAdmin(page);
  await gotoAdminClubs(page);

  // A per-run slug: the emulator's catalog is shared state across runs and this
  // test writes a real row into it.
  const slug = `e2e-new-${randomUUID().slice(0, 8)}`;
  const clubName = `מועדון שנוצר בפאנל ${slug}`;

  await page.getByRole("button", { name: "מועדון חדש" }).click();
  await page.getByLabel("מזהה").fill(slug);
  await page.getByLabel("שם").fill(clubName);
  await page.getByLabel("אתר המועדון").fill("https://example.com");
  await page.getByRole("button", { name: "שמירה" }).click();

  const row = clubRow(page, clubName);
  await expect(row).toBeVisible();
  // A club with no tiers is deliberately invisible to members (useClubCatalog
  // drops it), and the panel says so rather than letting it look finished.
  await expect(row.getByText("אין כרטיסים", { exact: false })).toBeVisible();

  await row.getByRole("button", { name: `הוספת כרטיס ל${clubName}` }).click();
  await page.getByLabel("מזהה").fill("gold");
  await page.getByLabel("שם הדרג").fill("זהב");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(row.getByText("אין מחזיקים")).toBeVisible();

  // The point of the whole panel: a catalog edit reaches members with no deploy
  // and no seed script.
  await page.goto("/clubs");
  await expect(
    page.getByRole("group", { name: clubName }).getByRole("checkbox", { name: "זהב" })
  ).toBeVisible();

  // Deleting is only offered while nobody holds the tier, which is exactly the
  // state here — and it leaves the shared emulator catalog as it was found.
  await gotoAdminClubs(page);
  await page.getByRole("button", { name: `מחיקת ${clubName}` }).click();
  // Deleting a club is the one action here behind a confirmation.
  const confirm = page.getByRole("dialog");
  await expect(confirm.getByText("אינה ניתנת לביטול", { exact: false })).toBeVisible();
  await confirm.getByRole("button", { name: "מחיקה" }).click();
  await expect(clubRow(page, clubName)).toHaveCount(0);

  await page.goto("/clubs");
  await expect(page.getByRole("group", { name: clubName })).toHaveCount(0);
});

test("a tier that users hold cannot be deleted", async ({ page }) => {
  await signInAsAdmin(page);
  await seedCatalog(page);

  // Mark a tier as this user, then look at the same tier as the admin — the
  // count the panel shows is what gates the delete button.
  await page.goto("/clubs");
  const box = page
    .getByRole("group", { name: "מועדון בדיקה רב-כרטיסים" })
    .getByRole("checkbox", { name: "VIP" });
  await box.check();
  // Re-enabling means the write was acked by the server rather than merely
  // queued; /admin/clubs counts server-side. See the note in clubs.spec.ts.
  await expect(box).toBeEnabled();

  await gotoAdminClubs(page);
  const tierRow = clubRow(page, "מועדון בדיקה רב-כרטיסים")
    .getByRole("listitem")
    .filter({ hasText: "VIP" });

  // Not an exact number: clubMemberships accumulate across runs in a shared
  // emulator, and the invariant under test is "someone holds it", not "one
  // person does".
  await expect(tierRow.getByText("אין מחזיקים")).toHaveCount(0);
  await expect(tierRow.getByText(/\d+ מחזיקים/)).toBeVisible();
  await expect(
    tierRow.getByRole("button", { name: "מחיקת הכרטיס VIP במועדון בדיקה רב-כרטיסים" })
  ).toBeDisabled();
});

test("an admin can upload a club logo", async ({ page }) => {
  await signInAsAdmin(page);
  await seedCatalog(page);
  await gotoAdminClubs(page);

  const row = clubRow(page, "מועדון בדיקה חד-כרטיסי");

  await row
    .getByLabel("העלאת לוגו עבור מועדון בדיקה חד-כרטיסי")
    .setInputFiles(path.join(process.cwd(), "public", "clubs", "tov.png"));

  const logo = row.locator("img");
  await expect(logo).toBeVisible();
  // A Storage download URL, not a /clubs/ path: the bytes went through the
  // Server Action and the Admin SDK, which is the only writer clubLogos/ has.
  await expect(logo).toHaveAttribute("src", /\/v0\/b\/.*\/o\/clubLogos%2F.*token=/);
});
