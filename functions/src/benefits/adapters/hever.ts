// חבר (מועדון הצרכנות של משרתי הקבע) — the one partially-open source.
//
// hvr.co.il itself is a login wall, but it serves three static JSON datasets
// that need no authentication and are regenerated every morning:
//
//   /bs2/datasets/giftcard.json             345 merchants honouring the gift card
//   /bs2/datasets/giftcard_branches.json    their branches
//   /bs2/datasets/teamimcard_branches.json  1,596 חבר טעמים restaurants
//
// **These are merchant directories, not priced offers.** חבר's actual benefits
// (with prices) live behind the login. Every row here is therefore
// kind: "acceptance" with a null price — see BenefitKind in ../types.ts for
// why that distinction is modelled rather than left implicit.
import { fetchAllowedJson } from "../http";
import { cleanTitle, stripHtml, toAbsoluteUrl } from "../text";
import type { AdapterSink, AdapterResult, ParsedBenefit } from "../types";

const BASE = "https://www.hvr.co.il/bs2/datasets";
const CLUB_SITE = "https://www.hvr.co.il";

interface HeverRecord {
  sn?: number;
  company?: string;
  name?: string;
  company_desc?: string;
  desc?: string;
  company_category?: string;
  category?: string;
  website?: string;
  limitations?: string;
  internal_link?: string;
  city?: string;
  address?: string;
  type?: string;
}

/** `{ branch: [...] }` in teamimcard_branches.json, a bare array in
 *  giftcard.json. Two shapes for the same idea, so both are accepted. */
type HeverFile = HeverRecord[] | { branch?: HeverRecord[] };

const rowsOf = (file: HeverFile): HeverRecord[] =>
  Array.isArray(file) ? file : (file.branch ?? []);

interface HeverSource {
  file: string;
  clubCardId: string;
}

function toBenefit(record: HeverRecord, clubCardIds: string[]): ParsedBenefit | null {
  const title = cleanTitle(record.company ?? record.name);
  if (!title) return null;

  // internal_link ("mcc_item_new,384198") is the club's own stable id and the
  // best dedupe key available. It points at mcc.co.il/mcc_item_new.aspx?id=…,
  // which was checked and returns a 6-byte auth-gated stub, so it is used as
  // an identifier only and never as a link.
  const sourceKey =
    cleanTitle(record.internal_link) ||
    (typeof record.sn === "number" ? String(record.sn) : "") ||
    // Last resort for branch rows that carry neither: stable across runs
    // because it is derived from the row's own content.
    `${title}|${cleanTitle(record.city)}|${cleanTitle(record.address)}`;

  const description = stripHtml(record.company_desc ?? record.desc ?? record.type);
  const limitations = cleanTitle(record.limitations);

  return {
    sourceKey,
    clubCardIds,
    kind: "acceptance",
    title,
    // The limitations line ("עד 1,000 ש\"ח לעסקה") is the single most useful
    // thing on these rows for someone deciding whether to walk in, so it is
    // kept rather than dropped for being an odd shape.
    description: [description, limitations].filter(Boolean).join(" · "),
    sourceCategory: cleanTitle(record.company_category ?? record.category) || null,
    // No prices anywhere in these files, by nature of what they are.
    priceFrom: null,
    originalPrice: null,
    discountText: null,
    url: toAbsoluteUrl(record.website) ?? CLUB_SITE,
    // The `logo` field holds a bare filename ("logo_shasha.jpg") and the base
    // path it hangs off is not publicly reachable — every plausible prefix
    // under hvr.co.il and mcc.co.il returns 404. Guessing would put a broken
    // image on every חבר row, so this stays null and ClubsGrid's letter-tile
    // fallback applies, which is the same call Club.logoUrl documents.
    imageUrl: null,
    provider: title,
    validUntil: null,
    sourceMemberTypes: null,
  };
}

/**
 * @param cardIds - which clubCards doc id each dataset belongs to. The gift
 *   card datasets describe the main חבר card; teamimcard describes חבר טעמים,
 *   a separate product with its own merchant list.
 */
export function createHeverAdapter(cardIds: { giftCard: string; teamim: string }) {
  const sources: HeverSource[] = [
    { file: "giftcard.json", clubCardId: cardIds.giftCard },
    { file: "giftcard_branches.json", clubCardId: cardIds.giftCard },
    { file: "teamimcard_branches.json", clubCardId: cardIds.teamim },
  ];

  return async function heverAdapter(sink: AdapterSink): Promise<AdapterResult> {
    const errors: string[] = [];
    // Keyed by sourceKey *and* card: the same restaurant legitimately appears
    // under both products, and those are two different facts about it.
    const seen = new Set<string>();
    const collected: ParsedBenefit[] = [];

    // Deliberately collected in full before anything is offered, unlike the
    // other two adapters. The whole source is three files already held in
    // memory, so there is no fetch to save by stopping early — and stopping
    // early here would make sourceTotal the *capped* count rather than the
    // source's size, which is precisely the number the runner's shrink guard
    // compares across runs. A cap change would then look like the source
    // collapsing and abort the run.
    for (const source of sources) {
      let rows: HeverRecord[];
      try {
        // fetchAllowedJson strips the UTF-8 BOM that teamimcard_branches.json
        // ships — JSON.parse throws an unhelpful "Unexpected token" on it.
        rows = rowsOf(await fetchAllowedJson<HeverFile>(`${BASE}/${source.file}`));
      } catch (error) {
        errors.push(`חבר: ${source.file} נכשל — ${String(error)}`);
        continue;
      }

      for (const row of rows) {
        const benefit = toBenefit(row, [source.clubCardId]);
        if (!benefit) continue;

        const dedupeKey = `${source.clubCardId}|${benefit.sourceKey}`;
        // giftcard.json and giftcard_branches.json overlap heavily — both
        // describe the same merchants — so without this the cap would be
        // spent listing the same shop twice.
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        collected.push(benefit);
      }
    }

    for (const benefit of collected) {
      if (sink.shouldStop()) break;
      sink.offer(benefit);
    }

    return { sourceTotal: collected.length, errors };
  };
}

export const __test = { toBenefit, rowsOf };
