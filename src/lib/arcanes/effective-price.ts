/**
 * The unranked price an arcane is shown (and valued) at.
 *
 * Ranking an arcane is done by combining copies of it, and the copies needed in total are the triangular numbers
 * 1, 3, 6, 10, 15, 21 for ranks 0…5 — so a max-rank (5) arcane is made of 21 unranked ones, a max-rank-3 arcane of 10.
 * That means a single unranked copy cannot be worth more than (max-rank price ÷ copies) for long: if the unranked
 * listings say otherwise, they are a lone, stale or hopeful ask. So when the rank-0 market is too thin to trust — or
 * absent, or priced at/above the max-rank price (impossible) — the price is the max-rank price divided by the copies.
 */
export const MIN_LISTINGS = 3;

/** Unranked copies needed to build a copy at `rank` (rank 0 → 1, rank 3 → 10, rank 5 → 21). */
export const copiesForRank = (rank: number) => ((rank + 1) * (rank + 2)) / 2;

export interface PriceInputs {
  /** Average of the 5 cheapest online rank-0 listings, and how many listings that is. */
  avg5: number | null;
  listings: number;
  /** Same at the arcane's max rank. */
  maxAvg5: number | null;
  maxListings: number;
}

export type PriceBasis =
  | "listings"  // enough rank-0 listings: the average of the cheapest 5
  | "derived"   // max-rank price ÷ copies, because the rank-0 data was thin / missing / impossible
  | "thin"      // few rank-0 listings and no usable max-rank price either: shown, but shaky
  | "none";

export interface EffectivePrice {
  price: number | null;
  basis: PriceBasis;
  /** Why the rank-0 listings were not used (derived only). */
  why?: "too few listings" | "no listings" | "priced above max rank";
  /** The workings of a derived price, for display: "max rank 81.6 ÷ 10 copies". */
  derivation?: { maxPrice: number; copies: number };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function effectivePrice(p: PriceInputs, maxRank: number | null): EffectivePrice {
  const hasMax = p.maxAvg5 != null && p.maxListings >= MIN_LISTINGS && !!maxRank && maxRank > 0;
  const solidRank0 = p.avg5 != null && p.listings >= MIN_LISTINGS;
  const aboveMax = solidRank0 && hasMax && (p.avg5 as number) >= (p.maxAvg5 as number);

  if (solidRank0 && !aboveMax) return { price: p.avg5, basis: "listings" };

  if (hasMax) {
    const copies = copiesForRank(maxRank as number);
    return {
      price: r1((p.maxAvg5 as number) / copies),
      basis: "derived",
      why: aboveMax ? "priced above max rank" : p.avg5 == null ? "no listings" : "too few listings",
      derivation: { maxPrice: p.maxAvg5 as number, copies },
    };
  }
  return p.avg5 != null ? { price: p.avg5, basis: "thin" } : { price: null, basis: "none" };
}
