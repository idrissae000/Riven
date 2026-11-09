import "server-only";
import { wfmGet } from "./client";
import { citedListings, estimate, findComparables, type Estimate, type Listing, type WfmAuction } from "./comparables";
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

/** Build the (cache-friendly) search URLs: weapon-wide cheapest, plus same-positive-stats cheapest. */
export function auctionQueries(riven: Pick<Riven, "weapon_slug" | "stats">): string[] {
  const base = `type=riven&weapon_url_name=${encodeURIComponent(riven.weapon_slug)}&buyout_policy=direct&sort_by=price_asc`;
  const positives = riven.stats.filter((s) => !s.is_negative).map((s) => s.stat).sort();
  const q = [`${SEARCH}?${base}`];
  if (positives.length) q.push(`${SEARCH}?${base}&positive_stats=${positives.join(",")}`);
  return q;
}

export async function priceRiven(
  riven: Riven,
  attributes: RivenAttribute[],
  opts: { force?: boolean } = {},
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
  const cited = citedListings(listings, est);

  const oldest = results.reduce((a, r) => (Date.parse(r.fetchedAt) < Date.parse(a) ? r.fetchedAt : a), results[0].fetchedAt);
  let note: string | null = null;
  if (listings.length === 0) note = "No comparable live listings found for this weapon and stat combination.";
  else if (!est) note = `Only ${listings.length} comparable listing${listings.length === 1 ? "" : "s"} — too few for a price estimate.`;
  else if (est.basis === "similar") note = "No (or too few) exact-name matches, so the range uses listings with a similar stat spread.";

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
