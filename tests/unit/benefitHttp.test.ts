import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ALLOWED_HOSTS,
  FetchNotAllowedError,
  fetchAllowedJson,
  fetchAllowedText,
} from "../../functions/src/benefits/http";
import { CLUB_SOURCES, SCRAPEABLE_CLUB_IDS } from "../../functions/src/benefits/registry";
import { CLUB_SCRAPE_SUPPORT } from "../../src/lib/services/benefitScrapeSupport";

// The allowlist is the whole of ADR #62's SSRF argument, so it is tested as a
// boundary rather than as a helper: what matters is that nothing outside the
// list can be reached, including via a redirect the source controls.

afterEach(() => {
  vi.restoreAllMocks();
});

/** A fetch stub that records what it was asked for. */
function stubFetch(responses: Array<{ status?: number; headers?: Record<string, string>; body?: string }>) {
  const calls: string[] = [];
  let index = 0;

  vi.stubGlobal("fetch", (input: URL | string) => {
    calls.push(String(input));
    const spec = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return Promise.resolve(
      new Response(spec?.body ?? "", {
        status: spec?.status ?? 200,
        headers: spec?.headers ?? {},
      })
    );
  });

  return calls;
}

describe("host allowlist", () => {
  it("refuses a host that is not on the list", async () => {
    const calls = stubFetch([{}]);
    await expect(fetchAllowedText("https://evil.example/x")).rejects.toBeInstanceOf(
      FetchNotAllowedError
    );
    // Rejected before any socket was opened, not after.
    expect(calls).toHaveLength(0);
  });

  it("refuses a suffix of an allowed host", async () => {
    // The reason ALLOWED_HOSTS is a Set of exact hosts and not an endsWith
    // check: "api.hot.co.il.evil.example" ends with nothing on the list, but a
    // sloppy `includes("hot.co.il")` would wave it through.
    stubFetch([{}]);
    await expect(fetchAllowedText("https://api.hot.co.il.evil.example/x")).rejects.toBeInstanceOf(
      FetchNotAllowedError
    );
  });

  it("refuses plain http even to an allowed host", async () => {
    stubFetch([{}]);
    await expect(fetchAllowedText("http://api.hot.co.il/x")).rejects.toBeInstanceOf(
      FetchNotAllowedError
    );
  });

  it("refuses the SSRF classics outright", async () => {
    stubFetch([{}]);
    for (const url of [
      "https://169.254.169.254/latest/meta-data/", // cloud metadata
      "https://127.0.0.1/",
      "https://localhost:8080/",
      "https://metadata.google.internal/",
    ]) {
      await expect(fetchAllowedText(url)).rejects.toBeInstanceOf(FetchNotAllowedError);
    }
  });

  it("allows a host that is on the list", async () => {
    const calls = stubFetch([{ body: "ok" }]);
    await expect(fetchAllowedText("https://api.hot.co.il/x")).resolves.toBe("ok");
    expect(calls).toHaveLength(1);
  });
});

describe("redirects", () => {
  it("follows a redirect that stays on an allowed host", async () => {
    const calls = stubFetch([
      { status: 302, headers: { location: "https://api.hot.co.il/moved" } },
      { body: "arrived" },
    ]);

    await expect(fetchAllowedText("https://api.hot.co.il/x")).resolves.toBe("arrived");
    expect(calls[1]).toBe("https://api.hot.co.il/moved");
  });

  it("refuses a redirect that leaves the allowlist", async () => {
    // The reason redirect: "manual" is worth the extra loop. With the automatic
    // mode this hop would be followed before our code ever saw it, handing the
    // allowlist's guarantee to whoever controls the source.
    stubFetch([
      { status: 302, headers: { location: "https://evil.example/steal" } },
      { body: "should never be read" },
    ]);

    await expect(fetchAllowedText("https://api.hot.co.il/x")).rejects.toBeInstanceOf(
      FetchNotAllowedError
    );
  });

  it("resolves a relative Location against the current URL", async () => {
    const calls = stubFetch([
      { status: 301, headers: { location: "/elsewhere" } },
      { body: "arrived" },
    ]);

    await expect(fetchAllowedText("https://api.hot.co.il/x")).resolves.toBe("arrived");
    expect(calls[1]).toBe("https://api.hot.co.il/elsewhere");
  });

  it("gives up rather than looping forever", async () => {
    stubFetch([{ status: 302, headers: { location: "https://api.hot.co.il/loop" } }]);
    await expect(fetchAllowedText("https://api.hot.co.il/loop")).rejects.toThrow(/redirect/i);
  });
});

describe("response handling", () => {
  it("rejects a response that declares itself too large", async () => {
    stubFetch([{ headers: { "content-length": String(50 * 1024 * 1024) }, body: "x" }]);
    await expect(fetchAllowedText("https://api.hot.co.il/x")).rejects.toThrow(/too large/i);
  });

  it("strips the BOM that חבר's teamimcard_branches.json ships", async () => {
    // Verified against the live file. Without this, JSON.parse throws
    // "Unexpected token" and the error points nowhere near the cause.
    stubFetch([{ body: '﻿{"branch":[]}' }]);
    await expect(fetchAllowedJson("https://www.hvr.co.il/bs2/datasets/x.json")).resolves.toEqual({
      branch: [],
    });
  });

  it("does not retry a 404, which a retry cannot fix", async () => {
    const calls = stubFetch([{ status: 404 }]);
    await expect(fetchAllowedText("https://api.hot.co.il/x")).rejects.toThrow(/404/);
    expect(calls).toHaveLength(1);
  });
});

describe("registry", () => {
  it("points every adapter at an allowlisted host", () => {
    // A new adapter aimed at a host nobody added to the list would otherwise
    // fail at 04:00 in production rather than here.
    for (const host of ["api.hot.co.il", "www.tovplus.org.il", "paisplus.co.il", "www.hvr.co.il"]) {
      expect(ALLOWED_HOSTS.has(host)).toBe(true);
    }
  });

  it("agrees with the copy the admin panel reads", () => {
    // src/lib/services/benefitScrapeSupport.ts duplicates the
    // supported/unsupported split because src/ cannot import from functions/
    // (ADR #24). This is what keeps the two copies honest.
    const fromRegistry = Object.fromEntries(
      CLUB_SOURCES.map((source) => [source.clubId, source.adapter ? null : source.unsupportedReason])
    );
    expect(fromRegistry).toEqual(CLUB_SCRAPE_SUPPORT);
  });

  it("lists exactly the four clubs with a reachable public source", () => {
    expect([...SCRAPEABLE_CLUB_IDS].sort()).toEqual(["hever", "hot", "mifal-hapais", "tov"]);
  });
});
