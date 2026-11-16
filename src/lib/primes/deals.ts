import type { SalesDay } from "@/lib/history-sales";
import type { PrimePart } from "./types";

export interface Level { slug: string; typical: number | null; recent: number | null; prev: number | null; per_day: number | null; days: number }
export interface Deal {
  slug: string; name: string; ask: number; listings: number;
  /** What it normally costs to buy, from its own 30-day record (median sold price × how asking prices usually sit against sold prices). */
  normal: number; typical: number;
  discountPct: number; gain: number; perDay: number;
  /** Selling prices over the last 3 days are still sliding against the 3 before. */
  falling: boolean;
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };

/** Asking prices (the average of the cheapest 5 online listings) don't sit exactly at sold prices. This is how far apart they usually are, across every item. */
export function askBaseline(levels: Level[], ask: (slug: string) => { avg5: number | null; listings: number } | undefined): number {
  const ratios: number[] = [];
  for (const l of levels) {
    const a = ask(l.slug);
    if (a?.avg5 != null && a.listings >= 3 && l.typical != null && l.typical >= 5 && (l.per_day ?? 0) >= 1 && l.days >= 15) ratios.push(a.avg5 / l.typical);
  }
  return ratios.length >= 30 ? (median(ratios) as number) : 1;
}

/** Fast-selling Prime parts and sets whose asking price is well below where they normally trade. */
export function findDeals(levels: Level[], parts: PrimePart[], ask: (slug: string) => { avg5: number | null; listings: number } | undefined, minDiscountPct = 10): { deals: Deal[]; baseline: number } {
  const baseline = askBaseline(levels, ask);
  const byLevel = new Map(levels.map((l) => [l.slug, l]));
  const deals: Deal[] = [];
  for (const p of parts) {
    const l = byLevel.get(p.slug), a = ask(p.slug);
    if (!l || !a || a.avg5 == null || a.listings < 3) continue;
    if (l.typical == null || l.typical < 10 || (l.per_day ?? 0) < 3 || l.days < 20) continue;
    const normal = l.typical * baseline;
    const discountPct = Math.round((1 - a.avg5 / normal) * 1000) / 10;
    if (discountPct < minDiscountPct) continue;
    deals.push({
      slug: p.slug, name: p.name, ask: a.avg5, listings: a.listings, normal: Math.round(normal * 10) / 10, typical: Math.round(l.typical * 10) / 10,
      discountPct, gain: Math.round((normal - a.avg5) * 10) / 10, perDay: Math.round((l.per_day ?? 0) * 10) / 10,
      falling: l.recent != null && l.prev != null && l.recent < l.prev * 0.95,
    });
  }
  deals.sort((a, b) => b.discountPct - a.discountPct);
  return { deals, baseline };
}

const vwap = (rows: SalesDay[]) => { const v = rows.reduce((s, r) => s + r.volume, 0); return v > 0 ? rows.reduce((s, r) => s + r.avg * r.volume, 0) / v : null; };

/**
 * From the item's own history: each time its 3-day selling price fell 10% or more below its usual (the median of the 30 days before), did it get back
 * to within 5% of that usual within the next 14 days? Counts separate dips (three weeks apart, so one long slump is one dip); dips with less than 14 days after them are left out.
 */
export function reboundStats(sales: SalesDay[]): { dips: number; recovered: number } {
  let dips = 0, recovered = 0, skipUntil = -1;
  for (let i = 30; i < sales.length - 14; i++) {
    if (i < skipUntil) continue;
    const usual = median(sales.slice(i - 30, i - 2).map((r) => r.avg));
    const now = vwap(sales.slice(i - 2, i + 1));
    if (usual == null || now == null || now > usual * 0.9) continue;
    dips++; skipUntil = i + 21;
    for (let j = i + 1; j <= i + 14; j++) { const v = vwap(sales.slice(j - 2, j + 1)); if (v != null && v >= usual * 0.95) { recovered++; break; } }
  }
  return { dips, recovered };
}
