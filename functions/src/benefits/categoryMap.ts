// Maps each source's own category name onto the six system categories seeded by
// scripts/seed-categories.ts, so /clubs can filter benefits with the same
// vocabulary the rest of the app already uses.
//
// Keyword rules rather than an exact-name lookup, because the vocabularies are
// long-tailed and unstable: a sample of הוט alone turned up 55+ distinct
// `item_category` values ("חומוסיות", "מיצוי זכויות והחזרי מס"), and the clubs
// rename them for every holiday. An exact table would silently dump most rows
// into "other" the first time a source added a category. `sourceCategory` is
// always stored verbatim alongside, so what a rule missed stays visible in the
// admin panel rather than being lost.
//
// The six ids are fixed by seed-categories.ts — `system-${id}`.
export const SYSTEM_CATEGORY_IDS = {
  restaurants: "system-restaurants",
  shopping: "system-shopping",
  gifts: "system-gifts",
  entertainment: "system-entertainment",
  electronics: "system-electronics",
  other: "system-other",
} as const;

// Order is the rule: the first bucket with a matching keyword wins, so these
// run most-specific first.
//
// Two orderings here are deliberate and easy to get wrong on a later edit:
//   - restaurants before shopping, so "בית קפה" is a café and not homeware
//     ("לבית ולחצר").
//   - gifts before entertainment, so חבר's "מתנות ופנאי" is a gift shop rather
//     than a leisure activity.
//
// Voucher words (תווי / שוברים) are deliberately *not* keywords anywhere: they
// describe the form, not the subject, and treating them as a category sends
// "תווים למסעדות ובתי קפה" to gifts while "שוברים ותווי קניה" goes to
// shopping. Letting the rest of the string decide keeps that consistent.
const RULES: ReadonlyArray<readonly [keyof typeof SYSTEM_CATEGORY_IDS, readonly string[]]> = [
  ["electronics", ["חשמל", "אלקטרוני", "מחשב", "סמארטפון", "סלולר", "צילום", "מצלמ", "גיימינג"]],
  [
    "restaurants",
    [
      "מסעד", "קפה", "פיצרי", "המבורגר", "סושי", "אסייתי", "חומוס", "גלידרי",
      "מאפי", "קונדיטורי", "פאב", "קייטרינג", "מעדני", "בשר", "יקב", "בירה",
      "שף", "מזון", "אוכל", "משקאות", "ארוח", "תבלינים", "פיצוח", "מיצים",
      "מתוקים", "קינוח", "טבע",
    ],
  ],
  ["gifts", ["מתנ", "יודאיקה", "פרחים", "עציצ"]],
  [
    "entertainment",
    [
      "בילוי", "פנאי", "תרבות", "מופע", "הצג", "קולנוע", "סרט", "אטרקצי",
      "נופש", "תיירות", "חופש", "טיול", "ספא", "ספורט", "חוג", "קורס",
      "לימוד", "מוזיק", "פסטיבל", "מלון", "חוויו", "משפחתי", "live",
    ],
  ],
  [
    "shopping",
    [
      "קני", "צרכנות", "שופינג", "חנו", "אופנ", "ביגוד", "הנעל", "הלבשה",
      "טיפוח", "קוסמטיק", "תכשיט", "שעונ", "אקססו", "אופטיק", "ריהוט",
      "טקסטיל", "שינה", "ילדים", "תינוק", "ספרים", "חיות מחמד", "מטבח",
      "נסיעות", "מחנא", "לבית", "לגן", "לחצר", "רשתות",
    ],
  ],
];

/**
 * Source category name -> a system category id. Never throws, never returns
 * empty: an unrecognised name becomes `system-other`.
 *
 * Handles the comma-separated multi-values חבר uses
 * ("ביגוד והנעלה,ספורט", and up to four at once) by testing each part in turn
 * and taking the first that matches a rule — so a row is filed under something
 * specific rather than under whichever value happened to be written first.
 */
export function mapCategory(sourceCategory: string | null | undefined): string {
  if (!sourceCategory) return SYSTEM_CATEGORY_IDS.other;

  const parts = sourceCategory
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  for (const part of parts) {
    for (const [bucket, keywords] of RULES) {
      if (keywords.some((keyword) => part.includes(keyword))) {
        return SYSTEM_CATEGORY_IDS[bucket];
      }
    }
  }

  return SYSTEM_CATEGORY_IDS.other;
}
