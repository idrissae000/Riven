import { usable, type WfmAuction } from "@/lib/wfm/comparables";

export interface StatPremium {
  stat: string;
  /** Median asking price of listings that have this stat / that don't, and how many listings had it. */
  withMedian: number;
  withoutMedian: number;
  n: number;
}

/** A weapon's riven market as seen in Warframe Market's cheapest buy-it-now listings. */
export interface WeaponMarket {
  /** Listings looked at (the search returns at most ~99, cheapest first). */
  listings: number;
  /** True when the search was full, i.e. there are at least that many listings — the weapon has plenty of supply. */
  saturated: boolean;
  /** Cheapest listing. */
  low: number | null;
  /** Median asking price of those listings: the ranking number ("what a typical riven for this weapon asks"). */
  median: number | null;
  p75: number | null;
  /** Stats whose listings ask noticeably more than ones without them. */
  stats: StatPremium[];
}

const FULL_PAGE = 95;
const MIN_GROUP = 5;
const MIN_RATIO = 1.15;

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
const median = (xs: number[]) => quantile([...xs].sort((a, b) => a - b), 0.5);

/** Reduce a weapon's search results to its market summary. Pure. */
export function summarizeWeaponListings(auctions: WfmAuction[], weaponSlug?: string): WeaponMarket {
  const rows = auctions.filter((a) => usable(a) && (!weaponSlug || a.item.weapon_url_name === weaponSlug));
  if (!rows.length) return { listings: 0, saturated: false, low: null, median: null, p75: null, stats: [] };
  const prices = rows.map((a) => a.buyout_price as number).sort((a, b) => a - b);

  // which positive stats go with higher asking prices?
  const statNames = new Set(rows.flatMap((a) => a.item.attributes.filter((t) => t.positive).map((t) => t.url_name)));
  const stats: StatPremium[] = [];
  for (const stat of statNames) {
    const withStat = rows.filter((a) => a.item.attributes.some((t) => t.url_name === stat && t.positive)).map((a) => a.buyout_price as number);
    const without = rows.filter((a) => !a.item.attributes.some((t) => t.url_name === stat && t.positive)).map((a) => a.buyout_price as number);
    if (withStat.length < MIN_GROUP || without.length < MIN_GROUP) continue;
    const w = median(withStat), wo = median(without);
    if (wo > 0 && w / wo >= MIN_RATIO) stats.push({ stat, withMedian: Math.round(w), withoutMedian: Math.round(wo), n: withStat.length });
  }
  stats.sort((a, b) => b.withMedian / b.withoutMedian - a.withMedian / a.withoutMedian || b.n - a.n);

  return {
    listings: rows.length,
    saturated: auctions.length >= FULL_PAGE,
    low: prices[0],
    median: Math.round(quantile(prices, 0.5)),
    p75: Math.round(quantile(prices, 0.75)),
    stats: stats.slice(0, 4),
  };
}
