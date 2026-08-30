import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptNullableField,
  decryptSensitiveField,
  encryptNullableField,
  encryptSensitiveField,
  isEncryptedField,
} from "@/lib/crypto/fieldEncryptionCore";

// The key is read lazily inside encrypt/decrypt, not at import time, so setting
// it here is enough (that laziness is itself deliberate — see the comment on
// getKey and the BUILD-availability note in apphosting.yaml).
beforeAll(() => {
  process.env.CARD_FIELD_ENCRYPTION_KEY = "DzSypG4OA6dhGFcc1hhTdgZDXj6degkAJ6WO9eVuUQg=";
});

describe("decryptNullableField", () => {
  // Regression guard for the 2026-08-30 production incident: the data export
  // answered 500 with "Cannot read properties of undefined (reading 'split')"
  // for any card document predating the cvv/barcodeOrCode fields. `doc.data()
  // as GiftCard` types the absent key as `string | null` while it is really
  // `undefined`, so nothing upstream can catch this. See docs/DECISIONS.md
  // ADR #32.
  it("treats a missing field (undefined) as null instead of throwing", () => {
    expect(decryptNullableField(undefined)).toBeNull();
  });

  it("passes null through", () => {
    expect(decryptNullableField(null)).toBeNull();
  });

  // Empty string stays an empty string rather than collapsing to null: it is a
  // value the user actually wrote, and encryptNullableField preserves it too.
  it("passes an empty string through unchanged", () => {
    expect(decryptNullableField("")).toBe("");
  });

  it("round-trips a real value", () => {
    const ciphertext = encryptNullableField("4580-1111-2222-3333");
    expect(ciphertext).not.toBe("4580-1111-2222-3333");
    expect(decryptNullableField(ciphertext)).toBe("4580-1111-2222-3333");
  });

  // Cards written before the encryption layer existed are still plaintext until
  // migrate-encrypt-fields runs over them (docs/SECURITY.md).
  it("returns un-migrated plaintext unchanged", () => {
    expect(decryptNullableField("1234")).toBe("1234");
  });
});

describe("encryptSensitiveField", () => {
  it("produces a v1-tagged, self-identifying ciphertext", () => {
    const ciphertext = encryptSensitiveField("123");
    expect(ciphertext.startsWith("v1:")).toBe(true);
    expect(isEncryptedField(ciphertext)).toBe(true);
    expect(decryptSensitiveField(ciphertext)).toBe("123");
  });

  // A fresh IV per call, so the same cvv on two cards does not produce the same
  // stored string.
  it("does not produce identical ciphertext for identical plaintext", () => {
    expect(encryptSensitiveField("123")).not.toBe(encryptSensitiveField("123"));
  });
});
