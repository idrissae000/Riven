import type { ArcanePriceRow } from "@/lib/data";
import { effectivePrice, type PriceBasis } from "./effective-price";

/** What the arcane pages show for one arcane's price. */
export interface ArcanePriceView {
  /** The unranked price shown and used for sorting / collection values. */
  price: number | null;
  basis: PriceBasis;
  /** Plain-language workings for a derived price ("max rank 60 ÷ 21 copies — the rank-0 market had too few listings"). */
  note: string | null;
  /** Cheapest online rank-0 listing, and how many listings the rank-0 average is of. */
  low: number | null;
  listings: number;
  volume48h: number | null;
  soldAvg48h: number | null;
  /** False until the first fetch of this arcane has landed. */
  fetched: boolean;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function priceView(row: ArcanePriceRow | undefined, maxRank: number | null): ArcanePriceView | null {
  if (!row) return null;
  const e = effectivePrice({ avg5: row.avg5, listings: row.listings, maxAvg5: row.max_avg5, maxListings: row.max_listings }, maxRank);
  const note = e.basis === "derived" && e.derivation
    ? `max rank ${fmt(e.derivation.maxPrice)} ÷ ${e.derivation.copies} copies — the rank-0 market ${e.why === "no listings" ? "has no listings" : e.why === "priced above max rank" ? "is priced above max rank" : "has too few listings"}`
    : null;
  return { price: e.price, basis: e.basis, note, low: row.low, listings: row.listings, volume48h: row.volume_48h, soldAvg48h: row.sold_avg_48h, fetched: !!row.fetched_at };
}
