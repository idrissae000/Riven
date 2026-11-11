import type { PrimePart } from "@/lib/primes/types";

export interface OwnedItem { id: string; kind: "prime" | "arcane"; slug: string; rank: number; qty: number }

export interface ItemInfo {
  name: string;
  /** Price of ONE (at the item's rank for arcanes); null when it has no usable price. */
  price: number | null;
  /** Ducat value of one, for Prime parts. */
  ducats: number | null;
  /** How the price was worked out, when it isn't the plain average of the cheapest listings. */
  note?: string | null;
}

export interface ValuedRow extends OwnedItem {
  name: string;
  unit: number | null;
  total: number | null;
  ducatsTotal: number | null;
  /** Ducats you'd get per platinum of market value (higher = better to hand to Baro than to sell). */
  ducatsPerPlat: number | null;
  note: string | null;
}

export interface InventoryValue { rows: ValuedRow[]; total: number; priced: number; count: number }

/** Value an inventory, best-selling items first. Items without a price are kept (listed last) but add nothing to the total. */
export function valueInventory(items: OwnedItem[], info: (i: OwnedItem) => ItemInfo | undefined): InventoryValue {
  const rows = items.map((i): ValuedRow => {
    const x = info(i);
    const unit = x?.price ?? null;
    return {
      ...i, name: x?.name ?? i.slug, unit, total: unit == null ? null : Math.round(unit * i.qty * 10) / 10,
      ducatsTotal: x?.ducats != null ? x.ducats * i.qty : null,
      ducatsPerPlat: x?.ducats != null && unit ? Math.round((x.ducats / unit) * 10) / 10 : null,
      note: x?.note ?? null,
    };
  });
  rows.sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || a.name.localeCompare(b.name));
  const priced = rows.filter((r) => r.total != null);
  return { rows, total: Math.round(priced.reduce((s, r) => s + (r.total as number), 0) * 10) / 10, priced: priced.length, count: rows.length };
}

export interface SetAdvice {
  setSlug: string;
  name: string;
  kind: "complete" | "nearly";
  /** How many sets you can make from what you own (complete) — 1 for "nearly". */
  count: number;
  setPrice: number;
  /** What the parts you'd use are worth sold one by one. */
  partsValue: number;
  /** For "nearly": the part(s) you'd still have to buy, and what that costs. */
  missing: { slug: string; name: string; qty: number; price: number }[];
  missingCost: number;
  /** Platinum you gain by selling the assembled set instead of the loose parts (after buying anything missing). */
  gain: number;
}

/**
 * Where selling a set beats selling its parts (you own every part → "complete"), and where buying the one missing part
 * and selling the set would beat selling what you have ("nearly"). Needs prices for the set and every part.
 */
export function setAdvice(owned: Map<string, number>, parts: PrimePart[], priceOf: (slug: string) => number | null, minGain = 1): SetAdvice[] {
  const bySet = new Map<string, PrimePart[]>();
  for (const p of parts) if (p.kind === "part" && p.setSlug) bySet.set(p.setSlug, [...(bySet.get(p.setSlug) ?? []), p]);
  const sets = new Map(parts.filter((p) => p.kind === "set").map((p) => [p.slug, p]));
  const out: SetAdvice[] = [];

  for (const [setSlug, ps] of bySet) {
    const set = sets.get(setSlug);
    const setPrice = priceOf(setSlug);
    if (!set || setPrice == null || ps.some((p) => priceOf(p.slug) == null)) continue;
    const have = ps.map((p) => ({ p, qty: owned.get(p.slug) ?? 0 }));
    if (!have.some((h) => h.qty > 0)) continue;
    const price = (p: PrimePart) => priceOf(p.slug) as number;

    const copies = Math.min(...have.map((h) => Math.floor(h.qty / h.p.perSet)));
    if (copies >= 1) {
      const partsValue = copies * ps.reduce((s, p) => s + p.perSet * price(p), 0);
      const gain = copies * setPrice - partsValue;
      out.push({ setSlug, name: set.name, kind: "complete", count: copies, setPrice, partsValue: r1(partsValue), missing: [], missingCost: 0, gain: r1(gain) });
      continue;
    }
    const short = have.filter((h) => h.qty < h.p.perSet);
    if (short.length === 1) {
      const m = short[0];
      const need = m.p.perSet - m.qty;
      const missingCost = need * price(m.p);
      const partsValue = have.reduce((s, h) => s + Math.min(h.qty, h.p.perSet) * price(h.p), 0);
      const gain = setPrice - missingCost - partsValue;
      if (gain >= minGain) out.push({ setSlug, name: set.name, kind: "nearly", count: 1, setPrice, partsValue: r1(partsValue), missing: [{ slug: m.p.slug, name: m.p.name, qty: need, price: price(m.p) }], missingCost: r1(missingCost), gain: r1(gain) });
    }
  }
  return out.sort((a, b) => b.gain - a.gain);
}

const r1 = (n: number) => Math.round(n * 10) / 10;
