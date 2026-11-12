import type { SupabaseClient } from "@supabase/supabase-js";
import { WfmFetchError, type WfmGet } from "@/lib/arcanes/refresh";
import { pickStale } from "@/lib/arcanes/top-price";

export interface SalesDay { day: string; avg: number; min: number | null; max: number | null; volume: number }

export const SALES_TTL_MS = 24 * 60 * 60_000;

interface StatRow { datetime?: string; volume?: number; min_price?: number; max_price?: number; avg_price?: number; wa_price?: number; mod_rank?: number }

/**
 * Daily closed-trade rows (`payload.statistics_closed["90days"]` from `GET /v1/items/{slug}/statistics`) -> one point per day
 * at rank 0 (items without ranks have no `mod_rank`, which counts as rank 0). Uses the volume-weighted average where given.
 */
export function reduceSales(rows: StatRow[] | null | undefined): SalesDay[] {
  const byDay = new Map<string, SalesDay>();
  for (const r of rows ?? []) {
    if ((r.mod_rank ?? 0) !== 0 || !r.datetime) continue;
    const avg = r.wa_price ?? r.avg_price;
    if (typeof avg !== "number" || !Number.isFinite(avg) || avg <= 0) continue;
    const day = r.datetime.slice(0, 10);
    const point: SalesDay = { day, avg: Math.round(avg * 10) / 10, min: r.min_price ?? null, max: r.max_price ?? null, volume: Math.max(0, Math.round(r.volume ?? 0)) };
    const have = byDay.get(day);
    byDay.set(day, have && have.volume >= point.volume ? have : point);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export async function fetchSales(get: WfmGet, wfmSlug: string): Promise<SalesDay[]> {
  const path = `/v1/items/${encodeURIComponent(wfmSlug)}/statistics`;
  const res = await get(path);
  if (!res.ok) throw new WfmFetchError(`Warframe Market ${res.status} for ${path}`, res.status);
  const json = (await res.json()) as { payload?: { statistics_closed?: { "90days"?: StatRow[] } } };
  return reduceSales(json.payload?.statistics_closed?.["90days"]);
}

export interface SalesBatchResult { refreshed: number; remaining: number; rateLimited: boolean }

/** Copies the 90-day sales history of the stalest items (oldest sync first, never-synced first). `sb` must be a service-role client. */
export async function refreshSalesBatch(sb: SupabaseClient, get: WfmGet, universe: { slug: string; wfm_slug: string }[], opts: { limit?: number; now?: number } = {}): Promise<SalesBatchResult> {
  const { limit = 6, now = Date.now() } = opts;
  const { data, error } = await sb.from("history_sync").select("slug,synced_at").limit(5000);
  if (error) throw new Error(error.message);
  const have = new Map((data ?? []).map((r) => [r.slug as string, r.synced_at as string]));
  const due = pickStale(universe, (u) => have.get(u.slug), now, SALES_TTL_MS, Infinity);
  const out: SalesBatchResult = { refreshed: 0, remaining: due.length, rateLimited: false };
  const nowIso = new Date(now).toISOString();
  try {
    for (const u of due.slice(0, limit)) {
      const days = await fetchSales(get, u.wfm_slug);
      if (days.length) {
        const { error: e } = await sb.from("sales_history").upsert(days.map((d) => ({ slug: u.slug, day: d.day, avg_price: d.avg, min_price: d.min, max_price: d.max, volume: d.volume })), { onConflict: "slug,day" });
        if (e) throw new Error(e.message);
      }
      const { error: e2 } = await sb.from("history_sync").upsert({ slug: u.slug, synced_at: nowIso }, { onConflict: "slug" });
      if (e2) throw new Error(e2.message);
      out.refreshed++; out.remaining--;
    }
  } catch (e) {
    if (e instanceof WfmFetchError && e.status === 429) out.rateLimited = true;
    else throw e;
  }
  return out;
}
