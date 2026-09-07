import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { __test as hot } from "../../functions/src/benefits/adapters/hot";
import { __test as dolce } from "../../functions/src/benefits/adapters/dolce";
import { __test as hever } from "../../functions/src/benefits/adapters/hever";
import { mapCategory } from "../../functions/src/benefits/categoryMap";
import { parsePrice, stripHtml, toAbsoluteUrl } from "../../functions/src/benefits/text";

// Imports reach into functions/src on purpose. The scraper cannot live in src/
// (functions/tsconfig.json pins rootDir to "src", so the Cloud Function could
// not import it back — ADR #24), and the parsers are pure functions with no
// firebase-functions dependency, so the root vitest project can exercise them
// directly. scripts/sweep-account-deletions.ts already crosses the same way.
//
// The fixtures are real captures from the live sources, trimmed to a few
// records — not hand-written objects. A synthetic fixture would only ever
// prove the parser agrees with my idea of the payload, which is precisely the
// thing that breaks.
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("stripHtml", () => {
  it("turns a real Dolce short_description into plain text", () => {
    expect(stripHtml('<p><span style="color: #e60026;"><strong>הטבת פלוס</strong></span></p>')).toBe(
      "הטבת פלוס"
    );
  });

  it("keeps a word boundary where the markup was", () => {
    // Without the <br>/<\/p> handling these run together into "אחתשתיים".
    expect(stripHtml("<p>אחת</p><p>שתיים</p>")).toBe("אחת שתיים");
    expect(stripHtml("אחת<br>שתיים")).toBe("אחת שתיים");
  });

  it("decodes the entities the sources actually emit", () => {
    expect(stripHtml("עד 1,000 ש&quot;ח&nbsp;לעסקה")).toBe('עד 1,000 ש"ח לעסקה');
  });

  it("is empty for nullish input rather than throwing", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(undefined)).toBe("");
  });
});

describe("parsePrice", () => {
  it("accepts both shapes the sources send", () => {
    expect(parsePrice(25)).toBe(25); // Dolce sends numbers
    expect(parsePrice("44")).toBe(44); // הוט sends strings
  });

  it("strips currency and thousands separators", () => {
    expect(parsePrice("₪1,299.90")).toBe(1299.9);
  });

  it("treats 0 and empty as no price", () => {
    // 0 has to become null: a benefit stored as "from ₪0" would sort to the
    // top of every price-ascending list and be wrong every time.
    expect(parsePrice(0)).toBeNull();
    expect(parsePrice("")).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice("חינם")).toBeNull();
  });
});

describe("toAbsoluteUrl", () => {
  it("adds a scheme to the bare hosts חבר stores", () => {
    expect(toAbsoluteUrl("www.shashagifts.com")).toBe("https://www.shashagifts.com/");
  });

  it("rejects values that are not hosts", () => {
    expect(toAbsoluteUrl("אין אתר")).toBeNull();
    expect(toAbsoluteUrl("")).toBeNull();
    expect(toAbsoluteUrl(null)).toBeNull();
  });
});

describe("הוט adapter", () => {
  const page = JSON.parse(fixture("hot-page1.json")) as {
    data: { records: Array<Record<string, unknown>> };
  };

  it("maps a real record onto every field the product asked for", () => {
    const record = page.data.records[0]!;
    const benefit = hot.toBenefit(record, ["hot-regular"]);

    expect(benefit).not.toBeNull();
    expect(benefit!.sourceKey).toBe(String(record.id));
    expect(benefit!.clubCardIds).toEqual(["hot-regular"]);
    expect(benefit!.kind).toBe("offer");
    expect(benefit!.title).toBe(record.title);
    // The id alone resolves — the slug in the canonical URL is decorative.
    expect(benefit!.url).toBe(encodeURI(`https://www.hot.co.il/הטבה/${record.id}`));
    // cdn.hot.co.il, not www. (which serves the SPA shell for /media paths)
    // and not dl. (which redirects).
    expect(benefit!.imageUrl).toBe(`https://cdn.hot.co.il${record.imagePath}`);
    expect(benefit!.description).not.toContain("<");
  });

  it("carries the free-text offer when there is no numeric price", () => {
    // Most הוט benefits are a discount at the till, not something you buy, so
    // `value` is the only signal that there is an offer at all.
    const benefit = hot.toBenefit({ id: 1, title: "כותרת", value: "חודש מתנה" }, ["hot-regular"]);
    expect(benefit!.priceFrom).toBeNull();
    expect(benefit!.discountText).toBe("חודש מתנה");
  });

  it("falls back to the numeric discount when there is no text", () => {
    const benefit = hot.toBenefit({ id: 1, title: "כותרת", discount: 20 }, ["hot-regular"]);
    expect(benefit!.discountText).toBe("20% הנחה");
  });

  it("drops records with no id or no title rather than storing a blank row", () => {
    expect(hot.toBenefit({ title: "בלי מזהה" }, ["hot-regular"])).toBeNull();
    expect(hot.toBenefit({ id: 1, title: "   " }, ["hot-regular"])).toBeNull();
  });
});

describe("Dolce __PRELOADED_STATE__ extraction", () => {
  it("pulls the state out of a real category page", () => {
    const state = dolce.extractPreloadedState(fixture("dolce-category.html"));
    expect(state?.config?.category?.products?.length).toBeGreaterThan(0);
    expect(state?.config?.categories?.length).toBeGreaterThan(0);
  });

  it("survives braces inside string values", () => {
    // The real payload is ~1MB of Hebrew product copy; a product name
    // containing a brace is what defeats a naive regex. This is the whole
    // reason the extractor matches braces by hand.
    const html = `<script>window.__PRELOADED_STATE__ = {"config":{"note":"a } brace {"}};</script>`;
    expect(dolce.extractPreloadedState(html)).toEqual({ config: { note: "a } brace {" } });
  });

  it("survives escaped quotes inside string values", () => {
    const html = String.raw`<script>window.__PRELOADED_STATE__ = {"config":{"note":"say \"} \""}};</script>`;
    expect(dolce.extractPreloadedState(html)?.config).toEqual({ note: 'say "} "' });
  });

  it("returns null rather than throwing when the marker is gone", () => {
    // What a platform redesign looks like. The adapter turns this into a
    // recorded error on the run, not a crash.
    expect(dolce.extractPreloadedState("<html><body>nothing here</body></html>")).toBeNull();
  });

  it("returns null on a truncated payload", () => {
    expect(dolce.extractPreloadedState(`<script>window.__PRELOADED_STATE__ = {"a":1`)).toBeNull();
  });
});

describe("Dolce adapter", () => {
  const state = dolce.extractPreloadedState(fixture("dolce-category.html"));
  const products = state!.config!.category!.products!;

  it("maps a real product onto the required fields", () => {
    const product = products[0]!;
    const benefit = dolce.toBenefit(product, "https://www.tovplus.org.il", ["tov-regular"], "מזון ומסעדות");

    expect(benefit!.sourceKey).toBe(String(product.product_id));
    expect(benefit!.url).toBe(`https://www.tovplus.org.il/product/${product.product_id}`);
    // club_price is the members' price — the "החל מ" the product asked for.
    expect(benefit!.priceFrom).toBe(parsePrice(product.club_price));
    expect(benefit!.sourceCategory).toBe("מזון ומסעדות");
    expect(benefit!.description).not.toContain("<");
  });

  it("takes the higher of market and discounted price as the 'was' figure", () => {
    const benefit = dolce.toBenefit(
      { product_id: 1, name: "שם", club_price: 25, market_price: 50, discounted_price: 44 },
      "https://x.co.il",
      ["c"],
      null
    );
    expect(benefit!.priceFrom).toBe(25);
    expect(benefit!.originalPrice).toBe(50);
  });

  it("keeps the raw eligibility codes for the מפעל הפיס tier split", () => {
    // ADR #61 decision 8: פיס פלוס has four real levels but the catalog models
    // two. Keeping the codes means resolving that is a migration, not a
    // re-scrape.
    const benefit = dolce.toBenefit(
      { product_id: 1, name: "שם", allowed_for_member_types: [1, 2, 3, 4] },
      "https://x.co.il",
      ["a", "b"],
      null
    );
    expect(benefit!.sourceMemberTypes).toEqual([1, 2, 3, 4]);
  });
});

describe("חבר adapter", () => {
  it("reads the bare-array shape (giftcard.json)", () => {
    const rows = hever.rowsOf(JSON.parse(fixture("hever-giftcard.json")));
    expect(rows.length).toBe(3);
    expect(rows[0]!.company).toBeTruthy();
  });

  it("reads the { branch: [...] } shape, BOM and all", () => {
    // teamimcard_branches.json really does ship a UTF-8 BOM, and JSON.parse
    // throws an unhelpful "Unexpected token" on it. The fixture keeps the BOM
    // so this stays a real regression test; fetchAllowedJson strips it in
    // production, which is what the slice below stands in for.
    const raw = fixture("hever-teamim.json");
    expect(raw.charCodeAt(0)).toBe(0xfeff);
    expect(() => JSON.parse(raw)).toThrow();

    const rows = hever.rowsOf(JSON.parse(raw.slice(1)));
    expect(rows.length).toBe(3);
    expect(rows[0]!.name).toBeTruthy();
  });

  it("produces acceptance rows with no price", () => {
    // These files are merchant directories; חבר's priced benefits are behind
    // its login. Storing them as price-less offers would read as a parse
    // failure instead of the fact it is.
    const rows = hever.rowsOf(JSON.parse(fixture("hever-giftcard.json")));
    const benefit = hever.toBenefit(rows[0]!, ["hever-regular"]);

    expect(benefit!.kind).toBe("acceptance");
    expect(benefit!.priceFrom).toBeNull();
    expect(benefit!.originalPrice).toBeNull();
    expect(benefit!.discountText).toBeNull();
    // The logo base path is not publicly reachable, so no image is claimed.
    expect(benefit!.imageUrl).toBeNull();
  });

  it("prefers internal_link as the dedupe key", () => {
    const benefit = hever.toBenefit(
      { company: "עסק", sn: 841, internal_link: "mcc_item_new,360278" },
      ["hever-regular"]
    );
    expect(benefit!.sourceKey).toBe("mcc_item_new,360278");
  });

  it("falls back to a content-derived key for branch rows with no id", () => {
    // Has to be stable across runs, or every scrape would look like a
    // completely new set of merchants and sweep the previous one away.
    const row = { name: "אנג'לינה", city: "אילת", address: "טיילת המלך" };
    expect(hever.toBenefit(row, ["c"])!.sourceKey).toBe(hever.toBenefit(row, ["c"])!.sourceKey);
    expect(hever.toBenefit(row, ["c"])!.sourceKey).toContain("אילת");
  });

  it("keeps the limitations line, which is the useful part of these rows", () => {
    const benefit = hever.toBenefit(
      { company: "עסק", company_desc: "אתר מתנות", limitations: "עד 1,000 ש\"ח לעסקה" },
      ["hever-regular"]
    );
    expect(benefit!.description).toBe('אתר מתנות · עד 1,000 ש"ח לעסקה');
  });
});

describe("mapCategory", () => {
  it("files real source categories under the seeded system ids", () => {
    // Names taken from live samples of both platforms.
    expect(mapCategory("מסעדה")).toBe("system-restaurants");
    expect(mapCategory("בית קפה")).toBe("system-restaurants");
    expect(mapCategory("חשמל ומחשבים")).toBe("system-electronics");
    expect(mapCategory("בילויים וחוויות")).toBe("system-entertainment");
    expect(mapCategory("ביגוד והנעלה")).toBe("system-shopping");
  });

  it("splits the comma-separated multi-values חבר uses", () => {
    expect(mapCategory("ביגוד והנעלה,ספורט")).toBe("system-shopping");
    expect(mapCategory("גלידריה מתוקים וקינוחים,מארזים במשלוח")).toBe("system-restaurants");
  });

  it("keeps 'בית קפה' a café and 'לבית ולחצר' homeware", () => {
    // The ordering restaurants-before-shopping exists for exactly this pair.
    expect(mapCategory("בית קפה")).toBe("system-restaurants");
    expect(mapCategory("לבית ולחצר")).toBe("system-shopping");
  });

  it("prefers gifts over entertainment for חבר's 'מתנות ופנאי'", () => {
    expect(mapCategory("מתנות ופנאי")).toBe("system-gifts");
  });

  it("falls back to other, never to empty", () => {
    expect(mapCategory("מיצוי זכויות והחזרי מס")).toBe("system-other");
    expect(mapCategory(null)).toBe("system-other");
    expect(mapCategory("")).toBe("system-other");
  });
});
