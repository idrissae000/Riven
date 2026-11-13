import type { Listing } from "./listings";

export type RepriceRule = "undercut" | "match" | "market";

export const REPRICE_RULES: { value: RepriceRule; label: string; help: string }[] = [
  { value: "undercut", label: "Undercut the cheapest online seller by 1", help: "1 platinum below the cheapest other online / in-game seller." },
  { value: "match", label: "Match the cheapest online seller", help: "The same price as the cheapest other online / in-game seller." },
  { value: "market", label: "Market price", help: "The average of the 5 cheapest online listings (yours excluded)." },
];

export type OrderStatus = "cheapest" | "undercut" | "ok" | "no-market";

export interface RepriceResult {
  status: OrderStatus;
  /** The price the rule would set (never below the floor), or null without any market to price from. */
  target: number | null;
  /** How many platinum cheaper the cheapest other online seller is (0 when you're the cheapest). */
  behind: number;
  /** The cheapest other online seller's price. */
  cheapest: number | null;
}

/**
 * Where a sell order stands against other online / in-game sellers and what a rule would price it at. `mine` is excluded
 * from `listings` by seller name (your own orders don't count against you). `floor` stops the price going below it.
 */
export function repriceSellOrder(price: number, listings: Listing[], mine: string | null, rule: RepriceRule, floor = 0): RepriceResult {
  const others = listings.filter((l) => !mine || l.seller.toLowerCase() !== mine.toLowerCase());
  if (!others.length) return { status: "no-market", target: null, behind: 0, cheapest: null };
  const cheapest = others[0].platinum;
  const raw = rule === "match" ? cheapest : rule === "undercut" ? cheapest - 1 : Math.round(others.reduce((s, l) => s + l.platinum, 0) / others.length);
  const target = Math.max(1, Math.round(floor) || 1, raw);
  return { status: price > cheapest ? "undercut" : price === cheapest ? "ok" : "cheapest", target, behind: Math.max(0, price - cheapest), cheapest };
}

/** The new price to set, or null to leave the order alone: only ever lowers a price (never raises it) unless `allowRaise`. */
export function repricedValue(price: number, r: RepriceResult, allowRaise = false): number | null {
  if (r.target == null || r.target === price) return null;
  return r.target < price || allowRaise ? r.target : null;
}
