// The single outbound-HTTP door for the benefit scrapers, and the thing
// docs/DECISIONS.md ADR #62 (issue #50) is actually about.
//
// The whole SSRF argument rests on one property: **no URL here ever originates
// from user input**. Every request is built from ALLOWED_HOSTS below plus an
// id that came from a previous response from that same host. There is no
// "fetch this URL for me" endpoint anywhere in this feature, so the classic
// SSRF shapes (internal metadata endpoints, 127.0.0.1, file://) are not
// defended against so much as unreachable. The allowlist is what keeps that
// true as the code grows: a new adapter pointed at a new host fails loudly
// here instead of quietly becoming a generic fetch proxy.

/** Hosts this feature may talk to. Exact match, no suffix matching — a
 *  suffix check on "hot.co.il" would also accept "hot.co.il.evil.example". */
export const ALLOWED_HOSTS = new Set([
  "api.hot.co.il", // הוט benefits API
  "www.tovplus.org.il", // טוב+ (Dolce platform)
  "tovplus.org.il",
  "paisplus.co.il", // פיס פלוס (same Dolce platform)
  "www.paisplus.co.il",
  "www.hvr.co.il", // חבר static merchant datasets
]);

const REQUEST_TIMEOUT_MS = 10_000;

/** 10MB, not 5: חבר's teamimcard_branches.json is 1.1MB on its own today and
 *  is a merchant directory that only grows. The cap exists to stop a source
 *  from exhausting the function's 512MiB, not to second-guess payload sizes. */
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

/** Politeness spacing between two requests to the same host. הוט at the
 *  default cap is ~2 requests, but at limit 0 it is 237, and those should not
 *  arrive as a burst. */
const MIN_HOST_INTERVAL_MS = 250;

const MAX_ATTEMPTS = 3;
const MAX_REDIRECTS = 3;

// Identifies the crawler rather than impersonating Chrome. Every source we
// touch allows this path in robots.txt (see the ADR), so there is nothing to
// hide behind a fake UA — and a real contact URL is what lets an operator ask
// us to stop.
const USER_AGENT = `ShovarimBot/1.0 (+${process.env.NEXT_PUBLIC_APP_URL ?? "https://shovarim-web--shovarim-prod.europe-west4.hosted.app"})`;

export class FetchNotAllowedError extends Error {}
export class FetchFailedError extends Error {}

const lastRequestAt = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function assertAllowed(url: URL): void {
  if (url.protocol !== "https:") {
    throw new FetchNotAllowedError(`Refusing non-https URL: ${url.protocol}//${url.host}`);
  }
  if (!ALLOWED_HOSTS.has(url.host)) {
    throw new FetchNotAllowedError(`Host not on the scraper allowlist: ${url.host}`);
  }
}

async function throttle(host: string): Promise<void> {
  const last = lastRequestAt.get(host);
  if (last !== undefined) {
    const wait = MIN_HOST_INTERVAL_MS - (Date.now() - last);
    if (wait > 0) await sleep(wait);
  }
  lastRequestAt.set(host, Date.now());
}

// Streamed rather than response.text(): a Content-Length header is optional and
// forgeable, so the only cap that actually holds is one applied while reading.
async function readCapped(response: Response, url: string): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_RESPONSE_BYTES) {
    throw new FetchFailedError(`Response too large (${declared} bytes declared) from ${url}`);
  }

  const body = response.body;
  if (!body) return "";

  const decoder = new TextDecoder("utf-8");
  const reader = body.getReader();
  let total = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        throw new FetchFailedError(`Response exceeded ${MAX_RESPONSE_BYTES} bytes from ${url}`);
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return text + decoder.decode();
}

/**
 * GET an allowlisted URL and return the body as text.
 *
 * Redirects are followed by hand (`redirect: "manual"`) so that each hop is
 * re-checked against the allowlist. With the automatic mode a 302 to an
 * arbitrary host would be followed before this code ever saw it, which would
 * hand the allowlist's guarantee to whoever controls the source.
 */
export async function fetchAllowedText(rawUrl: string): Promise<string> {
  let url = new URL(rawUrl);
  assertAllowed(url);

  for (let redirects = 0; ; redirects += 1) {
    const response = await fetchWithRetry(url);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new FetchFailedError(`Redirect without Location from ${url.href}`);
      if (redirects >= MAX_REDIRECTS) throw new FetchFailedError(`Too many redirects from ${rawUrl}`);
      // Resolved against the current URL so a relative Location works, then
      // re-checked — this is the line that makes manual redirects worth it.
      url = new URL(location, url);
      assertAllowed(url);
      continue;
    }

    if (!response.ok) {
      throw new FetchFailedError(`HTTP ${response.status} from ${url.href}`);
    }
    return readCapped(response, url.href);
  }
}

export async function fetchAllowedJson<T>(rawUrl: string): Promise<T> {
  const text = await fetchAllowedText(rawUrl);
  // Strips a UTF-8 BOM. חבר's teamimcard_branches.json ships one, and
  // JSON.parse throws "Unexpected token" on it — an error whose message points
  // nowhere near the actual cause.
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as T;
}

async function fetchWithRetry(url: URL): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await throttle(url.host);
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/html;q=0.9" },
      });

      // Retry only what a retry can fix. A 404 or a 401 is an answer, and
      // hammering it three times just makes the run slower and ruder — the
      // 401s on the DTS platform are exactly that shape.
      if (response.status === 429 || response.status >= 500) {
        lastError = new FetchFailedError(`HTTP ${response.status} from ${url.href}`);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }
        return response;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
    }
  }

  throw new FetchFailedError(`Request to ${url.href} failed: ${String(lastError)}`);
}
