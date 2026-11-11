import { ITEM_PRICE_TTL_MS } from "./refresh";
import { pickStale } from "@/lib/arcanes/top-price";

/** How many of these item slugs are due a price refresh right now. */
export function itemsDue(slugs: string[], prices: { slug: string; fetched_at: string | null }[], now: number = Date.now()): number {
  const have = new Map(prices.map((p) => [p.slug, p.fetched_at]));
  return pickStale(slugs.map((slug) => ({ slug })), (r) => have.get(r.slug), now, ITEM_PRICE_TTL_MS, Infinity).length;
}
