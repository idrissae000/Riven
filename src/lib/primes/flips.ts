import type { PrimePart } from "./types";

export interface FlipPart { slug: string; name: string; qty: number; price: number }
export interface Flip {
  setSlug: string; name: string; setPrice: number;
  /** What it costs to buy every part (counting duplicates, e.g. 2 barrels) at their current asking prices. */
  partsCost: number;
  /** Platinum made by buying the parts and selling the assembled set. */
  profit: number;
  /** profit ÷ cost, as a percentage. */
  roi: number;
  parts: FlipPart[];
  /** true when the set or a part has fewer than 3 listings behind its price, so the numbers are shaky. */
  thin: boolean;
}

export interface PriceInfo { price: number | null; listings: number }

/**
 * Sets that sell for more than their parts cost to buy: buy each part, assemble, sell the set. Needs a price for the set and
 * every part. Asking prices only, so treat it as a lead to check on the market, not a guarantee.
 */
export function findFlips(parts: PrimePart[], info: (slug: string) => PriceInfo | undefined, minProfit = 1): Flip[] {
  const bySet = new Map<string, PrimePart[]>();
  for (const p of parts) if (p.kind === "part" && p.setSlug) bySet.set(p.setSlug, [...(bySet.get(p.setSlug) ?? []), p]);
  const out: Flip[] = [];
  for (const set of parts) {
    if (set.kind !== "set") continue;
    const ps = bySet.get(set.slug);
    const s = info(set.slug);
    if (!ps?.length || s?.price == null) continue;
    const priced = ps.map((p) => ({ p, i: info(p.slug) }));
    if (priced.some((x) => x.i?.price == null)) continue;
    const list = priced.map((x): FlipPart => ({ slug: x.p.slug, name: x.p.name, qty: x.p.perSet, price: x.i!.price as number }));
    const cost = list.reduce((sum, x) => sum + x.qty * x.price, 0);
    const profit = s.price - cost;
    if (profit < minProfit) continue;
    out.push({
      setSlug: set.slug, name: set.name, setPrice: s.price, partsCost: r1(cost), profit: r1(profit), roi: cost > 0 ? Math.round((profit / cost) * 100) : 0, parts: list,
      thin: s.listings < 3 || priced.some((x) => (x.i?.listings ?? 0) < 3),
    });
  }
  return out.sort((a, b) => b.profit - a.profit || a.name.localeCompare(b.name));
}

const r1 = (n: number) => Math.round(n * 10) / 10;
