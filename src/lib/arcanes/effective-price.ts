/**
 * The unranked price an arcane is shown (and valued) at — deliberately simple:
 *
 *   1. The average of the 5 cheapest online rank-0 sell listings.
 *   2. If there aren't 5 rank-0 listings: the cheapest online max-rank listing ÷ the copies a max-rank arcane is
 *      made of (ranks 0…5 take 1, 3, 6, 10, 15, 21 copies in total, so rank 5 → 21, a rank-3-max arcane → 10).
 *   3. If there's no max-rank listing either: whatever rank-0 listings exist (flagged "thin"), or no price.
 */
export const BOTTOM_LISTINGS = 5;

/** Unranked copies needed to build a copy at `rank` (rank 0 → 1, rank 3 → 10, rank 5 → 21). */
export const copiesForRank = (rank: number) => ((rank + 1) * (rank + 2)) / 2;

export interface PriceInputs {
  /** Average of the cheapest online rank-0 listings, and how many listings that is (0–5). */
  avg5: number | null;
  listings: number;
  /** The cheapest online max-rank listing. */
  maxLow: number | null;
}

export type PriceBasis =
  | "listings"  // a full 5 rank-0 listings: their average
  | "derived"   // cheapest max-rank listing ÷ copies
  | "thin"      // fewer than 5 rank-0 listings and no max-rank listing to derive from
  | "none";

export interface EffectivePrice {
  price: number | null;
  basis: PriceBasis;
  /** Why the rank-0 listings were not used (derived only). */
  why?: "fewer than 5 listings" | "no listings";
  /** The workings of a derived price, for display: "cheapest max rank 60 ÷ 21 copies". */
  derivation?: { maxPrice: number; copies: number };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function effectivePrice(p: PriceInputs, maxRank: number | null): EffectivePrice {
  if (p.avg5 != null && p.listings >= BOTTOM_LISTINGS) return { price: p.avg5, basis: "listings" };

  if (p.maxLow != null && maxRank && maxRank > 0) {
    const copies = copiesForRank(maxRank);
    return { price: r1(p.maxLow / copies), basis: "derived", why: p.avg5 == null ? "no listings" : "fewer than 5 listings", derivation: { maxPrice: p.maxLow, copies } };
  }
  return p.avg5 != null ? { price: p.avg5, basis: "thin" } : { price: null, basis: "none" };
}
