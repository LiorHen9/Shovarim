import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { signMetaBody } from "@/lib/whatsapp/signature";
import { signInAsTestUser } from "./helpers/auth";

// docs/ROADMAP.md Phase 5.5.b. Covers the half of the webhook that needs no
// LLM: the signature boundary, the GET handshake, dedup, and the link-code
// path — which is the whole security model of the channel (ADR #29). The
// conversational path can't be covered here for the same reason /chat has no
// E2E: it would need real Claude calls (see the note in Phase 5.4).
//
// The secret matches the dummy WHATSAPP_APP_SECRET set in .env.local and in
// ci.yml; no outbound credentials are configured in either, so the handler
// logs the reply instead of calling graph.facebook.com.
const APP_SECRET = "e2e-local-app-secret";
const VERIFY_TOKEN = "e2e-local-verify-token";

const WEBHOOK = "/api/whatsapp/webhook";

// Meta sends the sender as a bare wa_id, no "+" — the normalization on our
// side is part of what this exercises.
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

function postDelivery(request: APIRequestContext, body: string, signature = signMetaBody(body, APP_SECRET)) {
  return request.post(WEBHOOK, {
    headers: { "content-type": "application/json", "x-hub-signature-256": signature },
    data: body,
  });
}

// A distinct number per test: the channelKey is the doc id, so a shared number
// would make parallel runs fight over the same channelLinks document.
function uniquePhone(): string {
  return `+9725${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
}

async function issueLinkCode(page: Page): Promise<string> {
  await page.goto("/settings");
  // Hydration gate — see the note in settings.spec.ts.
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible();
  await page.getByRole("button", { name: "חיבור WhatsApp" }).click();
  const codeRegion = page.getByRole("region", { name: "קוד קישור WhatsApp" });
  await expect(codeRegion).toBeVisible();
  return (await codeRegion.locator("code").innerText()).trim();
}

test("GET handshake echoes the challenge only for the right verify token", async ({ request }) => {
  const ok = await request.get(
    `${WEBHOOK}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1234567890`
  );
  expect(ok.status()).toBe(200);
  expect(await ok.text()).toBe("1234567890");

  const wrongToken = await request.get(
    `${WEBHOOK}?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1234567890`
  );
  expect(wrongToken.status()).toBe(403);
});

test("a delivery with a bad signature is rejected and changes nothing", async ({ page, request }) => {
  const uid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });
  const code = await issueLinkCode(page);

  const body = deliveryBody(phone, `wamid.${randomUUID()}`, code);

  // Signed with the wrong secret: the payload is otherwise perfectly valid,
  // which is exactly the forgery the HMAC exists to stop — anyone can guess a
  // phone number, nobody can guess the app secret.
  const forged = await postDelivery(request, body, signMetaBody(body, "wrong-secret"));
  expect(forged.status()).toBe(401);

  const missing = await request.post(WEBHOOK, {
    headers: { "content-type": "application/json" },
    data: body,
  });
  expect(missing.status()).toBe(401);

  await page.goto("/settings");
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible();
  await expect(page.getByText(phone)).not.toBeVisible();
});

test("a signed link-code message links the channel", async ({ page, request }) => {
  const uid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });
  const code = await issueLinkCode(page);

  const response = await postDelivery(request, deliveryBody(phone, `wamid.${randomUUID()}`, code));
  expect(response.status()).toBe(200);

  await page.goto("/settings");
  await expect(page.getByText(phone)).toBeVisible();
});

test("a replayed message id is ignored", async ({ page, request }) => {
  const uid = `e2e-${randomUUID()}`;
  const phone = uniquePhone();
  const messageId = `wamid.${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  const firstCode = await issueLinkCode(page);
  expect((await postDelivery(request, deliveryBody(phone, messageId, firstCode))).status()).toBe(200);

  await page.goto("/settings");
  await expect(page.getByText(phone)).toBeVisible();
  await page.getByRole("button", { name: "ניתוק", exact: true }).click();
  await page.getByRole("button", { name: "ניתוק הערוץ" }).click();
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible();

  // Same message id, a fresh valid code: Meta retries deliveries on any
  // timeout, and the claim has to make the second one a no-op — otherwise a
  // retried turn would run its write tools twice.
  const secondCode = await issueLinkCode(page);
  expect((await postDelivery(request, deliveryBody(phone, messageId, secondCode))).status()).toBe(200);

  await page.goto("/settings");
  await expect(page.getByText("אין ערוצים מקושרים")).toBeVisible();
  await expect(page.getByText(phone)).not.toBeVisible();
});
