import type { SupabaseClient } from "@supabase/supabase-js";
import { pickStale } from "@/lib/arcanes/top-price";
import { WfmFetchError, type WfmGet } from "@/lib/arcanes/refresh";
import type { WfmAuction } from "@/lib/wfm/comparables";
import { summarizeWeaponListings } from "./weapon-market";

export const WEAPON_TTL_MS = 4 * 60 * 60_000;

export interface WeaponBatchResult { refreshed: number; remaining: number; rateLimited: boolean }

/** The cheapest buy-it-now rivens for a weapon: up to ~99 listings, ~100 KB. */
export async function fetchWeaponListings(get: WfmGet, slug: string): Promise<WfmAuction[]> {
  const path = `/v1/auctions/search?type=riven&weapon_url_name=${encodeURIComponent(slug)}&buyout_policy=direct&sort_by=price_asc`;
  const res = await get(path);
  if (!res.ok) throw new WfmFetchError(`Warframe Market ${res.status} for ${path.split("?")[0]}`, res.status);
  return ((await res.json()) as { payload?: { auctions?: WfmAuction[] } }).payload?.auctions ?? [];
}

/** Refresh the stalest weapon riven-market summaries and save them. `sb` must be a service-role client. */
export async function refreshWeaponBatch(sb: SupabaseClient, get: WfmGet, opts: { limit?: number; now?: number } = {}): Promise<WeaponBatchResult> {
  const { limit = 3, now = Date.now() } = opts;
  const [{ data: weapons, error: e1 }, { data: have, error: e2 }] = await Promise.all([
    sb.from("weapons").select("slug"),
    sb.from("weapon_riven_prices").select("slug,fetched_at"),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const seen = new Map((have ?? []).map((r) => [r.slug as string, r.fetched_at as string | null]));
  const due = pickStale((weapons ?? []) as { slug: string }[], (w) => seen.get(w.slug), now, WEAPON_TTL_MS, Infinity);
  const out: WeaponBatchResult = { refreshed: 0, remaining: due.length, rateLimited: false };
  const nowIso = new Date(now).toISOString();
  try {
    for (const w of due.slice(0, limit)) {
      const m = summarizeWeaponListings(await fetchWeaponListings(get, w.slug), w.slug);
      const { error } = await sb.from("weapon_riven_prices").upsert({ slug: w.slug, listings: m.listings, saturated: m.saturated, low: m.low, median: m.median, p75: m.p75, stats: m.stats, fetched_at: nowIso }, { onConflict: "slug" });
      if (error) throw new Error(error.message);
      out.refreshed++; out.remaining--;
    }
  } catch (e) {
    if (e instanceof WfmFetchError && e.status === 429) out.rateLimited = true;
    else throw e;
  }
  return out;
}
