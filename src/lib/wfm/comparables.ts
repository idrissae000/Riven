import { toMaxRank } from "@/lib/rank";
import type { RivenStat } from "@/lib/types";
import type { Tier } from "@/lib/grading/config";

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
  /** "exact" = the listing has every one of our stats (same stats); "similar" = it shares enough of them. */
  matchKind: MatchKind;
  /** How many of our stats (and how many in total) the listing shares. */
  matched: number;
  total: number;
  score: number; // 0..1 closeness of the matching stats' values (used only to rank)
  /** 0 (worst) … 1 (best) overall roll quality of this listing, from its per-stat grades; null when it couldn't be graded. */
  quality?: number | null;
  /** Set by the valuation: how much this listing counted (0 for an excluded outlier), what it counted as after adjusting for roll quality, and whether it was dropped as an outlier. */
  weight?: number;
  adjustedPrice?: number;
  outlier?: boolean;
  /** Grade of each entry in `stats` (same order), graded for this weapon; null = can't be graded. */
  grades?: (Tier | null)[];
}

export interface Estimate {
  /** 25th percentile, weighted median and 75th percentile of the comparable asking prices (after adjustments). */
  low: number;
  median: number;
  high: number;
  basis: MatchKind;
  /** Listings that counted (outliers excluded). */
  sampleSize: number;
  /** Listings dropped as price outliers (troll or mispriced asks). */
  outliers: number;
  /** Whether asking prices were adjusted for the difference in roll quality between each listing and the riven. */
  adjusted: boolean;
  confidence: "high" | "medium" | "low";
}

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
  /** Max listings returned. */
  limit?: number;
}

/**
 * Stat-sharing rule (the riven NAME is deliberately not considered):
 *   2 stats  -> both must match
 *   3 stats  -> at least 2 must match
 *   4 stats  -> at least 2 of the POSITIVE stats must match
 * A stat "matches" when the listing has the same stat in the same role (bonus vs curse).
 */
export function sharedStats(mine: RivenStat[], listing: WfmAuction["item"]): { matched: number; matchedPositive: number; qualifies: boolean } {
  let matched = 0;
  let matchedPositive = 0;
  for (const s of mine) {
    if (listing.attributes.some((a) => a.url_name === s.stat && a.positive === !s.is_negative)) {
      matched++;
      if (!s.is_negative) matchedPositive++;
    }
  }
  const n = mine.length;
  const qualifies = n <= 2 ? matched === n : n === 3 ? matched >= 2 : matchedPositive >= 2;
  return { matched, matchedPositive, qualifies };
}

/**
 * Pick comparable listings for the same weapon whose stats satisfy `sharedStats`. Listings carrying ALL our
 * stats are "exact" (same stats) and sort first; the rest are "similar", ranked by how many stats they share,
 * then by how close the matching values are (compared at max rank). De-duplicated by auction id.
 */
export function findComparables(
  riven: { weapon_slug: string; stats: RivenStat[]; rank: number },
  auctions: WfmAuction[],
  unitOf: (slug: string) => string | null | undefined,
  { limit = 16 }: FindOptions = {},
): Listing[] {
  const seen = new Set<string>();
  const out: Listing[] = [];

  for (const a of auctions) {
    if (seen.has(a.id) || !usable(a) || a.item.weapon_url_name !== riven.weapon_slug) continue;
    seen.add(a.id);
    const { matched, qualifies } = sharedStats(riven.stats, a.item);
    if (!qualifies) continue;
    const { score } = similarity(riven, a.item, unitOf);
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
      matchKind: matched === riven.stats.length ? "exact" : "similar",
      matched,
      total: riven.stats.length,
      score,
    });
  }

  out.sort((x, y) => (x.matchKind === y.matchKind ? 0 : x.matchKind === "exact" ? -1 : 1) || y.matched - x.matched || y.score - x.score || x.price - y.price);
  return out.slice(0, limit);
}
