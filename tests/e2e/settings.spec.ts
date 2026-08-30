import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect, type Locator, type Page } from "@playwright/test";

import { signInAsTestUser } from "./helpers/auth";

// Same defaults as .env.local; `firebase emulators:exec` injects the host into
// CI's environment (see .github/workflows/ci.yml).
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-shovarim";

// The UI (issue #39) no longer shows the raw code — only a wa.me link with it
// pre-filled as the message text — so tests recover it from the link's href.
async function extractLinkCodeFromRegion(codeRegion: Locator): Promise<string> {
  const href = await codeRegion.getByRole("link", { name: "פתיחת WhatsApp" }).getAttribute("href");
  const code = new URL(href!).searchParams.get("text");
  expect(code).toBeTruthy();
  return code!;
}

async function createCardThroughUi(page: Page, name: string, balance: string): Promise<string> {
  await page.goto("/cards/new");
  await page.getByLabel("שם הכרטיס").fill(name);
  await page.getByLabel("יתרה התחלתית").fill(balance);
  await page.getByRole("button", { name: "שמירה" }).click();
  await page.waitForURL(/\/cards\/(?!new$)[^/]+$/, { timeout: 15000 });
  return page.url().split("/").pop()!;
}

test("user can export their data as JSON", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  const cardName = `כרטיס ייצוא ${randomUUID().slice(0, 8)}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await createCardThroughUi(page, cardName, "80");

  await page.goto("/settings");
  // Proof that /settings hydrated: this text only renders once
  // ChannelLinksSection's effect has run and its Server Action resolved.
  // Clicking before that lands on a button with no handler attached yet, which
  // fails as a silent timeout further down.
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible();
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

// Regression for the production 500 of 2026-08-30 (docs/DECISIONS.md ADR #32).
// A card document written before cvv/barcodeOrCode existed has no such keys at
// all — not `null`, absent — and `doc.data() as GiftCard` typed the resulting
// `undefined` as `string | null`, so decryptSensitiveField ran `undefined
// .split(":")`. The TypeError is not an ActionError, so it escaped
// toActionResult and the whole export answered 500. The existing test above
// cannot catch this: the create form always writes both keys.
test("export tolerates a card document with no cvv/barcodeOrCode fields", async ({ page, request }) => {
  const uid = `e2e-${randomUUID()}`;
  const cardName = `כרטיס ישן ${randomUUID().slice(0, 8)}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  const cardId = await createCardThroughUi(page, cardName, "50");

  // Delete the two keys outright. Naming a field in updateMask while omitting
  // it from the body is Firestore's REST "remove this field", and "Bearer
  // owner" is the emulator's rules bypass — the point is to produce a document
  // shape the app itself can no longer write.
  const mask = "updateMask.fieldPaths=cvv&updateMask.fieldPaths=barcodeOrCode";
  const stripped = await request.patch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/cards/${cardId}?${mask}`,
    { headers: { Authorization: "Bearer owner" }, data: { fields: {} } }
  );
  expect(stripped.ok()).toBeTruthy();
  expect((await stripped.json()).fields).not.toHaveProperty("cvv");

  await page.goto("/settings");
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible(); // hydration gate, see above
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "ייצוא כל הנתונים שלי (JSON)" }).click();
  const download = await downloadPromise;

  const exported = JSON.parse(await readFile((await download.path())!, "utf-8"));
  expect(exported.cards).toHaveLength(1);
  expect(exported.cards[0].name).toBe(cardName);
  expect(exported.cards[0].cvv).toBeNull();
  expect(exported.cards[0].barcodeOrCode).toBeNull();
});

// docs/ROADMAP.md Phase 5.5.a. Proves the linking flow end to end with no
// messaging provider in the picture: the app issues the code, an
// unauthenticated inbound caller redeems it (/e2e/redeem-link stands in for the
// webhook that arrives in 5.5.b), and the link then shows up — and can be
// removed — in the authenticated UI.
test("user can link a WhatsApp channel with a one-time code and unlink it", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  // A distinct number per run: the channelKey is the doc id, so a shared number
  // would make parallel runs fight over the same channelLinks document.
  const phone = `+9725${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await page.goto("/settings");
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible();

  await page.getByRole("button", { name: "חיבור WhatsApp" }).click();
  const codeRegion = page.getByRole("region", { name: "קישור חיבור WhatsApp" });
  await expect(codeRegion).toBeVisible();
  const code = await extractLinkCodeFromRegion(codeRegion);
  expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);

  // Redeemed without a session, the way the webhook will: the code is the only
  // credential in play.
  await page.goto(`/e2e/redeem-link?externalId=${encodeURIComponent(phone)}&code=${code}`);
  await expect(page.getByRole("status")).toHaveText("redeemed");

  await page.goto("/settings");
  await expect(page.getByText(phone)).toBeVisible();

  await page.getByRole("button", { name: "ניתוק", exact: true }).click();
  await page.getByRole("button", { name: "ניתוק הערוץ" }).click();
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible();
  await expect(page.getByText(phone)).not.toBeVisible();
});

test("a link code cannot be redeemed twice", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  const phone = `+9725${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  const otherPhone = `+9725${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await page.goto("/settings");
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible(); // hydration gate, see above
  await page.getByRole("button", { name: "חיבור WhatsApp" }).click();
  const codeRegion = page.getByRole("region", { name: "קישור חיבור WhatsApp" });
  await expect(codeRegion).toBeVisible();
  const code = await extractLinkCodeFromRegion(codeRegion);

  await page.goto(`/e2e/redeem-link?externalId=${encodeURIComponent(phone)}&code=${code}`);
  await expect(page.getByRole("status")).toHaveText("redeemed");

  // Same code, different number: a used code must not bind a second channel,
  // or anyone who saw it once could attach their own phone later.
  await page.goto(`/e2e/redeem-link?externalId=${encodeURIComponent(otherPhone)}&code=${code}`);
  await expect(page.getByRole("status")).toContainText("failed:");

  await page.goto("/settings");
  await expect(page.getByText(phone)).toBeVisible();
  await expect(page.getByText(otherPhone)).not.toBeVisible();
});

test("user can request and cancel account deletion", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await page.goto("/settings");
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible(); // hydration gate, see above
  await page.getByRole("button", { name: "מחיקת החשבון" }).click();
  await page.getByRole("button", { name: "תזמון מחיקת החשבון" }).click();

  await expect(page.getByText("החשבון מתוזמן למחיקה", { exact: true })).toBeVisible();

  // The global banner (rendered in the protected layout) shows on any protected page.
  await page.goto("/dashboard");
  await expect(page.getByText(/החשבון מתוזמן למחיקה בתאריך/)).toBeVisible();
  await page.getByRole("button", { name: "ביטול" }).click();
  await expect(page.getByText(/החשבון מתוזמן למחיקה בתאריך/)).not.toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "מחיקת החשבון" })).toBeVisible();
});
