import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { signMetaBody } from "@/lib/whatsapp/signature";
import { signInAsTestUser } from "./helpers/auth";

// docs/DECISIONS.md ADR #39 (restoring ADR #37's binding over ADR #38) —
// sharing a list with one number and one click. The code is only half the
// credential, so what these tests pin down is the other half: a link that
// reaches an account which has not proved the invited number is worthless, a
// code is spent by its first use, and a declined code stays dead. The linking
// half runs through the real signed webhook, the same way whatsapp.spec.ts
// does it.
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
// would make parallel runs fight over one channelLinks document. Both spellings
// come from one draw because the two halves of every test need them to describe
// the same number: the share form takes the local Israeli form, while the
// webhook, channelLinks and the owner's members list all speak E.164.
function uniquePhone(): { local: string; e164: string } {
  const local = `05${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  return { local, e164: `+972${local.slice(1)}` };
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

// Types the recipient's number, clicks share, and returns the invite URL —
// read out of the popup the button opens rather than out of the dialog's list
// of open links. The popup carries exactly the URL the owner is handed, which
// makes it unambiguous even on a re-share, where the list still shows for a
// moment the earlier link that this share is about to supersede.
async function issueInvite(page: Page, listPath: string, localPhone: string): Promise<string> {
  await stubWhatsApp(page);
  await page.goto(listPath);
  await page.getByRole("button", { name: "שיתוף", exact: true }).click();
  await page.getByLabel("מספר הטלפון של הנמען").fill(localPhone);

  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "שיתוף בוואטסאפ" }).click(),
  ]);
  // Opened blank inside the click gesture, then navigated once the code comes
  // back — so the wa.me URL is not there on the popup event itself.
  await popup.waitForURL(/wa\.me/, { timeout: 15000 });
  const shareUrl = new URL(popup.url());
  await popup.close();

  // The number is in the path, which is what skips WhatsApp's contact picker:
  // the message can only land in the chat the invite is bound to (ADR #39).
  expect(shareUrl.pathname).toBe(`/972${localPhone.slice(1)}`);

  const shareText = shareUrl.searchParams.get("text");
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

test("an invited user proves the invited number and joins the list", async ({ page, request }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const inviteeUid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath, phone.local)).pathname;

  // Second account, standing in for the recipient opening the link.
  await signIn(page, inviteeUid, "מוזמן");

  // Holding the link is not enough on its own: until the invited number is
  // proved, acceptance is not even offered.
  await page.goto(invitePath);
  await expect(page.getByRole("link", { name: "פתיחת WhatsApp" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "אישור והצטרפות" })).not.toBeVisible();

  await linkPhone(page, request, phone.e164);

  // The accept/decline dialog opens by itself once nothing is in the way.
  await page.goto(invitePath);
  await page.getByRole("button", { name: "אישור והצטרפות" }).click();

  await page.waitForURL(/\/cards\/lists\/[^/]+$/, { timeout: 15000 });
  await page.goto("/cards");
  await expect(page.getByRole("link").filter({ hasText: listName })).toBeVisible({
    timeout: 15000,
  });

  // Back on the owner's side, the share is listed against the number it was
  // addressed to — the same number that had to be proved to redeem it.
  await signIn(page, ownerUid, "בעל הרשימה");
  await page.goto(listPath);
  await page.getByRole("button", { name: "שיתוף", exact: true }).click();
  await expect(page.getByText(`${inviteeUid}@example.com`)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(phone.e164)).toBeVisible();
});

test("a link that reaches a different number cannot be redeemed", async ({ page, request }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const strangerUid = `e2e-${randomUUID()}`;
  const inviteeUid = `e2e-${randomUUID()}`;
  const invited = uniquePhone();
  const stranger = uniquePhone();
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath, invited.local)).pathname;

  // The intended recipient proves the invited number first but does not accept
  // yet, so the number is demonstrably taken by someone else when the stranger
  // arrives — which is what makes the gate below "wrong account" rather than
  // the ordinary "nobody has linked this yet".
  await signIn(page, inviteeUid, "מוזמן");
  await linkPhone(page, request, invited.e164);

  // This is the point of the binding (ADR #39): a leaked or forwarded link in
  // the hands of a fully legitimate account is still worth nothing, because
  // that account cannot receive WhatsApp on the invited number.
  await signIn(page, strangerUid, "מקבל הלינק בטעות");
  await linkPhone(page, request, stranger.e164);
  await page.goto(invitePath);
  await expect(page.getByText("מקושר למספר WhatsApp אחר")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "אישור והצטרפות" })).not.toBeVisible();
  await page.goto("/cards");
  await expect(page.getByText(listName)).not.toBeVisible();

  // And the code survives that attempt intact — a stranger opening it must not
  // burn the invite the intended recipient is still waiting to use.
  await signIn(page, inviteeUid, "מוזמן");
  await page.goto(invitePath);
  await page.getByRole("button", { name: "אישור והצטרפות" }).click();
  await page.waitForURL(/\/cards\/lists\/[^/]+$/, { timeout: 15000 });

  // Spent by that first use: reopening it offers nothing, so a link left in a
  // chat history cannot be replayed later.
  await page.goto(invitePath);
  await expect(page.getByText("ההזמנה כבר טופלה.")).toBeVisible();
  await expect(page.getByRole("button", { name: "אישור והצטרפות" })).not.toBeVisible();
});

test("a signed-out visitor is sent to sign in and back to the invite", async ({ page }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath, uniquePhone().local)).pathname;

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

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath, phone.local)).pathname;

  await signIn(page, inviteeUid, "מוזמן");
  await linkPhone(page, request, phone.e164);

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

test("re-sharing with the same number supersedes the earlier link", async ({ page, request }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const inviteeUid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const firstPath = new URL(await issueInvite(page, listPath, phone.local)).pathname;
  const secondPath = new URL(await issueInvite(page, listPath, phone.local)).pathname;
  expect(secondPath).not.toBe(firstPath);

  // "Send it again" must not leave two redeemable codes behind for one
  // recipient — the owner asked for one share, not two.
  await signIn(page, inviteeUid, "מוזמן");
  await linkPhone(page, request, phone.e164);
  await page.goto(firstPath);
  await expect(page.getByText("ההזמנה כבר טופלה.")).toBeVisible();

  await page.goto(secondPath);
  await page.getByRole("button", { name: "אישור והצטרפות" }).click();
  await page.waitForURL(/\/cards\/lists\/[^/]+$/, { timeout: 15000 });
});

test("sharing with a number that already has an open invite shows a notice, not a block", async ({
  page,
}) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  await issueInvite(page, listPath, phone.local);

  // Dialog was closed by issueInvite's popup flow (navigation away); reopen it
  // and type the same number again without submitting.
  await page.goto(listPath);
  await page.getByRole("button", { name: "שיתוף", exact: true }).click();
  await page.getByLabel("מספר הטלפון של הנמען").fill(phone.local);

  await expect(page.getByText("כבר יש לינק פתוח למספר הזה")).toBeVisible();
  await expect(page.getByRole("button", { name: "שיתוף בוואטסאפ" })).toBeEnabled();
});

test("sharing with a number that is already a member is blocked before submitting", async ({
  page,
  request,
}) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const inviteeUid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath, phone.local)).pathname;

  await signIn(page, inviteeUid, "מוזמן");
  await linkPhone(page, request, phone.e164);
  await page.goto(invitePath);
  await page.getByRole("button", { name: "אישור והצטרפות" }).click();
  await page.waitForURL(/\/cards\/lists\/[^/]+$/, { timeout: 15000 });

  // Back on the owner's side, typing the now-a-member's number must be caught
  // in the dialog itself — before the server round trip ADR #39 already
  // guards, not only after it via a toast.
  await signIn(page, ownerUid, "בעל הרשימה");
  await page.goto(listPath);
  await page.getByRole("button", { name: "שיתוף", exact: true }).click();
  await page.getByLabel("מספר הטלפון של הנמען").fill(phone.local);

  await expect(page.getByText("הרשימה כבר משותפת עם המספר הזה")).toBeVisible();
  await expect(page.getByRole("button", { name: "שיתוף בוואטסאפ" })).toBeDisabled();
});

test("the owner can revoke a link before anyone uses it", async ({ page, request }) => {
  const ownerUid = `e2e-${randomUUID()}`;
  const inviteeUid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  const listName = `רשימה ${randomUUID().slice(0, 8)}`;

  await signIn(page, ownerUid, "בעל הרשימה");
  const listPath = await createList(page, listName);
  const invitePath = new URL(await issueInvite(page, listPath, phone.local)).pathname;

  // Revocation is what the owner has for a link sent to the wrong number: the
  // binding stops the wrong person redeeming it, but only this kills it.
  await page.getByRole("button", { name: "ביטול הלינק" }).click();
  await expect(page.getByRole("link", { name: "פתיחת הלינק בוואטסאפ" })).toHaveCount(0);

  await signIn(page, inviteeUid, "מוזמן");
  await linkPhone(page, request, phone.e164);
  await page.goto(invitePath);
  await expect(page.getByText("ההזמנה כבר טופלה.")).toBeVisible();
});
