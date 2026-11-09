import { toMaxRank } from "@/lib/rank";
import type { RivenStat } from "@/lib/types";

/** Raw v1 auction as returned by /v1/auctions/search (only fields we use). */
export interface WfmAuction {
  id: string;
  buyout_price: number | null;
  starting_price: number;
  is_direct_sell: boolean;
  closed: boolean;
  visible: boolean;
  private?: boolean;
  created: string;
  updated: string;
  owner: { ingame_name: string; slug: string; status: string; reputation: number; platform: string };
  item: {
    type: string; name: string; weapon_url_name: string; polarity: string; mastery_level: number;
    mod_rank: number; re_rolls: number;
    attributes: { url_name: string; value: number; positive: boolean }[];
  };
}

export type MatchKind = "exact" | "similar";

export interface Listing {
  id: string;
  url: string;
  seller: string;
  sellerUrl: string;
  sellerStatus: string;
  price: number;
  postedAt: string;
  rivenName: string;
  rank: number;
  rerolls: number;
  polarity: string;
  masteryRank: number;
  stats: { stat: string; value: number; positive: boolean }[]; // as displayed on the listing
  matchKind: MatchKind;
  score: number; // 0..1 similarity of the stat spread
}

export interface Estimate {
  low: number;
  median: number;
  high: number;
  basis: MatchKind;
  sampleSize: number;
}

const normName = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/** Listings we can trust as real, current, buy-it-now offers. */
export function usable(a: WfmAuction): boolean {
  return a.item?.type === "riven" && !a.closed && a.visible && !a.private && a.is_direct_sell && a.buyout_price != null && a.buyout_price > 0;
}

/**
 * How closely a listing's stat spread matches ours (0..1), comparing values at
 * max rank. Each of our stats earns 0.6 for a same-sign slug match plus up to 0.4
 * for value closeness; extra/missing stats on the listing are penalised.
 */
export function similarity(
  mine: { stats: RivenStat[]; rank: number },
  listing: WfmAuction["item"],
  unitOf: (slug: string) => string | null | undefined,
): { score: number; matched: number } {
  let total = 0;
  let matched = 0;
  for (const s of mine.stats) {
    const theirs = listing.attributes.find((a) => a.url_name === s.stat && a.positive === !s.is_negative);
    if (!theirs) continue;
    matched++;
    const unit = unitOf(s.stat);
    const a = toMaxRank(s.value, mine.rank, unit);
    const b = toMaxRank(theirs.value, listing.mod_rank, unit);
    const ref = unit === "multiply" ? Math.max(Math.abs(a - 1), Math.abs(b - 1), 1e-6) : Math.max(Math.abs(a), Math.abs(b), 1e-6);
    total += 0.6 + 0.4 * (1 - Math.min(1, Math.abs(a - b) / ref));
  }
  const countPenalty = 0.1 * Math.abs(listing.attributes.length - mine.stats.length);
  const score = Math.max(0, Math.min(1, total / mine.stats.length - countPenalty));
  return { score, matched };
}

export interface FindOptions {
  /** Minimum similarity (default 0.7, and >= 2 matched stats) for a non-name match to count. */
  minScore?: number;
  /** Max listings returned. */
  limit?: number;
}

/**
 * Pick comparable listings: same weapon AND same riven name = "exact";
 * same weapon with a close stat spread = "similar". De-duplicated by auction id.
 */
export function findComparables(
  riven: { weapon_slug: string; riven_name: string | null; stats: RivenStat[]; rank: number },
  auctions: WfmAuction[],
  unitOf: (slug: string) => string | null | undefined,
  { minScore = 0.7, limit = 12 }: FindOptions = {},
): Listing[] {
  const mineName = normName(riven.riven_name);
  const seen = new Set<string>();
  const out: Listing[] = [];

  for (const a of auctions) {
    if (seen.has(a.id) || !usable(a) || a.item.weapon_url_name !== riven.weapon_slug) continue;
    seen.add(a.id);
    const { score, matched } = similarity(riven, a.item, unitOf);
    const exact = mineName !== "" && normName(a.item.name) === mineName;
    if (!exact && !(matched >= 2 && score >= minScore)) continue;
    out.push({
      id: a.id,
      url: `https://warframe.market/auction/${a.id}`,
      seller: a.owner.ingame_name,
      sellerUrl: `https://warframe.market/profile/${a.owner.slug}`,
      sellerStatus: a.owner.status,
      price: a.buyout_price as number,
      postedAt: a.updated || a.created,
      rivenName: a.item.name,
      rank: a.item.mod_rank,
      rerolls: a.item.re_rolls,
      polarity: a.item.polarity,
      masteryRank: a.item.mastery_level,
      stats: a.item.attributes.map((t) => ({ stat: t.url_name, value: t.value, positive: t.positive })),
      matchKind: exact ? "exact" : "similar",
      score,
    });
  }

  out.sort((x, y) => (x.matchKind === y.matchKind ? 0 : x.matchKind === "exact" ? -1 : 1) || y.score - x.score || x.price - y.price);
  return out.slice(0, limit);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Estimate from the cited listings ONLY. Returns null when fewer than `minSamples`
 * listings back it — callers must never display a price without the listings.
 * Prefers exact-name listings when there are enough of them.
 */
export function estimate(listings: Listing[], minSamples = 3): Estimate | null {
  const exact = listings.filter((l) => l.matchKind === "exact");
  const pool = exact.length >= minSamples ? exact : listings;
  if (pool.length < minSamples) return null;
  const prices = pool.map((l) => l.price).sort((a, b) => a - b);
  return {
    low: Math.round(percentile(prices, 0.25)),
    median: Math.round(percentile(prices, 0.5)),
    high: Math.round(percentile(prices, 0.75)),
    basis: exact.length >= minSamples ? "exact" : "similar",
    sampleSize: pool.length,
  };
}

/** The listings that actually back an estimate (so the UI cites exactly those). */
export function citedListings(listings: Listing[], est: Estimate | null): Listing[] {
  if (!est) return listings;
  return est.basis === "exact" ? listings.filter((l) => l.matchKind === "exact") : listings;
}
