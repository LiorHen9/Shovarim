import { describe, expect, it } from "vitest";

import { maskEmail, maskPhone } from "@/lib/utils/mask";

describe("maskEmail", () => {
  it("keeps the first and last character of the local part", () => {
    expect(maskEmail("liorhen9@gmail.com")).toBe("l******9@gmail.com");
  });

  it("stars a local part too short for a meaningful middle", () => {
    expect(maskEmail("a@x.com")).toBe("*@x.com");
    expect(maskEmail("ab@x.com")).toBe("**@x.com");
  });

  it("falls back to fully starred for a value with no @", () => {
    expect(maskEmail("not-an-email")).toBe("*".repeat("not-an-email".length));
  });
});

describe("maskPhone", () => {
  it("keeps the country code and last two digits", () => {
    expect(maskPhone("+972501234567")).toBe("+972*******67");
  });

  it("stars a short national number in full", () => {
    expect(maskPhone("+97250")).toBe("+972**");
  });

  it("falls back to fully starred for a non-E.164 value", () => {
    expect(maskPhone("not-a-number")).toBe("*".repeat("not-a-number".length));
  });
});
