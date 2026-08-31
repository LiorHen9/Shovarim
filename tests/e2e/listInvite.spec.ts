import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { signMetaBody } from "@/lib/whatsapp/signature";
import { signInAsTestUser } from "./helpers/auth";

// docs/DECISIONS.md ADR #38 (superseding parts of ADR #37) — sharing a list
// with one click, to a recipient the owner never names. The invite code is now
// the whole credential, so what these tests pin down is the boundary that
// replaced the phone binding: a code is spent by its first use, a declined code
// stays dead, and the invitee still has to sign in and prove a WhatsApp number
// (as enrichment, not authorization) before joining. The linking half runs
// through the real signed webhook, the same way whatsapp.spec.ts does it.
const APP_SECRET = "e2e-local-app-secret";
const WEBHOOK = "/api/whatsapp/webhook";

// Every test here drives two accounts through a full round trip — create a
// list, mint a link, sign in as the recipient, redeem a channel-link code
// through the real webhook, join — and several of them do it twice. That does
// not fit Playwright's 30s default; the work is genuinely this long, not stuck.
test.describe.configure({ timeout: 120_000 });

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

// The share button opens WhatsApp in a real popup (synchronously, to survive
// popup blockers), so every test that clicks it would otherwise navigate a tab
// to wa.me. Serving a blank page keeps that offline and instant.
async function stubWhatsApp(page: Page): Promise<void> {
  await page.context().route("https://wa.me/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" })
  );
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

// Clicks the one share button and returns the invite URL, recovered from the
// wa.me message of the link that then appears under "לינקים פתוחים" — the code
// is never rendered on its own, same as the channel-link flow (issue #39).
async function issueInvite(page: Page, listPath: string): Promise<string> {
  await stubWhatsApp(page);
  await page.goto(listPath);
  await page.getByRole("button", { name: "שיתוף", exact: true }).click();
  await page.getByRole("button", { name: "שיתוף בוואטסאפ" }).click();

  const openLink = page.getByRole("link", { name: "פתיחת הלינק בוואטסאפ" }).first();
  await expect(openLink).toBeVisible({ timeout: 15000 });
  const shareText = new URL((await openLink.getAttribute("href"))!).searchParams.get("text");
  expect(shareText).toBeTruthy();

  const inviteUrl = shareText!.match(/https?:\/\/\S+\/invite\/\S+/)?.[0];
  expect(inviteUrl).toBeTruthy();
  return inviteUrl!;
}

// Recovers a channel-link code from /settings, then redeems it through the
// real signed webhook — this is what attaches a provable number to the account.
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

async function signIn(page: Page, uid: string, name: string): Promise<void> {
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name });
}

test("an invited user links their number and joins the list", async ({ page, request }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const inviteeUid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath)).pathname;

  // Second account, standing in for the recipient opening the link.
  await signIn(page, inviteeUid, "מוזמן");

  // With no linked number the page must not offer acceptance yet — the number
  // is what lets the owner see who joined, so it is collected before the
  // decision, not after.
  await page.goto(invitePath);
  await expect(page.getByRole("link", { name: "פתיחת WhatsApp" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "אישור והצטרפות" })).not.toBeVisible();

  await linkPhone(page, request, phone);

  // The accept/decline dialog opens by itself once nothing is in the way.
  await page.goto(invitePath);
  await page.getByRole("button", { name: "אישור והצטרפות" }).click();

  await page.waitForURL(/\/cards\/lists\/[^/]+$/, { timeout: 15000 });
  await page.goto("/cards");
  await expect(page.getByRole("link").filter({ hasText: listName })).toBeVisible({
    timeout: 15000,
  });

  // Back on the owner's side, the share the invitee accepted is now listed with
  // the number they proved — the whole reason the linking step survived.
  await signIn(page, ownerUid, "בעל הרשימה");
  await page.goto(listPath);
  await page.getByRole("button", { name: "שיתוף", exact: true }).click();
  await expect(page.getByText(`${inviteeUid}@example.com`)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(phone)).toBeVisible();
});

test("a link that has been used once cannot be used again", async ({ page, request }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const firstUid = `e2e-${randomUUID()}`;
  const secondUid = `e2e-${randomUUID()}`;
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath)).pathname;

  await signIn(page, firstUid, "מוזמן ראשון");
  await linkPhone(page, request, uniquePhone());
  await page.goto(invitePath);
  await page.getByRole("button", { name: "אישור והצטרפות" }).click();
  await page.waitForURL(/\/cards\/lists\/[^/]+$/, { timeout: 15000 });

  // The credential is the code itself now, so "single use" is the whole
  // containment story for a link that gets forwarded: whoever comes second gets
  // nothing, however legitimate they look.
  await signIn(page, secondUid, "מוזמן שני");
  await linkPhone(page, request, uniquePhone());
  await page.goto(invitePath);
  await expect(page.getByText("ההזמנה כבר טופלה.")).toBeVisible();
  await expect(page.getByRole("button", { name: "אישור והצטרפות" })).not.toBeVisible();

  await page.goto("/cards");
  await expect(page.getByText(listName)).not.toBeVisible();
});

test("a signed-out visitor is sent to sign in and back to the invite", async ({ page }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath)).pathname;

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
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath)).pathname;

  await signIn(page, inviteeUid, "מוזמן");
  await linkPhone(page, request, uniquePhone());

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

test("the owner can revoke a link before anyone uses it", async ({ page, request }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const inviteeUid = `e2e-${randomUUID()}`;
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath)).pathname;

  // Revocation is what the owner has instead of the phone binding: a link sent
  // to the wrong chat has to be killable while it is still live.
  await page.getByRole("button", { name: "ביטול הלינק" }).click();
  await expect(page.getByRole("link", { name: "פתיחת הלינק בוואטסאפ" })).toHaveCount(0);

  await signIn(page, inviteeUid, "מוזמן");
  await linkPhone(page, request, uniquePhone());
  await page.goto(invitePath);
  await expect(page.getByText("ההזמנה כבר טופלה.")).toBeVisible();
});
