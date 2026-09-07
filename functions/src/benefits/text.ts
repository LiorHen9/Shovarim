// Small pure helpers shared by the adapters. Kept apart from the adapters so
// tests/unit/ can pin the awkward cases (entities, agorot, "החל מ-") without
// standing up a whole scrape.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#160": " ",
};

/**
 * HTML fragment -> plain text.
 *
 * Both platforms put markup in fields that read as plain text: הוט's
 * `description` and Dolce's `short_description` arrive as
 * `<p><strong>הטבת פלוס</strong></p>`. Storing that would push the escaping
 * problem into every future consumer of the collection (the chatbot included),
 * so it is stripped once, here, on the way in.
 *
 * Not a sanitiser and not trying to be: the output is text, never re-inserted
 * as markup, so the goal is legibility rather than safety.
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    // <br> and </p> are paragraph breaks; without this, two sentences run
    // together into one unreadable word boundary.
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&([a-z]+|#\d+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A source price field -> a number in shekels, or null.
 *
 * The sources are inconsistent: Dolce sends real numbers, הוט sends
 * `price_after_discount` as a *string*, and both use 0 and "" for "no price"
 * rather than omitting the field. 0 has to become null — a benefit stored as
 * "from ₪0" would sort to the top of every price-ascending list in Phase 10.3
 * and be wrong every time.
 */
export function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const numeric =
    typeof value === "number"
      ? value
      // Strip everything but digits and separators so "₪1,299.90" and
      // "החל מ-25 ₪" both land. The comma is a thousands separator in every
      // Hebrew price string here, never a decimal point.
      : Number(String(value).replace(/[^\d.,-]/g, "").replace(/,/g, ""));

  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric * 100) / 100;
}

/** Source date string -> Date, or null. Both platforms use ISO-ish strings,
 *  but ship "", null and "0000-00-00" for "no expiry". */
export function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value || value.startsWith("0000")) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Trims and collapses a title, and drops the empties the sources use. */
export function cleanTitle(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/**
 * A bare `www.example.co.il` (how both חבר and הוט store supplier sites) ->
 * an absolute https URL. Returns null for anything that is not plausibly a
 * host, so a junk value becomes "no link" rather than a link to nowhere.
 */
export function toAbsoluteUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}
