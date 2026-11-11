import { pickStale } from "@/lib/arcanes/top-price";
import { WEAPON_TTL_MS } from "./refresh";

/** How many weapons are due a riven-market refresh right now. */
export function weaponsDue(weapons: { slug: string }[], prices: { slug: string; fetched_at: string | null }[], now: number = Date.now()): number {
  const have = new Map(prices.map((p) => [p.slug, p.fetched_at]));
  return pickStale(weapons, (w) => have.get(w.slug), now, WEAPON_TTL_MS, Infinity).length;
}
