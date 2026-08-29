import { describe, expect, it } from "vitest";

import {
  buildSignInErrorMessage,
  isCancelledByUser,
  toAuthErrorCode,
} from "@/lib/auth/authErrors";
import { normalizeAuthErrorCode, UNKNOWN_AUTH_ERROR_CODE } from "@/lib/validation/clientError";

describe("toAuthErrorCode", () => {
  it("pulls the code off a FirebaseError-shaped object", () => {
    expect(toAuthErrorCode({ code: "auth/popup-blocked" })).toBe("auth/popup-blocked");
  });

  it.each([new Error("boom"), null, undefined, "auth/popup-blocked", { code: 42 }, { code: "" }])(
    "falls back to unknown for %j",
    (value) => {
      expect(toAuthErrorCode(value)).toBe(UNKNOWN_AUTH_ERROR_CODE);
    }
  );

  it("does not pass through a code that breaks the log-safe shape", () => {
    expect(toAuthErrorCode({ code: "auth/../../etc/passwd" })).toBe(UNKNOWN_AUTH_ERROR_CODE);
    expect(toAuthErrorCode({ code: "<script>alert(1)</script>" })).toBe(UNKNOWN_AUTH_ERROR_CODE);
  });
});

describe("normalizeAuthErrorCode", () => {
  it("keeps well-formed Firebase codes", () => {
    expect(normalizeAuthErrorCode("auth/network-request-failed")).toBe(
      "auth/network-request-failed"
    );
  });

  it("rejects free-form text so nothing attacker-controlled reaches Cloud Logging", () => {
    expect(normalizeAuthErrorCode("totally arbitrary\ninjected line")).toBe(
      UNKNOWN_AUTH_ERROR_CODE
    );
  });
});

describe("isCancelledByUser", () => {
  it("treats a closed popup as a non-failure", () => {
    expect(isCancelledByUser("auth/popup-closed-by-user")).toBe(true);
    expect(isCancelledByUser("auth/cancelled-popup-request")).toBe(true);
  });

  it("does not swallow a blocked popup", () => {
    expect(isCancelledByUser("auth/popup-blocked")).toBe(false);
  });
});

describe("buildSignInErrorMessage", () => {
  it("gives actionable text plus the raw code for known failures", () => {
    const message = buildSignInErrorMessage("provider-sign-in", "auth/popup-blocked");
    expect(message).toContain("חלונות קופצים");
    expect(message).toContain("(auth/popup-blocked)");
  });

  it("distinguishes a failed session mint from a failed popup", () => {
    expect(buildSignInErrorMessage("create-session", UNKNOWN_AUTH_ERROR_CODE)).not.toBe(
      buildSignInErrorMessage("provider-sign-in", UNKNOWN_AUTH_ERROR_CODE)
    );
  });

  it("omits the parenthetical when there is no useful code to show", () => {
    expect(buildSignInErrorMessage("provider-sign-in", UNKNOWN_AUTH_ERROR_CODE)).toBe(
      "ההתחברות נכשלה, נסו שוב"
    );
  });
});
