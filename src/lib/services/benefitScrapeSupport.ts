// Which clubs have a working benefit scraper, and why the others do not.
//
// Deliberately its own module with no imports at all: adminBenefits.ts pulls
// in the Admin SDK, which throws without credentials, and this constant needs
// to be readable by a plain unit test that checks it still agrees with
// functions/src/benefits/registry.ts.
//
// That duplication is the usual one — functions/tsconfig.json pins rootDir to
// "src", so src/ and functions/ cannot import from each other (ADR #24). The
// two copies are kept honest by tests/unit/benefitHttp.test.ts, which fails if
// they diverge. Only the ids and the reasons are mirrored; the adapters
// themselves are not something this side needs.
//
// null = a working adapter. A string = researched, nothing to scrape, and the
// string is what /admin/benefits shows in place of a "run" button.
export const CLUB_SCRAPE_SUPPORT: Record<string, string | null> = {
  hot: null,
  tov: null,
  "mifal-hapais": null,
  hever: null,
  shavve:
    "מועדון סגור — כל 64 נתיבי ה-API של הפלטפורמה (back.shavve.co.il) מחזירים 401 ללא התחברות חבר מועדון",
  behatsdaa: "מועדון סגור — back.behatsdaa.org.il מחזיר 401, והאתר עצמו מוגן ב-Imperva/Incapsula",
  ashmoret: "אין אתר פעיל — ashmoret-itu.co.il מחזיר עמוד ריק",
};
