import type { PrimePart } from "./types";

export interface MissingPart { slug: string; name: string; qty: number; price: number }
export interface SetPlan {
  setSlug: string; name: string; setPrice: number;
  /** How much of the set you already hold, 0-100 (by part count, a part that needs 2 counts twice). */
  completePct: number;
  owned: { slug: string; name: string; qty: number; price: number }[];
  missing: MissingPart[];
  /** Platinum to buy what's missing, at today's asking prices. */
  missingCost: number;
  /** What the parts you hold are worth sold one by one (what you give up by using them). */
  ownedValue: number;
  /** Platinum made by completing and selling the set, over selling what you hold and not buying anything: set price - missing cost - owned value. */
  gain: number;
  /** Trades it takes: one per missing part you buy (more if you need several of it). */
  trades: number;
  /** true when the set or a missing part has fewer than 3 online sellers behind its price. */
  thin: boolean;
  /** true when you already hold everything. */
  complete: boolean;
}

export interface PriceInfo { price: number | null; listings: number }

/**
 * For every set you hold at least one part of: what it costs to buy the rest, whether the finished set sells for more than your parts and the
 * extra parts would separately, and how many trades that takes. Sets where any price is missing are skipped. Best gain first.
 */
export function planSets(owned: Map<string, number>, parts: PrimePart[], info: (slug: string) => PriceInfo | undefined): SetPlan[] {
  const bySet = new Map<string, PrimePart[]>();
  for (const p of parts) if (p.kind === "part" && p.setSlug) bySet.set(p.setSlug, [...(bySet.get(p.setSlug) ?? []), p]);
  const out: SetPlan[] = [];
  for (const set of parts) {
    if (set.kind !== "set") continue;
    const ps = bySet.get(set.slug);
    const s = info(set.slug);
    if (!ps?.length || s?.price == null) continue;
    const rows = ps.map((p) => ({ p, have: owned.get(p.slug) ?? 0, i: info(p.slug) }));
    if (!rows.some((r) => r.have > 0) || rows.some((r) => r.i?.price == null)) continue;
    const price = (r: (typeof rows)[number]) => r.i!.price as number;
    const missing = rows.filter((r) => r.have < r.p.perSet).map((r): MissingPart => ({ slug: r.p.slug, name: r.p.name, qty: r.p.perSet - r.have, price: price(r) }));
    const ownedRows = rows.filter((r) => r.have > 0).map((r) => ({ slug: r.p.slug, name: r.p.name, qty: Math.min(r.have, r.p.perSet), price: price(r) }));
    const missingCost = missing.reduce((a, m) => a + m.qty * m.price, 0);
    const ownedValue = ownedRows.reduce((a, o) => a + o.qty * o.price, 0);
    const need = rows.reduce((a, r) => a + r.p.perSet, 0), have = rows.reduce((a, r) => a + Math.min(r.have, r.p.perSet), 0);
    out.push({
      setSlug: set.slug, name: set.name, setPrice: s.price, completePct: Math.round((have / need) * 100), owned: ownedRows, missing,
      missingCost: r1(missingCost), ownedValue: r1(ownedValue), gain: r1(s.price - missingCost - ownedValue), trades: missing.length,
      thin: s.listings < 3 || rows.some((r) => r.have < r.p.perSet && (r.i?.listings ?? 0) < 3), complete: missing.length === 0,
    });
  }
  return out.sort((a, b) => b.gain - a.gain || b.completePct - a.completePct || a.name.localeCompare(b.name));
}

const r1 = (n: number) => Math.round(n * 10) / 10;
