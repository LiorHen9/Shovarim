import { z } from "zod";

// Shared client+server schemas for the admin club-catalog editor (ADR #61,
// Phase 10.1.b). The catalog is still `allow write: if false` for every
// client — these validate input to Server Actions that write with the Admin
// SDK, which bypasses Rules. That makes the schema the *only* boundary
// between an authenticated admin's browser and the catalog, so it is enforced
// server-side and not merely used to decorate the form.

// Slugs, not Firestore auto-ids: a club card's doc id is `${clubId}-${cardId}`
// and both halves show up in exports and (later) benefit-source config, so
// they have to stay readable and stable. Stricter than firestoreIdSchema — no
// uppercase and no underscore — because a catalog with both "mifal-hapais"
// and "Mifal_Hapais" in it is a catalog nobody can reason about.
export const clubSlugSchema = z
  .string()
  .trim()
  .min(2, "מזהה קצר מדי")
  .max(60, "מזהה ארוך מדי")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "מזהה באותיות אנגליות קטנות, ספרות ומקפים בלבד");

// The accent bar and the letter-tile fallback both read this straight into a
// style attribute, so it is pinned to a 6-digit hex rather than accepting any
// CSS colour string.
export const clubColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "צבע חייב להיות בפורמט #RRGGBB");

// Empty means "this club has no live site" (אשמורת); upsertClub stores that as
// null, which is what makes ClubsGrid render no link instead of a dead one.
// Kept as "" rather than null here on purpose — this schema also types the
// admin form, and a text input's empty value is "", not null. http:// is
// rejected outright: the link opens in a new tab from an authenticated page,
// and there is no reason to ship a downgrade.
export const clubWebsiteSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^https:\/\/\S+\.\S+/.test(value), {
    message: "כתובת חייבת להתחיל ב-https:// או להישאר ריקה",
  });

// How many benefits the Phase 10.2 scraper may keep for a club or a card.
//
// 50 rather than "everything" because the sources are far larger than they
// look — הוט alone publishes ~7,100 benefits — and an uncapped first run would
// put tens of thousands of documents in Firestore before anyone had seen
// whether the parsing was even right.
export const DEFAULT_BENEFIT_SCRAPE_LIMIT = 50;

// 0 is "no cap", not "none" — stated in the field's own label in the form,
// because a bare 0 in a numeric input reads as "disabled" to most people.
//
// A plain z.number() rather than z.coerce, matching sortOrder above: the form
// registers this with { valueAsNumber: true }, so a number is what arrives.
// Neither is there a .default() — the absent-field case belongs to
// listCatalogForAdmin(), which substitutes DEFAULT_BENEFIT_SCRAPE_LIMIT for
// rows written before Phase 10.2. Putting it here too would make the schema's
// input and output types differ, which zodResolver cannot type.
export const benefitScrapeLimitSchema = z
  .number({ message: "יש להזין מספר" })
  .int("יש להזין מספר שלם")
  .min(0, "מספר לא תקין")
  .max(10000, "מקסימום 10,000");

export const clubFormSchema = z.object({
  id: clubSlugSchema,
  name: z.string().trim().min(1, "יש להזין שם").max(80),
  description: z.string().trim().max(300),
  website: clubWebsiteSchema,
  color: clubColorSchema,
  sortOrder: z.number().int().min(0, "מספר לא תקין").max(9999),
  isActive: z.boolean(),
  benefitScrapeLimit: benefitScrapeLimitSchema,
});
export type ClubFormValues = z.infer<typeof clubFormSchema>;

export const clubCardFormSchema = z.object({
  clubId: clubSlugSchema,
  // The tier half only — the stored doc id is `${clubId}-${cardId}`.
  cardId: clubSlugSchema,
  name: z.string().trim().min(1, "יש להזין שם").max(80),
  description: z.string().trim().max(300),
  sortOrder: z.number().int().min(0, "מספר לא תקין").max(9999),
  isActive: z.boolean(),
  benefitScrapeLimit: benefitScrapeLimitSchema,
});
export type ClubCardFormValues = z.infer<typeof clubCardFormSchema>;

export const clubIdOnlySchema = z.object({ clubId: clubSlugSchema });
export const clubCardIdSchema = z.object({
  clubId: clubSlugSchema,
  cardId: clubSlugSchema,
});

// Logos are icons — the seven seeded ones are 8KB–56KB. The cap is well under
// Next's 1MB default Server Action body limit on purpose: the file travels
// through a Server Action rather than a client upload (clubLogos/ is
// `allow write: if false`, so no browser may write there), and a limit that
// could reach the framework's own would surface as an opaque 413 instead of
// this message.
export const MAX_CLUB_LOGO_BYTES = 512 * 1024;

// SVG is allowed deliberately, with the trade-off stated: an SVG opened
// *directly* by URL is a document and can run script, unlike one in an <img>,
// which is how the app renders it. That script would run on
// firebasestorage.googleapis.com — a Google-owned origin with no access to
// this app's cookies or storage — and only an admin can upload at all, which
// is an actor who can already delete every user. Logos are the one asset where
// a vector genuinely beats a bitmap, so the surface is accepted rather than
// traded away.
export const CLUB_LOGO_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;

// Shared by the browser (before upload, for an instant message) and by the
// Server Action (which cannot trust that the browser ran it).
export function validateClubLogo(file: { type: string; size: number }): string | null {
  if (!(CLUB_LOGO_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return "פורמט לא נתמך — PNG, JPEG, WebP או SVG";
  }
  if (file.size > MAX_CLUB_LOGO_BYTES) return "הקובץ גדול מדי (מקסימום 512KB)";
  if (file.size === 0) return "הקובץ ריק";
  return null;
}
