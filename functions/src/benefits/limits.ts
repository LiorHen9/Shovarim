// Enforces the two extraction caps the admin panel configures: one on the club
// and one on each of its cards (src/lib/validation/club.ts,
// DEFAULT_BENEFIT_SCRAPE_LIMIT = 50).
//
// Kept apart from the adapters, and given to them only as two callbacks
// (`offer` / `shouldStop`), so no adapter has to know the cap model at all —
// which is what lets a future adapter for a closed club inherit cap
// enforcement without a line of its own.
//
// It is also what makes the caps a *fetch* optimisation and not just a storage
// one: `shouldStop()` going true is why הוט pulls 2 pages at the default cap
// instead of all 237.
import type { ParsedBenefit } from "./types";

/** 0 means "no cap" — the admin panel labels the field that way. */
const UNLIMITED = 0;

export interface LimiterConfig {
  clubLimit: number;
  /** clubCards doc id -> its own cap. A card missing here is uncapped. */
  cardLimits: Record<string, number>;
}

export interface Limiter {
  /** Offer one benefit, in the source's own order. */
  offer: (benefit: ParsedBenefit) => "kept" | "rejected";
  /** True once nothing further could be accepted, so the adapter can stop. */
  shouldStop: () => boolean;
  kept: () => ParsedBenefit[];
  cappedBy: () => "club" | "card" | null;
  /** How many were offered in total, accepted or not. */
  offered: () => number;
}

const isUnlimited = (limit: number) => limit === UNLIMITED;
const hasRoom = (limit: number, used: number) => isUnlimited(limit) || used < limit;

export function createLimiter(config: LimiterConfig): Limiter {
  const kept: ParsedBenefit[] = [];
  const cardUsage = new Map<string, number>();
  let offered = 0;
  let cappedBy: "club" | "card" | null = null;

  const cardLimitFor = (cardId: string) => config.cardLimits[cardId] ?? UNLIMITED;
  const usageFor = (cardId: string) => cardUsage.get(cardId) ?? 0;

  // A benefit is admissible while *any* of its cards still has room. Requiring
  // every card to have room would let one full card block a benefit that the
  // club's other, emptier card still wants — which is the wrong answer for
  // מפעל הפיס, the only multi-tier club, where most benefits carry both tiers.
  const cardWithRoom = (benefit: ParsedBenefit) =>
    benefit.clubCardIds.some((cardId) => hasRoom(cardLimitFor(cardId), usageFor(cardId)));

  const clubFull = () => !hasRoom(config.clubLimit, kept.length);

  return {
    offer(benefit) {
      offered += 1;

      if (clubFull()) {
        cappedBy = "club";
        return "rejected";
      }
      if (!cardWithRoom(benefit)) {
        // Only the club cap is allowed to overwrite this: if both bite, the
        // club cap is the more useful thing to report, since it is the one
        // that bounded the run as a whole.
        if (cappedBy === null) cappedBy = "card";
        return "rejected";
      }

      kept.push(benefit);
      // Counted against every card it applies to, including cards that were
      // already full — the benefit is stored for them too, so pretending
      // otherwise would let a card exceed its own cap.
      for (const cardId of benefit.clubCardIds) {
        cardUsage.set(cardId, usageFor(cardId) + 1);
      }
      return "kept";
    },

    // Stops only when nothing more can *ever* be accepted. The club being full
    // is final. Cards are trickier: a benefit for card B is still wanted while
    // card A is full, so this only gives up once every known card is full —
    // and never when a card cap is missing, since an unknown card is uncapped.
    shouldStop() {
      if (clubFull()) return true;
      const cardIds = Object.keys(config.cardLimits);
      if (cardIds.length === 0) return false;
      return cardIds.every((cardId) => !hasRoom(cardLimitFor(cardId), usageFor(cardId)));
    },

    kept: () => kept,
    cappedBy: () => cappedBy,
    offered: () => offered,
  };
}
