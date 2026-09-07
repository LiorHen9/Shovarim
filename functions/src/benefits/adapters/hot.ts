// הוט (מועדון הוט צרכנות) — the easiest of the three: a public, unauthenticated
// JSON API.
//
//   GET https://api.hot.co.il/api/website/2.0/getAllBenefits/?page=N&size=30
//
// `size` is pinned to 30 by the server (asking for 200 still returns 30), so
// the page count is fixed: ~7,100 benefits over 237 pages, and page 238 comes
// back empty. At the default cap of 50 this stops after 2 pages.
//
// robots.txt note: www.hot.co.il disallows /api/, but api.hot.co.il is a
// separate host with its own robots.txt that is `Allow: /` with no Disallow,
// and its Content-Signal is `use=reference` — which is exactly what linking to
// a benefit page is. See ADR #62.
import { fetchAllowedJson } from "../http";
import { cleanTitle, parseDate, parsePrice, stripHtml } from "../text";
import type { AdapterSink, AdapterResult, ParsedBenefit } from "../types";

const API = "https://api.hot.co.il/api/website/2.0/getAllBenefits/";
const IMAGE_BASE = "https://cdn.hot.co.il";
const BENEFIT_PAGE = "https://www.hot.co.il/הטבה";

// A backstop, not the real stop condition: the loop ends on an empty page or a
// full limiter. This only bounds the damage if the API ever starts returning
// records forever.
const MAX_PAGES = 300;

interface HotRecord {
  id?: number;
  title?: string;
  clean_title?: string;
  description?: string;
  free_text?: string;
  small_description?: string;
  item_category?: string;
  item_brand?: string;
  price_after_discount?: string | number | null;
  price_before_discount?: string | number | null;
  discount?: number;
  value?: string;
  imagePath?: string;
  expiryDate?: string | null;
  is_expired?: boolean;
  active?: boolean;
  exclude_from_search_results?: boolean;
  hideFromSearch?: boolean;
}

interface HotResponse {
  data?: {
    metaData?: { totalResults?: number };
    records?: HotRecord[];
  };
}

function toBenefit(record: HotRecord, clubCardIds: string[]): ParsedBenefit | null {
  if (typeof record.id !== "number") return null;

  const title = cleanTitle(record.title ?? record.clean_title);
  if (!title) return null;

  const priceFrom = parsePrice(record.price_after_discount);
  const originalPrice = parsePrice(record.price_before_discount);

  // `value` is free text like "חודש מתנה" or "20% הנחה" and is the only signal
  // on the many הוט benefits that have no price at all — a discount at the
  // till rather than something you buy. Falling back to the numeric `discount`
  // keeps those rows from looking like they have no offer.
  const discountText =
    cleanTitle(record.value) ||
    (typeof record.discount === "number" && record.discount > 0 ? `${record.discount}% הנחה` : "") ||
    null;

  const sourceCategory = cleanTitle(record.item_category) || null;

  return {
    sourceKey: String(record.id),
    clubCardIds,
    kind: "offer",
    title,
    description: stripHtml(record.description ?? record.small_description ?? record.free_text),
    sourceCategory,
    priceFrom,
    originalPrice,
    discountText,
    // The slug in the canonical URL (…/הטבה/61561/דיאלוג-מוזיקלי) is
    // decorative — verified that the id alone returns 200. encodeURI because
    // the path segment "הטבה" is Hebrew.
    url: encodeURI(`${BENEFIT_PAGE}/${record.id}`),
    imageUrl: record.imagePath ? `${IMAGE_BASE}${record.imagePath}` : null,
    provider: cleanTitle(record.item_brand) || null,
    validUntil: parseDate(record.expiryDate),
    sourceMemberTypes: null,
  };
}

export function createHotAdapter(clubCardIds: string[]) {
  return async function hotAdapter(sink: AdapterSink): Promise<AdapterResult> {
    const errors: string[] = [];
    let sourceTotal = 0;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      if (sink.shouldStop()) break;

      let response: HotResponse;
      try {
        response = await fetchAllowedJson<HotResponse>(`${API}?page=${page}&size=30`);
      } catch (error) {
        // One bad page should not lose the pages already collected: record it
        // and stop. The runner's shrink guard is what decides whether the
        // partial result is trustworthy enough to overwrite with.
        errors.push(`הוט: עמוד ${page} נכשל — ${String(error)}`);
        break;
      }

      // Read from the first page only: it is the source's own total, so it
      // stays correct no matter how few pages the cap let us pull. That is
      // what the runner's shrink guard needs to compare across runs.
      if (page === 1) sourceTotal = response.data?.metaData?.totalResults ?? 0;

      const records = response.data?.records ?? [];
      if (records.length === 0) break;

      for (const record of records) {
        if (record.is_expired === true) continue;
        if (record.active === false) continue;
        if (record.exclude_from_search_results === true || record.hideFromSearch === true) continue;

        const benefit = toBenefit(record, clubCardIds);
        if (!benefit) continue;
        sink.offer(benefit);
        if (sink.shouldStop()) break;
      }
    }

    return { sourceTotal, errors };
  };
}

// Exported for tests/unit/ — lets the field mapping be pinned against a real
// captured record without any network. Category mapping is deliberately not
// done here; the runner applies mapCategory() to every adapter's output.
export const __test = { toBenefit };
