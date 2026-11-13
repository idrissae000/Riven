export interface MarketListing { id: string; seller: string; sellerStatus: string; price: number; matchKind: "exact" | "similar" }
export interface MarketEstimate { low: number; median: number; high: number }

export type RivenStrategy = "median" | "low" | "undercut" | "match";
export const RIVEN_STRATEGIES: { value: RivenStrategy; label: string; help: string }[] = [
  { value: "median", label: "Estimated value (median)", help: "Our market estimate for this riven, adjusted for its roll quality." },
  { value: "low", label: "Low end of the estimate", help: "The low end of our estimate — for a quicker sale." },
  { value: "undercut", label: "Undercut the cheapest online match by 1", help: "1 platinum below the cheapest comparable riven from an online / in-game seller." },
  { value: "match", label: "Match the cheapest online match", help: "The same as the cheapest comparable riven from an online / in-game seller." },
];

/** The `count` cheapest comparable rivens from players who are online or in game, cheapest first. */
export function cheapestOnlineRivens(listings: MarketListing[] | null | undefined, count = 5): MarketListing[] {
  return (listings ?? []).filter((l) => (l.sellerStatus === "ingame" || l.sellerStatus === "online") && l.price > 0).sort((a, b) => a.price - b.price).slice(0, count);
}

/** The price to list at for a strategy, or null when there's nothing to price from (no estimate / no online comparables). */
export function rivenAutoPrice(estimate: MarketEstimate | null | undefined, online: MarketListing[], strategy: RivenStrategy): number | null {
  if (strategy === "median") return estimate ? Math.max(1, Math.round(estimate.median)) : null;
  if (strategy === "low") return estimate ? Math.max(1, Math.round(estimate.low)) : null;
  if (!online.length) return null;
  return strategy === "match" ? online[0].price : Math.max(1, online[0].price - 1);
}
