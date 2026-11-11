import type { SupabaseClient } from "@supabase/supabase-js";
import { pickStale, reduceSold, reduceTopOrders } from "./top-price";

/** A GET against Warframe Market: path includes the version ("/v2/…"). The app passes its throttled client; scripts pass their own. */
export type WfmGet = (path: string) => Promise<Response>;

export const PRICE_TTL_MS = 45 * 60_000; // arcane prices move slowly; this keeps ~166 items cheap to keep fresh
export const STATS_TTL_MS = 12 * 60 * 60_000;

export interface PriceRow { slug: string; low: number | null; avg5: number | null; listings: number; fetched_at: string }
export interface StatsRow { slug: string; volume_48h: number | null; sold_avg_48h: number | null; stats_at: string }

export class WfmFetchError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Cheapest + average-of-cheapest-5 online rank-0 sell prices: `GET /v2/orders/item/{slug}/top?rank=0` (≈3 KB). */
export async function fetchPriceRow(get: WfmGet, slug: string, wfmSlug: string, nowIso: string): Promise<PriceRow> {
  const path = `/v2/orders/item/${encodeURIComponent(wfmSlug)}/top?rank=0`;
  const res = await get(path);
  if (!res.ok) throw new WfmFetchError(`Warframe Market ${res.status} for ${path.split("?")[0]}`, res.status);
  const json = (await res.json()) as { data?: { sell?: Parameters<typeof reduceTopOrders>[0] } };
  return { slug, ...reduceTopOrders(json.data?.sell), fetched_at: nowIso };
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
  const { priceLimit = 6, statsLimit = 2, now = Date.now() } = opts;
  const nowIso = new Date(now).toISOString();
  const [{ data: arcanes, error: e1 }, { data: prices, error: e2 }] = await Promise.all([
    sb.from("arcanes").select("slug,wfm_slug").not("wfm_slug", "is", null),
    sb.from("arcane_prices").select("slug,fetched_at,stats_at"),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const have = new Map((prices ?? []).map((p) => [p.slug as string, p as { fetched_at: string | null; stats_at: string | null }]));
  const items = (arcanes ?? []) as { slug: string; wfm_slug: string }[];

  const duePrices = pickStale(items, (a) => have.get(a.slug)?.fetched_at, now, PRICE_TTL_MS, Infinity);
  const dueStats = pickStale(items, (a) => have.get(a.slug)?.stats_at, now, STATS_TTL_MS, Infinity);
  const out: BatchResult = { prices: 0, stats: 0, remaining: { prices: duePrices.length, stats: dueStats.length }, rateLimited: false };

  try {
    for (const a of duePrices.slice(0, priceLimit)) {
      const row = await fetchPriceRow(get, a.slug, a.wfm_slug, nowIso);
      const { error } = await sb.from("arcane_prices").upsert(row, { onConflict: "slug" });
      if (error) throw new Error(error.message);
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
