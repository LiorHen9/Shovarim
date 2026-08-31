import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { signMetaBody, verifyMetaSignature } from "@/lib/whatsapp/signature";
import { extractInboundMessages } from "@/lib/validation/whatsapp";

// The webhook's whole trust boundary is these two pure functions: the HMAC
// decides whether a delivery is real, and the extractor decides what we act on.
// Both run before any Firestore access, so they are unit-testable in full —
// unlike the turn itself, which needs a live LLM (docs/ROADMAP.md Phase 5.5.b).

const SECRET = "test-app-secret";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "123",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550001111", phone_number_id: "PHONE_ID" },
              messages: [
                {
                  from: "972501234567",
                  id: "wamid.HBgLOTcyNTAxMjM0NTY3",
                  timestamp: "1756400000",
                  type: "text",
                  text: { body: "  מה היתרה שלי?  " },
                },
              ],
              ...overrides,
            },
          },
        ],
      },
    ],
  };
}

describe("verifyMetaSignature", () => {
  it("accepts a body signed with the app secret", () => {
    const body = JSON.stringify(payload());
    expect(verifyMetaSignature(body, signMetaBody(body, SECRET), SECRET)).toBe(true);
  });

  it("rejects a body that was altered after signing", () => {
    const body = JSON.stringify(payload());
    const signature = signMetaBody(body, SECRET);
    // A forged sender is the attack this exists to stop: swapping the phone
    // number is enough to make the digest fail.
    expect(verifyMetaSignature(body.replace("972501234567", "972509999999"), signature, SECRET)).toBe(
      false
    );
  });

  it("rejects a signature made with a different secret", () => {
    const body = JSON.stringify(payload());
    expect(verifyMetaSignature(body, signMetaBody(body, "other-secret"), SECRET)).toBe(false);
  });

  it.each([
    ["missing header", null],
    ["no sha256= prefix", createHmac("sha256", SECRET).update("x").digest("hex")],
    ["truncated digest", "sha256=abcd"],
    ["non-hex digest", `sha256=${"z".repeat(64)}`],
  ])("rejects %s", (_label, header) => {
    expect(verifyMetaSignature(JSON.stringify(payload()), header, SECRET)).toBe(false);
  });

  // A length mismatch makes timingSafeEqual throw; the guard must turn that
  // into a plain rejection rather than a 500 on the route.
  it("does not throw on a malformed header", () => {
    expect(() => verifyMetaSignature("{}", "sha256=00", SECRET)).not.toThrow();
  });
});

describe("extractInboundMessages", () => {
  it("normalizes the sender to E.164 and trims the text", () => {
    expect(extractInboundMessages(payload())).toEqual([
      {
        messageId: "wamid.HBgLOTcyNTAxMjM0NTY3",
        from: "+972501234567",
        phoneNumberId: "PHONE_ID",
        text: "מה היתרה שלי?",
      },
    ]);
  });

  it("reports a non-text message as text: null rather than dropping it", () => {
    const messages = extractInboundMessages(
      payload({
        messages: [
          { from: "972501234567", id: "wamid.image", type: "image", image: { id: "media-1" } },
        ],
      })
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toBeNull();
  });

  it("ignores status callbacks, which carry no messages array", () => {
    const statuses = { statuses: [{ id: "wamid.x", status: "delivered" }], messages: undefined };
    expect(extractInboundMessages(payload(statuses))).toEqual([]);
  });

  it.each([[null], [{}], ['{"entry":"not-an-array"}'], [{ entry: [{ changes: [{}] }] }]])(
    "returns [] for unrecognized payload %j",
    (value) => {
      expect(extractInboundMessages(value)).toEqual([]);
    }
  );

  it("skips a message whose sender is not a usable phone number", () => {
    expect(
      extractInboundMessages(
        payload({ messages: [{ from: "not-a-number", id: "wamid.y", type: "text", text: { body: "hi" } }] })
      )
    ).toEqual([]);
  });

  it("extracts a reply-button tap as text, same as typed input (issue #75)", () => {
    const messages = extractInboundMessages(
      payload({
        messages: [
          {
            from: "972501234567",
            id: "wamid.button",
            type: "interactive",
            interactive: { type: "button_reply", button_reply: { id: "relink_confirm", title: "כן" } },
          },
        ],
      })
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toBe("כן");
  });

  it("falls through to text: null for a non-button_reply interactive message", () => {
    const messages = extractInboundMessages(
      payload({
        messages: [
          {
            from: "972501234567",
            id: "wamid.list",
            type: "interactive",
            interactive: { type: "list_reply" },
          },
        ],
      })
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toBeNull();
  });

  it("caps an oversized body instead of rejecting the delivery", () => {
    const messages = extractInboundMessages(
      payload({
        messages: [
          { from: "972501234567", id: "wamid.long", type: "text", text: { body: "א".repeat(9000) } },
        ],
      })
    );
    expect(messages[0]?.text).toHaveLength(4000);
  });
});
