import { describe, expect, it } from "vitest";

import { isConfiguredSiteKey } from "@/lib/firebase/appCheck";

// Regression guard for the 2026-08-29 production incident: the old check was
// `!siteKey`, so the literal "REPLACE_ME" shipped in apphosting.yaml counted
// as configured and App Check initialized against a nonexistent reCAPTCHA
// key. See docs/DECISIONS.md ADR #27.
describe("isConfiguredSiteKey", () => {
  it("rejects the placeholder that actually reached production", () => {
    expect(isConfiguredSiteKey("REPLACE_ME")).toBe(false);
  });

  it.each(["", "   ", undefined, "replace_me", "CHANGE_ME", "change-me", "TODO", "your_site_key"])(
    "rejects %j",
    (value) => {
      expect(isConfiguredSiteKey(value)).toBe(false);
    }
  );

  it("accepts a real-shaped reCAPTCHA v3 site key", () => {
    expect(isConfiguredSiteKey("6LcAbCdEfGhIjKlMnOpQrStUvWxYz0123456789A")).toBe(true);
  });

  it("tolerates surrounding whitespace on a real key", () => {
    expect(isConfiguredSiteKey("  6LcAbCdEfGhIjKlMnOpQrStUvWxYz0123456789A  ")).toBe(true);
  });
});
