// טוב+ and פיס פלוס. One adapter, two clubs: both run on the same white-label
// "Dolce" platform (their images even share media.dolcemaster.co.il), so the
// page shape is identical and only the origin differs.
//
// There is a REST API behind the site (POST /category/filter), but it is
// Laravel and answers an unauthenticated POST with 419 (CSRF token mismatch).
// The server-rendered `window.__PRELOADED_STATE__` blob carries the same
// payload with no token dance, so that is what this reads. robots.txt on both
// hosts is `Allow: /`, with /category/ not disallowed.
import { fetchAllowedText } from "../http";
import { cleanTitle, parsePrice, stripHtml } from "../text";
import type { AdapterSink, AdapterResult, ParsedBenefit } from "../types";

const MAX_CATEGORIES = 200;

// How many products to take from a category before moving to the next one.
// Small enough that a default cap of 50 draws on several categories, large
// enough that a club with few categories still fills up on the first pass.
const FIRST_PASS_PER_CATEGORY = 8;

interface DolceProduct {
  product_id?: number;
  name?: string;
  short_description?: string;
  club_price?: number | string | null;
  market_price?: number | string | null;
  discounted_price?: number | string | null;
  image_url?: string;
  provider_name?: string;
  business_name?: string;
  out_of_stock?: string;
  allowed_for_member_types?: number[];
}

interface DolceCategory {
  category_id?: number;
  is_homepage?: string;
  name?: string;
  category_name?: string;
  product_count?: string | number;
  products?: DolceProduct[];
  categories?: DolceCategory[];
}

interface DolceState {
  config?: {
    categories?: DolceCategory[];
    sub_categories?: DolceCategory[];
    category?: DolceCategory;
  };
}

/**
 * Pulls the `window.__PRELOADED_STATE__ = {...}` object out of a page.
 *
 * The brace matching is hand-rolled and string-aware rather than a regex,
 * which is the whole point: the payload is ~1MB of Hebrew product copy that
 * routinely contains braces inside string values, so a lazy regex match
 * truncates mid-object and a greedy one swallows the rest of the page.
 * Escapes are tracked so an escaped quote inside a string does not end it.
 *
 * This is the most fragile function in the feature — the one that breaks if
 * the platform changes its bootstrap — so it has direct unit coverage.
 */
export function extractPreloadedState(html: string): DolceState | null {
  const marker = /window\.__PRELOADED_STATE__\s*=\s*\{/.exec(html);
  if (!marker) return null;

  const start = marker.index + marker[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const char = html[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as DolceState;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function toBenefit(
  product: DolceProduct,
  origin: string,
  clubCardIds: string[],
  sourceCategory: string | null
): ParsedBenefit | null {
  if (typeof product.product_id !== "number") return null;

  const title = cleanTitle(product.name);
  if (!title) return null;

  // club_price is the members' price — the "החל מ" the product asked for.
  // discounted_price is the non-member price and market_price the list price,
  // so the "was" figure is the higher of whichever exist.
  const priceFrom = parsePrice(product.club_price);
  const market = parsePrice(product.market_price);
  const discounted = parsePrice(product.discounted_price);
  const originalPrice =
    market !== null && discounted !== null ? Math.max(market, discounted) : (market ?? discounted);

  return {
    sourceKey: String(product.product_id),
    clubCardIds,
    kind: "offer",
    title,
    description: stripHtml(product.short_description),
    sourceCategory,
    priceFrom,
    originalPrice,
    discountText: null,
    url: `${origin}/product/${product.product_id}`,
    imageUrl: product.image_url || null,
    provider: cleanTitle(product.provider_name ?? product.business_name) || null,
    validUntil: null,
    // מפעל הפיס really has four eligibility levels (כסף/זהב/זהב+/פלטינום) and
    // this is them, unmapped. ADR #61 decision 8 collapsed the catalog to
    // רגיל/VIP; keeping the raw codes means resolving that later is a data
    // migration rather than another full scrape.
    sourceMemberTypes: Array.isArray(product.allowed_for_member_types)
      ? product.allowed_for_member_types
      : null,
  };
}

export interface DolceConfig {
  /** e.g. "https://www.tovplus.org.il" — no trailing slash. */
  origin: string;
  clubCardIds: string[];
}

export function createDolceAdapter(config: DolceConfig) {
  return async function dolceAdapter(sink: AdapterSink): Promise<AdapterResult> {
    const errors: string[] = [];

    let homeHtml: string;
    try {
      homeHtml = await fetchAllowedText(`${config.origin}/`);
    } catch (error) {
      return { sourceTotal: 0, errors: [`Dolce: דף הבית לא נטען — ${String(error)}`] };
    }

    const home = extractPreloadedState(homeHtml);
    if (!home?.config) {
      return {
        sourceTotal: 0,
        errors: ["Dolce: __PRELOADED_STATE__ לא נמצא בדף הבית — ייתכן שהפלטפורמה השתנתה"],
      };
    }

    const roots = [...(home.config.categories ?? []), ...(home.config.sub_categories ?? [])];

    // The source's own total, from the home page alone — no category visited.
    // product_count double-counts products that sit in several categories, so
    // this is an upper bound rather than a headcount. That is what the shrink
    // guard wants: it compares this number against itself across runs, so
    // consistency matters and exactness does not.
    const sourceTotal = roots.reduce((sum, category) => sum + (Number(category.product_count) || 0), 0);

    // Breadth-first, not depth-first, specifically because of the cap: at the
    // default 50 a depth-first walk would exhaust one category and return 50
    // products on a single subject, while this spreads them across the club's
    // top-level sections.
    const queue: number[] = [];
    const visited = new Set<number>();
    const seenProducts = new Set<number>();
    // Products fetched but not offered in the first pass, one list per
    // category, drained round-robin below.
    const leftovers: ParsedBenefit[][] = [];

    // The home-page category is visited last, because the category a product
    // is found under is the only category signal these pages carry. The home
    // page lists everything, so taking products from it first files them under
    // "דף הבית" — which maps to system-other and tells a reader nothing. This
    // uses the platform's own is_homepage flag rather than matching the Hebrew
    // name, so it keeps working when a club renames the tab.
    //
    // Measured: this moved a third of the rows out of system-other.
    const ordered = [...roots].sort(
      (a, b) => Number(a.is_homepage === "Y") - Number(b.is_homepage === "Y")
    );

    for (const category of ordered) {
      if (typeof category.category_id === "number") queue.push(category.category_id);
    }

    while (queue.length > 0 && visited.size < MAX_CATEGORIES) {
      if (sink.shouldStop()) break;

      const categoryId = queue.shift();
      // link_to_category_id makes the category graph cyclic, so this is load
      // bearing rather than defensive.
      if (categoryId === undefined || visited.has(categoryId)) continue;
      visited.add(categoryId);

      let state: DolceState | null;
      try {
        state = extractPreloadedState(await fetchAllowedText(`${config.origin}/category/${categoryId}`));
      } catch (error) {
        errors.push(`Dolce: קטגוריה ${categoryId} נכשלה — ${String(error)}`);
        continue;
      }

      const category = state?.config?.category;
      if (!category) continue;

      const categoryName = cleanTitle(category.category_name ?? category.name) || null;

      for (const child of category.categories ?? []) {
        if (typeof child.category_id === "number" && !visited.has(child.category_id)) {
          queue.push(child.category_id);
        }
      }

      const fresh: ParsedBenefit[] = [];
      for (const product of category.products ?? []) {
        if (product.out_of_stock === "Y") continue;
        if (typeof product.product_id !== "number") continue;
        // The same product is listed under several categories; without this
        // the cap would be spent on duplicates.
        if (seenProducts.has(product.product_id)) continue;
        seenProducts.add(product.product_id);

        const benefit = toBenefit(product, config.origin, config.clubCardIds, categoryName);
        if (benefit) fresh.push(benefit);
      }

      // Only a slice now; the rest is parked for the second pass. Without this
      // the breadth-first walk above would be pointless: a category page
      // returns its products up to show:1000, so the very first category would
      // fill a cap of 50 on its own and every stored benefit would carry that
      // one category name. Measured before this: 50/50 of טוב+ under
      // "חגי תשרי", 45/50 of פיס פלוס under "שלח מתנה".
      for (const benefit of fresh.splice(0, FIRST_PASS_PER_CATEGORY)) {
        sink.offer(benefit);
        if (sink.shouldStop()) return { sourceTotal, errors };
      }
      if (fresh.length > 0) leftovers.push(fresh);
    }

    // Second pass over what the first pass parked, round-robin so the spread
    // survives. No fetching happens here — these were already downloaded — so
    // it costs nothing when the cap is generous enough to want them, and an
    // uncapped run still ends up with everything.
    for (let depth = 0; leftovers.some((list) => depth < list.length); depth += 1) {
      for (const list of leftovers) {
        const benefit = list[depth];
        if (!benefit) continue;
        sink.offer(benefit);
        if (sink.shouldStop()) return { sourceTotal, errors };
      }
    }

    return { sourceTotal, errors };
  };
}

export const __test = { toBenefit, extractPreloadedState };
