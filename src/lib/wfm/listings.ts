/** The slice of a Warframe Market (v2) order we read. */
export interface RawOrder {
  type?: string; platinum: number; quantity?: number; rank?: number; visible?: boolean;
  user?: { ingameName?: string; slug?: string; status?: string; platform?: string; crossplay?: boolean };
}
export interface Listing { platinum: number; quantity: number; seller: string; status: "ingame" | "online" }

const onlineStatus = (s?: string): s is "ingame" | "online" => s === "ingame" || s === "online";

/**
 * The `count` cheapest sell listings from players who are online or in game (offline and invisible players are skipped, as
 * are hidden orders), cheapest first. `rank` is the item rank the listing must be at (0 for Prime parts).
 */
export function cheapestOnline(orders: RawOrder[] | null | undefined, count = 5, rank = 0): Listing[] {
  return (orders ?? [])
    .filter((o) => (o.type ?? "sell") === "sell" && o.visible !== false && (o.quantity ?? 1) > 0 && (o.rank ?? 0) === rank && onlineStatus(o.user?.status) &&
      (o.user?.platform === "pc" || o.user?.crossplay === true || o.user?.platform === undefined) && Number.isFinite(o.platinum) && o.platinum > 0)
    .map((o): Listing => ({ platinum: o.platinum, quantity: o.quantity ?? 1, seller: o.user?.ingameName ?? o.user?.slug ?? "unknown", status: o.user!.status as "ingame" | "online" }))
    .sort((a, b) => a.platinum - b.platinum)
    .slice(0, count);
}

export type PriceStrategy = "market" | "undercut" | "match";

export const STRATEGIES: { value: PriceStrategy; label: string; help: string }[] = [
  { value: "market", label: "Market price", help: "The average of the 5 cheapest online listings — fair, and not chasing a lone low-baller." },
  { value: "undercut", label: "Undercut by 1", help: "1 platinum below the cheapest online listing (never below 1)." },
  { value: "match", label: "Match the cheapest", help: "The same as the cheapest online listing." },
];

/** The price the app would list at for a strategy, or null when nobody is selling it online right now (no market to price from). */
export function autoPrice(listings: Listing[], strategy: PriceStrategy): number | null {
  if (!listings.length) return null;
  const lowest = listings[0].platinum;
  if (strategy === "match") return lowest;
  if (strategy === "undercut") return Math.max(1, lowest - 1);
  return Math.max(1, Math.round(listings.reduce((s, l) => s + l.platinum, 0) / listings.length));
}
