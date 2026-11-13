import { HOT_ITEM_TTL_MS, ITEM_PRICE_TTL_MS } from "./refresh";
import { pickStale } from "@/lib/arcanes/top-price";

/** How many of these item slugs are due a price refresh right now. */
export function itemsDue(slugs: string[], prices: { slug: string; fetched_at: string | null; avg5?: number | null }[], now: number = Date.now()): number {
  const have = new Map(prices.map((p) => [p.slug, p]));
  return pickStale(slugs.map((slug) => ({ slug })), (r) => have.get(r.slug)?.fetched_at, now, (r) => ((have.get(r.slug)?.avg5 ?? 0) >= 15 ? HOT_ITEM_TTL_MS : ITEM_PRICE_TTL_MS), Infinity).length;
}
