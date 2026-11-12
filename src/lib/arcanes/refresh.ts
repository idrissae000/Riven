import type { SupabaseClient } from "@supabase/supabase-js";
import { effectivePrice } from "./effective-price";
import { pickStale, reduceSold, reduceTopOrders } from "./top-price";

/** A GET against Warframe Market: path includes the version ("/v2/…"). The app passes its throttled client; scripts pass their own. */
export type WfmGet = (path: string) => Promise<Response>;

export const PRICE_TTL_MS = 60 * 60_000; // arcane prices move slowly; this keeps ~166 items cheap to keep fresh
export const STATS_TTL_MS = 12 * 60 * 60_000;

export interface PriceRow { slug: string; low: number | null; avg5: number | null; listings: number; max_low: number | null; max_avg5: number | null; max_listings: number; fetched_at: string }
export interface StatsRow { slug: string; volume_48h: number | null; sold_avg_48h: number | null; stats_at: string }

export class WfmFetchError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/**
 * Every order for an item (`GET /v2/orders/item/{slug}`, 100–850 KB). We deliberately do NOT use `/top`: despite the name it is
 * not "the 5 cheapest" and routinely includes 60–90p outliers, which inflated every price we stored.
 */
export async function fetchOrders(get: WfmGet, wfmSlug: string) {
  const path = `/v2/orders/item/${encodeURIComponent(wfmSlug)}`;
  const res = await get(path);
  if (!res.ok) throw new WfmFetchError(`Warframe Market ${res.status} for ${path}`, res.status);
  const json = (await res.json()) as { data?: Parameters<typeof reduceTopOrders>[0] };
  return Array.isArray(json.data) ? json.data : [];
}

/** The 5 cheapest online sell listings at `rank` (0 for unranked items), reduced to low / average / count. */
export async function fetchTop(get: WfmGet, wfmSlug: string, rank: number) {
  return reduceTopOrders(await fetchOrders(get, wfmSlug), 5, rank);
}

/**
 * Cheapest + average-of-cheapest-5 online sell prices at rank 0 AND at max rank, from one full order list. The cheapest
 * max-rank listing lets us work out an unranked price when there are fewer than 5 rank-0 listings.
 */
export async function fetchPriceRow(get: WfmGet, slug: string, wfmSlug: string, nowIso: string, maxRank: number | null = null): Promise<PriceRow> {
  const orders = await fetchOrders(get, wfmSlug);
  const r0 = reduceTopOrders(orders, 5, 0);
  const max = maxRank && maxRank > 0 ? reduceTopOrders(orders, 5, maxRank) : { low: null, avg5: null, listings: 0 };
  return { slug, ...r0, max_low: max.low, max_avg5: max.avg5, max_listings: max.listings, fetched_at: nowIso };
}

/** Rank-0 sales in the last 48h: `GET /v1/items/{slug}/statistics` (≈200 KB, so fetched rarely). */
export async function fetchStatsRow(get: WfmGet, slug: string, wfmSlug: string, nowIso: string): Promise<StatsRow> {
  const path = `/v1/items/${encodeURIComponent(wfmSlug)}/statistics`;
  const res = await get(path);
  if (!res.ok) throw new WfmFetchError(`Warframe Market ${res.status} for ${path}`, res.status);
  const json = (await res.json()) as { payload?: { statistics_closed?: { "48hours"?: Parameters<typeof reduceSold>[0] } } };
  const sold = reduceSold(json.payload?.statistics_closed?.["48hours"]);
  return { slug, volume_48h: sold?.volume48h ?? 0, sold_avg_48h: sold?.soldAvg48h ?? null, stats_at: nowIso };
}

export interface BatchResult {
  prices: number;
  stats: number;
  /** Arcanes still due a price / sales refresh after this batch. */
  remaining: { prices: number; stats: number };
  /** Set if Warframe Market rate-limited us (the batch stopped early; what was fetched is saved). */
  rateLimited: boolean;
}

/**
 * Refresh the most out-of-date arcane prices (then, once those are all fresh, the most out-of-date sales stats) and
 * save them. Small batches keep each call inside a serverless time limit. `sb` must be a service-role client.
 */
export async function refreshArcaneBatch(
  sb: SupabaseClient,
  get: WfmGet,
  opts: { priceLimit?: number; statsLimit?: number; now?: number } = {},
): Promise<BatchResult> {
  const { priceLimit = 4, statsLimit = 2, now = Date.now() } = opts;
  const nowIso = new Date(now).toISOString();
  const [{ data: arcanes, error: e1 }, { data: prices, error: e2 }] = await Promise.all([
    sb.from("arcanes").select("slug,wfm_slug,max_rank").not("wfm_slug", "is", null),
    sb.from("arcane_prices").select("slug,fetched_at,stats_at"),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const have = new Map((prices ?? []).map((p) => [p.slug as string, p as { fetched_at: string | null; stats_at: string | null }]));
  const items = (arcanes ?? []) as { slug: string; wfm_slug: string; max_rank: number | null }[];

  const duePrices = pickStale(items, (a) => have.get(a.slug)?.fetched_at, now, PRICE_TTL_MS, Infinity);
  const dueStats = pickStale(items, (a) => have.get(a.slug)?.stats_at, now, STATS_TTL_MS, Infinity);
  const out: BatchResult = { prices: 0, stats: 0, remaining: { prices: duePrices.length, stats: dueStats.length }, rateLimited: false };

  try {
    for (const a of duePrices.slice(0, priceLimit)) {
      const row = await fetchPriceRow(get, a.slug, a.wfm_slug, nowIso, a.max_rank);
      const { error } = await sb.from("arcane_prices").upsert(row, { onConflict: "slug" });
      if (error) throw new Error(error.message);
      // one point per day for the trend charts (the latest of the day wins); a failure here must not lose the price we just saved
      const eff = effectivePrice({ avg5: row.avg5, listings: row.listings, maxLow: row.max_low }, a.max_rank);
      if (eff.price != null) await sb.from("price_history").upsert({ slug: a.slug, day: nowIso.slice(0, 10), price: eff.price, listings: row.listings }, { onConflict: "slug,day" });
      out.prices++; out.remaining.prices--;
    }
    // sales stats are heavy, so only once the (cheap) prices are all current
    if (out.remaining.prices === 0) {
      for (const a of dueStats.slice(0, statsLimit)) {
        const row = await fetchStatsRow(get, a.slug, a.wfm_slug, nowIso);
        const { error } = await sb.from("arcane_prices").upsert(row, { onConflict: "slug" });
        if (error) throw new Error(error.message);
        out.stats++; out.remaining.stats--;
      }
    }
  } catch (e) {
    if (e instanceof WfmFetchError && e.status === 429) out.rateLimited = true;
    else throw e;
  }
  return out;
}
