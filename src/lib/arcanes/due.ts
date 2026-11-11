import { PRICE_TTL_MS, STATS_TTL_MS } from "./refresh";
import { pickStale } from "./top-price";

/** How many tradable arcanes are due a price refresh plus a sales-stats refresh right now. */
export function arcanesDue(
  arcanes: { slug: string; wfm_slug: string | null }[],
  prices: { slug: string; fetched_at: string | null; stats_at: string | null }[],
  now: number = Date.now(),
): number {
  const have = new Map(prices.map((p) => [p.slug, p]));
  const tradable = arcanes.filter((a) => a.wfm_slug);
  return pickStale(tradable, (a) => have.get(a.slug)?.fetched_at, now, PRICE_TTL_MS, Infinity).length
    + pickStale(tradable, (a) => have.get(a.slug)?.stats_at, now, STATS_TTL_MS, Infinity).length;
}
