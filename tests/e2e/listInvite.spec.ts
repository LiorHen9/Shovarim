import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { signMetaBody } from "@/lib/whatsapp/signature";
import { signInAsTestUser } from "./helpers/auth";

// docs/DECISIONS.md ADR #37 (issue #58) — sharing a list by phone number with
// someone who may not have an account yet. The security claim under test is
// that accepting needs *both* the invite code and a channelLinks entry proving
// the number belongs to the accepting account: holding the link alone is not
// enough. The link half is established through the real signed webhook, the
// same way whatsapp.spec.ts does it, so nothing here fakes the linking step.
const APP_SECRET = "e2e-local-app-secret";
const WEBHOOK = "/api/whatsapp/webhook";

function deliveryBody(phone: string, messageId: string, text: string): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "e2e",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550001111", phone_number_id: "E2E_PHONE_ID" },
              contacts: [{ profile: { name: "בודק" }, wa_id: phone.replace("+", "") }],
              messages: [
                {
                  from: phone.replace("+", ""),
                  id: messageId,
                  timestamp: `${Math.floor(Date.now() / 1000)}`,
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

function postDelivery(request: APIRequestContext, body: string) {
  return request.post(WEBHOOK, {
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": signMetaBody(body, APP_SECRET),
    },
    data: body,
  });
}

// A distinct number per test — the channelKey is a doc id, so a shared number
// would make parallel runs fight over one channelLinks document.
function uniquePhone(): string {
  return `+9725${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
}

// Creating the first card auto-creates a list (Phase 3.1), which is the
// cheapest way to get one; the share dialog lives on that list's page. It is
// then renamed so assertions can key on a name unique to this test — the
// auto-created one is "הרשימה שלי" for every user.
async function createList(page: Page, listName: string): Promise<string> {
  await page.goto("/cards/new");
  await page.getByLabel("שם הכרטיס").fill(`כרטיס ${listName}`);
  await page.getByLabel("יתרה התחלתית").fill("100");
  await page.getByRole("button", { name: "שמירה" }).click();
  await page.waitForURL(/\/cards\/(?!new$)[^/]+$/, { timeout: 15000 });

  await page.goto("/cards");
  const listLink = page.getByRole("link").filter({ hasText: "הרשימה שלי" }).first();
  await listLink.waitFor({ timeout: 15000 });
  const href = await listLink.getAttribute("href");

  await page.goto(href!);
  await page.getByRole("button", { name: "עריכת שם הרשימה" }).click();
  await page.getByLabel("שם חדש לרשימה").fill(listName);
  await page.getByRole("button", { name: "שמירת שם הרשימה" }).click();
  // The heading re-renders off the list subscription, not the write's promise,
  // so allow for the round trip rather than the default 5s.
  await expect(page.getByRole("heading", { name: listName })).toBeVisible({ timeout: 15000 });

  return href!;
}

// Issues a phone invite from the owner's share dialog and returns the invite
// URL, recovered from the wa.me link's pre-filled message — the code is never
// rendered on its own, same as the channel-link flow (issue #39).
async function issueInvite(page: Page, listPath: string, phone: string): Promise<string> {
  await page.goto(listPath);
  await page.getByRole("button", { name: "שיתוף" }).click();

  await page.getByLabel("מספר טלפון").fill(phone);
  await page.getByRole("button", { name: "יצירת הזמנה לוואטסאפ" }).click();

  const region = page.getByRole("region", { name: "הזמנה מוכנה לשליחה" });
  await expect(region).toBeVisible();
  const href = await region.getByRole("link", { name: "פתיחת וואטסאפ" }).getAttribute("href");
  const shareText = new URL(href!).searchParams.get("text");
  expect(shareText).toBeTruthy();

  const inviteUrl = shareText!.match(/https?:\/\/\S+\/invite\/\S+/)?.[0];
  expect(inviteUrl).toBeTruthy();
  return inviteUrl!;
}

// Recovers a channel-link code from /settings, then redeems it through the
// real signed webhook — this is what makes the invited number provably belong
// to the current account.
async function linkPhone(page: Page, request: APIRequestContext, phone: string): Promise<void> {
  await page.goto("/settings");
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible();
  await page.getByRole("button", { name: "חיבור WhatsApp" }).click();
  const codeRegion = page.getByRole("region", { name: "קישור חיבור WhatsApp" });
  await expect(codeRegion).toBeVisible();
  const href = await codeRegion.getByRole("link", { name: "פתיחת WhatsApp" }).getAttribute("href");
  const code = new URL(href!).searchParams.get("text");

  const response = await postDelivery(request, deliveryBody(phone, `wamid.${randomUUID()}`, code!));
  expect(response.status()).toBe(200);
}

test("an invited user links their number and joins the list", async ({ page, request }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const inviteeUid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signInAsTestUser(page, {
    uid: ownerUid,
    email: `${ownerUid}@example.com`,
    name: "בעל הרשימה",
  });
  const listPath = await createList(page, listName);
  const inviteUrl = await issueInvite(page, listPath, phone);
  const invitePath = new URL(inviteUrl).pathname;

  // Second account, standing in for the recipient opening the link.
  await signInAsTestUser(page, {
    uid: inviteeUid,
    email: `${inviteeUid}@example.com`,
    name: "מוזמן",
  });

  // Before linking, the page must refuse to offer acceptance: holding the
  // invite link is deliberately not sufficient on its own.
  await page.goto(invitePath);
  await expect(page.getByRole("button", { name: "קישור מספר הוואטסאפ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "אישור והצטרפות" })).not.toBeVisible();

  await linkPhone(page, request, phone);

  await page.goto(invitePath);
  await page.getByRole("button", { name: "אישור והצטרפות" }).click();

  await page.waitForURL(/\/cards\/lists\/[^/]+$/, { timeout: 15000 });
  await page.goto("/cards");
  await expect(page.getByRole("link").filter({ hasText: listName })).toBeVisible({
    timeout: 15000,
  });
});

test("an invite cannot be accepted from an account that has not linked the number", async ({
  page,
  request,
}) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const inviteeUid = `e2e-${randomUUID()}`;
  const invitedPhone = uniquePhone();
  const otherPhone = uniquePhone();
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signInAsTestUser(page, {
    uid: ownerUid,
    email: `${ownerUid}@example.com`,
    name: "בעל הרשימה",
  });
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath, invitedPhone)).pathname;

  await signInAsTestUser(page, {
    uid: inviteeUid,
    email: `${inviteeUid}@example.com`,
    name: "מוזמן",
  });
  // Links a *different* number than the one invited — the account now has a
  // channel link, just not the one this invite requires.
  await linkPhone(page, request, otherPhone);

  await page.goto(invitePath);
  await expect(page.getByRole("button", { name: "אישור והצטרפות" })).not.toBeVisible();

  await page.goto("/cards");
  await expect(page.getByText(listName)).not.toBeVisible();
});

test("a signed-out visitor is sent to sign in and back to the invite", async ({ page }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signInAsTestUser(page, {
    uid: ownerUid,
    email: `${ownerUid}@example.com`,
    name: "בעל הרשימה",
  });
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath, phone)).pathname;

  // The preview must render for someone with no session at all — a recipient
  // who has never used the app has to see what they were invited to first.
  await page.context().clearCookies();
  await page.goto(invitePath);

  // The name appears both as the panel heading and inside the invite sentence,
  // so this targets the heading specifically.
  await expect(page.getByRole("heading", { name: listName })).toBeVisible();
  const signInLink = page.getByRole("link", { name: "התחברות והמשך" });
  await expect(signInLink).toBeVisible();
  expect(await signInLink.getAttribute("href")).toBe(`/?next=${encodeURIComponent(invitePath)}`);
});

test("an invite declined by the recipient cannot then be accepted", async ({ page, request }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const inviteeUid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signInAsTestUser(page, {
    uid: ownerUid,
    email: `${ownerUid}@example.com`,
    name: "בעל הרשימה",
  });
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath, phone)).pathname;

  await signInAsTestUser(page, {
    uid: inviteeUid,
    email: `${inviteeUid}@example.com`,
    name: "מוזמן",
  });
  await linkPhone(page, request, phone);

  await page.goto(invitePath);
  await page.getByRole("button", { name: "דחייה" }).click();
  await expect(page.getByText("ההזמנה נדחתה. הרשימה לא שותפה איתך.")).toBeVisible();

  // A declined code is spent: reopening the link must not offer acceptance
  // again, or "no" would be reversible by anyone still holding the URL.
  await page.goto(invitePath);
  await expect(page.getByRole("button", { name: "אישור והצטרפות" })).not.toBeVisible();
  await expect(page.getByText("ההזמנה כבר טופלה.")).toBeVisible();

  await page.goto("/cards");
  await expect(page.getByText(listName)).not.toBeVisible();
});
