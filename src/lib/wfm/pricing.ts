import "server-only";
import { wfmGet } from "./client";
import { citedListings, estimate, findComparables, type Estimate, type Listing, type WfmAuction } from "./comparables";
import { gradeRiven } from "@/lib/grading/grade";
import type { CodexRivenData } from "@/lib/codex/types";
import type { Riven, RivenAttribute } from "@/lib/types";

export interface RivenMarketResult {
  estimate: Estimate | null;
  /** Exactly the listings the estimate is based on (or the closest matches when there is no estimate). */
  listings: Listing[];
  fetchedAt: string;
  fromCache: boolean;
  stale: boolean;
  queries: number;
  note: string | null;
}

const SEARCH = "/v1/auctions/search";

/** All k-sized subsets of xs. */
function subsets<T>(xs: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (xs.length < k) return [];
  const [head, ...rest] = xs;
  return [...subsets(rest, k - 1).map((r) => [head, ...r]), ...subsets(rest, k)];
}

/**
 * Cache-friendly search URLs: the weapon-wide cheapest listings, plus one filtered query per combination of
 * stats that would satisfy the matching rule (see sharedStats) — so a listing that shares only 2 of our 3 stats
 * can still be found even when it isn't among the weapon's cheapest.
 */
export function auctionQueries(riven: Pick<Riven, "weapon_slug" | "stats">): string[] {
  const base = `type=riven&weapon_url_name=${encodeURIComponent(riven.weapon_slug)}&buyout_policy=direct&sort_by=price_asc`;
  const pos = riven.stats.filter((s) => !s.is_negative).map((s) => s.stat).sort();
  const neg = riven.stats.filter((s) => s.is_negative).map((s) => s.stat).sort();
  const n = riven.stats.length;

  // The stat combinations a listing must contain: 2 stats -> both; 3 -> any 2; 4 -> any 2 positives.
  const combos: { pos: string[]; neg: string[] }[] =
    n <= 2 ? [{ pos, neg }]
    : n === 3 ? subsets([...pos.map((s) => ({ s, neg: false })), ...neg.map((s) => ({ s, neg: true }))], 2).map((c) => ({ pos: c.filter((x) => !x.neg).map((x) => x.s), neg: c.filter((x) => x.neg).map((x) => x.s) }))
    : subsets(pos, 2).map((p) => ({ pos: p, neg: [] }));

  const q = [`${SEARCH}?${base}`];
  for (const c of combos) {
    q.push(`${SEARCH}?${base}${c.pos.length ? `&positive_stats=${c.pos.join(",")}` : ""}${c.neg.length ? `&negative_stats=${c.neg.join(",")}` : ""}`);
  }
  return [...new Set(q)];
}

export async function priceRiven(
  riven: Riven,
  attributes: RivenAttribute[],
  opts: { force?: boolean; grading?: { weapon: { name: string; riven_type: string; group_name?: string | null }; data: CodexRivenData | null } } = {},
): Promise<RivenMarketResult> {
  const unit = new Map(attributes.map((a) => [a.slug, a.unit]));
  const queries = auctionQueries(riven);

  // Sequential on purpose: the shared throttle spaces them out, and the second is often a cache hit.
  const results = [];
  for (const q of queries) {
    results.push(await wfmGet<{ payload: { auctions: WfmAuction[] } }>(q, { force: opts.force, minRefreshAgeMs: 60_000 }));
  }

  const auctions = results.flatMap((r) => r.data.payload?.auctions ?? []);
  const listings = findComparables(riven, auctions, (s) => unit.get(s));
  const est = estimate(listings);
  const attrMap = new Map(attributes.map((a) => [a.slug, a]));
  // Rate every stat on every listing the same way as the user's own riven.
  const cited = citedListings(listings, est).map((l) => !opts.grading ? l : {
    ...l,
    grades: gradeRiven(
      { rank: l.rank, stats: l.stats.map((x) => ({ stat: x.stat, value: x.value, is_negative: !x.positive })) },
      opts.grading.weapon, attrMap, opts.grading.data,
    ).map((g) => g.tier),
  });

  const oldest = results.reduce((a, r) => (Date.parse(r.fetchedAt) < Date.parse(a) ? r.fetchedAt : a), results[0].fetchedAt);
  let note: string | null = null;
  if (listings.length === 0) note = "No live listings share enough of these stats.";
  else if (!est) note = `Only ${listings.length} comparable listing${listings.length === 1 ? "" : "s"} — too few for a price estimate.`;
  else if (est.basis === "similar") note = "Few listings have every one of these stats, so the range also uses ones that share most of them.";

  return {
    estimate: est,
    listings: cited,
    fetchedAt: oldest,
    fromCache: results.every((r) => r.fromCache),
    stale: results.some((r) => r.stale),
    queries: queries.length,
    note,
  };
}
