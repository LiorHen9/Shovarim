import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

import { signInAsTestUser } from "./helpers/auth";

test("user can export their data as JSON", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  const cardName = `כרטיס ייצוא ${randomUUID().slice(0, 8)}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await page.goto("/cards/new");
  await page.getByLabel("שם הכרטיס").fill(cardName);
  await page.getByLabel("יתרה התחלתית").fill("80");
  await page.getByRole("button", { name: "שמירה" }).click();
  await page.waitForURL(/\/cards\/(?!new$)[^/]+$/, { timeout: 15000 });

  await page.goto("/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "ייצוא כל הנתונים שלי (JSON)" }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const exported = JSON.parse(await readFile(path!, "utf-8"));

  expect(exported.profile.uid).toBe(uid);
  expect(exported.cards).toHaveLength(1);
  expect(exported.cards[0].name).toBe(cardName);
  expect(exported.cards[0].currentBalance).toBe(80);
});
